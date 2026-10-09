# 02 · 仓库布局与模块职责

## 1. 顶层目录布局

```text
vendor/       Cordis 及少量上游包的固定源码副本（rescope 后 private: true）
packages/     @deepseek-ai/dsh-<pkg> 工作区，按能力族分组：packages/<group>/<pkg>/
python/       Python SDK / runtime
native/       @deepseek-ai/node-addon-system 源码（原生插件）
benchmarks/   性能门禁
apps/         应用：cli、web、desktop、desktop-host 等
.agents/      Agent 工作流与决策记录（Agent Notes、skills）
docs/         文档（权威规范见 docs/AGENTS.md）
scripts/      门禁脚本与生成器
website/      VitePress 文档站投影
```

pnpm workspace 的 `workspaces` 字段为：`vendor/*`、`packages/*/*`、`native/system`、`native/system/packages/*`、`apps/*`、`website`。

## 2. 命名与分组约定

- 每个包都是 `@deepseek-ai/dsh-<name>`，且**恰好属于一个 group**；新包加入既有 group，新增 group 时须更新该 group 的 README 与 `packages/README.md` 的总表。
- 跨包引用使用包名；包内相对引用使用 `.ts`。
- 全仓 ESM。Harness 包在 `peerDependencies`/`devDependencies` 中声明 `@deepseek-ai/cordis`。
- 工作区依赖分段：DSH 包用 `workspace:*`，vendor/native 用 `workspace:~`。
- 测试位于包级 `tests/`，而非 `src/__tests__/`。
- `src/types.ts` 只放类型，不放运行时代码。

## 3. 分组职责总表

下表来自 `packages/README.md`，是"哪个 group 负责什么"的权威索引。

| Group | 职责 |
|---|---|
| `core/` | 产品 API 脊梁：sessions、prompts、tools、agent services 以及具体 loop |
| `api/` | 远程 BFF 装配与 Typert RPC 网关 |
| `typert/` | 类型图生成、产物加载与运行时注册表 |
| `goal/` | 同会话目标（goal）持久化与生命周期 |
| `schedule/` | 宿主拥有的定时跟进 |
| `feedback/` | 人类反馈采集与命令 |
| `telemetry/` | 共享 Cordis OTel 上报通道 |
| `identity/` | 共享匿名身份 |
| `llm/` | LLM 能力族：抽象服务 + provider 适配器 |
| `subprocess/` | 子进程能力族：Service Definition + 本地进程树 provider |
| `ssh/` | POSIX 远程连接，配套 filesystem / subprocess / sandbox provider |
| `shell/` | Bash 能力族：executor 接缝、本地实现、面向模型的工具 |
| `terminal/` | 持久 PTY 能力族：owner 作用域会话、本地实现、面向模型的工具 |
| `ptc-runtime/` | PTC 执行能力族：Service Definition + 沙箱化 Node provider + PTC 模式 Consumer |
| `computer-use/` | 排他性的具名桌面 provider 注册 |
| `browser-use/` | 排他性的具名浏览器 provider 注册 |
| `sandbox/` | 进程约束接缝；bwrap/Landlock/Seatbelt 后端 |
| `deliverables/` | Turn 交付物：显式文件交付与已记录的工作区变更 |
| `fs/` | 文件系统能力族：接缝、本地实现、文件工具、发现工具 |
| `lsp/` | LSP 能力族：接缝、通用 stdio provider、`lsp` 工具 |
| `skill/` | Skill 能力族：provider 注册表、本地 provider、面向模型的 catalog/loader |
| `compaction/` | 压缩能力族：Service Definition + basic provider + 命令 Consumer |
| `context/` | 模型可见请求上下文：工作区指令、时间上下文、引用 |
| `subagent/` | 子 Agent 能力族：provider 注册契约与面向模型的委派工具 |
| `jobs/` | 通用后台作业运行时与面向模型的作业控制工具 |
| `experimental/` | 预稳定原型（对外公开，含显式私有例外） |
| `workflow/` | Workflow 接缝、PTC 流程引擎、`workflow`/`ralph` 工具 |
| `webhook/` | 经校验的外部事件、可信规则、fire-and-forget Workspace Session |
| `web/` | Web 能力族：接缝、search/fetch provider、面向模型的 web 工具 |
| `document/` | 共享 Host 端 Office→PDF 转换 |
| `attachment/` | 持久附件身份、校验、本地内容寻址存储 |
| `spill/` | Spill 能力族：存储接缝、本地实现、工具结果 spill 策略 |
| `todo/` | 面向模型的 `todo_write` 工具 |
| `plan/` | 带直接进入命令与受评审退出的计划协作状态 |
| `preset/` | 依据 preset `cordis.yml` 的每会话 agent 组合 |
| `guard/` | Loop 卫生守卫：重复调用提醒 + `tools/execute` 截止期强制 |
| `bundle/` | 可安装的 `dsh --profile` 补丁层 |
| `extensions/` | Agent 运行时自修改：活体插件/服务检视与模型编写的挂载/卸载 |
| `mcp/` | 外部 MCP server 以原生工具形式暴露 |
| `hooks/` | Hook 桥接 + 共享的 Claude Code / Codex 线协议库 |
| `session/` | 持久会话数据面：持久化接缝 + 后端、投影接缝、日志驱动的标题、会话上报 |
| `session-query/` | 会话检索族：逻辑语料、有界读取、血缘、语义过滤、SQLite 全文检索 |
| `settings/` | 用户设置接缝 + 文件后端 provider |
| `credentials/` | 凭证引用/记录接缝 + env-over-`.env` provider + 询问人类的授权流程 |
| `storage/` | 非会话存储中枢 + 后端 + 领域形态 |
| `workspace/` | Workspace 实体 |
| `sdk/` | 进程外 SDK：JSON-RPC 协议与 TypeScript client/server |
| `acp/` | 仅自动化的 Agent Client Protocol server |
| `interaction/` | 人机协作面：审批/交互接缝、权限预设、命令、ask-user 工具 |
| `boot/` | 共享 app-bin 启动胶水 |
| `host/` | Web GUI Host 服务、目录选择、应用启动、插件清单与产品遥测 |
| `client/` | Web GUI 浏览器半侧：shell、wire、对象服务、slots、`ui-*` 插件 |
| `test-support/` | 测试基础设施（testkits、replay、Loader smokes） |
| `util/` | 跨组共享的零依赖底层工具（`Branded<B>`、home/path、timeout、retention） |

