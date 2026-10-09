# 10 · 术语表

dsh 的领域词汇遵循"一个概念一个规范术语"。本页整理阅读代码时最常撞到的术语；权威定义见仓库 `docs/glossary.md`。

## 接缝与注册

- **seam（接缝）** —— 一个可替换能力，含三角色：**Service Definition**（拥有 `ctx.<key>` 与词汇类型的 Cordis `Service`；抽象类如 `ShellExecutor`，或具体注册表如 `WebRuntime`，**绝不**是 TypeScript `interface`）、一个或多个 **Service Provider**、一个或多个 **Consumer**。接缝是完整能力，绝不指其中某一角色。规范示例是 `packages/shell`：`dsh-shell`（定义）、`dsh-bash-local` / `dsh-bash-sandbox`（提供者）、`dsh-tool-bash`（消费者）。
- **scope（作用域）** —— 每 agent 注册的单位。一个贡献（工具、prompt 分段、变量、限制、监听器）要么**全局**（对每个 agent 可见），要么**作用域化**（恰好由一个 scope key 拥有）。两层、扁平：作用域注册**不**向下继承到子 agent。
- **scope key** —— 作用域所按键的不透明身份，按对象身份比较。Harness 约定：**存活的 agent 即其自身作用域的 key**。
- **agent context（`agent.ctx`）** —— agent 的作用域 context；经它注册的既是 scope-visible 又是 scope-lifetime（一个事实驱动两者）。
- **scoped dispatch（作用域派发）** —— 关于某个 agent 活动的事件带着该 agent 的载体派发；关于"注册表本身"的事件（某个工具被添加）是 registry-subject，保持不筛选。
- **shadowing（遮蔽）** —— 最具体者胜的名字解析：作用域工具/分段/变量对同一作用域替换其同名的全局项。
- **restriction（限制）** —— `tools.restrict` 对某个作用域过滤**全局**工具集（按交集组合）；作用域局部注册在该过滤之后合并。被过滤掉的全局工具既不在 prompt 中，也拒绝执行，与不存在者无法区分。
- **setup window** —— 创建槽位，创建者在此组合 agent 的作用域世界（`CreateAgentOptions.setup`）：在作用域与 agent 对象存在之后、但在 agent/session 发布、`agent/created` 触发或首个 prompt 装配之前。setup 只注册，绝不驱动 agent。
- **lineage（血缘）** —— 父/子事实，作为数据携带（`parentSession`、耐久 `delegationDepth`、运行时 `subagentDepth`）；**从不影响可见性**。

## 循环层级

- **turn** —— 一次"排空已接纳输入"的过程，在模型与其工具停止、或某终态策略介入后结束。
- **step** —— 一次模型请求加上其响应引发的工具执行；一个 turn 含零或多个 step。
- **round** —— 包含一个 turn 的外层策略迭代，例如 goal round 或一次全新 agent 的 Ralph 尝试。round 计数器属于该策略，不统计会话中的每个 turn。
- **goal round** —— 为当前 goal 接纳的一次续跑周期；同会话驱动把 goal round 物化为一个 goal-sourced turn。

## 目标与流程

- **goal（目标）** —— 附加到既有会话的单个耐久完成目标，带修订化阶段 `active` / `paused` / `blocked` / `complete` 与 goal-round 上限；`blocked` 保留策略码与解释。goal 是**状态**，不是调度器或独立对话；会话日志仍是其真相来源。
- **goal activation（目标激活）** —— 进程局部许可，允许续跑消费者接纳下一个 goal round。为 `armed` 或 `disarmed`，**刻意不进入耐久重放**，因此 resume/fork 需要后续经 `/goal` 或模型工具的人类授权 resume 变更才能自动工作。
- **human command（人类命令）** —— 以斜杠开头的指令，由面向人类的适配器经 `ctx.commands` 解释执行，**不**成为模型消息。区别于模型可见工具，也区别于经 `ctx.shell` 的 shell 执行。
- **Ralph loop** —— 一次前台、全新 agent、朝不可变目标推进的 workflow 运行；由 workflow 与 subagent 原语组合成的**模型可见工具策略**，不是同会话 goal、不是 agent-loop 模式、不是调度器，也不是通用 workflow 脚本特性。
- **Ralph round** —— Ralph loop 中的一次全新子会话；子会话不接收父或先前子会话的对话种子，跨 round 状态由共享工作区与一份有界 Ralph handoff 承载。
- **Ralph handoff** —— 从一个续跑 Ralph round 传给下一个的规范化有界结构化报告，含状态、摘要、证据、下一步与阻塞文本；它补充共享工作区而非取代其权威地位。

