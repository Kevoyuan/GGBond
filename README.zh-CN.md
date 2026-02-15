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

## 简介

GGBond 是一款由 AI 驱动的智能编程助手桌面应用，基于 Google Gemini CLI 构建。它将强大的 AI 编程能力与现代化的桌面界面相结合，为开发者提供流畅的 AI 辅助编程体验。

## 功能特性

### 💬 智能对话
- 自然语言交互
- Markdown 代码高亮渲染
- 支持多轮对话上下文
- 会话历史保存与恢复

### 🤖 Agent 管理
- 内置多种 Agent（Think、Code、Review 等）
- 支持自定义 Agent 创建
- Agent 运行状态实时显示
- 可视化对话图谱

### 🔧 工具系统
- 完整的 CLI 工具集成
- 文件编辑与预览
- 终端命令执行
- 工具调用审批机制

### 🔌 MCP 支持
- MCP 服务器管理面板
- MCP 工具集成
- MCP 资源访问

### 🧠 记忆系统
- 项目上下文管理
- 全局记忆存储
- 上下文自动加载

### 🪝 Hook 系统
- 事件监听器配置
- 实时事件监控
- 支持 onToolStart、onToolComplete 等多种事件

### 📊 会话管理
- 会话保存与恢复
- 会话归档功能
- 检查点管理
- 使用统计

### 📁 工作区
- 文件浏览器
- 项目结构树
- 文件预览

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 |
| 桌面框架 | Electron 37 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| AI 核心 | @google/gemini-cli-core, @google/genai |
| 数据库 | better-sqlite3 |
| 可视化 | @xyflow/react (React Flow) |
| 动画 | Framer Motion |

## 安装

### 从 Release 下载

前往 [Releases](https://github.com/Kevoyuan/gem-ui/releases) 页面下载最新版本的 macOS 安装包：

- **DMG 安装包**: `GGBond-x.x.x-arm64.dmg`
- **ZIP 便携版**: `GGBond-x.x.x-arm64-mac.zip`

### 自行构建

```bash
# 克隆项目
git clone https://github.com/Kevoyuan/ggbond.git
cd ggbond

# 安装依赖
npm install

# 开发模式
npm run desktop:dev

# 构建桌面应用
npm run desktop:build
```

## 使用指南

### 启动应用

安装完成后，双击打开 `GGBond` 应用，或从 Launchpad 中启动。

### 开始对话

1. 在左侧边栏选择或创建新的聊天会话
2. 在底部的输入框中输入你的问题或需求
3. 按 Enter 或点击发送按钮
4. AI 将会分析你的请求并提供帮助

### 使用 Agent

1. 点击顶部的 Agent 下拉菜单
2. 选择需要的 Agent 类型（Think、Code、Review 等）
3. Agent 会根据其专长处理特定任务

### 管理 MCP 服务器

1. 在左侧边栏点击 Tools > MCP Servers
2. 添加或配置 MCP 服务器
3. 使用 MCP 工具扩展 AI 能力

### 文件操作

1. 在左侧边栏的 Workspace 中浏览项目文件
2. 点击文件可预览内容
3. AI 可帮助你编辑、创建或删除文件

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+Space | 全局唤起应用 |
| Cmd+N | 新建会话 |
| Cmd+K | 打开命令面板 |

## 项目结构

```
ggbond/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主页面
│   ├── api/               # API 路由
│   └── ...
├── components/            # React 组件
│   ├── modules/          # 功能模块组件
│   └── views/            # 视图组件
├── lib/                   # 核心服务库
│   ├── core-service.ts   # 核心服务
│   ├── gemini-service.ts # Gemini 服务
│   └── ...
├── stores/                # Zustand 状态管理
├── electron/              # Electron 桌面应用
│   ├── main.cjs          # 主进程
│   └── preload.cjs       # 预加载脚本
└── public/                # 静态资源
```

## 贡献

欢迎提交 Pull Request 或创建 Issue！

## 许可证

MIT License

---

<p align="center">Made with ❤️ by <a href="https://github.com/Kevoyuan">Kevoyuan</a></p>

---

# English | 英文

GGBond is an AI-powered intelligent coding assistant desktop application, built on top of Google Gemini CLI. It combines powerful AI coding capabilities with a modern desktop interface, providing developers with a seamless AI-assisted programming experience.

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

After installation, double-click to open `GGBond` app, or launch from Launchpad.

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
ggbond/
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
