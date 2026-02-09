# Gemini CLI GUI 开发说明书

---

## 第一部分：完整 API 参考

---

### 1. CLI 启动参数

```bash
gemini                                    # 交互模式
gemini -p "prompt"                        # 非交互模式
gemini -p "prompt" --output-format json   # JSON 输出（含完整统计）
gemini -p "prompt" --output-format stream-json  # 流式 JSON
gemini -m gemini-2.5-pro                  # 指定模型
gemini --include-directories ../lib,../docs
gemini --debug                            # 调试模式
gemini --yolo                             # 自动批准
gemini --approval-mode auto_edit          # 审批模式
gemini --all-files                        # 包含所有文件
```

---

### 2. Slash 命令 (/)

#### 会话管理
```bash
/chat save <tag>           # 保存对话检查点
/chat list                 # 列出所有检查点
/chat resume <tag>         # 恢复检查点
/chat delete <tag>         # 删除检查点
/chat share [filename]     # 导出为 Markdown/JSON
/resume                    # 浏览历史会话
/rewind                    # 回退对话历史
/restore [tool_call_id]    # 恢复到工具执行前状态
/compress                  # 压缩上下文生成摘要
/clear                     # 清屏 (Ctrl+L)
/copy                      # 复制最后输出
```

#### 工具与 MCP
```bash
/tools                     # 列出可用工具
/tools desc                # 显示工具详细描述
/tools nodesc              # 只显示工具名
/mcp                       # 列出 MCP 服务器
/mcp list                  # 同上
/mcp desc                  # 显示详细描述
/mcp schema                # 显示工具 schema
/mcp refresh               # 重启所有服务器
/mcp auth <server>         # OAuth 认证
```

#### 技能与扩展
```bash
/skills list               # 列出技能
/skills enable <name>      # 启用技能
/skills disable <name>     # 禁用技能
/skills reload             # 重新加载
/extensions                # 列出活动扩展
```

#### 上下文与内存
```bash
/memory show               # 显示完整上下文
/memory list               # 列出 GEMINI.md 路径
/memory add <text>         # 添加到内存
/memory refresh            # 重新加载
/init                      # 自动生成 GEMINI.md
/directory show            # 显示工作目录
/directory add <path>      # 添加目录
```

#### 配置与设置
```bash
/settings                  # 设置编辑器
/model                     # 模型选择
/theme                     # 主题选择
/auth                      # 认证设置
/editor                    # 编辑器选择
/privacy                   # 隐私设置
/vim                       # Vim 模式
```

#### Hooks
```bash
/hooks list                # 列出钩子
/hooks enable <name>       # 启用
/hooks disable <name>      # 禁用
/hooks enable-all          # 全部启用
/hooks disable-all         # 全部禁用
```

#### 统计与调试
```bash
/stats                     # ⭐ 显示会话统计（Token/性能/工具）
/stats model               # ⭐ 按模型详细统计
/about                     # 版本信息
/introspect                # 调试信息
/policies list             # 策略列表
```

#### 其他
```bash
/help   /docs   /bug   /shortcuts   /shells   /quit
```

---

### 3. 引用与 Shell 命令

```bash
# @ 文件引用
@path/to/file.ts           # 单文件
@src/                      # 目录
@**/*.ts                   # Glob
@image.png                 # 图片/PDF

# ! Shell
!ls -la                    # 单个命令
!                          # Shell 模式（再按 ! 退出）
```

---

### 4. 扩展管理命令

```bash
gemini extensions install <url|path>
gemini extensions uninstall <name>
gemini extensions list

gemini mcp add <name> --command "cmd" --args "arg1,arg2"
gemini mcp remove <name>
gemini mcp enable/disable <name>
```

---

### 5. 内置工具 API

| 工具名 | 显示名 | 确认 | 参数 |
|--------|--------|------|------|
| `list_directory` | ReadFolder | 否 | `path`, `ignore?`, `respect_git_ignore?` |
| `read_file` | ReadFile | 否 | `path`, `offset?`, `limit?` |
| `write_file` | WriteFile | 是 | `file_path`, `content` |
| `glob` | FindFiles | 否 | `pattern`, `path?`, `case_sensitive?` |
| `grep_search` | SearchText | 否 | `pattern`, `path?`, `include?` |
| `replace` | Edit | 是 | `file_path`, `old_string`, `new_string`, `expected_replacements?` |
| `run_shell_command` | Shell | 是 | `command`, `description?`, `directory?` |
| `google_web_search` | GoogleSearch | 否 | `query` |
| `web_fetch` | WebFetch | 否 | `url` |
| `save_memory` | SaveMemory | 否 | `content` |
| `write_todos` | WriteTodos | 否 | `todos` |

