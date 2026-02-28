<div align="center">
  <img src="./public/icon.png" alt="GGBond Logo" width="128" />
  <h1>GGBond 🕶️</h1>
  <p><strong>Your Personal Desktop AI Coding Cockpit, Powered by Gemini & Tauri.</strong></p>
</div>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/GGBond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?color=black&style=for-the-badge" alt="Latest release" />
  </a>
  <a href="https://www.npmjs.com/package/@google/gemini-cli-core">
    <img src="https://img.shields.io/npm/v/%40google%2Fgemini-cli-core?style=for-the-badge&label=gemini-cli-core" alt="gemini-cli-core" />
  </a>
  <a href="https://github.com/Kevoyuan/GGBond/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-black.svg?style=for-the-badge" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Desktop-Tauri%202-black.svg?style=for-the-badge&logo=tauri&logoColor=white" alt="Desktop" />
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-black.svg?style=for-the-badge&logo=apple&logoColor=white" alt="Platform" />
</p>

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond screenshot" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" width="100%" />
</p>

GGBond is not just another terminal wrapper—it's a full-fledged **desktop AI coding cockpit** built on top of the Gemini CLI, now supercharged with a Tauri + Rust runtime. Designed for developers who value speed, context, and intelligent workflows.

---

## ✨ Why GGBond?

*   ⚡️ **Blazing Fast Terminal**: Rust-backed terminal streaming via `portable-pty` for instantaneous, ultra-responsive command execution.
*   🧠 **Visual AI Workflow**: See your thoughts turn into action with an intuitive branch graph, a rich timeline, and a dedicated **Plan Mode** for tracking progress.
*   🔒 **Workspace First**: All your sessions are securely maintained with local SQLite persistence. Switch projects without losing AI context.
*   📦 **Featherweight Core**: Aggressively optimized Tauri packaging ensures a minimal resource footprint while delivering desktop-class power.

## 🏗 Architecture

GGBond seamlessly bridges modern web tech with bare-metal performance:

*   **Frontend**: Next.js 15 + React 19 (driving the desktop webview UI).
*   **Desktop Shell & Runtime**: Tauri 2, bundled with a Next standalone server for flawless `/api/*` parity.
*   **System Bridge**: Rust (`src-tauri`) handles typed commands (`invoke`) and robust background tasks.
*   **Terminal Pipeline**: Event-driven PTY streams (`pty-stream-*`) manage inputs, outputs, and execution controls effortlessly.

## 🛠 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Core Shell** | ![Tauri](https://img.shields.io/badge/Tauri2-24C8DB?style=flat-square&logo=tauri&logoColor=white) ![Rust](https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white) |
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js%2015-black?style=flat-square&logo=next.js&logoColor=white) ![React](https://img.shields.io/badge/React%2019-20232A?style=flat-square&logo=react&logoColor=61DAFB) |
| **UI & Styling** | ![TailwindCSS](https://img.shields.io/badge/Tailwind_4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) ![Framer](https://img.shields.io/badge/Framer_Motion-black?style=flat-square&logo=framer&logoColor=white) |
| **Terminal** | `xterm.js` + `portable-pty` |
| **Database** | `better-sqlite3` |

## 🚀 Quick Download

Grab the latest version from our [Releases page](https://github.com/Kevoyuan/GGBond/releases):

*   🍏 **macOS (Apple Silicon)**: `ggbond_<version>_aarch64.dmg`
*   🪟 **Windows**: `ggbond_<version>_x64-setup.exe`

> **Note**: Official release artifacts are code-signed. macOS release builds are notarized in CI, so you can launch GGBond right out of the box without running any manual `xattr` tricks!

## 💻 Developer Setup

Excited to tinker with GGBond? Here's how to get your environment ready:

```bash
git clone https://github.com/Kevoyuan/GGBond.git
cd GGBond
npm install

# Start the Web UI development server
npm run dev

# Start the Tauri desktop development app
npm run tauri dev
```

## 📦 Building for Production

```bash
# 1. Build the frontend and prepare it for Tauri consumption
npm run build:tauri-dist

# 2. Package the desktop app for your current host OS
npm run tauri build
```

## 📂 Project Structure

```text
GGBond/
├── app/                 # Next.js pages & API routes
├── components/          # Reusable React components
├── lib/                 # Frontend state & runtime services
├── scripts/             # Build automation & utility scripts
├── src-tauri/           # Rust native codebase & Tauri config
└── docs/                # Operational guidelines & release docs
```

## 📄 License

This project is licensed under the [MIT License](./LICENSE). Build great things!
