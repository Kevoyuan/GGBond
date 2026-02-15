# GGBond

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/ggbond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/gem-ui?include_prereleases&label=latest" alt="Latest Release" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Kevoyuan/gem-ui" alt="License" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Kevoyuan/gem-ui?label=build" alt="Build Status" />
  </a>
</p>

## Introduction

GGBond is an AI-powered intelligent coding assistant desktop application built on top of Google Gemini CLI. It combines powerful AI coding capabilities with a modern desktop interface, providing developers with a seamless AI-assisted programming experience.

## Features

### Intelligent Chat
- Natural language interaction with AI
- Markdown code highlighting with syntax support
- Multi-turn conversation context preservation
- Session history save and restore functionality

### Agent Management
- Built-in agents (Think, Code, Review, etc.)
- Custom agent creation and configuration
- Real-time agent execution status monitoring
- Visual conversation graph for session visualization

### Tool System
- Complete CLI tool integration with Gemini CLI
- File editing and preview capabilities
- Terminal command execution
- Tool call approval mechanism for security

### MCP Support
- MCP server management panel
- MCP tool integration for extended capabilities
- MCP resource access and management

### Memory System
- Project context management
- Global memory storage with SQLite
- Automatic context loading for sessions

### Hook System
- Event listener configuration
- Real-time event monitoring
- Support for onToolStart, onToolComplete, and other events

### Session Management
- Session save and restore
- Session archiving capabilities
- Checkpoint management for undo/redo
- Usage statistics and token tracking

### Workspace Management
- File browser with tree view
- Project structure visualization
- File preview and editing

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

Visit the [Releases](https://github.com/Kevoyuan/gem-ui/releases) page to download the latest macOS installer:

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

## Getting Started

### Launch the App

After installation, double-click to open GGBond app, or launch from Launchpad.

### Start a Conversation

1. Select or create a new chat session in the left sidebar
2. Enter your question or request in the input box at the bottom
3. Press Enter or click the send button
4. AI will analyze your request and provide assistance

### Using Agents

1. Click the Agent dropdown menu at the top
2. Select the desired agent type (Think, Code, Review, etc.)
3. Agents will handle specific tasks according to their expertise

### Managing MCP Servers

1. Click Tools > MCP Servers in the left sidebar
2. Add or configure MCP servers
3. Use MCP tools to extend AI capabilities

### File Operations

1. Browse project files in the Workspace section of the left sidebar
2. Click on files to preview their content
3. AI can help you edit, create, or delete files

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
│   ├── api/               # API routes for backend services
│   └── ...
├── components/            # React components
│   ├── modules/          # Feature module components
│   ├── views/            # Tool view components
│   ├── message/          # Message rendering components
│   └── sidebar/          # Sidebar components
├── lib/                   # Core service library
│   ├── core-service.ts   # Core Gemini CLI integration
│   ├── gemini-service.ts # Gemini API service wrapper
│   └── db.ts             # SQLite database operations
├── stores/                # Zustand state management
├── electron/              # Electron desktop app
│   ├── main.cjs         # Main process
│   └── preload.cjs      # Preload script for IPC
└── public/                # Static assets
```

## Contributing

Contributions are welcome. Please feel free to submit pull requests or create issues for bugs and feature requests.

## License

MIT License

---

<p align="center">Made by <a href="https://github.com/Kevoyuan">Kevoyuan</a></p>