---

### 6. settings.json 完整配置

```json
{
  "general": {
    "preferredEditor": "code",
    "vimMode": false,
    "enableAutoUpdate": true,
    "enablePromptCompletion": false,
    "checkpointing": { "enabled": false },
    "sessionRetention": { "enabled": false, "maxAge": "30d", "maxCount": 100 }
  },
  "model": {
    "name": "gemini-2.5-pro",
    "maxSessionTurns": -1,
    "compressionThreshold": 0.5,
    "disableLoopDetection": false,
    "summarizeToolOutput": { "run_shell_command": { "tokenBudget": 2000 } }
  },
  "modelConfigs": {
    "customAliases": {
      "my-alias": {
        "extends": "chat-base",
        "modelConfig": {
          "model": "gemini-2.5-flash",
          "generateContentConfig": {
            "temperature": 0.7, "topP": 0.9, "topK": 40,
            "maxOutputTokens": 8192,
            "thinkingConfig": { "thinkingBudget": 4096, "thinkingLevel": "HIGH" }
          }
        }
      }
    }
  },
  "tools": {
    "sandbox": "docker",
    "approvalMode": "default",
    "core": ["read_file", "run_shell_command(git)"],
    "exclude": ["run_shell_command(rm)"],
    "allowed": ["run_shell_command(git status)"],
    "shell": { "enableInteractiveShell": true, "showColor": false, "inactivityTimeout": 300 },
    "truncateToolOutputThreshold": 40000,
    "disableLLMCorrection": true
  },
  "mcpServers": {
    "server-name": {
      "command": "uvx", "args": [], "cwd": "", "env": {},
      "url": "", "httpUrl": "", "headers": {},
      "timeout": 5000, "trust": false,
      "includeTools": [], "excludeTools": []
    }
  },
  "mcp": { "allowed": [], "excluded": [] },
  "context": {
    "fileName": ["GEMINI.md"],
    "includeDirectories": [],
    "discoveryMaxDirs": 200,
    "fileFiltering": { "respectGitIgnore": true, "respectGeminiIgnore": true, "enableFuzzySearch": true }
  },
  "skills": { "enabled": true, "disabled": [] },
  "hooksConfig": { "enabled": true, "disabled": [], "notifications": true },
  "hooks": {
    "BeforeTool": [], "AfterTool": [], "BeforeAgent": [], "AfterAgent": [],
    "SessionStart": [], "SessionEnd": [], "BeforeModel": [], "AfterModel": [],
    "PreCompress": [], "BeforeToolSelection": [], "Notification": []
  },
  "security": {
    "disableYoloMode": false,
    "auth": { "selectedType": "gemini-api-key", "enforcedType": null },
    "folderTrust": { "enabled": true },
    "environmentVariableRedaction": { "enabled": true, "allowed": [], "blocked": [] }
  },
  "ui": {
    "theme": "GitHub",
    "hideBanner": false, "hideTips": false, "hideFooter": false,
    "footer": { "hideCWD": false, "hideModelInfo": false, "hideContextPercentage": false },
    "showLineNumbers": true, "showMemoryUsage": false, "showCitations": false,
    "customThemes": {}, "customWittyPhrases": []
  },
  "telemetry": {
    "enabled": true, "target": "local",
    "otlpEndpoint": "http://localhost:4317", "otlpProtocol": "grpc",
    "logPrompts": true, "outfile": ".gemini/telemetry.log", "useCollector": false
  },
  "admin": {
    "secureModeEnabled": false,
    "extensions": { "enabled": true },
    "mcp": { "enabled": true },
    "skills": { "enabled": true }
  },
  "experimental": {
    "enableAgents": false, "extensionManagement": true,
    "jitContext": false, "plan": false
  }
}
```

---

### 7. 环境变量

```bash
export GEMINI_API_KEY="..."
export GOOGLE_API_KEY="..."
export GOOGLE_CLOUD_PROJECT="..."
export GOOGLE_GENAI_USE_VERTEXAI=true
export GEMINI_MODEL="gemini-2.5-pro"
export GEMINI_CLI_HOME="/custom/path"
```

