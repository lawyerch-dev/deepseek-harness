# 06 · 会话数据面：日志、持久化、投影、查询与存储

会话（Session）是 dsh 的核心持久事实。本页说明日志格式、持久化接缝、投影读模型、检索与通用存储。

## 1. 模型：append-only 事件日志

- `ctx.sessions`（`SessionStore`，`packages/core/session/src/index.ts`）拥有**追加式**的 `SessionEvent` 日志与内存 store，并广播耐久事件流（`session/event`）。
- `deriveMessages()` 从日志投影出模型历史——日志是模型所见上下文的**唯一来源**。
- 每个成功请求记入 `assistant/message`，并内嵌产生它的精确紧凑流；失败/重试/取消/流错误的尝试在未产生表面消息时结算为 `assistant/attempt`，不进入模型历史。
- 硬进程丢失（结算前）不会留下任何耐久 attempt 流。

**关键不变式**：Model-visible ⟺ logged。任何抵达模型请求的内容都必须能从日志重建；新增模型可见输入 = 新增 session 事件。

## 2. 持久化接缝

- 定义：`session/session-persistence`，`ctx.sessionPersistence`，抽象类 `SessionPersistence extends Service`（`packages/session/session-persistence/src/index.ts`）。
- 核心 API：`create` / `open` / `stat` / `list` / `export`（`flush` 亦在 README 中描述）。
- 提供者：`session-persistence-jsonl`（JSONL 后端，每个 Session 一个产物）。
- 直接消费者：`agent-loop`、`tool-bash`、`hooks-claude-code`、`hooks-codex`、`session-query`、`session-query-sqlite`、`message-feedback`。

### 2.1 格式版本与生成（generation）

- 存储契约在 `src/storage-contract.ts` 中经 `assertVersion` 强制**当前格式版本门**，绑定 `SESSION_FORMAT_VERSION`。
- 存储事件**fail-closed 校验**：除非事件标记 `ignorable`，否则拒绝未知事件类型，以防会话被错误重建。
- JSONL 物理布局：v0 使用 `session.jsonl[.zstd]`；v1 及以后使用小写 `session.vN.jsonl[.zstd]`。**已提交的 generation 路径永不重命名、替换或删除。**
- Session 消费者只认识**当前逻辑格式**：
  - header-only 的 `stat` / `list` 重扫每个 Session 目录，选择数值最高的规范 generation，并可翻译受支持的历史 header，而不加载事件或发布后继版本；
  - 存储会话的 `open` 选中同一 generation，拒绝未来版本，或一次性解码并组合静态的**相邻迁移链**，返回已校验的当前逻辑事件；
  - 读打开使用内存结果、不发布后继；写打开先编码、校验，**独占发布**最终以版本命名的后继，源文件保持不变。
- 每个相邻迁移包只拥有一步 `vN -> vN+1`（如 `session-format-v0-to-v1`、`session-format-v1-to-v2`，另有 `session-format` 与 `session-format-catalog`）。
- 未封口的中断尾部（unsealed interrupted tail）的常规修复属于 handle 消费者的责任。

升级与迁移策略见仓库 `.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md`。

## 3. 投影（读模型）接缝

- 定义：`session/session-projection`，`ctx.sessionProjections`，`SessionProjectionRegistry extends Service`（`packages/session/session-projection/src/index.ts`）。核心单元契约是 `ProjectionDefinition`。
- 语义：注册的单位**增量折叠**已提交事件；host 消费者用 `stateOf()` 读取一份类型化状态；载体用 `snapshot()` 批量下发裁剪后的客户端视图。
- **强制接缝**：host 读取者必须在激活期要求该服务，或在注册表/所需 key 缺失时显式失败。贡献者可以保留 `ctx.inject(['sessionProjections'], ...)` 注册，但不得静默为缺失的 host 值取默认。
- `agent-loop` 为其读取者注册共享的 `turnBoundary` 状态。
- 缓存：`session/session-projection-cache`，`ctx.sessionProjectionCache`（`SessionProjectionCache extends Service`）按 session **耐久 checkpoint** 各投影单元状态（节流 + `turn/end`/detach 强制点），提供缓存视图并加速已准备 Session 的投影水合。

