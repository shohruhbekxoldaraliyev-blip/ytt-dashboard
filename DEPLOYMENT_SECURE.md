# 🔐 SECURE DEPLOYMENT GUIDE

## ⚠️ DATA PRIVACY CRITICAL

**Soliq Qo'mitasi haqiqiy ma'lumotlari GitHub'ga yukalib KETMASLIGI KERAK!**

---

## 📋 FILE CLASSIFICATION

### 🔒 **NEVER push to GitHub** (Real data)
```
real_data/
├─ real_data_ytt.csv (Soliq ma'lumotlari)
├─ real_data_pochta.csv (Qarz/Penya)
└─ .secure/
   └─ jshshir_mapping.json (PII sensitive)

1777150762520_*.xlsx (Original Soliq files)
```

### ✅ **OK to push** (Public files)
```
index.html (dashboard)
clean_data_ytt.csv (mock data - safe)
clean_data_full.csv (mock data - safe)
README.md
.gitignore
DEPLOYMENT_*.md
*.py (ETL scripts)
```

---

## 🚀 DEPLOYMENT OPTIONS

### **Option 1: Local Testing Only**
✅ Best for BMI thesis development

```bash
# Local workflow
# 1. Use real_data_ytt.csv for testing
# 2. real_data_dashboard.html for visualization
# 3. DO NOT commit to GitHub
# 4. Keep in .gitignore

git add .
git commit -m "Local development: real data testing"
# DO NOT push
```

**Result:** Real data stays local. Safe.

---

### **Option 2: GitHub + Mock Data**
✅ Best for public demo

```bash
# Setup
# 1. Keep real_data/ in .gitignore
# 2. Use clean_data_*.csv for GitHub
# 3. Dashboard works with mock data
# 4. Push publicly safe

# Files to push
- index.html (uses clean_data_ytt.csv)
- clean_data_ytt.csv (MOCK, safe)
- clean_data_full.csv (MOCK, safe)
- README.md
- .gitignore (protects real_data/)

# Verify before push
git status
# Should NOT show: real_data/ or 1777150762520_*.xlsx
```

**Result:** Public demo with mock data. Safe.

---

### **Option 3: GitHub Private Repo**
✅ Best for advisor sharing

```bash
# Create PRIVATE repo on GitHub
# Repository → Settings → Visibility → Private

# Then OK to push:
- real_data/ (protected by private repo)
- 1777150762520_*.xlsx (protected)
- All analysis files

# Only authorized users can access
# Perfect for thesis advisor review
```

**Result:** Real data shared securely. Safe.

---

## ✅ SECURITY CHECKLIST

Before pushing to ANY public GitHub:

- [ ] `git status` shows NO `real_data/`
- [ ] `git status` shows NO `.xlsx` files
- [ ] `git status` shows NO `.secure/` folder
- [ ] Dashboard uses `clean_data_*.csv` OR
- [ ] Repository is **PRIVATE** (Option 3)
- [ ] .gitignore includes `real_data/`
- [ ] .gitignore includes `*.xlsx`
- [ ] README.md explains data sources

---

## 📝 FOR BMI THESIS

**In Appendix:**

```markdown
## Data Protection

This thesis uses:
1. **Mock data** (clean_data_*.csv) for public GitHub demo
2. **Real data** (local storage only) for analysis
3. Both processed through anonymization ETL
4. JSHSHIR → YTT_XXXXXX (pseudonymized)
5. PII removed per O'zbekiston Qonuni O'RQ-547

**Real data location:** Local secure storage
**Public dashboard:** Uses anonymized mock data
**Access:** Thesis advisor by request (private repo)
```

---

## 🎯 RECOMMENDED: Hybrid Approach

**For maximum security + functionality:**

```
GitHub (PUBLIC):
├─ index.html (dashboard with mock data)
├─ clean_data_ytt.csv (safe mock)
├─ clean_data_full.csv (safe mock)
├─ README.md
└─ .gitignore (blocks real data)

Local (PRIVATE):
├─ real_data/ (Soliq files)
├─ real_data_dashboard.html
├─ 02_real_data_etl.py
└─ .secure/ (JSHSHIR mapping)
```

**Benefits:**
- ✅ Real data stays safe locally
- ✅ Public demo available (mock data)
- ✅ Advisor can access real analysis
- ✅ Thesis fully documented
- ✅ Reproducible (ETL code public)

---

## 🚨 IF ACCIDENTALLY PUSHED

**If real data committed to GitHub:**

```bash
# DO NOT just delete - must rewrite history

# Remove from all history
git filter-branch --tree-filter 'rm -rf real_data/' HEAD

# Or use BFG (cleaner)
# https://rtyley.github.io/bfg-repo-cleaner/

# Force push (careful!)
git push --force-with-lease origin main

# Notify GitHub support to purge cache
```

---

## 📞 QUESTIONS?

- Real data too large? → Use mock data
- Need advisor access? → Make repo PRIVATE
- Concerned about privacy? → Local-only (no push)
- Sharing thesis files? → Export WITHOUT data folder

**Safety First! 🔐**