---

### 8. 配置文件优先级

| 位置 | 优先级 |
|------|--------|
| `/etc/gemini-cli/system-defaults.json` | 1 (最低) |
| `~/.gemini/settings.json` | 2 |
| `.gemini/settings.json` | 3 |
| `/etc/gemini-cli/settings.json` | 4 |
| 环境变量 / `.env` | 5 |
| CLI 参数 | 6 (最高) |

---

## 第二部分：数据统计 API（⭐ 核心）

---

### API 1：Headless JSON 输出 — 结构化统计数据

**这是 GUI 获取统计数据最重要的接口。**

```bash
gemini -p "prompt" --output-format json
```

#### 完整返回结构
```json
{
  "response": "AI 的回答内容",
  
  "stats": {
    "models": {
      "gemini-2.5-pro": {
        "api": {
          "totalRequests": 2,
          "totalErrors": 0,
          "totalLatencyMs": 5053
        },
        "tokens": {
          "prompt": 24939,
          "candidates": 20,
          "total": 25113,
          "cached": 21263,
          "thoughts": 154,
          "tool": 0
        }
      },
      "gemini-2.5-flash": {
        "api": {
          "totalRequests": 1,
          "totalErrors": 0,
          "totalLatencyMs": 1879
        },
        "tokens": {
          "prompt": 8965,
          "candidates": 10,
          "total": 9033,
          "cached": 0,
          "thoughts": 30,
          "tool": 28
        }
      }
    },
    
    "tools": {
      "totalCalls": 1,
      "totalSuccess": 1,
      "totalFail": 0,
      "totalDurationMs": 1881,
      "totalDecisions": {
        "accept": 0,
        "reject": 0,
        "modify": 0,
        "auto_accept": 1
      },
      "byName": {
        "google_web_search": {
          "count": 1,
          "success": 1,
          "fail": 0,
          "durationMs": 1881,
          "decisions": {
            "accept": 0,
            "reject": 0,
            "modify": 0,
            "auto_accept": 1
          }
        }
      }
    },
    
    "files": {
      "totalLinesAdded": 0,
      "totalLinesRemoved": 0
    }
  },
  
  "error": {
    "type": "ApiError",
    "message": "Error description",
    "code": 429
  }
}
```

#### 数据提取示例
```bash
# 提取总 token
result=$(gemini -p "query" --output-format json)
total_tokens=$(echo "$result" | jq '.stats.models | to_entries | map(.value.tokens.total) | add')

# 提取使用的模型
models_used=$(echo "$result" | jq -r '.stats.models | keys | join(", ")')

# 提取工具调用统计
tool_calls=$(echo "$result" | jq '.stats.tools.totalCalls')
tools_used=$(echo "$result" | jq -r '.stats.tools.byName | keys | join(", ")')
```

---

### API 2：/stats 命令 — 交互式会话统计

```bash
/stats           # 总览统计
/stats model     # 按模型详细统计
```

