<div align="center">
  <img src="./public/icon.png" alt="GGBond Logo" width="128" />
  <h1>GGBond</h1>
</div>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/GGBond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?color=black&style=flat-square" alt="最新版本" />
  </a>
  <a href="https://github.com/Kevoyuan/GGBond/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-black.svg?style=flat-square" alt="许可证" />
  </a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-black.svg?style=flat-square" alt="平台" />
</p>

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond 截图" width="100%" />
</p>

GGBond 是一个基于 Gemini CLI 的桌面级 AI 编程工作台。
它不是“套壳聊天框”，而是把真实开发流程里最关键的能力补全：工作区隔离、会话分支可视化、工具执行可追踪、会话可回放、桌面端稳定运行。

## 为什么是 GGBond（差异化）

- 工作区优先：每次对话都绑定到明确项目目录，避免上下文漂移。
- 分支可视化：对话图谱 + 时间线，不再丢失思路和备选方案。
- 工具可观测：看得到调用了什么、改了什么、哪里失败。
- Agent 友好：内置与自定义 Agent 都能按模型/模式明确运行。
- 桌面稳定性：本地服务兜底、单实例保护、SQLite 持久化增强。

## 核心能力 🚀

### 1) ⚡️ 沉浸式 PTY 交互终端
- 完整集成 `xterm.js` 与 `node-pty`。
- 允许在应用内流畅运行交互式进程、本地服务架构或控制台调试。
- 键盘输入实时捕获代理及完整的 ANSI 高亮流式渲染。

### 2) 🤖 真正可操作的 AI 对话
- 深度融合原生 **Plan Mode** (任务计划模块)，支持直观的进度管理与状态追踪。
- 多轮对话伴随可视化网状分支，灵活回溯并试错任何路线。
- 高可用、精细优化的工具调用卡片与悬浮进度坞（A11y 加持）。

### 3) 📂 工作区即环境，开箱即用
- 一键自动生成绑定了该目录的默认会话。
- 内置文件树与代码轻量级阅读环境，免切换上下文。
- 采用独立专门设计的模块化管理界面统一调度各类 Agent、Skills 与 Hooks。

### 4) 🔍 对话过程极度透明
- 独家双重视图：分支结构鸟瞰（Graph），流式执行推演（Timeline）。
- 追踪每个工具执行流并百分比化进度。
- 彻底粉碎 AI "黑箱模式"，把决策链路展现得一览无余。

### 5) 📦 面向发布且极致瘦身
- 引进全新体积压缩流水线脚本，全方位压榨 macOS 分发包冗余，轻装上阵。
- 完善的跨会话管理机制保障单实例应用的安全防碰撞。
- 零配置以本地 SQLite 构建出坚如磐石的数据持久化方案。

## 技术栈

| 模块 | 技术 |
|---|---|
| 桌面壳 | Electron 37 |
| 应用框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript |
| 状态管理 | Zustand |
| AI 核心 | `@google/gemini-cli-core`, `@google/genai` |
| 数据存储 | `better-sqlite3` |
| 可视化 | `@xyflow/react` |
| UI/动画 | Tailwind CSS 4 + Framer Motion |

## 安装

从 [Releases](https://github.com/Kevoyuan/GGBond/releases) 下载最新版：

- `GGBond-x.x.x-arm64.dmg`（推荐）
- `GGBond-x.x.x-arm64-mac.zip`

## 3 分钟上手

1. 启动 GGBond。
2. 添加工作区（项目目录）。
3. 在 Chat 里输入明确任务。
4. 查看工具调用和文件变化。
5. 用 Graph/Timeline 从任意分支继续。

## 本地开发与构建

```bash
git clone https://github.com/Kevoyuan/GGBond.git
cd GGBond
npm install

# 桌面开发模式
npm run desktop:dev

# 构建 macOS 应用
npm run desktop:build:mac:release
```

签名与公证配置见：

- `docs/macos-release.md`

## 常见问题

### 打开应用后空白或无响应
- 先确认没有旧进程占用本地服务端口。
- 完全退出所有 GGBond 进程后重开。

### 能添加工作区但看不到文件
- 优先使用系统目录选择器授权目录。
- 在 macOS 隐私设置中补充文件访问权限（必要时 Full Disk Access）。

### Chat 出现 “Error processing request”
- 常见原因是旧实例冲突或本地状态异常。
- 完全退出应用后重启，再重试会话。

## 项目结构

```text
GGBond/
├── app/                 # Next.js 页面与 API 路由
├── components/          # UI 组件（聊天、侧栏、图谱等）
├── electron/            # 桌面主进程与 preload
├── lib/                 # 核心服务（Gemini 桥接、DB、运行时）
├── stores/              # Zustand 状态
├── scripts/             # 构建/发布辅助脚本
└── docs/                # 发布与维护文档
```

## 贡献

欢迎提 Issue 和 PR。建议在 PR 中明确：

- 改了什么
- 为什么改
- 如何验证

## 许可证

MIT

---

<p align="center">由 <a href="https://github.com/Kevoyuan">Kevoyuan</a> 开发</p>
