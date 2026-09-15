currently being updated to work 


<div align="center">
<img width="1536" height="1024" alt="Discord YouTube" src="./assets/banner.png" />

_A lightweight Electron wrapper for YouTube with Discord Rich Presence._

[![License](https://img.shields.io/github/license/claudemods/Discord-YouTube?color=blue)](LICENSE)
</div>

---

## 🌟 Features

- 🖥️ Full-quality streaming (auto-selects highest available)
- 📌 Picture-in-picture button in the player control bar
- 🧠 Discord Rich Presence — video title, channel, progress timer
- 🔗 "Watch on YouTube" button in your Discord activity
- 🏠 Overlay / interstitial cleanup
- 🖱️ Smooth scroll
- 📋 Auto update notifier

---

## 📥 Download

Prebuilt installers will be available on the [releases page](https://github.com/claudemods/Discord-YouTube/releases) once the first build is published.

---

## 🛠️ Building It Yourself

### Prerequisites

- [Node.js](https://nodejs.org/en/) v18 or v20 (LTS recommended)
- [Git](https://git-scm.com/)

### Supported Platforms

- ✅ Windows
- ✅ Linux
- ✅ macOS

### Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
npm start

# 3. Build a distributable installer for your current OS
npm run winbuild    # Windows
npm run macbuild    # macOS
npm run linbuild    # Linux
