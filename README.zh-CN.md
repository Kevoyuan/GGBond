# GGBond

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond - AI 智能编程助手" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/ggbond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?include_prereleases&label=latest" alt="最新版本" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Kevoyuan/GGBond" alt="许可证" />
  </a>
  <a href="https://github.com/Kevoyuan/ggbond/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Kevoyuan/GGBond?label=构建" alt="构建状态" />
  </a>
</p>

## 简介

GGBond 是一款由 AI 驱动的智能编程助手桌面应用，基于 Google Gemini CLI 构建。它将强大的 AI 编程能力与现代化的桌面界面相结合，为开发者提供流畅的 AI 辅助编程体验。

## 核心功能

### 💬 智能对话界面
- 自然语言与 AI 交互
- Markdown 代码高亮渲染，支持语法高亮
- 多轮对话上下文保持
- 会话历史保存与恢复

### 🤖 Agent 系统
- 内置多种 Agent（Think、Code、Review 等）
- 支持自定义 Agent 创建与配置
- 实时运行状态监控

### 🌐 对话可视化
- 可视化对话图谱，展示消息分支结构
- 消息时间线，追踪对话流程
- 分支洞察，探索备选对话路径
- 消息树结构，展示复杂对话关系

### 🔧 工具与 MCP 集成
- 完整的 CLI 工具集成
- 文件编辑与预览功能
- 终端命令执行
- MCP 服务器管理面板
- MCP 工具集成，扩展 AI 能力

### 🧠 记忆与上下文
- 项目上下文管理
- SQLite 全局记忆存储
- 上下文自动加载到会话

### 🖥️ 桌面集成
- 系统托盘，支持显示/隐藏切换
- 全局快捷键：`Ctrl+Shift+Space` 唤起应用
- 原生窗口控制
- **极致性能**：全面启用硬件加速和会话缓存，UI 流畅如丝
- **体积优化**：配置 Next.js `optimizePackageImports` 以加快加载速度

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 |
| 桌面框架 | Electron 37 |
| 编程语言 | TypeScript |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| AI 核心 | @google/gemini-cli-core, @google/genai |
| 数据库 | better-sqlite3 |
| 可视化 | @xyflow/react (React Flow) |
| 动画 | Framer Motion |

## 安装

### 从 Release 下载

前往 [Releases](https://github.com/Kevoyuan/GGBond/releases) 页面下载最新版本的 macOS 安装包：

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

## 快速开始

1. 启动 GGBond 应用程序
2. 在左侧边栏选择或创建新的聊天会话
3. 在底部的输入框中输入你的问题或需求
4. 按 Enter 或点击发送按钮
5. AI 将会分析你的请求并提供帮助

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+Space | 全局唤起应用（显示/隐藏切换） |
| Cmd+N | 新建会话 |
| Cmd+K | 打开命令面板 |

## 项目结构

```
ggbond/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主页面
│   └── api/               # API 路由
├── components/            # React 组件
│   ├── modules/           # 功能模块组件
│   ├── views/             # 视图组件
│   ├── message/           # 消息渲染组件
│   └── sidebar/          # 侧边栏组件
├── lib/                   # 核心服务库
│   ├── core-service.ts   # 核心 Gemini CLI 集成
│   ├── gemini-service.ts # Gemini API 服务封装
│   └── db.ts             # SQLite 数据库操作
├── stores/                # Zustand 状态管理
├── electron/              # Electron 桌面应用
│   ├── main.cjs          # 主进程
│   └── preload.cjs       # 预加载脚本
└── public/                # 静态资源
```

## 贡献

欢迎提交 Pull Request 或创建 Issue 报告 bug 和提出功能建议！

## 许可证

MIT License

---

<p align="center">由 <a href="https://github.com/Kevoyuan">Kevoyuan</a> ❤️ 开发</p>