## 运行时组合

- **profile（配置档）** —— Harness home 中的具名组合；列出所叠 bundle、持有树外插件与用户自己的 `cordis.patch.yml`。内置模板：`web`、`headless`、`sdk`、`sdk-minimal`、`acp`。
- **bundle（捆绑层）** —— Cordis 配置行及其所挂载代码的分发格式，使插入内容仍可被上层补丁覆盖。由 `package.json` 的 `dsh.bundle.patch` 声明。
- **patch（补丁）** —— 通过 id 定位某一行并整体替换其 config，或插入新行。
- **HMR** —— 热模块/配置重载；`dsh-hmr` 拥有模块与精确配置监听器，应用变更共享其队列。是否启用由 YAML 控制。

## 事件与会话

- **session event（会话事件）** —— 追加到会话日志并广播的耐久事实；跨重载存活。`turn/*`、`step/*`、`user/message`、`assistant/message`、`assistant/attempt`、`tool/*` 等。
- **agent event（`agent/*`）** —— 携带存活 `Agent` 的在途控制/观测事件；不进入日志。
- **capability event（`fs/*`、`tools/*`、`telemetry/*`）** —— 在不引入 loop 依赖的前提下为接缝挂策略与适配器的扩展点。
- **waterfall** —— 一种事件派发语义：监听器**必须**调用 `next()` 才能委托给链条后续者，否则短路。属于 waterfall 的有 `agent/pre-step`、`agent/request`、`llm/stream`、三个 `tools/*`。
- **settlement（结算）** —— 一次模型尝试最终落定为 `assistant/message`（带内容/表面）或 `assistant/attempt`（失败/重试/取消/流错误，不进入模型历史）。
- **projection（投影）** —— 从已提交会话事件派生出的**读模型**，供客户端消费当前会话状态而无需重放原始日志；经 `ctx.sessionProjections` 注册与读取。
- **generation（生成版本）** —— 会话在磁盘上的版本化产物（v0：`session.jsonl[.zstd]`；v1+：`session.vN.jsonl[.zstd]`）；已提交的 generation 路径永不重命名、替换或删除。

## GUI 与类型

- **Remote** —— Host 上以 `@Remote` / `@RemoteScope` 标注的可调用方法，构建时生成 Host-for-Client 类型与运行时贡献，Client 在 `ctx.remote` / `agentCtx.remote` 下消费。
- **Typert** —— 类型图与 RPC 基础设施：`ctx.typert` 运行时注册表 + `ctx.typertGateway` 调用网关；生成阶段只在 Host tsdown 运行。
- **Host / Client** —— Web GUI 的两半：Host 提供服务、持久化与安全边界；Client 是浏览器半侧，只做渲染与交互。

## 其他常见缩写

- **PTC** —— Programmatic Tool Calling；`ctx.ptcRuntime` 运行针对宿主提供的异步绑定的程序。
- **spill** —— 把超大工具文本落盘并返回面向模型的定位符与检索提示；由 `ctx.spillStore` + `spill-policy` 承担。
- **skill** —— 可加载的能力包；`ctx.skills` 合并 provider 的 skill 目录，`tool-skill` 渲染会话前缀目录并按需加载完整体。
- **subagent** —— 受托执行的一次委派；`ctx.subagents` 提供 provider 与可选的可续跑编排。
- **permission preset** —— 面向用户的预设表（`workspace-write` / `danger-full-access`），捆绑 sandbox-mode 与 approval-policy 两个开关。