## 4. 会话检索

- 定义：`session-query/session-query`，`ctx.sessionQuery`，抽象类 `SessionQueryEngine extends Service`。
- 接口提供精确读取、过滤与 trace；具体后端（`session-query-sqlite`，`SessionQueryEngine` 实现）增加全文协调、排序、片段与游标 generation。
- 模型消费者 `tool-session-query` 拥有工作区权威与无游标渲染；`context/session-reference` 消费它以准备跨会话快照。

## 5. 会话标题与遥测

- `session/session-title`，`ctx.sessionTitle`，`SessionTitleService extends Service`：拥有确定性回退、latest-title 折叠，以及**唯一可选的异步 provider 注册**。provider 有 `session-title-first-prompt-llm` 与 `session-title-all-prompts-llm`。
- `session/session-telemetry`，`ctx.sessionTelemetry`，抽象类 `SessionTelemetryBackend`：捕获、脱敏并把会话记录交给**单一后端**；除输出离开进程外无其他消费者。后端 `session-telemetry-otel`。

## 6. 反馈

- `feedback/message-feedback`，`ctx.messageFeedback`：拥有规范日志中的每条 assistant 消息反馈、目标校验、逐项 CAS，以及 Host 一元 Remote 契约。反馈**不在模型历史内**。
- `feedback/command-feedback`，`ctx.sessionFeedback`：以 log-only 的 `feedback/record` 事件记录一条会话级备注（含分类），`/feedback` 命令共享同一生产者。

## 7. 通用存储中枢

- `storage/storage`，`ctx.storage`，`Storage extends Service`：后端按名字并列注册；数据形态（domain 优先）挂到中枢上，把类型化操作翻译为不透明的 KV 单元原语。
- 后端：`storage-json`、`storage-sqlite`。
- 领域形态：`storage/storage-domain`，`ctx.storageDomain`：等待所有已配置后端就绪，然后发布该 domain 形态为一个**生命周期绑定的服务**，用于类型化持久状态。消费者是 `workspace`。
- `workspace/workspace`，`ctx.workspaceRegistry`，`WorkspaceRegistry extends Service`：在 domain 设施之上拥有 `WorkspaceId` 品牌化记录；稳定的 `sessionIds` 账户驱动 Host RPC 与 GUI 投影。

## 8. 附件（二进制）

- `attachment/attachment`，`ctx.attachments`，抽象类 `AttachmentStore extends Service`；提供者 `attachment-local`（本地内容寻址存储）。
- 语义：Host 在会话事件之前提交已被接受的图像；provider 适配器把已授权的耐久引用解析为 provider 原生内容。消费者：`api/session-controller`、`tool-fs`、`llm-pi-ai`、`llm-deepseek`。

## 9. 设置、凭证与身份

- `settings/settings`，`ctx.settings`，`SettingsForms extends Service`：从活跃 profile entries 构造易变的 `Config` 字段，并把已校验的编辑委托给 config-editor。插件消费各自的 `Config` 引用。
- `credentials/credentials`，`ctx.credentials`，抽象类 `CredentialProvider`：配置携带**对 secret 的引用**，provider 拥有值。消费者按操作解析，因此轮换凭证能立刻作用于下一次请求；settings controller 只暴露无值视图与只写存储。
- `credentials/authorization`，`ctx.authorization`，`AuthorizationService extends Service`：由"知道如何获取某凭证"的插件注册流程，以它们写入的记录为 key；接缝拥有对话与"每 key 一次尝试"的生命周期，**绝不拥有协议**。
- `credentials/deepseek-account`，`ctx.deepseekAccount`，抽象类 `DeepSeekAccount`：Host 拥有浏览器授权与本地凭证；UI 消费者拿到状态而非 token。提供者 `deepseek-account-platform`。