#### /stats 输出结构
```
┌─────────────────────────────────────────────────────────────────┐
│ Session Stats                                                   │
│                                                                 │
│ Interaction Summary                                             │
│   Tool Calls:    40 ( ✔ 40  ✖ 0 )                              │
│   Success Rate:  100.0%                                         │
│   User Agreement: 100.0% (3 reviewed)                           │
│                                                                 │
│ Performance                                                     │
│   Wall Time:     15m 53s                                        │
│   Agent Active:  14m 32s                                        │
│   » API Time:    8m 1s (55.2%)                                  │
│   » Tool Time:   6m 31s (44.8%)                                 │
│                                                                 │
│ Model Usage      Reqs   Input Tokens  Thoughts  Output Tokens   │
│ ──────────────────────────────────────────────────────────────── │
│ gemini-2.5-pro    12     6,082,929     xxx       17,014         │
│                                                                 │
│ Savings Highlight: 2,401,483 (39.5%) of input tokens were       │
│ served from cache, reducing costs.                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 关键字段
| 字段 | 含义 |
|------|------|
| Tool Calls | 工具调用总数（成功/失败） |
| Success Rate | 工具成功率 |
| User Agreement | 用户批准率 |
| Wall Time | 总时长 |
| Agent Active | 活跃时长 |
| API Time | API 调用耗时 + 占比 |
| Tool Time | 工具执行耗时 + 占比 |
| Reqs | 每个模型的请求次数 |
| Input Tokens | 输入 token 数 |
| Thoughts | 思考 token 数（计费但不在摘要中）|
| Output Tokens | 输出 token 数 |
| Cached | 缓存命中的 token 数 + 百分比 |

---

### API 3：OpenTelemetry 遥测 — 完整可观测性系统

#### 配置
```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "outfile": ".gemini/telemetry.log",
    "logPrompts": true
  }
}
```

环境变量覆盖：
```bash
export GEMINI_TELEMETRY_ENABLED=true
export GEMINI_TELEMETRY_TARGET=local
export GEMINI_TELEMETRY_OUTFILE=.gemini/telemetry.log
export GEMINI_TELEMETRY_LOG_PROMPTS=true
export GEMINI_TELEMETRY_OTLP_ENDPOINT=http://localhost:4317
export GEMINI_TELEMETRY_OTLP_PROTOCOL=grpc
```

---

#### 遥测日志事件（Logs）

##### Session 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.config` | 启动时 | `model`, `sandbox_enabled`, `approval_mode`, `mcp_servers_count`, `extension_count`, `mcp_tools_count`, `output_format` |
| `gemini_cli.user_prompt` | 用户提交 | `prompt_length`, `prompt_id`, `prompt`, `auth_type` |
| `gemini_cli.conversation_finished` | 会话结束 | `approvalMode`, `turnCount` |

##### API 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.api_request` | 发送请求 | `model`, `prompt_id`, `request_text` |
| `gemini_cli.api_response` | 收到响应 | `model`, `status_code`, `duration_ms`, `input_token_count`, `output_token_count`, `cached_content_token_count`, `thoughts_token_count`, `tool_token_count`, `total_token_count`, `auth_type`, `finish_reasons` |
| `gemini_cli.api_error` | 请求失败 | `model`, `error`, `error_type`, `status_code`, `duration_ms` |

##### Tool 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.tool_call` | 工具调用 | `function_name`, `function_args`, `duration_ms`, `success`, `decision`, `tool_type`("native"/"mcp"), `mcp_server_name`, `content_length` |
| `gemini_cli.tool_output_truncated` | 输出截断 | `tool_name`, `original_content_length`, `truncated_content_length`, `threshold` |
| `gemini_cli.edit_correction` | 编辑修正 | `correction`("success"/"failure") |

##### File 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.file_operation` | 文件操作 | `tool_name`, `operation`("create"/"read"/"update"), `lines`, `mimetype`, `extension`, `programming_language` |

##### Model Routing 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.model_routing` | 路由决策 | `decision_model`, `decision_source`, `routing_latency_ms`, `reasoning`, `failed` |
| `gemini_cli.slash_command.model` | 模型切换 | `model_name` |

##### Chat 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.chat_compression` | 上下文压缩 | `tokens_before`, `tokens_after` |
| `gemini_cli.chat.content_retry` | 内容重试 | `attempt_number`, `error_type`, `retry_delay_ms`, `model` |
| `gemini_cli.chat.content_retry_failure` | 重试失败 | `total_attempts`, `final_error_type`, `total_duration_ms` |

##### Extension 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.extension_install` | 安装 | `extension_name`, `extension_version`, `extension_source`, `status` |
| `gemini_cli.extension_uninstall` | 卸载 | `extension_name`, `status` |
| `gemini_cli.extension_enable` | 启用 | `extension_name`, `setting_scope` |
| `gemini_cli.extension_disable` | 禁用 | `extension_name`, `setting_scope` |

##### Agent 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.agent.start` | Agent 启动 | `agent_id`, `agent_name` |
| `gemini_cli.agent.finish` | Agent 结束 | `agent_id`, `agent_name`, `duration_ms`, `turn_count`, `terminate_reason` |

##### Resilience 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gemini_cli.flash_fallback` | 模型降级 | `auth_type` |
| `gemini_cli.ripgrep_fallback` | grep 降级 | `error` |
| `gemini_cli.web_fetch_fallback_attempt` | WebFetch 降级 | `reason` |

##### Approval Mode 事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `approval_mode_switch` | 模式切换 | `from_mode`, `to_mode` |
| `approval_mode_duration` | 模式持续 | `mode`, `duration_ms` |
| `plan_execution` | 计划执行 | `approval_mode` |

