# 08 · 依赖关系与约束

本页说明包与包之间应当以何种方向依赖，以及编译器层面如何约束这些关系。

## 1. 依赖方向规则

来自 `packages/README.md` 的核心规则：

> **扩展插件依赖 Service Definition，绝不依赖具体 provider。**

- `dsh-agent-loop` 是**可替换的**：依赖 loop 的插件应依赖 `dsh-agent` 的事件与服务，而不是 `dsh-agent-loop` 本身。
- UI、hook 与工具插件通过 `dsh-agent` 交互。
- 组合 bundle 可以依赖 spine 插件（这是装配层的职责）。
- 能力接缝在角色独立演进时才拆分，见 [04-capability-seams.md](04-capability-seams.md)。

**这条规则带来的好处**：替换一个 provider 就能改变整个产品。例如当 `ctx.fs` 与 `ctx.subprocess` 同时指向远程沙箱时，Bash、PTY、LSP 会随之整体迁移，而消费者（`tool-bash` 等）无需改动。

## 2. 由能力接缝决定的典型依赖边

以下边来自生成文件 `docs/capability-seams.md`，可作为"谁依赖谁"的具体样板：

- `ctx.llm`（`llm/llm`）← 消费者 `agent-loop`、`compaction-basic`；provider 为 `llm-deepseek`、`llm-pi-ai`、`llm-replay`。
- `ctx.subprocess`（`subprocess/subprocess`）← 消费者 `bash-local`、`bash-sandbox`、`terminal-bash`、`lsp-stdio`、`subagent-acp`、`subagent-codex`、`subagent-claude-code`。
- `ctx.shell`（`shell/shell`）← 消费者 `tool-bash`、`tool-pwsh`、`hooks-claude-code`、`hooks-codex`。
- `ctx.fs`（`fs/fs`）← 消费者 `tool-fs`；配套 `fs-observation-policy` 经 `fs/*` 事件门参与。
- `ctx.tools`（`core/tools`）← `agent-loop` 与各 `tool-*` 消费者。
- `ctx.sessions`（`core/session`）← `agent`、`agent-loop`、`session-persistence`、`session-query(+sqlite)`、`subagent-in-process-driver`、`message-feedback`。
- `ctx.sessionPersistence`（`session/session-persistence`）← `agent-loop`、`tool-bash`、hooks、`session-query(+sqlite)`、`message-feedback`。
- `ctx.sessionProjections`（`session/session-projection`）← `api/session-controller`、`tool-todo`、`session-title`。
- `ctx.storage`（`storage/storage`）← `storage-domain` ← `workspace`。

阅读要点：`core/*` 位于依赖图底部；`tool-*` 与 `ui-*` 位于顶部；`bundle/*` 横向装配上述所有层。

## 3. 生成的模块图

完整的包级依赖图是**生成产物**：

- 文件：`docs/module-graph.md`
- 生成命令：`pnpm run gen-module-graph`
- 校验命令：`pnpm run verify-module-graph`（在 CI 中做 freshness 门禁）

因此请不要手工编辑 `docs/module-graph.md`；改动依赖后重新生成即可。

## 4. 工作区依赖约定

- 每个包名为 `@deepseek-ai/dsh-<name>`；Harness 包在 `peerDependencies`/`devDependencies` 声明 `@deepseek-ai/cordis`。
- 依赖分段：**DSH 包用 `workspace:*`，vendor / native 用 `workspace:~`**（见 `.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md`）。
- pnpm 使用严格符号链接 linker：**未声明的依赖会直接失败**，不会靠 hoisting 侥幸可用。
- vendor 是 rescope 过的固定源码副本，包声明 `private: true`；改动 `vendor/*/src` 必须同时更新 `vendor/README.md` 清单（hook 会校验）。
- Raw / Web `cordis.yml` 中的裸插件必须出现在其 resolver manifest 的 `dependencies` 里，由 `verify-cordis-config` 强制。

## 5. 编译面（TypeScript Project Layout）

仓库使用**隔离的 Host 与 Client 两个 aggregate**：普通包只注册进其中一个，Host 包进 `tsconfig.host.json`，Client 包进 `tsconfig.client.json`。

| 文件 | 角色 | 是否构成程序 |
|---|---|---|
| `tsconfig.json` | 解根：`extends` base、`files: []`、引用两个 aggregate。tsserver 发现入口，也是 `scripts/` 经 tsx 运行时的解析配置 | 否 |
| `tsconfig.host.json` | Host aggregate：Host 包、examples、tests、scripts、website 及 `api/remotes` 的 Host 项目 | 是 |
| `tsconfig.client.json` | Client aggregate：`packages/client/*` 及其测试、`apps/web` 及 `api/remotes` 的 Client 项目 | 是 |
| `tsconfig.base.json` | 共享 compilerOptions 与源码 `paths`；vitest 经 vite-tsconfig-paths 指向的解析门面（**无 include**） | 否 |
| `tsconfig.base.client.json` | 浏览器编译设置（`jsx`、DOM libs、`types: []`），被 Client aggregate 与所有 `packages/client/*` 扩展 | 否 |

**三条纪律**：

1. `tsconfig.base.json` **不得**新增 `include` / `files`（会泄漏到每个扩展包并收窄门面的全匹配范围）。
2. 构建全仓 `ts.Program` 的脚本必须显式以 `tsconfig.host.json` 或 `tsconfig.client.json` 播种，**绝不能用解根**——把两个 aggregate 摊平进一个程序会让 `Context` 的声明合并冲突。
3. 新包只注册进一个 aggregate；只有上述拆分包同时携带两个叶子配置，共享叶子因两侧都要类型检查同一源码而被两个 aggregate 引用。

**同时拆分 Host/Client 的包共有六个**：`api/remotes`、`api/gateway`、`api/session-controller`、`api/workspace-controller`、`client/connection`、`session-query/session-log-export`。它们各自的包根 `tsconfig.json` 只是 solution，两个 aggregate 与直接消费者分别引用 `tsconfig.host.json` 或 `tsconfig.client.json`。

## 6. 源码面 vs 产物面

- **静态门禁与测试**经 tsconfig `paths` 把工作区 import 解析到 `src`，并在干净树上通过。
- **消费已构建 `lib/` 的门禁**必须显式声明该依赖。
- 生成的 Host-for-Client Remote 声明是刻意的例外：`typecheck`/`lint`/`doc-typecheck` 会先生成它们，内部的 `*:contracts-ready` 脚本假定调用方（或调度门禁）已依赖 Typert 契约生成阶段或完整构建。

## 7. 相关守卫脚本

| 脚本 | 作用 |
|---|---|
| `verify-module-graph` | 模块图 freshness |
| `verify-package-dependencies` | 包依赖合法性 |
| `verify-runtime-closure` | 运行时闭包完整性 |
| `verify-application-entrypoints` | 应用启动路径只能经 `dsh` |
| `verify-cordis-config` | cordis.yml 裸插件必须在 resolver manifest 中声明 |
| `constraints` | 遍历可达 Project Reference 图，检查每个引用项目自身的编译面 |
| `verify-default-product-isolation` | 默认产品隔离 |
| `verify-dependency-catalog` / `gen-dependency-catalog` | 依赖目录生成与校验 |
