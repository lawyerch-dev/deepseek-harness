# 01 · 整体架构

本页给出 DeepSeek Harness 的架构心智模型。深入某个子系统时，请进入对应专题页。

## 1. Cordis：一切皆插件

Cordis 是 dsh 之下的框架：**插件向共享 context 贡献服务（service）、类型化事件（typed events）和可回滚 effect**。

- 产品的每一部分都是插件，包括模型适配器、工具注册表、会话日志、以及 Agent 主循环本身。
- **没有特权核心**：扩展 dsh 的方式是在其它插件旁边挂载一个新插件，而不是修改内核。
- **注册即 effect**：所有注册（`ctx.effect()` / `ctx.on()`）在其插件卸载时自动回滚（unwind）。注册表的 `register()` 通常返回 disposer。

Cordis 的设计理念见论文 *A Programming Paradigm for Spatiotemporal Composability*；入门读物为 `docs/cordis-primer.md`。

## 2. Profile 与 Bundle：运行时的插件树

一个运行中的 `dsh` 是一棵**在启动时按有序层叠组装出来的插件树**。

- **Profile（配置档）**：存放在 Harness home 中的具名组合。它列出所叠的 bundle、持有安装的树外插件，并保留用户自己的 `cordis.patch.yml`。
- **Bundle（捆绑层）**：Cordis 配置行（config rows）及其所挂载代码的分发格式，因此它插入的内容仍能被更上层的补丁覆盖。

二者都在各自 `package.json` 的 `dsh` 字段里自描述：`dsh.profile` 列出一个 profile 的 bundles，`dsh.bundle` 指向 bundle 的补丁文件。

**内置 profile**：`web`、`headless`、`sdk`、`sdk-minimal`、`acp`（`desktop` 名称保留给 Electron 应用）。其中 `web`、`headless`、`sdk`、`acp` 共享第一层 `dsh-base`；`dsh-sdk-minimal` 是刻意的例外——单个 bundle 拥有其完整显式 SDK 树，不引用 `dsh-base`。

**层叠顺序**（作用于空 entry 列表）：

1. 按 profile 所列顺序叠加每个 bundle 的补丁；
2. profile 自身的 `cordis.patch.yml`；
3. home 级 `$DSH_HOME/cordis.patch.yml`；
4. `--patch` 覆盖层。

补丁通过 id 定位某一行并整体替换其 config，或插入新行。用 `dsh --profile web --dump-config` 可以查看本机实际启动的树，打印出的任何行都能被自己的补丁替换。

细节见 [05-runtime-composition.md](05-runtime-composition.md)。

## 3. 三种事件域

事件是扩展点，**选对事件域是多数改动的第一决策**：

| 事件域 | 例 | 用途 |
|---|---|---|
| **Session 事件** | `turn/*`、`step/*`、`user/message`、`assistant/message`、`tool/call`、`tool/result` | 追加到会话日志、可跨重载存活的**持久事实** |
| **Agent 事件** | `agent/created`、`agent/inbox/*`、`agent/status`、`agent/pre-step`、`agent/request`、`agent/turn-stopping`、`agent/assistant-stream` | 携带存活 `Agent` 的**在途控制/观测**（inbox、step、状态、请求、校验、续跑） |
| **Capability 事件** | `fs/*`、`tools/*`、`telemetry/*` | 在不引入 loop 依赖的前提下，为某个接缝挂策略与适配器 |

其中 `agent/pre-step`、`agent/request`、`llm/stream`、`tools/pre-execute`、`tools/execute`、`tools/post-execute` 是 **waterfall**（监听器必须调用 `next()` 才能委托，否则短路）；`agent/turn-stopping` 是串行的、没有 `next()`。

## 4. turn / step 循环

- **step**：一次模型请求 + 它触发的工具调用。
- **turn**：零或多个 step；在首个输入被认领前打开，在"无所亏欠"时关闭。

```text
turn/start
  claim next-step input plus one queued message
  assemble prompt sections + tool schemas; project runtime context
  -> agent/pre-step                   reject | enter(messages, startsRequestSeries?)
     step/start
     agent/request -> prepareCall (cancellation commits neither system nor users)
     reconcile system/message using the prepared call capability
     append entered messages as user/message; log request/header and request/context as needed
     derive and freeze model history from the log
     stream the bound prepared call -> llm/stream -> agent/assistant-stream start
       agent/assistant-stream chunk*
       assistant/message | assistant/attempt -> agent/assistant-stream end
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     tools owe another request, or next-step input arrived -> claim -> next step
  -> agent/turn-stopping
turn/end
```

要点：

- `agent/pre-step` 决定被接受的输入，可改写或拒绝；被拒绝或首个认领为空的 turn 会**不消耗 step** 地关闭。
- `agent/request` 与 `prepareCall()` 在提交 system prompt 与已接受用户消息**之前**解析真实路由；任一异步阶段被取消则两者都不提交。
- 重试（retry）在打开的 step 内进行，重复"准备 + 对齐同一份渲染装配"，但**不重复**装配、`agent/pre-step` 或用户消息入账。
- 每个 `assistant/message` 内嵌产生它的精确紧凑流；失败/重试/取消的尝试记入 `assistant/attempt`，不进入模型历史。
- 事件与生命周期的完整时序见仓库 `docs/agent-lifecycle.md`，事件的生产者/消费者清单见 `docs/event-producer-consumer.md`。

