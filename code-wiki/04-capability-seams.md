# 04 · 能力接缝与服务总表

本页是"一个 `ctx.<key>` 由谁定义、有多少实现、谁在消费"的索引。内容整理自仓库生成文件 `docs/capability-seams.md`（由 `scripts/gen-doc-graphs.ts` 生成，勿手改源文件）。

## 1. 什么是能力接缝

**接缝（seam）** = 一个可替换能力，含三种角色：

- **Service Definition**：拥有 `ctx.<key>` 与词汇类型的 Cordis `Service`。可以是抽象类（如 `ShellExecutor`、`FileSystem`、`SandboxProvider`），也可以是具体注册表（如 `WebRuntime`、`SkillRegistry`）。**绝不使用 TypeScript `interface`。**
- **Service Provider**：接口的实现，通常是按平台/传输/后端区分的多个包。
- **Consumer**：注入该服务的包，通常是面向模型的工具。

判定规则：它们是**同一个完整能力**，而不是"某个角色"；角色通常在演进取向独立时才拆成不同包，否则一个包可同时承担多个角色（如 `dsh-user-approval` 同时拥有审批接缝的定义与具体实现）。

**为什么接缝重要**：FileSystem 与 Subprocess provider 共享同一个执行世界，因此把两者指向远程沙箱，会连带迁移 Bash、PTY、LSP，而无需任何 provider fork。

## 2. 核心脊梁服务

| `ctx` 键 | 角色 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|---|
| `ctx.sessions` | core | `core/session` | — | agent-loop、agent、session-persistence、session-query(+sqlite)、subagent-in-process-driver、message-feedback |
| `ctx.systemPrompt` | core | `core/system-prompt` | — | agent-loop、tools、tool-fs、tool-terminal、tool-web |
| `ctx.tools` | core | `core/tools` | — | agent-loop 及各 `tool-*` |
| `ctx.agents` | core | `core/agent` | — | agent-loop、acp、subagent-in-process-driver |
| `ctx.agentLoop` | bundle | `core/agent-loop` | — | bundle/base、bundle/sdk-minimal |
| `ctx.agentDefaultModel` | core | `core/agent-default-model` | — | api/session-controller、bundle/headless |
| `ctx.llm` | seam | `llm/llm` | `llm-deepseek`、`llm-pi-ai`、`llm-replay` | agent-loop、compaction-basic |
| `ctx.webhookRuntime` | core | `webhook/webhook` | — | `webhook-github` |

## 3. 能力接缝（seam）

### 3.1 执行世界

| `ctx` 键 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|
| `ctx.subprocess` | `subprocess/subprocess` | `subprocess-local`、`subprocess-ssh` | `bash-local`、`bash-sandbox`、`terminal-bash`、`lsp-stdio`、`subagent-acp`、`subagent-codex`、`subagent-claude-code` |
| `ctx.shell` | `shell/shell` | `bash-local`、`bash-sandbox`、`pwsh-local` | `tool-bash`、`tool-pwsh`、hooks |
| `ctx.terminals` | `terminal/terminal` | `terminal-bash` | `tool-terminal` |
| `ctx.fs` | `fs/fs` | `fs-local`、`fs-sandbox`、`fs-ssh` | `tool-fs`（配套 `fs-observation-policy`） |
| `ctx.sandbox` | `sandbox/sandbox` | `sandbox-local`、`sandbox-ssh` | `bash-sandbox`、`terminal-bash` |
| `ctx.ssh` | `ssh/ssh` | — | `fs-ssh`、`subprocess-ssh`、`sandbox-ssh` |
| `ctx.ptcRuntime` | `ptc-runtime/ptc-runtime` | `ptc-runtime-node`、`experimental-ptc-runtime-python` | `core/tools`、`workflow-ptc` |

### 3.2 模型与上下文

