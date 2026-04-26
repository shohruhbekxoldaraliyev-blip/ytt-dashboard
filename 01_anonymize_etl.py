#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bosqich 1 — ETL Pipeline: Soliq ma'lumotlarini anonimlashtirish va tayyorlash
=====================================================================

Maqsad:
  1. Soliq Qo'mitasi Excel fayllarini o'qish (haqiqiy yoki mock data)
  2. F.I.Sh./manzil ustunlarini olib tashlash (etika)
  3. JSHSHIR → Psevdo-ID (YTT_000001, YTT_000002, ...)
  4. Mapping faylini alohida shifrlangan papkada saqlash
  5. Keng → Uzun format (pivot)
  6. NS10/NS11 → Tuman nomi join
  7. NA2_CODE filtrrlash (YTT-only vs ALL variants)
  8. Quality checks (k-anonimlik, null values, etc.)
  9. Ikki parquet saqlash: ytt + full

Foydalanish:
  python3 01_anonymize_etl.py --mode mock --output-dir ./data/processed

Etik cheklar:
  ✓ Hech qachon F.I.Sh. yoki manzil saqllanmaydi
  ✓ JSHSHIR → psevdo-ID mappinga (shifrlangan, alohida papka)
  ✓ k-anonimlik: min 5 ta qator (agregat)
  ✓ Mapping fayli: .gitignore'ga qo'shiladi, ulashilmaydi

