# ⬡ ScanAI — AI Object Recognition Scanner

> Point your camera at anything. Get instant AI identification + live web search results. Powered by Claude Vision API.

![ScanAI](https://img.shields.io/badge/Powered%20by-Claude%20AI-00ffcc?style=flat-square&logo=anthropic)
![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-0066ff?style=flat-square&logo=github)
![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)

---

## ✦ Features

- 📷 **Live camera feed** with animated scan overlay
- 🔍 **AI object identification** using Claude Vision (claude-sonnet)
- 🌐 **Live web search** — results pulled from the web in real time
- 📊 **Confidence score** with animated bar
- 🏷️ **Auto-tagging** — category, tags, fun fact
- 🕐 **Scan history** — stored locally, tap any card to re-view
- 📱 **Mobile-ready** — works on phone camera too
- ⌨️ **Keyboard shortcut** — press `Space` to scan

---

## 🚀 Deploy to GitHub Pages (Free)

### Step 1 — Create a GitHub repo

1. Go to [github.com](https://github.com) → **New repository**
2. Name it anything (e.g. `scanai`)
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Upload the files

Upload this entire folder keeping the structure:
```
scanai/
├── index.html
├── README.md
└── assets/
    ├── style.css
    └── app.js
```

You can drag-and-drop files into GitHub's web UI, or use Git:

```bash
git init
git add .
git commit -m "Initial ScanAI deploy"
git remote add origin https://github.com/YOUR_USERNAME/scanai.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select `main` branch → `/ (root)` folder
3. Click **Save**
4. Your site will be live at: `https://YOUR_USERNAME.github.io/scanai`

---

## 🔑 Getting Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy your key (starts with `sk-ant-...`)
5. Paste it into ScanAI using the **API KEY** button in the top-right

Your key is stored only in your browser's `localStorage` — it is never sent anywhere except directly to Anthropic's API.

---

## 📁 File Structure

```
scanai/
├── index.html          ← Page structure, layout, modals
├── README.md           ← This file
└── assets/
    ├── style.css       ← All styling (dark industrial theme)
    └── app.js          ← Camera, API calls, UI, history, particles
```

---

## ⚙️ How It Works

```
User taps SCAN
      ↓
Camera frame captured as JPEG base64
      ↓
Sent to Claude claude-sonnet API with image + web_search tool
      ↓
Claude identifies the object & searches the web
      ↓
Returns structured JSON: name, confidence, tags, description, web results
      ↓
Result panel slides in with all info
```

---

## 🛠 Local Development

No build tools needed. Just open with a local server (camera requires HTTPS or localhost):

**Option A — VS Code Live Server**
- Install the "Live Server" extension
- Right-click `index.html` → Open with Live Server

**Option B — Python**
```bash
python -m http.server 8080
# visit http://localhost:8080
```

**Option C — Node**
```bash
npx serve .
```

---

## 📜 License

MIT — free to use, modify, and deploy.

---

Made with ♥ using Claude AI
