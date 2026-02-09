# Gemini CLI GUI 深度定制可视化设计方案

## 📋 概述

基于对 Gemini CLI 功能的全面分析，以下是为该工具设计 GUI 的详细建议，涵盖所有核心功能模块、相关 API/CLI 用法和值得深度定制的可视化组件。

---

## 🎯 核心功能模块与 API

### 1. 💬 对话与聊天界面

#### 相关命令与 API

```bash
# 启动交互式会话
gemini

# 非交互模式（脚本用）
gemini -p "Your prompt here"
gemini -p "Your prompt" --output-format json
gemini -p "Your prompt" --output-format stream-json

# 指定模型
gemini -m gemini-2.5-pro
gemini -m gemini-3-flash-preview
```

#### Slash 命令
```bash
/chat save <tag>      # 保存对话检查点
/chat list            # 列出所有保存的对话
/chat resume <tag>    # 恢复对话
/chat delete <tag>    # 删除检查点
/chat share [file]    # 导出对话为 Markdown/JSON

/compress             # 压缩上下文（生成摘要）
/clear                # 清屏 (Ctrl+L)
/copy                 # 复制最后输出到剪贴板
/rewind               # 回退对话历史
/restore [tool_id]    # 恢复文件到工具执行前状态
/resume               # 浏览并恢复之前的会话
```

#### 深度定制建议
| 功能 | 可视化方案 | API 支持 | 价值 |
|------|-----------|----------|------|
| **Checkpointing 检查点** | 时间线视图，可点击任意节点回溯 | `/chat save/resume/list` | ⭐⭐⭐⭐⭐ |
| **对话分支** | 树形图展示对话分叉路径 | `/rewind`, `/restore` | ⭐⭐⭐⭐⭐ |
| **会话浏览器** | 列表+搜索+预览 | `/resume` | ⭐⭐⭐⭐ |
| **对话导出** | 一键导出 MD/JSON | `/chat share` | ⭐⭐⭐ |

---

### 2. 📊 Token 使用监控（高优先级）

#### 相关命令
```bash
/stats    # 显示当前会话统计：Token 使用、缓存节省、会话时长
```

#### settings.json 配置
```json
{
  "ui": {
    "footer": {
      "hideModelInfo": false,
      "hideContextPercentage": false  // 显示上下文窗口百分比
    },
    "showMemoryUsage": true  // 显示内存使用
  },
  "model": {
    "compressionThreshold": 0.5,  // 上下文压缩阈值
    "maxSessionTurns": -1,  // 最大轮次 (-1=无限)
    "summarizeToolOutput": {
      "run_shell_command": { "tokenBudget": 2000 }
    }
  }
}
```

#### 关键指标
```
┌─────────────────────────────────────────────────┐
│  Token Usage Dashboard                          │
├─────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Input   │  │ Output  │  │ Cached  │         │
│  │ 15,234  │  │ 8,456   │  │ 45,000  │         │
│  └─────────┘  └─────────┘  └─────────┘         │
│                                                 │
│  Context Window: ████████████░░░░ 78% (780K/1M)│
│                                                 │
│  Daily Quota:    ████████░░░░░░░░ 52% (520/1000)│
│  Rate Limit:     ████░░░░░░░░░░░░ 27% (16/60/min)│
└─────────────────────────────────────────────────┘
```

#### 深度定制建议
| 功能 | 可视化方案 | 数据来源 | 价值 |
|------|-----------|----------|------|
| **实时 Token 流** | 动态数字滚动 + 折线图 | `/stats` 输出解析 | ⭐⭐⭐⭐⭐ |
| **上下文窗口仪表盘** | 环形进度条（1M token） | Footer context percentage | ⭐⭐⭐⭐⭐ |
| **Token 缓存命中率** | 堆叠柱状图 | `/stats` cached tokens | ⭐⭐⭐⭐ |
| **成本估算器** | 实时美元估算 | Token count × price | ⭐⭐⭐⭐⭐ |
| **压缩提示** | 警告 banner | `compressionThreshold` | ⭐⭐⭐⭐ |

