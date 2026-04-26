# YTT Soliq Tushumlari Dashboard

**Live Demo:** https://yourusername.github.io/ytt-dashboard/

Toshkent shahar Soliq Qo'mitasi uchun yakka tartibdagi tadbirkorlar (YTT) soliq tushumlari analitik dashboardi.

## 📊 Xususiyatlari

- ✅ **Real-time data visualization** — CSV fayllardan ma'lumotlar
- ✅ **Dual-mode toggle** — YTT-only vs Barcha jismoniy rejimlar
- ✅ **12 ta tuman tahlili** — Toshkent shaharining barcha tumanlari
- ✅ **Interactive charts** — D3.js + Chart.js
- ✅ **Responsive design** — Desktop, tablet, mobile
- ✅ **Privacy-first** — JSHSHIR psevdonimlashtirish, PII o'chirilgan

## 🚀 Ishlatish

1. Brauzer'da ochish: `index.html`
2. Yuklangandan keyin CSV fayllar avtomatik yuklanadi
3. Mode toggle: "YTT" ↔ "Barcha jismoniy"
4. Tabs: Asosiy oyna, Tumanlar reytingi, Dinamika

## 📁 Fayllar

- `index.html` — Main dashboard (Papa Parse + Chart.js + D3)
- `clean_data_ytt.csv` — 1,312 ta YTT record (mock)
- `clean_data_full.csv` — 5,000 ta record (all physical persons)

## 🔐 Data Privacy

- JSHSHIR → Psevdo-ID (YTT_000001, ...)
- F.I.Sh. va manzil o'chirilgan
- k-anonimlik: minimal 5 ta qator
- O'zbekiston Qonuni O'RQ-547 asosida

## 📚 Texnologiyalar

- **Frontend:** HTML5, CSS3, Vanilla JS
- **Data parsing:** Papa Parse (CSV reader)
- **Visualization:** Chart.js (charts), D3.js (potential maps)
- **Hosting:** GitHub Pages (static)

## 📝 License

TDIU Bachelor Thesis Project (2026)

---

**Muallif:** Shohrux, TDIU, Data Analyst  
**Tarix:** April 2026  
**Sozov:** Toshkent shahar Soliq Qo'mitasi
