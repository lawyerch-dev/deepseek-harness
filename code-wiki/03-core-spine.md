# 03 · 核心脊梁与关键类/函数

`packages/core/*` 是产品 API 脊梁。本页列出这些包的职责、`ctx` 服务、以及在源码中验证过的关键导出类/接口与函数。行号来自当前源码，可能随重构漂移，请以符号名为准。

## 1. 脊梁包一览

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `core/session` | `ctx.sessions` | 追加式 `SessionEvent` 日志与内存 store |
| `core/system-prompt` | `ctx.systemPrompt` | prompt 分段与工具 schema 的装配 |
| `core/tools` | `ctx.tools` | 作用域化工具注册表与带守卫的执行流水线 |
| `core/agent` | `ctx.agents` | 存活 `Agent` 句柄、创建/恢复工厂接缝、`agent/*` 事件、initiator 作用域 |
| `core/agent-loop` | `ctx.agentLoop` | 实现 `AgentFactory` 的默认驱动（唯一具体 loop 插件） |
| `core/scope` | 无（库） | 每 agent 的作用域注册原语 |
| `core/agent-default-model` | `ctx.agentDefaultModel` | 无会话专属选择时的 Agent 默认模型 |

另外两个常与脊梁并列的包：`llm/llm`（`ctx.llm`，消息与流词汇 + 适配器接缝）与 `webhook/webhook`（`ctx.webhookRuntime`）。

## 2. 关键类与函数

### 2.1 `core/session` — 会话日志

文件：`packages/core/session/src/index.ts`

- `Session`（约 L434）：事件溯源会话。**它不是 Service**；通过 `ctx.sessions.create()` 获得。持有追加式事件日志，是模型上下文、持久化、投影、遥测的共同来源。
- `SessionStore extends Service`（约 L921）：注册到 `ctx.sessions`。核心职责包括：
  - `registerMessageProjection`：为已有消息内容注册**纯消息投影**（插件改内容时的接缝）；
  - `create`：创建会话；
  - `prepare`：准备（冷读场景）；
  - 通过 `ctx.inject(['typert'])` 注册 session 类型解析。

关键类型：`SessionEvent` 与合并可扩展的 `SessionEventMap`。`SessionEventMap` 成员默认 **required-on-read**：不认识该类型的构建会拒绝日志，除非该事件在信封上标记 `ignorable: true`；只有结构格式变化才提升 `SESSION_FORMAT_VERSION`。

### 2.2 `core/system-prompt` — prompt 装配

文件：`packages/core/system-prompt/src/index.ts`

- 扩展 `Context`，新增 `systemPrompt`，并声明事件 `system-prompt/assemble`、`system-prompt/change`（约 L13–L38）。
- `SystemPrompt extends Service`（约 L405，注册到 `ctx.systemPrompt`）：管理配置、作用域 prompt 层、默认 harness identity 与 persona prompt 段。
- 核心 API（约 L446–L558）：`section`（注册分段）、`context`、`tools`（注册模型可见工具 schema）、`variable`、`assemble`（组装）。装配在每个 step 前发生。

### 2.3 `core/tools` — 工具注册与执行流水线

文件：`packages/core/tools/src/index.ts`

- 扩展 `Context` 新增 `tools: ToolRuntime`，并声明事件 `tools/pre-execute`、`tools/execute`、`tools/post-execute`、`tools/ptc-dispatch-log`、`tools/result`、`tools/change`（约 L137–L209）。
- `ToolRuntime extends Service`（约 L807，注册到 `ctx.tools`）：注册能力、拥有 PTC 模式传输，并把调用路由经过 **pre-policy → 单调守卫 → around dispatch → post-policy → final-result 观测**。
- 三个 `tools/*` 事件是 waterfall，监听器必须 `next()` 才能委托。

### 2.4 `core/agent` — Agent 句柄与注册

文件：`packages/core/agent/src/index.ts`

- 扩展 `Context` 新增 `agents: AgentRegistry`（约 L27–L31）。
- `AgentRegistry extends Service`（约 L245，注册到 `ctx.agents`）：拥有 agent 生命周期、initiator 管理、经 `ctx.inject(['typert'])` 的 agent 类型解析，以及 archive 准入。
- 工厂注册与调用入口（约 L347–L415）：`setFactory`、`create`、`resume`。`agent-loop` 通过 `setFactory` 提供具体创建实现。
- AgentLoop 在开始排队工作前 **串行等待 `agent/created` 初始化**；初始化失败会回滚创建。