##### GenAI 标准事件
| 事件名 | 触发时机 | 关键属性 |
|--------|----------|----------|
| `gen_ai.client.inference.operation.details` | 推理详情 | `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.temperature`, `gen_ai.request.top_p`, `gen_ai.request.top_k` |

---

#### 遥测指标（Metrics）

##### Token 使用指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.token.usage` | Counter, Int | `model`, `type`("input"/"output"/"thought"/"cache"/"tool") |
| `gen_ai.client.token.usage` | Histogram | `gen_ai.token.type`, `gen_ai.request.model`, `gen_ai.provider.name` |

##### API 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.api.request.count` | Counter, Int | `model`, `status_code`, `error_type` |
| `gemini_cli.api.request.latency` | Histogram, ms | `model` |
| `gemini_cli.api.request.breakdown` | Histogram, ms | `model`, `phase`("request_preparation"/"network_latency"/"response_processing"/"token_processing") |
| `gen_ai.client.operation.duration` | Histogram, s | `gen_ai.operation.name`, `gen_ai.request.model` |

##### Tool 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.tool.call.count` | Counter, Int | `function_name`, `success`, `decision`, `tool_type` |
| `gemini_cli.tool.call.latency` | Histogram, ms | `function_name` |
| `gemini_cli.tool.queue.depth` | Histogram | 队列深度 |
| `gemini_cli.tool.execution.breakdown` | Histogram, ms | `function_name`, `phase`("validation"/"preparation"/"execution"/"result_processing") |

##### File 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.file.operation.count` | Counter, Int | `operation`, `lines`, `mimetype`, `programming_language` |
| `gemini_cli.lines.changed` | Counter, Int | `function_name`, `type`("added"/"removed") |

##### Session 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.session.count` | Counter, Int | — |

##### Chat 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.chat_compression` | Counter, Int | `tokens_before`, `tokens_after` |
| `gemini_cli.chat.invalid_chunk.count` | Counter, Int | — |
| `gemini_cli.chat.content_retry.count` | Counter, Int | — |
| `gemini_cli.chat.content_retry_failure.count` | Counter, Int | — |

##### Agent 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.agent.run.count` | Counter, Int | `agent_name`, `terminate_reason` |
| `gemini_cli.agent.duration` | Histogram, ms | `agent_name` |
| `gemini_cli.agent.turns` | Histogram | `agent_name` |

##### Model Routing 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.model_routing.latency` | Histogram, ms | `decision_model`, `decision_source` |
| `gemini_cli.model_routing.failure.count` | Counter, Int | `decision_source`, `error_message` |
| `gemini_cli.slash_command.model.call_count` | Counter, Int | `model_name` |

##### Performance 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.startup.duration` | Histogram, ms | `phase`, `details` |
| `gemini_cli.memory.usage` | Histogram, bytes | `memory_type`("heap_used"/"heap_total"/"external"/"rss"), `component` |
| `gemini_cli.cpu.usage` | Histogram, % | `component` |
| `gemini_cli.token.efficiency` | Histogram, ratio | `model`, `metric`, `context` |
| `gemini_cli.performance.score` | Histogram | `category`, `baseline` |
| `gemini_cli.performance.regression` | Counter, Int | `metric`, `severity`, `current_value`, `baseline_value` |

##### Approval Mode 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.plan.execution.count` | Counter, Int | `approval_mode` |

##### UI 指标
| 指标名 | 类型 | 属性 |
|--------|------|------|
| `gemini_cli.ui.flicker.count` | Counter, Int | — |

---

#### 遥测日志文件解析示例

```bash
# 按模型聚合 token 用量（从 telemetry.log）
jq 'select(.name == "gemini_cli.api_response") |
  {model: .attributes.model, 
   input: .attributes.input_token_count,
   output: .attributes.output_token_count,
   cached: .attributes.cached_content_token_count,
   thoughts: .attributes.thoughts_token_count}' .gemini/telemetry.log
```

---

### 三种统计 API 对比

