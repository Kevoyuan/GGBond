# GG-Bond

<p align="center">
  <img src="./public/screenshot.png" alt="GG-Bond" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/gem-ui/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/gem-ui?include_prereleases&label=latest" alt="Latest Release" />
  </a>
  <a href="https://github.com/Kevoyuan/gem-ui/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Kevoyuan/gem-ui" alt="License" />
  </a>
  <a href="https://github.com/Kevoyuan/gem-ui/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Kevoyuan/gem-ui?label=build" alt="Build Status" />
  </a>
</p>

## Introduction

GG-Bond is an AI-powered intelligent coding assistant desktop application, built on top of Google Gemini CLI. It combines powerful AI coding capabilities with a modern desktop interface, providing developers with a seamless AI-assisted programming experience.

## Features

### 💬 Intelligent Chat
- Natural language interaction
- Markdown code highlighting
- Multi-turn conversation context
- Session history save and restore

### 🤖 Agent Management
- Built-in agents (Think, Code, Review, etc.)
- Custom agent creation support
- Real-time agent execution status
- Visual conversation graph

### 🔧 Tool System
- Complete CLI tool integration
- File editing and preview
- Terminal command execution
- Tool call approval mechanism

### 🔌 MCP Support
- MCP server management panel
- MCP tool integration
- MCP resource access

### 🧠 Memory System
- Project context management
- Global memory storage
- Automatic context loading

### 🪝 Hook System
- Event listener configuration
- Real-time event monitoring
- Support for onToolStart, onToolComplete events

### 📊 Session Management
- Session save and restore
- Session archiving
- Checkpoint management
- Usage statistics

### 📁 Workspace
- File browser
- Project structure tree
- File preview

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

- **DMG Installer**: `GG-Bond-x.x.x-arm64.dmg`
- **ZIP Portable**: `GG-Bond-x.x.x-arm64-mac.zip`

### Build from Source

```bash
# Clone the project
git clone https://github.com/Kevoyuan/gem-ui.git
cd gem-ui

# Install dependencies
npm install

# Development mode
npm run desktop:dev

# Build desktop app
npm run desktop:build
```

## Getting Started

### Launch the App

After installation, double-click to open `GG-Bond` app, or launch from Launchpad.

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
| Ctrl+Shift+Space | Global app summon |
| Cmd+N | New session |
| Cmd+K | Open command palette |

## Project Structure

```
gem-ui/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main page
│   ├── api/               # API routes
│   └── ...
├── components/            # React components
│   ├── modules/          # Feature module components
│   └── views/            # View components
├── lib/                   # Core service library
│   ├── core-service.ts   # Core service
│   ├── gemini-service.ts # Gemini service
│   └── ...
├── stores/                # Zustand state management
├── electron/              # Electron desktop app
│   ├── main.cjs          # Main process
│   └── preload.cjs       # Preload script
└── public/                # Static assets
```

## Contributing

Pull Requests and Issues are welcome!

## License

MIT License

---

<p align="center">Made with ❤️ by <a href="https://github.com/Kevoyuan">Kevoyuan</a></p>
