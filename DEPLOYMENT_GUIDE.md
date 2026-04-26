# 🚀 YTT Dashboard — GitHub Pages Deployment Guide

**Quick Setup: 5 minutes**

---

## 📌 Prerequisites

- GitHub account (github.com)
- Git installed on your computer (`git --version`)
- This folder with all files:
  - `index.html`
  - `clean_data_ytt.csv`
  - `clean_data_full.csv`
  - `README.md`
  - `.gitignore`

---

## 🔧 Setup Instructions

### **1️⃣ Create GitHub Repository**

1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** `ytt-dashboard`
   - **Description:** "YTT Soliq Tushumlari Dashboard - Toshkent"
   - **Visibility:** Public ✅
3. Click **Create repository**
4. Copy the HTTPS URL (looks like: `https://github.com/yourusername/ytt-dashboard.git`)

### **2️⃣ Push Files to GitHub**

Open Terminal/Command Prompt in this folder:

```bash
# Initialize git
git init

# Add all files
git add index.html clean_data_ytt.csv clean_data_full.csv README.md .gitignore

# Configure git (use your info)
git config user.email "your.email@example.com"
git config user.name "Your Name"

# Create first commit
git commit -m "🚀 Initial commit: YTT Dashboard"

# Add remote (replace URL with your repo's HTTPS URL)
git remote add origin https://github.com/yourusername/ytt-dashboard.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**You'll be asked for GitHub credentials:**
- Username: Your GitHub username
- Password: Your GitHub password OR Personal Access Token (if 2FA enabled)

### **3️⃣ Enable GitHub Pages**

1. Go to your repo: `https://github.com/yourusername/ytt-dashboard`
2. Click **Settings** (top right)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - **Source:** Select "Deploy from a branch"
   - **Branch:** Select `main`
   - **Folder:** Select `/ (root)`
5. Click **Save**

### **4️⃣ Wait for Deployment**

⏳ GitHub will deploy your site in 1-2 minutes.

Check for green checkmark at: https://github.com/yourusername/ytt-dashboard/deployments

### **5️⃣ Visit Your Dashboard!**

🎉 **Your dashboard is now live at:**

```
https://yourusername.github.io/ytt-dashboard/
```

Replace `yourusername` with your actual GitHub username.

---

## ✅ Testing

When you visit the URL:

1. **Page loads:** Dashboard HTML renders (check!)
2. **Loading message:** "⏳ Ma'lumotlar yuklanmoqda..."
3. **CSV loads:** Data aggregates from CSV
4. **Dashboard renders:** KPI cards, tables, charts appear
5. **Mode toggle:** Click "YTT" ↔ "Barcha jismoniy" (switches data)
6. **Charts update:** Real-time (0.4 seconds)

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| 404 Error | Pages not enabled. Go to Settings → Pages and check "Deploy from a branch" is selected |
| Blank page | Open F12 (Developer Tools) → Console tab. Check for errors. CSV file path must be correct |
| CSV not found | Make sure `clean_data_ytt.csv` is in the root folder of your repo |
| Slow loading | Normal (first load ~2-3 seconds for CSV parse). Refresh if needed |
| Mode toggle doesn't work | Check browser console for JavaScript errors (F12 → Console) |

---

## 📝 Update Your Dashboard

To update data or code:

```bash
# Make changes to files locally
# Then:

git add .
git commit -m "Update: Add new data for May 2026"
git push
```

GitHub will automatically redeploy (1-2 minutes).

---

## 🔐 Important Notes

✅ **Privacy:**
- All data is anonymized (JSHSHIR → YTT_000001, etc.)
- F.I.Sh. and addresses removed
- CSV files contain no sensitive PII

✅ **Performance:**
- Dashboard is static (no server needed)
- CSV parsing happens in browser (client-side)
- No data sent to external servers

✅ **Licensing:**
- TDIU Bachelor Thesis Project
- GitHub Pages hosting: Free
- Code: Open source (add LICENSE if desired)

---

## 📚 Resources

- GitHub Pages Docs: https://pages.github.com/
- Git Basics: https://git-scm.com/book/en/v2/Getting-Started-The-Basics
- Markdown Guide: https://www.markdownguide.org/

---

**Questions?** Check your repo's GitHub Issues tab or re-read this guide.

**Ready?** Start with Step 1: Create GitHub Repository 👆

---

**Dashboard Version:** v2 (CSV-enabled)  
**Created:** April 25, 2026  
**For:** Shohrux, TDIU, Data Analyst