---

### 3. 🔧 内置工具管理

#### 工具列表命令
```bash
/tools            # 显示可用工具列表
/tools desc       # 显示工具详细描述
/tools nodesc     # 只显示工具名
```

#### 内置工具 API

##### 文件系统工具
```javascript
// 1. list_directory (ReadFolder)
list_directory({
  path: "/absolute/path",           // 必需：绝对路径
  ignore: ["*.log", ".git"],        // 可选：忽略模式
  respect_git_ignore: true          // 可选：遵循 .gitignore
})
// 返回: "Directory listing for /path:\n[DIR] subfolder\nfile.txt"

// 2. read_file (ReadFile)
read_file({
  path: "/absolute/path/file.txt",  // 必需：绝对路径
  offset: 0,                         // 可选：起始行号
  limit: 100                         // 可选：读取行数
})
// 支持: 文本、图片(PNG/JPG/GIF/WEBP/SVG)、音频(MP3/WAV)、PDF

// 3. write_file (WriteFile) - 需要确认
write_file({
  file_path: "/absolute/path/new.txt",
  content: "File content here"
})
// 返回: "Successfully created and wrote to new file: /path/new.txt"

// 4. glob (FindFiles)
glob({
  pattern: "**/*.ts",               // 必需：glob 模式
  path: "/search/directory",        // 可选：搜索目录
  case_sensitive: false,            // 可选：大小写敏感
  respect_git_ignore: true
})
// 返回按修改时间排序的文件列表

// 5. grep_search (SearchText)
grep_search({
  pattern: "function\\s+myFunc",   // 必需：正则表达式
  path: "/search/directory",        // 可选
  include: "*.ts"                   // 可选：文件过滤
})
// 返回: 匹配行 + 文件路径 + 行号

// 6. replace (Edit) - 需要确认
replace({
  file_path: "/absolute/path/file.txt",
  old_string: "original text with context",  // 需要3行上下文
  new_string: "replacement text",
  expected_replacements: 1                    // 可选：替换次数
})
```

##### Shell 工具
```javascript
// run_shell_command (Shell) - 需要确认
run_shell_command({
  command: "npm run build",         // 必需：shell 命令
  description: "Build the project", // 可选：描述
  directory: "./src"                // 可选：执行目录
})
// 返回: { stdout, stderr, exitCode, signal, backgroundPIDs }
```

##### Web 工具
```javascript
// google_web_search (GoogleSearch)
google_web_search({
  query: "latest TypeScript features"
})

// web_fetch (WebFetch)
web_fetch({
  url: "https://example.com/api"
})
```

#### settings.json 工具配置
```json
{
  "tools": {
    "sandbox": "docker",          // 沙盒模式: true/false/"docker"/路径
    "approvalMode": "default",   // "default"|"auto_edit"|"plan"
    
    // 允许的工具（白名单）
    "core": [
      "read_file",
      "run_shell_command(git)",
      "run_shell_command(npm test)"
    ],
    
    // 禁用的工具（黑名单）
    "exclude": [
      "write_file",
      "run_shell_command(rm)"
    ],
    
    // 允许跳过确认的工具
    "allowed": [
      "run_shell_command(git status)",
      "run_shell_command(npm test)"
    ],
    
    "shell": {
      "enableInteractiveShell": true,
      "showColor": true,
      "pager": "less",
      "inactivityTimeout": 300     // 秒
    },
    
    "truncateToolOutputThreshold": 40000,
    "disableLLMCorrection": false
  }
}
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **工具调用追踪** | 垂直时间线 | 解析工具调用日志 | ⭐⭐⭐⭐⭐ |
| **文件 Diff 视图** | 并排对比 | `replace` 输出 | ⭐⭐⭐⭐⭐ |
| **Shell 沙盒状态** | 安全等级指示器 | `tools.sandbox` | ⭐⭐⭐⭐ |
| **工具权限矩阵** | 开关表格 | `tools.core/exclude/allowed` | ⭐⭐⭐⭐⭐ |
| **命令限制编辑器** | 可视化规则构建器 | `run_shell_command(*)` 语法 | ⭐⭐⭐⭐ |

---

### 4. 🔌 MCP Server 集成（高优先级）

#### 相关命令
```bash
/mcp                  # 默认：列出服务器和工具
/mcp list             # 同上
/mcp ls               # 同上
/mcp desc             # 显示详细描述
/mcp schema           # 显示工具 schema
/mcp refresh          # 重启所有 MCP 服务器
/mcp auth <server>    # OAuth 认证
```

#### CLI 管理命令
```bash
# 添加 MCP 服务器
gemini mcp add <name> --command "npx" --args "@mcp/server-git"
gemini mcp add github --httpUrl "https://api.githubcopilot.com/mcp/"