## 5. 会话日志：模型上下文的唯一来源

会话日志（session log）是模型所见上下文的来源；`deriveMessages()` 从日志投影出模型历史。

- **Model-visible ⟺ logged**：任何抵达模型请求的内容都必须能从日志重建。新增模型可见输入 = 新增 session 事件。
- 分叉（fork）、恢复（resume）、transcript、遥测、持久化都从这些持久结算（settlement）派生；实时 UI 的增量则来自 `agent/assistant-stream`。
- **投影接缝**：`dsh-session-projection` 拥有 `ctx.sessionProjections`；注册的单元增量折叠已提交事件，宿主消费者用 `stateOf()` 读取一份类型化状态，载体用 `snapshot()` 批量下发裁剪后的客户端视图。

细节见 [06-session-data-plane.md](06-session-data-plane.md)。

## 6. 能力接缝（Capability Seam）

**接缝**是一个可替换能力，含三种角色：

- **Service Definition（服务定义）**：拥有 `ctx.<key>` 与词汇类型的 Cordis `Service`（抽象类，如 `ShellExecutor`；或具体注册表，如 `WebRuntime`，绝不使用 TypeScript `interface`）。
- **Service Provider（服务提供者）**：实现该接口。
- **Consumer（消费者）**：注入该服务，通常是面向模型的工具。

典型例子是 shell：`dsh-shell`（定义）、`dsh-bash-local` / `dsh-bash-sandbox`（提供者）、`dsh-tool-bash`（消费者）。**接缝是完整能力，而不是其中某个角色。**

接缝是"一次 provider 替换即可改变整个产品"的原因：文件系统与子进程 provider 共享同一个执行世界，把它们指向远程沙箱，Bash、PTY、LSP 会随之整体迁移，无需 fork。

完整清单见 [04-capability-seams.md](04-capability-seams.md)。

## 7. 新行为应该放在哪里

新行为附加到已文档化的扩展点上；若改动了 loop 本身，必须同步更新 `docs/architecture.md`。

| 目标 | 机制 |
|---|---|
| 新增模型提供者 | 在 `ctx.llm` 注册适配器 |
| 新增模型可见能力 | 在 `ctx.tools` 注册；其 schema 加入 prompt 装配 |
| 让某会话使用不同能力集 | 组合 agent preset；其中的服务行需要 `isolate` realm |
| 新增 shell 执行 | 注册 `ctx.shell` 后端；本地后端经 `ctx.subprocess` 派生 |
| 新增持久终端执行 | 注册 `ctx.terminals` 后端 + `dsh-tool-terminal` |
| 新增人类命令 | 在 `ctx.commands` 注册；不经模型 turn 直接派发 |
| 管理后台作业 | 在 `ctx.jobs` 注册；`job_*` 工具读取或停止 |
| 由外部 webhook 启动会话 | 在 `ctx.webhookRuntime` 注册可信规则并挂载 provider 适配器 |
| 新增文件系统访问或策略 | 注册 `ctx.fs` provider 或监听 `fs/*` 事件 |
| 约束派生进程 | 使用 `ctx.sandbox` 后端；消费者在 spawn 前包裹 argv |
| 拦截请求、工具或 turn | 使用对应 `agent/*` / `tools/*` 事件；`agent/turn-stopping` 可停止 turn |
| 新增模型可见上下文 | 调用 `agent.inject()`，在下次被接纳的请求中生效 |
| 新增 UI 或编辑器集成 | 驱动 `ctx.agents`，从 `session/event` 渲染 |
| 新增 Web Client Chat 节点 | 注册 `ConversationNodeDefinition` + 键控渲染器 |
| 新增持久会话状态 | 扩展 `SessionEventMap`；从日志渲染与重放 |
| 生成会话标题 | 注册唯一的 `ctx.sessionTitle` provider |
| 管理同会话目标 | 使用 `ctx.goals`，经 `agent/*` 续跑 |
| 在 turn 边界分叉会话 | `ctx.agents.create({ sessionId, seed, meta: { parentSession, seedLength } })` |
| 换一种会话存储后端 | 实现 `SessionPersistence`（`create`/`open`/`stat`/`list`/`export`） |
| 将注册限定在单个 agent | 使用该 agent 的 `agent.ctx` |

分步指南见 `docs/cookbook/`（新增 package / 新增 tool / 新增 LLM adapter / 新增 settings card）。

## 8. 应用启动与桌面端（速览）

- 受支持的 Node 应用只能通过具名 `dsh` profile 启动；package bins、demos、公开 SDK argv 逃逸均被禁止（由 `verify-application-entrypoints` 校验）。
- Electron 桌面应用在签名资源中携带其精确的 dsh 生产运行时，独占保留 `$DSH_HOME/profiles/desktop`；Electron 以 Electron Node 模式启动私有 Desktop Host，后者调用共享 CLI 的 profile runner 与完整 Web 应用。
- Python SDK 遵循同一应用架构：其 runtime wheel 打包正常的 `dsh` CLI，客户端默认以 `dsh --profile sdk` 启动，并暴露 profile 选择与有序补丁文件。

细节见 [05-runtime-composition.md](05-runtime-composition.md) 与 [07-gui-host-client.md](07-gui-host-client.md)。