**发布预期**：多数 group 属于 product（稳定 API）；例外是 `experimental/`（不承诺稳定性与支持），以及 `test-support/`、`util/`（支持类，兼容性预期更低）。

## 4. 组内构成速查

以下按能力族归纳组内的"定义 / 提供者 / 消费者"分工。角色定义详见 [04-capability-seams.md](04-capability-seams.md)。

### 4.1 模型与推理

- `llm/`：定义 `dsh-llm`（`ctx.llm`，服务类 `LlmRuntime`，适配器基类 `LlmAdapter`）；provider 有 `llm-deepseek`、`llm-pi-ai`、`llm-replay`（测试）；配套 `deepseek-llm-api-extensions`、`token-meter`、`plugin-package-inventory-deepseek`。
- `compaction/`：定义 `dsh-compaction`（`ctx.compaction`，`CompactionEngine`）；provider `compaction-basic`；配套 `compaction-tool-result-pruner`（`ctx.toolResultPruner`）与 `/compact` 命令。

### 4.2 执行世界（进程 / 文件系统 / 终端 / 沙箱）

- `subprocess/`：定义 `dsh-subprocess`（`ctx.subprocess`，`SubprocessRuntime`）；provider `subprocess-local`（本地进程树）。Bash 执行器、PTY 后端、LSP host、进程外 subagent 后端都经它派生。
- `shell/`：定义 `dsh-shell`（`ctx.shell`，`ShellExecutor`）；provider `bash-local`、`bash-sandbox`、`pwsh-local`；消费者 `tool-bash`、`tool-pwsh`、hooks。配套 `shell-env`（`ctx.shellEnv`，受管 bash 环境注册表）。
- `fs/`：定义 `dsh-fs`（`ctx.fs`，`FileSystem`）；provider `fs-local`、`fs-sandbox`、`fs-ssh`；消费者 `tool-fs`；配套 `fs-observation-policy`（经 `fs/*` 事件门贡献观测态检查）。
- `terminal/`：定义 `dsh-terminal`（`ctx.terminals`，`TerminalSessionService`）；provider `terminal-bash`；消费者 `tool-terminal`。
- `sandbox/`：定义 `dsh-sandbox`（`ctx.sandbox`，`SandboxProvider`）与 `sandbox-policy`（`ctx.sandboxPolicy`，`SandboxPolicyService`）；后端 `sandbox-local`、`sandbox-ssh`、`sandbox-windows-acl`。
- `ssh/`：`dsh-ssh`（`ctx.ssh`，`SshConnection`）拥有一条经认证的 OpenSSH 连接，并配套 `fs-ssh`、`subprocess-ssh`、`sandbox-ssh` 三个远程 provider。

### 4.3 面向模型的能力

