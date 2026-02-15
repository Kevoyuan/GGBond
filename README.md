# GGBond

[English](./README.md) | [简体中文](./README.zh-CN.md)

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond - AI-Powered Intelligent Coding Assistant" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/ggbond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?include_prereleases&label=latest" alt="Latest Release" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Kevoyuan/GGBond" alt="License" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Kevoyuan/GGBond?label=build" alt="Build Status" />
  </a>
</p>

## Overview

GGBond is an AI-powered intelligent coding assistant desktop application built on top of Google Gemini CLI. It combines powerful AI coding capabilities with a modern desktop interface, providing developers with a seamless AI-assisted programming experience.

## Key Features

### Intelligent Chat Interface
- Natural language interaction with AI
- Markdown code highlighting with syntax support
- Multi-turn conversation context preservation
- Session history save and restore

### Agent System
- Built-in agents (Think, Code, Review, etc.)
- Custom agent creation and configuration
- Real-time execution status monitoring

### Conversation Visualization
- Visual conversation graph showing message branches
- Message timeline for tracking conversation flow
- Branch insights for exploring alternative paths
- Message tree structure for complex conversations

### Tool & MCP Integration
- Complete CLI tool integration with Gemini CLI
- File editing and preview capabilities
- Terminal command execution
- MCP server management panel
- MCP tool integration for extended capabilities

### Memory & Context
- Project context management
- Global memory storage with SQLite
- Automatic context loading for sessions

### Desktop Integration
- System tray with toggle functionality
- Global shortcut: `Ctrl+Shift+Space` to summon app
- Native window controls

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 16 + React 19 |
| Desktop | Electron 37 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| State Management | Zustand |
| AI Core | @google/gemini-cli-core, @google/genai |
| Database | better-sqlite3 |
| Visualization | @xyflow/react (React Flow) |
| Animation | Framer Motion |

## Installation

### Download from Release

Visit the [Releases](https://github.com/Kevoyuan/GGBond/releases) page to download the latest macOS installer:

- **DMG Installer**: `GGBond-x.x.x-arm64.dmg`
- **ZIP Portable**: `GGBond-x.x.x-arm64-mac.zip`

### Build from Source

```bash
# Clone the project
git clone https://github.com/Kevoyuan/ggbond.git
cd ggbond

# Install dependencies
npm install

# Development mode
npm run desktop:dev

# Build desktop app
npm run desktop:build
```

## Quick Start

1. Launch the GGBond application
2. Select or create a new chat session in the left sidebar
3. Enter your question or request in the input box
4. Press Enter or click the send button
5. AI will analyze your request and provide assistance

## Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| Ctrl+Shift+Space | Global app summon (toggle visibility) |
| Cmd+N | New session |
| Cmd+K | Open command palette |

## Project Structure

```
ggbond/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main application page
│   └── api/               # API routes
├── components/            # React components
│   ├── modules/           # Feature module components
│   ├── views/            # Tool view components
│   ├── message/          # Message rendering components
│   └── sidebar/          # Sidebar components
├── lib/                   # Core service library
│   ├── core-service.ts   # Core Gemini CLI integration
│   ├── gemini-service.ts # Gemini API service wrapper
│   └── db.ts             # SQLite database operations
├── stores/                # Zustand state management
├── electron/              # Electron desktop app
│   ├── main.cjs          # Main process
│   └── preload.cjs       # Preload script for IPC
└── public/                # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

MIT License

---

<p align="center">Made by <a href="https://github.com/Kevoyuan">Kevoyuan</a></p>
