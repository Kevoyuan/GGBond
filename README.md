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
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-black.svg?style=flat-square" alt="Platform" />
</p>

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond screenshot" width="100%" />
</p>

GGBond is a desktop-first AI coding cockpit built on top of Gemini CLI.
It keeps the raw power of CLI workflows, but adds the missing pieces serious development needs: visual conversation branches, workspace isolation, session replay, tool-level transparency, and a practical UI for daily use.

## Why GGBond (What makes it different)

- Workspace-first: each chat runs in a concrete project directory, not a vague global context.
- Branch-aware conversations: inspect timeline + graph, revisit branches, and continue from any node.
- Tool transparency: see what tools were called, what changed, and what failed.
- Agent workflow ready: run with built-in or custom agents, with explicit model/mode behavior.
- Desktop reliability: local service fallback, single-instance protection, and stable SQLite persistence.

## Feature Highlights 🚀

### 1) ⚡️ Fully Interactive Built-in PTY Terminal
- Complete `xterm.js` and `node-pty` integration.
- Run interactive processes, dev servers, or REPLs directly in the app.
- Full proxy of keyboard input and ANSI output formatting.

### 2) 🤖 AI Chat That Is Actually Operable
- Native **Plan Mode** execution tracking with rich visual progress.
- Multi-turn coding chat with deep session history and message branching.
- Adaptive UI elements and accessibility tools.

### 3) 📂 Workspace + File Ops in One Place
- Zero-config auto-created sessions on workspace addition.
- Built-in file tree and file viewer/editor for project inspection.
- Granular Module Management UI covering Hooks, Skills, and Agents.

### 4) 🔍 Visual Debuggability for AI Sessions
- Graph view for branch structure and chronological Timeline view.
- Per-message and per-tool visibility with percentage progress tracking.
- Eliminating the "AI black box" one UI component at a time.

### 5) 📦 Production-Oriented & Ultra-lightweight
- Aggressive post-pack pruning scripts to dramatically reduce macOS app size.
- Signed macOS build flow + optional notarization pipeline.
- Rock-solid local SQLite storage with strict single-instance locking.

## Tech Stack

| Area | Stack |
|---|---|
| Desktop shell | Electron 37 |
| App framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| State | Zustand |
| AI core | `@google/gemini-cli-core`, `@google/genai` |
| Storage | `better-sqlite3` |
| Visual graph | `@xyflow/react` |
| Motion/UI | Framer Motion + Tailwind CSS 4 |

## Install

Download the latest build from [Releases](https://github.com/Kevoyuan/GGBond/releases):

- `GGBond-x.x.x-arm64.dmg` (recommended)
- `GGBond-x.x.x-arm64-mac.zip`

## Quick Start (First 3 Minutes)

1. Launch GGBond.
2. Add a workspace (project folder).
3. Open Chat view and ask for a concrete task.
4. Inspect tool calls and file changes.
5. Use Graph/Timeline to continue from the branch you want.

## Build From Source

```bash
git clone https://github.com/Kevoyuan/GGBond.git
cd GGBond
npm install

# Desktop dev
npm run desktop:dev

# Build macOS app
npm run desktop:build:mac:release
```

For signing/notarization setup, see:

- `docs/macos-release.md`

## Common Issues

### App opens but blank / no response
- Ensure no stale old app process is occupying local runtime port.
- Quit all GGBond processes and reopen.

### Workspace added but cannot read files
- Prefer folder picker authorization first.
- On macOS, grant Files/Folders or Full Disk Access if needed.

### "Error processing request" in chat
- Usually caused by stale local runtime state or parallel old instances.
- Fully quit app, relaunch, and retry session.

## Project Structure

```text
GGBond/
├── app/                 # Next.js app + API routes
├── components/          # UI components (chat, sidebar, graph, etc.)
├── electron/            # Desktop main/preload process
├── lib/                 # Core services (Gemini bridge, DB, runtime logic)
├── stores/              # Zustand stores
├── scripts/             # Build/release helper scripts
└── docs/                # Release and operational docs
```

## Contributing

Issues and PRs are welcome.
If you open a PR, include:

- what changed
- why it changed
- how to verify it

## License

MIT

---

<p align="center">Built by <a href="https://github.com/Kevoyuan">Kevoyuan</a></p>