### 2.5 `core/agent-loop` — 具体主循环

文件：`packages/core/agent-loop/src/index.ts`

- 扩展 `Context` 新增 `agentLoop`，并声明 `agent-loop/config-start-failed` 事件（约 L215–L239）。
- `AgentLoop extends Service implements AgentFactory`（约 L330，注册到 `ctx.agentLoop`）：负责配置校验、`ctx.agents.setFactory(this)`、system prompt 变量注入、配置化 agent 的启动/恢复逻辑。
- 它是**唯一的具体 loop 插件**；扩展包依赖 `dsh-agent` 的事件与服务，而非本包。loop 的 turn/step 行为见 [01-architecture.md](01-architecture.md) 与 `packages/core/agent-loop/README.md`。

### 2.6 `core/scope` — 作用域原语

文件：`packages/core/scope/src/index.ts`

- `Scope` 接口与 `createScope(ctx, key, options)`（约 L104–L147）：作用域 context 继承父 context 的依赖 API，并拥有独立注册与销毁边界。
- `scopeTarget<T>(base, key)`（约 L158–L185）：构造作用域事件载体（`thisArg`），其过滤器接纳未打标签的监听器加上 subject 自身的监听器。
- 语义要点（见 `docs/glossary.md`）：
  - **作用域 key**：不透明身份，按对象身份比较；约定是"存活 agent 即其自身作用域之 key"。
  - **`agent.ctx`**：agent 的作用域 context；经它注册的既 scope-visible 又 scope-lifetime。
  - **shadowing**：最具体者胜——作用域工具/分段/变量对同一作用域替换同名的全局项（每 agent persona 与工具变体的机制）。
  - **restriction**：`tools.restrict` 对某个作用域过滤**全局**工具集（按交集组合），过滤掉的全局工具在 prompt 与执行中都不可见、不可用。

### 2.7 `core/agent-default-model`

文件：`packages/core/agent-default-model/src/index.ts`

- 扩展 `Context` 新增 `agentDefaultModel: AgentDefaultModelConfig`（约 L16–L21）。
- `AgentDefaultModelConfig extends Service`（约 L48，注册到 `ctx.agentDefaultModel`）：提供 `currentSelection()` 读取默认 `ModelSelection`、`saveSelection()` 经 profile editor 保存选择。

## 3. 会话事件与模型历史的派生

`deriveMessages()` 从会话日志投影出模型历史。理解脊梁必须抓住几条不变式：

- **Model-visible ⟺ logged**：任何抵达模型请求的内容都必须能从日志重建；新增模型可见输入需要新增 session 事件。
- **投影接缝**：`dsh-session-projection` 拥有 `ctx.sessionProjections`。注册单元增量折叠已提交事件；host 消费者经 `stateOf()` 读一份类型化状态；载体用 `snapshot()` 批量下发裁剪后的客户端视图。缺失注册表或所需 key 的 host 读取者必须显式失败，而非静默取默认值。
- **消息投影**：修改既有消息内容的插件注册"纯消息投影"；分离式读取者必须显式提供同一份定义。

## 4. 扩展点与事件域回顾

| 事件域 | 关键字 | 语义 |
|---|---|---|
| Session 事件 | `turn/*`、`step/*`、`user/message`、`assistant/message`、`assistant/attempt`、`system/message`、`tool/*`、`request/*` | 耐久、可重放 |
| Agent 事件 | `agent/created`、`agent/inbox/*`、`agent/status`、`agent/pre-step`、`agent/request`、`agent/request-error`、`agent/turn-stopping`、`agent/assistant-stream` | 存活协调 |
| Capability 事件 | `fs/*`、`tools/*`、`telemetry/*` | 接缝策略/适配器 |

- waterfall：`agent/pre-step`、`agent/request`、`llm/stream`、`tools/pre-execute`、`tools/execute`、`tools/post-execute` —— 必须 `next()`。
- 串行：`agent/turn-stopping` —— 无 `next()`。
- `agent/assistant-stream` 发布进程本地的 start / 瞬时 chunk / end 帧；Web Session-follow 适配器是其实时事件的唯一远程消费者。

事件的生产者与消费者完整清单见仓库 `docs/event-producer-consumer.md`。