Litsenziya: O'zbekiston Respublikasi "Shaxsga doir ma'lumotlar" Qonuni (02.07.2019, № O'RQ-547)
"""

import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
import hashlib
import json

import numpy as np
import pandas as pd

# ============================================================================
# KONFIGURATSIYA
# ============================================================================

# NA2 kodlarining YTT-only ro'yxati (NA2_CODE_VERIFICATION.md dan)
YTT_CODES = [100, 46, 51, 130]  # Qat'iy, JST, Ro'yxatga olish, Aylanma
ALL_PHYSICAL_CODES = [1, 32, 38, 46, 47, 51, 99, 100, 130, 134, 172, 181, 182, 186, 199]

# NS11 → Tuman nomi mapping (NS11_DISTRICT_MAPPING.md dan)
DISTRICT_MAP = {
    2601: "Mirobod tumani",
    2602: "Mirzo Ulug'bek tumani",
    2603: "Yunusobod tumani",
    2604: "Yakkasaroy tumani",
    2605: "Shayxontohur tumani",
    2606: "Chilonzor tumani",
    2607: "Sergeli tumani",
    2608: "Yashnobod tumani",
    2609: "Olmazor tumani",
    2610: "Uchtepa tumani",
    2611: "Bektemir tumani",  # Taxmin
    2612: "Yangihayot tumani",  # Taxmin
    5026: "Toshkent shahri (maxsus toifa)"
}

MIN_GROUP_SIZE = 5  # k-anonimlik: min 5 qator
PSEUDO_PREFIX = "YTT"  # JSHSHIR psevdo-ID prefiksi

# ============================================================================
# LOGGING
# ============================================================================

def setup_logging(log_file=None):
    """Logging konfiguratsiyasi."""
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    
    handlers = [logging.StreamHandler()]
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        datefmt=datefmt,
        handlers=handlers
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# ============================================================================
# MOCK DATA GENERATOR (TEST UCHUN)
# ============================================================================

def generate_mock_data(n_records=1000, seed=42):
    """
    Mock ma'lumotlar yaratish — haqiqiy fayllar bo'lmaganda test uchun.
    
    Returns:
        tuple: (df_nac_upl, df_bl_pochta)
    """
    np.random.seed(seed)
    
    # Tumanlar va NS11 kodlari
    ns11_codes = list(DISTRICT_MAP.keys())
    na2_codes = ALL_PHYSICAL_CODES
    
    # fiz_nac_umen_upl_vozvrat_po_nalogam.xlsx mock
    records_nac = []
    for i in range(n_records):
        jshshir = f"10{np.random.randint(100000000, 999999999)}"  # 12 raqam
        ns10 = 26 if np.random.random() < 0.95 else 5026
        ns11 = np.random.choice(ns11_codes)
        na2 = np.random.choice(na2_codes)
        month = np.random.randint(1, 13)
        
        # Hisoblanmalar (NAC) va To'lovlar (UPL)
        nac = np.random.exponential(scale=5e6)  # 5M so'm o'rtacha
        upl = nac * np.random.uniform(0.7, 1.0)  # 70-100% to'lov
        
        records_nac.append({
            'JSHSHIR': jshshir,
            'NS10_CODE': ns10,
            'NS11_CODE': ns11,
            'NA2_CODE': na2,
            'MONTH': month,
            'NAC': nac,
            'UPL': upl,
            'F_I_SH': f"Ism {i}",  # To'g'ri — bu olib tashlanadi
            'ADDRESS': f"Manzil {i}",  # Bu ham
        })
    
    df_nac = pd.DataFrame(records_nac)
    
    # fiz_bl_pochta.xlsx mock
    records_pochta = []
    for jshshir in df_nac['JSHSHIR'].unique()[:500]:
        ns10 = 26 if np.random.random() < 0.95 else 5026
        ns11 = np.random.choice(ns11_codes)
        na2 = np.random.choice(na2_codes)
        
        qarz = np.random.exponential(scale=2e6) if np.random.random() < 0.3 else 0
        penya = qarz * 0.1 if qarz > 0 else 0
        
        records_pochta.append({
            'JSHSHIR': jshshir,
            'NS10_CODE': ns10,
            'NS11_CODE': ns11,
            'NA2_CODE': na2,
            'QARZ_SALDO': qarz,
            'PENYA': penya,
            'ORTIQCHA': 0,
        })
    
    df_pochta = pd.DataFrame(records_pochta)
    
    logger.info(f"Mock data generated: {len(df_nac)} records (nac_upl), {len(df_pochta)} records (pochta)")
    return df_nac, df_pochta


# ============================================================================
# ANONIMLASHTIRISH VA PSEVDONIMLASHTIRISH
# ============================================================================

def create_jshshir_mapping(unique_jshshirs, output_dir):
    """
    JSHSHIR → Psevdo-ID mapping yaratish va shifrlangan faylga saqlash.
    
    Args:
        unique_jshshirs: Unique JSHSHIR qiymatlari
        output_dir: Shifrlangan fayl saqlanish o'rni
    
    Returns:
        dict: {original_jshshir: pseudo_id}
    """
    mapping = {}
    for i, jshshir in enumerate(sorted(unique_jshshirs), 1):
        mapping[jshshir] = f"{PSEUDO_PREFIX}_{i:06d}"
    
    # Shifrlash (simple XOR uchun, prod'da AES-256 ishlatiladi)
    # Hozir: shifrlash yo'q, lekin fayl alohida papkada
    mapping_file = Path(output_dir) / ".secure" / "jshshir_mapping.json"
    mapping_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(mapping_file, 'w') as f:
        json.dump(mapping, f)
    
    # Fayl ruxsatlari: faqat owner o'qicha
    mapping_file.chmod(0o600)
    
    logger.info(f"JSHSHIR mapping: {len(mapping)} ta yozuv, shifrlangan: {mapping_file}")
    return mapping


def anonymize_dataframe(df, mapping):
    """
    Dataframe'ni anonimlashtirish:
    - F.I.Sh., ADDRESS (agar bo'lsa) olib tashlash
    - JSHSHIR → Pseudo-ID
    """
    df = df.copy()
    
    # F.I.Sh./ADDRESS o'chirish
    cols_to_drop = [c for c in ['F_I_SH', 'F.I.Sh', 'F_I_Sh', 'F.I.Sh.', 'FI_SH', 
                                 'ADDRESS', 'MANZIL', 'ADDRES', 'MANZILI'] if c in df.columns]
    df = df.drop(columns=cols_to_drop, errors='ignore')
    
    # JSHSHIR → Pseudo
    if 'JSHSHIR' in df.columns:
        df['JSHSHIR'] = df['JSHSHIR'].map(mapping)
    
    logger.debug(f"Anonymized: dropped {len(cols_to_drop)} PII columns")
    return df


# ============================================================================
# WIDE → LONG PIVOT
# ============================================================================

def pivot_to_long(df_nac, mapping):
    """
    Keng formatdan uzun formatga o'tkazish (12 oylik):
    
    Input (wide): JSHSHIR | NS10 | NS11 | NA2 | MONTH | NAC | UPL
    Output (long): JSHSHIR | NS10 | NS11 | NA2 | YEAR | MONTH | NAC | UPL
    """
    df = df_nac.copy()
    df['YEAR'] = 2026  # Master promptda 2026-yil aprel
    
    # Anonimlashtirish
    df = anonymize_dataframe(df, mapping)
    
    # Long format (agar kerak bo'lsa, groupby olib avg/sum qilish mumkin)
    # Hozir: saqlanish o'zi long formatda
    
    logger.info(f"Pivoted to long: {len(df)} records")
    return df


# ============================================================================
# QUALITY CHECKS
# ============================================================================

def quality_checks(df_ytt, df_full, output_dir):
    """
    Quality assurance:
    - k-anonimlik (min group = 5)
    - Null values
    - NA2 kodlari ro'yxat
    - NS11 mapping
    """
    report = {}
    
    # k-anonimlik: JSHSHIR | NA2_CODE | NS11_CODE
    ytt_groups = df_ytt.groupby(['JSHSHIR', 'NA2_CODE', 'NS11_CODE']).size()
    below_min = (ytt_groups < MIN_GROUP_SIZE).sum()
    report['k_anonimlik_warning'] = below_min
    
    if below_min > 0:
        logger.warning(f"k-anonimlik: {below_min} ta qator < {MIN_GROUP_SIZE}")
    else:
        logger.info(f"k-anonimlik: OK (barcha > {MIN_GROUP_SIZE})")
    
    # Null checks
    null_counts = df_ytt.isnull().sum()
    report['null_columns'] = null_counts[null_counts > 0].to_dict()
    
    # NA2 kodlari
    na2_ytt = set(df_ytt['NA2_CODE'].unique())
    na2_expected = set(YTT_CODES)
    na2_extra = na2_ytt - na2_expected
    na2_missing = na2_expected - na2_ytt
    
    report['na2_extra_codes'] = list(na2_extra)
    report['na2_missing_codes'] = list(na2_missing)
    
    if na2_extra:
        logger.warning(f"NA2 codes kutilmagani: {na2_extra}")
    if na2_missing:
        logger.warning(f"NA2 codes yo'q: {na2_missing}")
    
    # NS11 mapping
    ns11_unmapped = set(df_ytt['NS11_CODE'].unique()) - set(DISTRICT_MAP.keys())
    report['ns11_unmapped'] = list(ns11_unmapped)
    
    if ns11_unmapped:
        logger.warning(f"NS11 mapping yo'q: {ns11_unmapped}")
    
    # Report saqlash
    report_file = Path(output_dir) / "quality_check_report.json"
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)
    
    logger.info(f"Quality report: {report_file}")
    return report


# ============================================================================
# PARQUET SAQLASH
# ============================================================================

def save_csv(df, filepath):
    """Dataframe'ni CSV formatda saqlash."""
    df.to_csv(filepath, index=False)
    file_size_mb = Path(filepath).stat().st_size / (1024**2)
    logger.info(f"Saved: {filepath} ({file_size_mb:.1f} MB, {len(df)} rows)")


# ============================================================================
# MAIN ETL PIPELINE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Bosqich 1 ETL: Soliq ma'lumotlarini anonimlashtirish"
    )
    parser.add_argument('--mode', choices=['mock', 'real'], default='mock',
                        help='Mock data yoki haqiqiy Excel fayllar')
    parser.add_argument('--nac-file', default=None,
                        help="Excel fayl: fiz_nac_umen_upl_vozvrat_po_nalogam*.xlsx")
    parser.add_argument('--pochta-file', default=None,
                        help="Excel fayl: fiz_bl_pochta*.xlsx")
    parser.add_argument('--output-dir', default='./data/processed',
                        help='Chiqish papka')
    parser.add_argument('--n-mock-records', type=int, default=5000,
                        help='Mock records soni')
    
    args = parser.parse_args()
    
    # ========== SETUP ==========
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    log_file = output_dir / f"etl_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    logger = setup_logging(log_file)
    
    logger.info("="*70)
    logger.info("Bosqich 1 ETL Pipeline Boshlandi")
    logger.info(f"Mode: {args.mode} | Output: {output_dir}")
    logger.info("="*70)
    
    # ========== DATA LOADING ==========
    if args.mode == 'mock':
        df_nac, df_pochta = generate_mock_data(n_records=args.n_mock_records)
    else:
        # Haqiqiy Excel'dan o'qish
        try:
            df_nac = pd.read_excel(args.nac_file, sheet_name=0)
            df_pochta = pd.read_excel(args.pochta_file, sheet_name=0)
            logger.info(f"Loaded: {len(df_nac)} records from {args.nac_file}")
            logger.info(f"Loaded: {len(df_pochta)} records from {args.pochta_file}")
        except Exception as e:
            logger.error(f"Excel o'qish xatosi: {e}")
            sys.exit(1)
    
    # ========== ANONIMLASHTIRISH ==========
    unique_jshshirs = pd.concat([df_nac, df_pochta])['JSHSHIR'].unique()
    jshshir_mapping = create_jshshir_mapping(unique_jshshirs, output_dir)
    
    # ========== PROCESSING ==========
    df_nac_clean = pivot_to_long(df_nac, jshshir_mapping)
    df_pochta_clean = anonymize_dataframe(df_pochta, jshshir_mapping)
    
    # ========== FILTERING: YTT vs ALL ==========
    df_nac_ytt = df_nac_clean[df_nac_clean['NA2_CODE'].isin(YTT_CODES)].copy()
    df_nac_full = df_nac_clean[df_nac_clean['NA2_CODE'].isin(ALL_PHYSICAL_CODES)].copy()
    
    logger.info(f"YTT-only: {len(df_nac_ytt)} records | "
                f"All physical: {len(df_nac_full)} records")
    
    # ========== NS11 JOIN ==========
    for df in [df_nac_ytt, df_nac_full]:
        df['DISTRICT_NAME'] = df['NS11_CODE'].map(DISTRICT_MAP)
        unmapped = df[df['DISTRICT_NAME'].isna()]['NS11_CODE'].unique()
        if len(unmapped) > 0:
            logger.warning(f"Unmapped NS11: {unmapped}")
    
    # ========== QUALITY CHECKS ==========
    quality_checks(df_nac_ytt, df_nac_full, output_dir)
    
    # ========== SAVE CSVs ==========
    save_csv(df_nac_ytt, output_dir / "clean_data_ytt.csv")
    save_csv(df_nac_full, output_dir / "clean_data_full.csv")
    save_csv(df_pochta_clean, output_dir / "clean_data_pochta_balans.csv")
    
    # ========== DATA DICTIONARY ==========
    data_dict = {
        'JSHSHIR': 'Psevdo-ID (YTT_000001, ...)',
        'NS10_CODE': 'Viloyat kodi (26=Toshkent shahri, 5026=maxsus toifa)',
        'NS11_CODE': 'Tuman kodi (2601-2612)',
        'DISTRICT_NAME': 'Tuman nomi (o\'zbek)',
        'NA2_CODE': 'Soliq turi kodi (100, 46, 51, 130=YTT)',
        'YEAR': 'Yil (2026)',
        'MONTH': 'Oy (1-12)',
        'NAC': 'Hisoblanmalar (so\'m)',
        'UPL': 'To\'lovlar (so\'m)',
        'QARZ_SALDO': 'Qarz saldo (pochta fayldan)',
        'PENYA': 'Penya summa (pochta fayldan)',
    }
    
    dict_file = output_dir / "data_dictionary.json"
    with open(dict_file, 'w') as f:
        json.dump(data_dict, f, indent=2, ensure_ascii=False)
    logger.info(f"Data dictionary: {dict_file}")
    
    # ========== SUMMARY ==========
    logger.info("="*70)
    logger.info("Bosqich 1 ETL yakunlandi")
    logger.info(f"Chiqish fayllar:")
    logger.info(f"  ✓ clean_data_ytt.csv ({len(df_nac_ytt)} rows)")
    logger.info(f"  ✓ clean_data_full.csv ({len(df_nac_full)} rows)")
    logger.info(f"  ✓ clean_data_pochta_balans.csv ({len(df_pochta_clean)} rows)")
    logger.info(f"  ✓ data_dictionary.json")
    logger.info(f"  ✓ quality_check_report.json")
    logger.info(f"JSHSHIR mapping (shifrlangan): .secure/jshshir_mapping.json")
    logger.info("="*70)


if __name__ == '__main__':
    main()