| `ctx` 键 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|
| `ctx.llm` | `llm/llm` | `llm-deepseek`、`llm-pi-ai`、`llm-replay` | agent-loop、compaction-basic |
| `ctx.deepseekLlmApiExtensions` | `llm/deepseek-llm-api-extensions` | `session-log-deepseek`、`plugin-package-inventory-deepseek` | `llm-deepseek` |
| `ctx.compaction` | `compaction/compaction` | `compaction-basic` | `compaction-basic` |
| `ctx.tokenMeter` | `llm/token-meter` | — | `compaction-basic` |
| `ctx.toolResultPruner` | `compaction/compaction-tool-result-pruner` | — | `compaction-basic` |
| `ctx.skills` | `skill/skill` | `skill-filesystem`、`skill-badge`、`skill-office`、`sandbox-windows-acl` | `tool-skill` |
| `ctx.web` | `web/web` | `web-search-exa`、`web-search-perplexity`、`web-search-deepseek`、`web-fetch-http` | `tool-web` |
| `ctx.lsp` | `lsp/lsp` | `lsp-stdio` | `tool-lsp` |
| `ctx.spillStore` | `spill/spill` | `spill-local` | `spill-policy` |
| `ctx.sessionPersistence` | `session/session-persistence` | `session-persistence-jsonl` | agent-loop、tool-bash、hooks、session-query(+sqlite)、message-feedback |
| `ctx.sessionTitle` | `session/session-title` | `session-title-first-prompt-llm`、`session-title-all-prompts-llm` | — |
| `ctx.sessionTelemetry` | `session/session-telemetry` | `session-telemetry-otel` | —（输出离开进程） |
| `ctx.sessionQuery` | `session-query/session-query` | `session-query-sqlite` | `session-reference`、`tool-session-query` |
| `ctx.fileReferences` | `context/file-reference` | `file-reference-local` | `api/session-controller` |
| `ctx.attachments` | `attachment/attachment` | `attachment-local` | api/session-controller、tool-fs、llm-pi-ai、llm-deepseek |
| `ctx.jobs` | `jobs/jobs` | `jobs-local` | `tool-bash`、`tool-pwsh`、`tool-terminal`、`tool-subagent`、`tool-jobs`、api/job-controller |
| `ctx.workflowEngine` | `workflow/workflow` | `workflow-ptc` | `tool-workflow`、`tool-ralph` |
| `ctx.subagents` | `subagent/subagent` | `subagent-spawn-in-process`、`subagent-fork-in-process`、`subagent-acp`、`subagent-codex`、`subagent-claude-code`、`subagent-dsh-sdk` | `tool-subagent`、`tool-subagent-control`、`tool-ralph` |
| `ctx.mcpResources` | `mcp/mcp-resources` | `mcp-client` | `mcp-resources` |
| `ctx.browserUse` | `browser-use/browser-use` | `experimental-browser-use-*`（playwright-mcp / chrome-devtools-mcp / stagehand-native） | 同左 |
| `ctx.computerUse` | `computer-use/computer-use` | `experimental-computer-use-cua-driver-*` | 同左 |

### 3.3 人机协作与安全

| `ctx` 键 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|
| `ctx.approval` | `interaction/user-approval` | —（answerers 是监听器） | `core/tools`、`tool-bash`、`acp` |
| `ctx.userQuestions` | `interaction/user-questions` | —（UI 前端提供 answer provider） | `tool-ask-user` |
| `ctx.permissionPresets` | `interaction/permission-presets` | — | —（用户面预设表） |
| `ctx.sandboxPolicy` | `sandbox/sandbox-policy` | — | `bash-sandbox`、`fs-sandbox`、`terminal-bash` |
| `ctx.shellEnv` | `shell/shell-env` | — | `tool-bash`、`tool-pwsh` |
| `ctx.credentials` | `credentials/credentials` | `credentials-local` | api/settings-controller、llm-deepseek、llm-pi-ai |
| `ctx.deepseekAccount` | `credentials/deepseek-account` | `deepseek-account-platform` | api/account-controller、llm-deepseek |
| `ctx.authorization` | `credentials/authorization` | — | `llm-pi-ai` |

### 3.4 数据与存储

| `ctx` 键 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|
| `ctx.storage` | `storage/storage` | `storage-json`、`storage-sqlite` | `storage-domain` |
| `ctx.storageDomain` | `storage/storage-domain` | — | `workspace` |
| `ctx.workspaceRegistry` | `workspace/workspace` | — | api/workspace-controller、api/session-controller |
| `ctx.settings` | `settings/settings` | —（文件后端） | api/settings-controller |
| `ctx.configEditor` | `boot/config-editor` | — | `settings`、`agent-default-model` |
| `ctx.messageFeedback` | `feedback/message-feedback` | — | —（Host Remote） |
| `ctx.sessionFeedback` | `feedback/command-feedback` | — | —（`/feedback`） |

### 3.5 组合、扩展与 GUI