# 删除服务器
gemini mcp remove <name> --scope user|project

# 启用/禁用
gemini mcp enable <name>
gemini mcp disable <name>
```

#### settings.json MCP 配置
```json
{
  "mcpServers": {
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"],
      "cwd": "/project/root",
      "env": {
        "GIT_TOKEN": "$GIT_TOKEN"
      },
      "timeout": 5000,
      "trust": false,
      "description": "Git operations server",
      "includeTools": ["git_status", "git_log"],
      "excludeTools": ["git_push"]
    },
    
    "github": {
      "httpUrl": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer $GITHUB_TOKEN"
      },
      "timeout": 10000
    },
    
    "database": {
      "url": "http://localhost:3001/sse",  // SSE 传输
      "trust": true
    }
  },
  
  "mcp": {
    "allowed": ["git", "github"],   // 允许的服务器
    "excluded": ["risky-server"]    // 排除的服务器
  }
}
```

#### MCP 服务器状态
```
┌─────────────────────────────────────────────────────────┐
│  MCP Server Manager                                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🟢 github      Ready   74 tools   [Configure]  │   │
│  │ 🟢 git         Ready   13 tools   [Configure]  │   │
│  │ 🟡 firebase    Loading  0 tools   [Retry]      │   │
│  │ 🔴 database    Error    0 tools   [Debug]      │   │
│  │ ⚫ slack       Disabled 12 tools  [Enable]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Add Server]  [Import from URL]  [Marketplace]      │
└─────────────────────────────────────────────────────────┘
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **服务器健康监控** | 状态灯 + 延迟 | `/mcp list` 输出 | ⭐⭐⭐⭐⭐ |
| **工具浏览器** | 树形目录 + 搜索 | `/mcp desc`, `/mcp schema` | ⭐⭐⭐⭐⭐ |
| **配置编辑器** | JSON Schema 表单 | `mcpServers.*` | ⭐⭐⭐⭐⭐ |
| **工具筛选器** | 多选框 | `includeTools/excludeTools` | ⭐⭐⭐⭐ |
| **一键安装** | 扩展商店 | `gemini mcp add` | ⭐⭐⭐⭐⭐ |

---

### 5. 🎨 Extensions 扩展管理

#### 相关命令
```bash
/extensions           # 列出所有活动扩展

# CLI 扩展管理
gemini extensions install <url>     # 从 Git URL 安装
gemini extensions install <path>    # 从本地路径安装
gemini extensions uninstall <name>  # 卸载扩展
gemini extensions list              # 列出已安装扩展
```

#### 扩展结构 (gemini-extension.json)
```json
{
  "name": "cloud-run",
  "version": "1.0.0",
  "description": "Google Cloud Run deployment tools",
  "mcpServers": {
    "cloudrun": {
      "command": "npx",
      "args": ["@gcp/mcp-server-cloudrun"]
    }
  },
  "commands": [
    {
      "name": "deploy",
      "file": "commands/deploy.toml"
    }
  ],
  "context": ["GEMINI.md"]
}
```

#### settings.json 扩展相关配置
```json
{
  "security": {
    "blockGitExtensions": false,
    "allowedExtensions": ["^https://github.com/google-gemini/.*"]
  },
  "experimental": {
    "extensionManagement": true,
    "extensionConfig": true,
    "extensionReloading": false
  }
}
```

