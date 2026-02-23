<div align="center">
  <img src="./public/icon.png" alt="GGBond Logo" width="128" />
  <h1>GGBond</h1>
</div>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/GGBond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?color=black&style=flat-square" alt="Latest release" />
  </a>
  <a href="https://github.com/Kevoyuan/GGBond/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-black.svg?style=flat-square" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Desktop-Tauri%202-black.svg?style=flat-square" alt="Desktop" />
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-black.svg?style=flat-square" alt="Platform" />
</p>

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond screenshot" width="100%" />
</p>

GGBond is a desktop AI coding cockpit built on top of Gemini CLI, now powered by a Tauri + Rust runtime.

## Highlights

- Rust-backed terminal streaming (`portable-pty`) for responsive command execution.
- Visual AI workflow with branch graph + timeline and Plan Mode progress.
- Workspace-first sessions with local SQLite persistence.
- Lightweight Tauri packaging with optimized release profile.

## Architecture

- Frontend: Next.js + React UI (desktop webview content).
- Desktop shell: Tauri 2.
- Runtime commands: Rust (`src-tauri`) with typed command bridge (`invoke`).
- Terminal pipeline: PTY stream events (`pty-stream-*`) and command/input/stop controls.

## Tech Stack

| Area | Stack |
|---|---|
| Desktop runtime | Tauri 2 |
| Frontend | Next.js 15 + React 19 |
| Language | TypeScript + Rust |
| Terminal | `xterm` + Rust `portable-pty` |
| Storage | `better-sqlite3` |
| UI | Tailwind CSS 4 + Framer Motion |

## Install

Download from [Releases](https://github.com/Kevoyuan/GGBond/releases):

- macOS (Apple Silicon): `ggbond_<version>_aarch64.dmg`
- Windows installer: `ggbond_<version>_x64-setup.exe` (or NSIS/MSI depending on target)

## Development

```bash
git clone https://github.com/Kevoyuan/GGBond.git
cd GGBond
npm install

# Web dev for UI
npm run dev

# Tauri dev (desktop)
npm run tauri dev
```

## Build

```bash
# Build frontend and prepare dist for Tauri
npm run build:tauri-dist

# Build desktop package for current host
npm run tauri build
```

## Project Structure

```text
GGBond/
├── app/                 # Next.js pages and API routes
├── components/          # UI components
├── lib/                 # Frontend/runtime services
├── scripts/             # Build and utility scripts
├── src-tauri/           # Rust runtime and Tauri config
└── docs/                # Operational and release docs
```

## License

MIT