| 特性 | Headless JSON | /stats | Telemetry |
|------|--------------|--------|----------|
| **获取方式** | `--output-format json` | 交互式命令 | 日志文件/OTLP |
| **粒度** | 每次请求汇总 | 整个会话 | 每个事件 |
| **实时性** | 请求结束后 | 随时查看 | 实时写入 |
| **Token 详情** | ✅ per-model | ✅ per-model | ✅ per-request |
| **工具统计** | ✅ per-tool | ✅ 汇总 | ✅ per-call |
| **文件统计** | ✅ 行数 | ❌ | ✅ per-operation |
| **性能指标** | ✅ 延迟 | ✅ 时间分布 | ✅ 完整breakdown |
| **历史数据** | ❌ 单次 | ❌ 单会话 | ✅ 持久化 |
| **GUI 适用** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 第三部分：15 个核心模块

---

### 模块 1：Token 使用监控仪表盘 ⭐⭐⭐⭐⭐

数据源：`stats.models.*.tokens.*` + `gemini_cli.token.usage` + `gemini_cli.api_response`

---

### 模块 2：MCP Server 管理器 ⭐⭐⭐⭐⭐

数据源：`/mcp list|desc|schema` + `mcpServers.*` + `gemini_cli.tool_call(tool_type=mcp)`

---

### 模块 3：对话 Checkpointing ⭐⭐⭐⭐⭐

数据源：`/chat save|resume|list` + `general.checkpointing`

---

### 模块 4：模型选择器 ⭐⭐⭐⭐⭐

数据源：`/model` + `model.name` + `modelConfigs.customAliases` + `gemini_cli.model_routing`

---

### 模块 5：工具调用追踪器 ⭐⭐⭐⭐⭐

数据源：`stats.tools.byName.*` + `gemini_cli.tool_call` + `gemini_cli.tool.call.latency`

---

### 模块 6：认证管理器 ⭐⭐⭐⭐⭐

数据源：`/auth` + `security.auth.*` + 环境变量

---

### 模块 7：GEMINI.md 上下文编辑器 ⭐⭐⭐⭐⭐

数据源：`/memory show|list|refresh` + `context.*`

---

### 模块 8：性能分析面板 ⭐⭐⭐⭐

数据源：`gemini_cli.api.request.breakdown` + `gemini_cli.tool.execution.breakdown` + `gemini_cli.startup.duration` + `gemini_cli.memory.usage` + `gemini_cli.cpu.usage`

---

### 模块 9：扩展市场 ⭐⭐⭐⭐

数据源：`gemini extensions install|list` + `gemini_cli.extension_*` 事件

---

### 模块 10：自定义命令编辑器 ⭐⭐⭐⭐

数据源：TOML 文件系统 + `gemini_cli.slash_command`

---

### 模块 11：技能管理器 ⭐⭐⭐⭐

数据源：`/skills list|enable|disable` + `skills.*`

---

### 模块 12：Shell 权限控制面板 ⭐⭐⭐⭐

数据源：`tools.core|exclude|allowed` + `gemini_cli.tool_call(function_name=run_shell_command)`

---

### 模块 13：Hooks 编辑器 ⭐⭐⭐⭐

数据源：`/hooks list` + `hooks.*` + `hooksConfig.*`

---

### 模块 14：会话历史浏览器 ⭐⭐⭐

数据源：`/resume` + `general.sessionRetention` + `gemini_cli.conversation_finished`

---

### 模块 15：工作目录管理器 ⭐⭐⭐

数据源：`/directory show|add` + `context.includeDirectories`

---

## 附录：GUI 与 CLI 集成方式

### 方式 1：进程调用 + JSON 解析（推荐）
```typescript
import { spawn } from 'child_process';

const gemini = spawn('gemini', ['-p', prompt, '--output-format', 'stream-json']);
gemini.stdout.on('data', (data) => {
  const events = data.toString().split('\n').filter(Boolean);
  events.forEach(e => handleEvent(JSON.parse(e)));
});
```

### 方式 2：直接读写配置
```typescript
import { readFileSync, writeFileSync } from 'fs';
const settingsPath = join(homedir(), '.gemini', 'settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
```

### 方式 3：监听 Telemetry 日志
```typescript
import { watch } from 'fs';
const logPath = '.gemini/telemetry.log';
watch(logPath, () => {
  // 解析新增日志行
  // 更新仪表盘
});
```

### 方式 4：OTLP Collector 接入
```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "useCollector": true,
    "otlpEndpoint": "http://localhost:4317"
  }
}
```
GUI 启动本地 OTLP collector，直接接收结构化指标和日志。