#### 扩展存储位置
- 全局: `~/.gemini/extensions/`
- 项目: `.gemini/extensions/`

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **扩展商店** | 卡片网格 | `gemini extensions install` | ⭐⭐⭐⭐⭐ |
| **版本管理** | 更新提示 | 解析 `gemini-extension.json` | ⭐⭐⭐⭐ |
| **扩展创建向导** | 分步表单 | 生成 `gemini-extension.json` | ⭐⭐⭐⭐ |

---

### 6. ⚡ Skills 技能系统

#### 相关命令
```bash
/skills               # 默认：列出技能状态
/skills list          # 列出所有技能
/skills enable <name> # 启用技能
/skills disable <name># 禁用技能
/skills reload        # 重新加载技能
```

#### settings.json 技能配置
```json
{
  "skills": {
    "enabled": true,
    "disabled": ["skill-name-1", "skill-name-2"]
  },
  "admin": {
    "skills": {
      "enabled": true  // 管理员级别控制
    }
  }
}
```

#### 技能层级
- **Workspace**: `.gemini/skills/`
- **User**: `~/.gemini/skills/`  
- **Extensions**: 扩展包内的技能

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **技能列表** | 卡片 + 开关 | `/skills list` | ⭐⭐⭐⭐ |
| **技能来源标识** | 层级标签 | Workspace/User/Extension | ⭐⭐⭐ |
| **技能编辑器** | 代码编辑 | 文件系统操作 | ⭐⭐⭐ |

---

### 7. 📁 Context Files (GEMINI.md)

#### 相关命令
```bash
/memory               # 显示内存子命令
/memory show          # 显示完整上下文内容
/memory list          # 列出 GEMINI.md 文件路径
/memory add <text>    # 添加文本到内存
/memory refresh       # 重新加载所有 GEMINI.md

/init                 # 自动生成 GEMINI.md
```

#### settings.json 上下文配置
```json
{
  "context": {
    "fileName": ["GEMINI.md", "CONTEXT.md"],  // 支持多文件
    "includeDirectories": ["../lib", "~/docs"],
    "loadMemoryFromIncludeDirectories": true,
    "discoveryMaxDirs": 200,
    
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectGeminiIgnore": true,
      "enableRecursiveFileSearch": true,
      "enableFuzzySearch": true,
      "customIgnoreFilePaths": [".myignore"]
    }
  }
}
```