- `web/`：定义 `dsh-web`（`ctx.web`，`WebRuntime`）；provider `web-search-exa`、`web-search-perplexity`、`web-search-deepseek`、`web-fetch-http`；消费者 `tool-web`。
- `skill/`：定义 `dsh-skill`（`ctx.skills`，`SkillRegistry`）；provider `skill-filesystem`、`skill-badge`、`skill-office`；消费者 `tool-skill`。
- `lsp/`：定义 `dsh-lsp`（`ctx.lsp`，`Lsp`）；provider `lsp-stdio`；消费者 `tool-lsp`。
- `subagent/`：定义 `dsh-subagent`（`ctx.subagents`，`SubagentRuntime`）；provider `subagent-spawn-in-process`、`subagent-fork-in-process`、`subagent-acp`、`subagent-codex`、`subagent-claude-code`、`subagent-dsh-sdk`；消费者 `tool-subagent`、`tool-subagent-control`、`tool-ralph`。
- `jobs/`：定义 `dsh-jobs`（`ctx.jobs`，`JobRegistry`）；provider `jobs-local`；消费者 `tool-jobs`（模型侧的读/列/杀），并服务于后台 bash/pwsh、PTY、subagent。
- `spill/`：定义 `dsh-spill`（`ctx.spillStore`，`SpillStore`）；provider `spill-local`；消费者 `spill-policy`（经 `tools/post-execute` 决定何时 spill）。
- `workflow/`：定义 `dsh-workflow`（`ctx.workflowEngine`，`WorkflowEngine`）；provider `workflow-ptc`；消费者 `tool-workflow`、`tool-ralph`。
- `ptc-runtime/`：定义 `dsh-ptc-runtime`（`ctx.ptcRuntime`，`PtcRuntime`）；provider `ptc-runtime-node`、`experimental-ptc-runtime-python`；消费者 `core/tools`（PTC 呈现）与 `workflow-ptc`。
- `mcp/`：`dsh-mcp-resources`（`ctx.mcpResources`，`McpResourceRuntime`）+ `mcp-client`，把配置的 MCP server 映射为工具/资源。
- `browser-use/` / `computer-use/`：分别定义 `BrowserUseRegistry`（`ctx.browserUse`）与 `ComputerUseRegistry`（`ctx.computerUse`），每个服务实例只允许一个 provider 拥有具名能力；provider 在 `experimental/`。

### 4.4 会话与人机协作

- `session/`：`ctx.sessions`、`ctx.sessionPersistence`、`ctx.sessionProjections`、`ctx.sessionProjectionCache`、`ctx.sessionTitle`、`ctx.sessionTelemetry` 等（详见 [06-session-data-plane.md](06-session-data-plane.md)）。
- `session-query/`：`ctx.sessionQuery`（`SessionQueryEngine`）+ `session-query-sqlite`（全文检索后端）+ `tool-session-query` + `session-log-export`。
- `context/`：`ctx.fileReferences`（`FileReferenceService`）+ `file-reference-local`；`session-reference`（`ctx.sessionReferenceResolver`）；以及工作区指令、时间上下文。
- `interaction/`：`ctx.approval`（`ApprovalService`）、`ctx.userQuestions`（`UserQuestionService`）、`ctx.commands`（`CommandRuntime`）、`permission-presets`（`ctx.permissionPresets`）、`tool-ask-user`。
- `attachment/`：`ctx.attachments`（`AttachmentStore`）+ `attachment-local`。
- `goal/`、`schedule/`、`plan/`、`todo/`、`feedback/`：分别为 `GoalService`、`ScheduleService`、`PlanModeController`、`todo_write` 工具、反馈采集。
- `preset/`：`agent-preset-registry`（`ctx.agentPresets`）按 YAML 预设组合每会话 agent。
- `guard/`、`deliverables/`、`extensions/`、`webhook/`：loop 守卫、turn 交付物、运行时自修改、外部 webhook 入口。

### 4.5 存储、设置与身份

- `storage/`：`ctx.storage`（`Storage`）+ `storage-json` / `storage-sqlite` + `storage-domain`（`ctx.storageDomain`）。
- `settings/`：`ctx.settings`（`SettingsForms`）+ `config-editor`（`ctx.configEditor`）。
- `credentials/`：`ctx.credentials`（`CredentialProvider`）、`ctx.authorization`（`AuthorizationService`）、`ctx.deepseekAccount`（`DeepSeekAccount`）。
- `workspace/`、`identity/`、`telemetry/`：`ctx.workspaceRegistry`（`WorkspaceRegistry`）、匿名身份、`ctx.otel`。

### 4.6 装配、应用与 GUI

- `bundle/`：`base`、`web-app`、`headless`、`sdk-app`、`sdk-minimal`、`acp-app`。
- `boot/`：`app-boot`（`ctx.profileContext`、`ctx.hmr`）、`plugin-manager`（`ctx.pluginManager`）、`config-editor`、`cmdline` 等。
- `api/`：`gateway`（`ctx.typertGateway`）、`remotes`，以及一批 Remote 控制器（`session-controller`、`workspace-controller`、`job-controller`、`settings-controller`、`account-controller`、`terminal-controller`、`workspace-files`）。
- `typert/`：`registry`（`ctx.typert`，`TypertRegistry`）、`loader`、`generator`。
- `host/`：`webserver`（`ctx.webServer`，`WebServer`）、`directory-picker`（`ctx.directoryPicker`）、`frontend-static`、`product-telemetry-otel`。
- `client/`：`connection`、`modules`（`ctx.clientModules`）、`hmr` 以及大量 `ui-*` 插件（会话、对话、设置、模型选择、文件上传、命令等）。
- `sdk/`、`acp/`、`host/`、`apps/`：进程外 SDK、ACP server、GUI host、以及 `apps/cli`、`apps/web`、`apps/desktop`。
