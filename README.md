<div align="center">

# 🎨 VFF Teaching Studio
### High-Performance Client-Side Online Whiteboard & PDF Annotation Canvas for Educators

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Launch%20Whiteboard-2563eb?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.victoryfluentforum.com/tools/online-whiteboard)
[![Official Platform](https://img.shields.io/badge/Official%20Platform-Victory%20Fluent%20Forum-f59e0b?style=for-the-badge&logo=safari&logoColor=white)](https://www.victoryfluentforum.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Zero Backend](https://img.shields.io/badge/Backend-100%25%20Client--Side-purple?style=for-the-badge)](#architecture)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Data%20Collection-blue?style=for-the-badge)](#privacy--security)

<br/>

**VFF Teaching Studio** is a standalone, browser-based digital whiteboard and lesson presentation surface engineered specifically for live tutors, classroom teachers, and homeschool educators. 

Built with pure Vanilla HTML5 Canvas and modern JavaScript, it runs **100% in your browser** with **zero server dependencies, zero required logins, and complete offline capability**.

[**Try the Official Live Web App**](https://www.victoryfluentforum.com/tools/online-whiteboard) • [**Report Bug**](https://github.com/Zarabagwan/vff-teaching-studio/issues) • [**Request Feature**](https://github.com/Zarabagwan/vff-teaching-studio/issues)

</div>

---

## 🌟 Key Highlights

- ⚡ **100% Client-Side & Instant Load:** Zero backend servers, zero database setups, zero configuration. Works immediately on any browser.
- 📄 **Multi-Page PDF Worksheet Annotation:** Import worksheets, textbooks, or homework PDFs directly onto canvas slides with multi-page navigation and precision drawing overlay.
- 🎯 **Educator Tool Palette:** Pens, fine-line highlighters, smart geometric shapes (rectangles, circles, arrows, lines), custom text formatting, and precision erasers.
- 📑 **Infinite Multi-Slide Management:** Add, delete, duplicate, and switch between classroom board slides during a live lecture.
- 🎨 **Dual Theme Support:** Seamless toggle between clean Light Paper theme and ultra-dark OLED Night Classroom mode.
- 💾 **Export & Session Continuity:** Export full boards to PNG images or high-resolution vector PDFs. Board states persist across page refreshes via secure browser LocalStorage.
- 🔒 **Zero Data Collection & Complete Privacy:** No student data, audio, or canvas drawings ever leave your local machine.

---

## 🚀 Quick Start (Local Setup)

Because VFF Teaching Studio is 100% static client-side software, you can run it locally with any lightweight static HTTP server in seconds.

### Option 1: Using `npx serve` (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/Zarabagwan/vff-teaching-studio.git
cd vff-teaching-studio

# 2. Start local static server
npx serve . -p 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Using Python 3

```bash
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 3: Using VS Code Live Server
Simply right-click [`index.html`](index.html) and select **"Open with Live Server"**.

---

## 🏗️ Architecture & Directory Structure

VFF Teaching Studio is designed with modularity, performance, and complete isolation:

```text
vff-teaching-studio/
├── index.html              # Main standalone application shell & UI
├── css/
│   ├── whiteboard.css      # Core canvas drawing & toolbar styles
│   ├── toolhub-core.css    # VFF SaaS design system, layout, & buttons
│   └── theme.css           # Light and Dark theme design tokens
├── js/
│   ├── whiteboard.js       # Complete canvas engine, PDF loader, and event handlers
│   └── toolhub-core.js     # UI utilities, theme switcher, and clipboard helpers
├── vendor/
│   ├── pdf.min.js          # Standalone PDF.js rendering engine
│   ├── pdf.worker.min.js   # Background PDF rendering web worker
│   └── cmaps/              # High-compatibility font CMaps for foreign text
├── assets/
│   ├── logo.jpg            # Platform emblem
│   ├── favicon.png         # Browser favicon
│   └── preview.webp        # Social graph & metadata preview
├── package.json            # Tool manifest and npm serve scripts
├── LICENSE                 # Open-source MIT License
└── README.md               # Documentation & usage guide
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `P` | Switch to Pen Tool |
| `H` | Switch to Highlighter |
| `E` | Switch to Eraser |
| `T` | Insert Text Block |
| `S` | Select Shapes Menu |
| `Ctrl + Z` / `Cmd + Z` | Undo last stroke |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo stroke |
| `Ctrl + S` | Save current board as image |
| `Delete` / `Backspace` | Delete selected shape or annotation |

---

## 🛡️ Privacy & Security

- **No Remote Tracking:** Does not communicate with third-party tracking or analytics endpoints.
- **Zero Credentials:** Contains zero API keys, secrets, authentication headers, or backend URLs.
- **COPPA & FERPA Friendly:** Safe for K-12 school environments and tutoring services because no student information or personally identifiable information (PII) is gathered or sent over the wire.

---

## 🌐 Official Platform & Links

- **Official Live Web Tool:** [Victory Fluent Forum - Online Whiteboard](https://www.victoryfluentforum.com/tools/online-whiteboard)
- **Official Home Platform:** [Victory Fluent Forum](https://www.victoryfluentforum.com/)
- **Educator Workbooks & Resources:** [VFF Resources](https://www.victoryfluentforum.com/resources)
- **Public Speaking & Writing Programs:** [VFF Flagship Programs](https://www.victoryfluentforum.com/programs)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details. Free for personal, commercial, and educational use.