#### 上下文层级
```
~/.gemini/GEMINI.md           (Global)
    ↓
/project/GEMINI.md            (Project Root)
    ↓
/project/src/GEMINI.md        (Subdirectory)
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **层级可视化** | 树形图 | `/memory list` | ⭐⭐⭐⭐⭐ |
| **内容编辑器** | Split view | 文件系统 + `/memory show` | ⭐⭐⭐⭐⭐ |
| **Token 分析** | 饼图 | 计算各文件贡献 | ⭐⭐⭐⭐ |
| **模板库** | 预设选择 | `/init` 增强 | ⭐⭐⭐⭐ |

---

### 8. 🎛️ Custom Commands 自定义命令

#### 命令文件位置
- 全局: `~/.gemini/commands/*.toml`
- 项目: `.gemini/commands/*.toml`

#### TOML 命令格式
```toml
# ~/.gemini/commands/deploy.toml
[command]
name = "deploy"
description = "Deploy to Cloud Run"

[command.arguments]
project = { type = "string", required = true, description = "GCP Project ID" }
location = { type = "string", required = false, default = "us-central1" }
name = { type = "string", required = true, description = "Service name" }

[command.prompt]
template = """
Deploy the current project to Google Cloud Run.
Project: {{project}}
Location: {{location}}
Service Name: {{name}}

Use the Cloud Run MCP server tools to complete this deployment.
"""
```

#### 使用自定义命令
```bash
/deploy --project=my-project --name=my-service
/deploy --project="my-project" --location="europe-west1" --name="api"
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **命令编辑器** | TOML 语法高亮 | 文件系统 | ⭐⭐⭐⭐⭐ |
| **参数构建器** | 拖拽表单 | 生成 TOML | ⭐⭐⭐⭐ |
| **命令测试** | 沙盒执行 | 解析 prompt template | ⭐⭐⭐⭐⭐ |

---

### 9. 🔐 认证与安全

#### 相关命令
```bash
/auth                 # 打开认证选择对话框
/privacy              # 隐私设置
```

#### 环境变量
```bash
# Gemini API Key
export GEMINI_API_KEY="your-api-key"

# Google Cloud (Vertex AI)
export GOOGLE_API_KEY="your-google-key"
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_GENAI_USE_VERTEXAI=true

# CLI 配置目录
export GEMINI_CLI_HOME="/custom/path"

# 模型选择
export GEMINI_MODEL="gemini-3-flash-preview"
```

#### settings.json 安全配置
```json
{
  "security": {
    "disableYoloMode": false,
    "enablePermanentToolApproval": false,
    
    "auth": {
      "selectedType": "gemini-api-key",  // 或 "oauth", "vertex-ai"
      "enforcedType": null,
      "useExternal": false
    },
    
    "folderTrust": {
      "enabled": true
    },
    
    "environmentVariableRedaction": {
      "enabled": true,
      "allowed": ["PATH", "HOME"],
      "blocked": ["*TOKEN*", "*SECRET*", "*PASSWORD*"]
    }
  },
  
  "admin": {
    "secureModeEnabled": false,
    "extensions": { "enabled": true },
    "mcp": { "enabled": true },
    "skills": { "enabled": true }
  }
}
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **多账户切换** | 下拉菜单 | `security.auth.selectedType` | ⭐⭐⭐⭐⭐ |
| **API Key 管理** | 安全存储 | 环境变量 / `.env` | ⭐⭐⭐⭐⭐ |
| **Trusted Folders** | 目录树 | `security.folderTrust` | ⭐⭐⭐⭐ |

---

### 10. 🤖 模型选择与配置

#### 相关命令
```bash
/model                # 打开模型选择对话框

# CLI 参数
gemini -m gemini-2.5-pro
gemini -m gemini-3-flash-preview
gemini -m gemini-2.5-flash-lite
```

#### settings.json 模型配置
```json
{
  "model": {
    "name": "gemini-2.5-pro",
    "maxSessionTurns": -1,
    "compressionThreshold": 0.5,
    "disableLoopDetection": false,
    "skipNextSpeakerCheck": true
  },
  
  "modelConfigs": {
    "customAliases": {
      "my-fast": {
        "extends": "chat-base",
        "modelConfig": {
          "model": "gemini-2.5-flash-lite",
          "generateContentConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "topK": 40,
            "maxOutputTokens": 8192,
            "thinkingConfig": {
              "thinkingBudget": 4096
            }
          }
        }
      }
    }
  }
}
```

#### 内置模型别名
| 别名 | 模型 | 用途 |
|------|------|------|
| `gemini-3-pro-preview` | gemini-3-pro-preview | 最强推理 |
| `gemini-3-flash-preview` | gemini-3-flash-preview | 快速响应 |
| `gemini-2.5-pro` | gemini-2.5-pro | 平衡选择 |
| `gemini-2.5-flash` | gemini-2.5-flash | 高速 |
| `gemini-2.5-flash-lite` | gemini-2.5-flash-lite | 最快 |
| `web-search` | gemini-2.5-flash + GoogleSearch | 搜索增强 |

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **模型选择器** | 卡片对比 | `/model`, `model.name` | ⭐⭐⭐⭐⭐ |
| **参数滑块** | 滑块控件 | `generateContentConfig` | ⭐⭐⭐⭐ |
| **别名管理** | 编辑器 | `modelConfigs.customAliases` | ⭐⭐⭐⭐ |

---

### 11. 📈 Telemetry 遥测与监控

#### settings.json 遥测配置
```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",           // "local" | "gcp"
    "otlpEndpoint": "http://localhost:4317",
    "otlpProtocol": "grpc",      // "grpc" | "http"
    "logPrompts": true,
    "outfile": "~/.gemini/telemetry.log",
    "useCollector": false
  },
  
  "privacy": {
    "usageStatisticsEnabled": true
  }
}
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **性能仪表盘** | 折线图 | 解析 telemetry 日志 | ⭐⭐⭐⭐⭐ |
| **OTLP 配置** | 表单 | `telemetry.*` | ⭐⭐⭐⭐ |
| **导出报告** | PDF/CSV | 日志聚合 | ⭐⭐⭐ |

---

### 12. 🪝 Hooks 钩子系统

#### 相关命令
```bash
/hooks                # 显示钩子管理
/hooks list           # 列出所有钩子
/hooks enable <name>  # 启用钩子
/hooks disable <name> # 禁用钩子
/hooks enable-all     # 全部启用
/hooks disable-all    # 全部禁用
```

#### settings.json Hooks 配置
```json
{
  "hooksConfig": {
    "enabled": true,
    "disabled": ["hook-name"],
    "notifications": true
  },
  
  "hooks": {
    "BeforeTool": [
      {
        "command": "echo 'Tool starting: $TOOL_NAME'",
        "timeout": 5000
      }
    ],
    "AfterTool": [],
    "BeforeAgent": [],
    "AfterAgent": [],
    "Notification": [],
    "SessionStart": [],
    "SessionEnd": [],
    "PreCompress": [],
    "BeforeModel": [],
    "AfterModel": [],
    "BeforeToolSelection": []
  }
}
```

#### Hook 类型
| Hook | 触发时机 | 用途 |
|------|----------|------|
| `BeforeTool` | 工具执行前 | 验证、拦截 |
| `AfterTool` | 工具执行后 | 日志、后处理 |
| `BeforeAgent` | Agent 循环开始 | 初始化 |
| `AfterAgent` | Agent 循环结束 | 清理 |
| `SessionStart` | 会话开始 | 资源初始化 |
| `SessionEnd` | 会话结束 | 持久化 |
| `BeforeModel` | LLM 请求前 | 修改 prompt |
| `AfterModel` | LLM 响应后 | 处理输出 |

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **Hook 编辑器** | 表单+代码 | `hooks.*` | ⭐⭐⭐⭐ |
| **执行日志** | 时间线 | Hook 输出 | ⭐⭐⭐⭐ |

---

### 13. 🖥️ UI 与主题

#### 相关命令
```bash
/theme                # 打开主题选择器
/settings             # 打开设置编辑器
/vim                  # 切换 Vim 模式
/shortcuts            # 切换快捷键面板
/shells               # 切换后台 shell 视图
```

#### settings.json UI 配置
```json
{
  "ui": {
    "theme": "GitHub",
    "autoThemeSwitching": true,
    
    "hideBanner": false,
    "hideTips": false,
    "hideContextSummary": false,
    "hideFooter": false,
    "hideWindowTitle": false,
    
    "footer": {
      "hideCWD": false,
      "hideSandboxStatus": false,
      "hideModelInfo": false,
      "hideContextPercentage": false
    },
    
    "showLineNumbers": true,
    "showCitations": false,
    "showModelInfoInChat": false,
    "showMemoryUsage": false,
    "showSpinner": true,
    
    "useAlternateBuffer": false,
    "useBackgroundColor": true,
    "incrementalRendering": true,
    
    "customWittyPhrases": [
      "Connecting to AGI...",
      "Brewing intelligence..."
    ],
    
    "customThemes": {
      "MyTheme": {
        "primary": "#FF6900",
        "background": "#1a1a1a"
      }
    },
    
    "accessibility": {
      "enableLoadingPhrases": true,
      "screenReader": false
    }
  },
  
  "general": {
    "vimMode": false,
    "preferredEditor": "code"
  }
}
```

---

### 14. 📂 目录与工作区

#### 相关命令
```bash
/directory show              # 显示所有工作目录
/directory add <path>        # 添加目录
/dir add ../lib,~/docs       # 支持多个路径

# CLI 启动参数
gemini --include-directories ../lib,../docs
```

#### 深度定制建议
| 功能 | 可视化方案 | API | 价值 |
|------|-----------|-----|------|
| **目录树视图** | 文件浏览器 | `/directory show` | ⭐⭐⭐⭐ |
| **快速添加** | 拖拽添加 | `/directory add` | ⭐⭐⭐ |

---

## 🏗️ 推荐 UI 架构

### 整体布局
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]  Project: my-app ▼  │  Model: gemini-2.5-pro ▼  │ 👤  │
├──────────┬─────────────────────────────────────┬───────────────┤
│          │                                     │               │
│ Navigator│         Main Chat Area              │  Inspector    │
│          │                                     │               │
│ ├ Chats  │  ┌─────────────────────────────┐   │ ┌───────────┐ │
│ ├ MCP    │  │ User: Explain this code...  │   │ │ Token     │ │
│ ├ Tools  │  │ AI: This code does...       │   │ │ Usage     │ │
│ ├ Config │  │ [Tool: ReadFile] ▼          │   │ │ ████ 75%  │ │
│ └ History│  │ AI: Based on the file...    │   │ └───────────┘ │
│          │  └─────────────────────────────┘   │ ┌───────────┐ │
│          │                                     │ │ Active    │ │
│          │  ┌─────────────────────────────┐   │ │ Tools     │ │
│          │  │ > Type message... [@ ] [▶] │   │ │ • github  │ │
│          │  └─────────────────────────────┘   │ │ • git     │ │
│          │                                     │ └───────────┘ │
├──────────┴─────────────────────────────────────┴───────────────┤
│  Status: Connected │ Quota: 520/1000 │ Cache: Active │ v0.27.3 │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 配置文件层级汇总

| 位置 | 优先级 | 用途 |
|------|--------|------|
| `/etc/gemini-cli/system-defaults.json` | 1 (最低) | 系统默认 |
| `~/.gemini/settings.json` | 2 | 用户全局 |
| `.gemini/settings.json` | 3 | 项目级别 |
| `/etc/gemini-cli/settings.json` | 4 | 系统覆盖 |
| 环境变量 / `.env` | 5 | 运行时 |
| CLI 参数 | 6 (最高) | 命令行 |

---

## 🎨 技术栈建议

| 层级 | 推荐技术 | 理由 |
|------|----------|------|
| **框架** | Tauri 2.0 / Electron | 跨平台桌面 |
| **前端** | React + TypeScript | 组件化 |
| **UI 库** | shadcn/ui | 现代化 |
| **状态** | Zustand | 轻量级 |
| **图表** | Recharts | Token 可视化 |
| **代码编辑** | Monaco Editor | TOML/JSON 编辑 |
| **Diff** | react-diff-viewer-continued | 文件对比 |
| **终端** | xterm.js | 嵌入式 Shell |

---

## 📋 CLI 与 GUI 交互方式

### 方案 1: 进程调用
```typescript
import { spawn } from 'child_process';

const gemini = spawn('gemini', ['-p', prompt, '--output-format', 'stream-json']);
gemini.stdout.on('data', (data) => {
  const events = data.toString().split('\n').filter(Boolean);
  events.forEach(e => handleEvent(JSON.parse(e)));
});
```

### 方案 2: 复用 Core 包
```typescript
import { GeminiCore } from '@google/gemini-cli/core';

const core = new GeminiCore({ configPath: '~/.gemini/settings.json' });
await core.initialize();
const response = await core.sendMessage(prompt);
```

### 方案 3: HTTP/WebSocket 包装
```typescript
// 启动 headless 服务
// gemini serve --port 3000

const ws = new WebSocket('ws://localhost:3000');
ws.send(JSON.stringify({ type: 'message', content: prompt }));
ws.onmessage = (e) => handleResponse(JSON.parse(e.data));
```
