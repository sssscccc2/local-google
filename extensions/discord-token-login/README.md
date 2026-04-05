# Discord Token Login Extension

A beautiful, modern Discord Token Login browser extension with glassmorphism UI.

## 🎨 Features

- ✨ Modern glassmorphism design
- 🌈 Animated gradient background orbs
- 💾 Save multiple tokens
- 🔒 Show/hide token visibility
- 🚀 One-click login
- 📱 Auto-fetch username from token
- 🎯 Font Awesome icons

## 📦 Installation

1. **Generate Icons:**
   - Open `generate-icons.html` in your browser
   - Click "Download" for each size
   - Move downloaded files to the `icons` folder:
     - `icon16.png`
     - `icon32.png`
     - `icon48.png`
     - `icon128.png`

2. **Load Extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right corner)
   - Click "Load unpacked"
   - Select this folder

## 🔧 Usage

1. Open Discord.com
2. Click on the extension icon
3. Enter your token
4. Click "Login"
5. Page will automatically reload

## ⚠️ Warning

- **Never share your token with anyone!**
- Token gives full access to your account
- Only use on trusted computers

## 📁 File Structure

```
Discord Token Login/
├── manifest.json       # Extension configuration
├── popup.html          # Popup UI
├── popup.js            # Popup JavaScript
├── styles.css          # CSS styles
├── content.js          # Discord page script
├── background.js       # Background service worker
├── generate-icons.html # Icon generator
├── README.md           # This file
└── icons/
    ├── icon.svg        # SVG icon
    ├── icon16.png      # 16x16 icon
    ├── icon32.png      # 32x32 icon
    ├── icon48.png      # 48x48 icon
    └── icon128.png     # 128x128 icon
```

## 🎨 Design

- **Font:** Outfit (Google Fonts)
- **Icons:** Font Awesome 6.5
- **Colors:** Discord color palette
- **Effects:** Glassmorphism, gradient orbs, smooth animations

## 📄 License

This extension is for personal use only.