| `ctx` 键 | 定义包 | 提供者 | 主要消费者 |
|---|---|---|---|
| `ctx.profileContext` | `boot/app-boot` | — | `plugin-manager` |
| `ctx.hmr` | `boot/hmr` | — | `app-boot` |
| `ctx.pluginManager` | `boot/plugin-manager` | — | `plugin-manager`、`ui-settings-plugin-inventory` |
| `ctx.agentPresets` | `preset/agent-preset-registry` | — | — |
| `ctx.commands` | `interaction/commands` | — | — |
| `ctx.goals` | `goal/goal` | — | — |
| `ctx.schedule` | `schedule/schedule` | — | — |
| `ctx.planMode` | `plan/plan-mode` | — | — |
| `ctx.sessionProjections` | `session/session-projection` | — | api/session-controller、tool-todo、session-title |
| `ctx.sessionProjectionCache` | `session/session-projection-cache` | — | api/session-controller、session-query、session-reference |
| `ctx.dynamicCordisRunner` | `extensions/cordis-host-runner` | — | `tool-cordis` |
| `ctx.cordisInspect` | `extensions/cordis-host-runner` | — | `tool-cordis` |
| `ctx.typert` | `typert/registry` | — | `typert-loader`、`api/gateway` |
| `ctx.typertGateway` | `api/gateway` | — | — |
| `ctx.webServer` | `host/webserver` | — | client-connection、client-modules、client-hmr |
| `ctx.directoryPicker` | `host/directory-picker` | `host-directory-picker-native`、`host-directory-picker-browse` | api/workspace-controller |
| `ctx.clientModules` | `client/modules` | — | `client-hmr` |
| `ctx.connection` | `client/connection` | — | api/gateway、host-frontend-static |
| `ctx.otel` | `telemetry/otel` | — | host-product-telemetry-otel、session-telemetry-otel |
| `ctx.productTelemetry` | `host/product-telemetry-otel` | — | — |
| `ctx.inspector` | `experimental/inspector` | — | — |
| `ctx.agentTeams` | `experimental/agent-team` | — | experimental-tool-agent-team |
| `ctx.speechToText` | `experimental/speech-to-text` | `experimental-speech-to-text-sensevoice` | experimental-api-speech-to-text |
| `ctx.claudeCodeMods` | `experimental/claude-code-mods` | — | — |

> 注：`ctx.agentTeams` 是公开的 opt-in 协调接缝（durable roster、task board、mailbox，叠在可续跑 subagent 之上）。

## 4. Host 侧 Remote 控制器（Web GUI 的桥）

这些 `ctx` 服务把 Host 能力投影到生成的 Remote 命名空间，由浏览器半侧消费：

| `ctx` 键 | 定义包 | 职责 |
|---|---|---|
| `ctx.sessionController` | `api/session-controller` | Session 命令、冷读、耐久事件跟随、活控制态、模型目录、工作区打开、Agent 激活策略 |
| `ctx.workspaceController` | `api/workspace-controller` | Workspace 命令与可重连的 Workspace 状态投递 |
| `ctx.directoryPickerController` | `api/workspace-controller` | 目录选择能力上线：能力门控、取消、接缝编码的失败 |
| `ctx.workspaceFiles` | `api/workspace-files` | 会话工作区根内文件的 stat / 分页文本 / 字节窗口 / 目录列举 / 变更流 |
| `ctx.workspaceChanges` | `deliverables/workspace-changes` | 按 session 与事件序号提供每 turn 的变更摘要 |
| `ctx.terminalController` | `api/terminal-controller` | 用户终端进程、默认 shell 解析、有界屏幕恢复 |
| `ctx.jobController` | `api/job-controller` | 单个后台作业的观测记录流 |
| `ctx.settingsController` | `api/settings-controller` | 用户设置接缝上线（读取恒为脱敏） |
| `ctx.credentialsController` | `api/settings-controller` | 凭证引用接缝上线（值不可见、只写） |
| `ctx.sessionFileReferences` | `api/session-controller` | 经 Session Controller 的 Agent 查找策略做文件引用发现 |
| `ctx.sessionSkillCatalog` | `api/session-controller` | 列出会话组合中的用户可调用 skill，不激活冷 Agent |
| `ctx.fileUploads` | `client/file-upload` | 流式接入、持久存储、暂存收据生命周期 |

## 5. 替换一个 provider 会发生什么

以 shell 为例：把 `ctx.shell` 的 provider 从 `bash-local` 换成 `bash-sandbox`，`tool-bash` 与 hook 桥接**无需改动**即可获得沙箱化执行；进一步地，若同时把 `ctx.subprocess` 指向 `subprocess-ssh`，则 Bash、PTY（`terminal-bash`）、LSP（`lsp-stdio`）会一并迁移到远程世界。

这就是"扩展插件依赖 Service Definition、绝不依赖具体 provider"这一规则的工程价值。依赖方向规则见 [08-dependencies.md](08-dependencies.md)。

## 6. 维护方式

`docs/capability-seams.md` 由脚本生成（hybrid 模式）：服务从 Cordis 声明中发现，接口/实现/消费者角色在 `scripts/gen-doc-graphs.ts` 中分类，并有完整性守卫。因此**本页只应作为导读**；新增接缝时请更新定义包并重新运行 `pnpm run gen-doc-graphs`。
