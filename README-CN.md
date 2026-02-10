# Gemini CodePilot

一个为 gemini-cli 设计的完美像素级 AI IDE 界面，提供增强的可视化和管理功能。

## 概述

Gemini CodePilot 是一个基于 Next.js 的桌面应用程序，为 Gemini CLI 工具提供图形用户界面。它提供了增强功能，如令牌使用情况可视化、MCP 服务器管理、会话历史记录以及用于 AI 辅助开发的简化聊天界面。

## 功能特性

- **现代聊天界面**: 干净、响应式的 UI，用于与 Gemini 模型交互
- **令牌使用跟踪**: 输入/输出/缓存令牌的实时可视化
- **MCP 服务器管理**: 集成管理模型上下文协议服务器
- **会话历史**: 持久的聊天会话和工作区支持
- **文件浏览器**: 集成的文件浏览和预览功能
- **设置管理**: 用于配置 Gemini CLI 设置的 GUI
- **技能集成**: 管理 AI 技能和功能
- **上下文可视化**: 清晰显示活动上下文和内存使用情况
- **多模型支持**: 轻松在不同 Gemini 模型之间切换
- **工作区管理**: 使用专用工作区组织项目

## 技术栈

- **框架**: Next.js 16.1.6
- **运行时**: React 19.2.3, React DOM 19.2.3
- **样式**: Tailwind CSS, Tailwind CSS Animate
- **UI 组件**: shadcn/ui, Lucide React 图标
- **数据库**: Better SQLite3
- **动画**: Framer Motion
- **日期工具**: date-fns
- **语法高亮**: react-syntax-highlighter
- **Markdown 渲染**: react-markdown
- **UUID 生成**: uuid
- **类型安全**: TypeScript
- **代码检查**: ESLint
- **测试**: Vitest

## 先决条件

- Node.js 18+ (推荐)
- npm 或 yarn 包管理器
- Google Gemini API 密钥或 OAuth 凭据
- 已安装并配置的 Gemini CLI

## 安装

1. 克隆仓库:
```bash
git clone https://github.com/your-username/gem-ui.git
cd gem-ui
```

2. 安装依赖:
```bash
npm install
```

3. 设置您的 Gemini API 凭据:
```bash
# 将您的 API 密钥添加到环境变量
export GEMINI_API_KEY="your-api-key-here"
```

4. 运行开发服务器:
```bash
npm run dev
```

5. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 配置

该应用程序集成了标准的 Gemini CLI 配置，位于 `~/.gemini/settings.json`。您可以通过此文件自定义 CLI 行为的各个方面，包括：

- 模型选择和参数
- MCP 服务器配置
- 工具权限和审批模式
- 上下文管理设置
- UI 首选项

## 使用方法

### 开始新聊天
1. 打开应用程序
2. 从下拉菜单中选择您首选的模型
3. 在底部的输入字段中键入您的提示
4. 按 Enter 键或单击发送按钮

### 管理会话
- 在侧边栏中查看所有以前的会话
- 单击任何会话以恢复对话
- 删除不再需要的会话
- 使用 "+" 按钮创建新聊天

### 工作区管理
- 添加工作区以专注于特定项目
- 每个工作区维护自己的上下文
- 在工作区之间无缝切换

### 令牌监控
- 在标题中监控实时令牌使用情况
- 在使用情况对话框中查看详细的使用统计信息
- 跟踪成本估算和上下文窗口使用情况

### MCP 服务器管理
- 在设置面板中查看连接的 MCP 服务器
- 管理服务器状态和配置
- 根据需要添加或删除 MCP 服务器

## 开发

### 在开发模式下运行
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 运行测试
```bash
npm run test
```

### 代码检查
```bash
npm run lint
```

## 项目结构

```
gem-ui/
├── app/                    # Next.js 应用路由器页面
│   ├── api/               # API 路由
│   ├── modules/           # 功能模块
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页面
├── components/            # 可重用的 UI 组件
├── lib/                   # 实用函数和服务
│   ├── api/              # API 帮助程序
│   ├── types/            # TypeScript 类型定义
│   ├── db.ts             # 数据库实用程序
│   ├── gemini-service.ts # Gemini CLI 集成
│   ├── gemini-utils.ts   # Gemini 实用程序
│   ├── pricing.ts        # 定价计算
│   └── utils.ts          # 通用实用程序
├── public/                # 静态资源
├── __tests__/            # 测试文件
└── ...
```

## API 集成

该应用程序通过服务层与 Gemini CLI 通信，该服务层执行 CLI 命令并解析响应。主要集成点包括：

- 通过 CLI 进程生成进行聊天补全
- 通过配置文件进行设置管理
- 从 CLI 输出进行令牌使用跟踪
- MCP 服务器管理
- 会话持久化

## 贡献

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 进行更改
4. 提交更改 (`git commit -m 'Add amazing feature'`)
5. 推送到分支 (`git push origin feature/amazing-feature`)
6. 打开 Pull Request

## 故障排除

### 常见问题

1. **找不到 Gemini CLI**: 确保 `gemini` 命令在您的 PATH 中可用
2. **API 密钥问题**: 验证您的 GEMINI_API_KEY 环境变量是否正确设置
3. **权限错误**: 检查应用程序是否具有必要的文件系统权限

### 调试

通过将 `NODE_ENV` 环境变量设置为 `development` 来启用额外的日志记录。

## 许可证

该项目根据 MIT 许可证授权 - 详见 LICENSE 文件。

## 致谢

- 使用 Next.js 和 Gemini CLI 构建
- 受现代 AI 开发工作流程启发
- UI 组件来自 shadcn/ui