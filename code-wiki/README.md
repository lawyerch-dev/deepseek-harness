# DeepSeek Harness Code Wiki

本 Wiki 是对 `deepseek-harness`（命令名 `dsh`）仓库的一次系统性代码导读，目标是让读者从"整体架构"到"关键类与函数"再到"如何运行"逐层建立完整认知。

内容基于仓库内的权威来源整理：`docs/architecture.md`、`docs/capability-seams.md`、`docs/agent-lifecycle.md`、`docs/development.md`、`packages/README.md`、`apps/cli/README.md`，以及 `packages/*/*/src` 源码中实际导出的类与服务声明。

## 项目一句话定位

DeepSeek Harness 是 DeepSeek AI 开发的开源 Agent Harness，采用 **"一切皆插件"（everything-is-a-plugin）** 架构，构建在 [Cordis](https://github.com/cordiverse/cordis) 框架之上；模型适配器、工具注册表、会话日志、乃至 Agent 主循环本身都是可替换的插件。

## 技术栈

| 维度 | 选型 |
|---|---|
| 语言/模块 | TypeScript（`strict`）、全仓 ESM（`"type": "module"`） |
| 框架 | Cordis（`vendor/cordis`，服务 / 类型化事件 / 可回滚 effect） |
| 包管理 | pnpm workspaces（`pnpm@11.7.0`，workspace 协议 `workspace:*`） |
| 运行时 | Node.js `^22.19.0 \|\| >=24.0.0` |
| 构建 | `tsc -b`（类型/声明）+ `tsdown`（运行时打包）+ Vite（Web） |
| 测试 | Vitest（单测 / 快照 / e2e / Web / 基准） |
| 桌面端 | Electron（`apps/desktop`） |
| 文档站 | VitePress（`website/`） |

## 文档导航

| 文档 | 内容 |
|---|---|
| [01-architecture.md](01-architecture.md) | 整体架构：插件模型、profile/bundle、事件域、turn/step 循环、能力接缝、扩展点 |
| [02-repository-and-packages.md](02-repository-and-packages.md) | 仓库布局与 50+ 包分组的模块职责 |
| [03-core-spine.md](03-core-spine.md) | 核心脊梁包与关键类、关键函数说明 |
| [04-capability-seams.md](04-capability-seams.md) | 能力接缝与 `ctx.<key>` 服务总表（定义 / 提供者 / 消费者） |
| [05-runtime-composition.md](05-runtime-composition.md) | 运行装配：profile / bundle / boot / CLI 与启动流程 |
| [06-session-data-plane.md](06-session-data-plane.md) | 会话数据面：事件日志、持久化、投影、查询、存储 |
| [07-gui-host-client.md](07-gui-host-client.md) | Web GUI：Host / Client / API Remote / Typert / Desktop |
| [08-dependencies.md](08-dependencies.md) | 依赖关系方向、模块图与编译面约束 |
| [09-build-and-run.md](09-build-and-run.md) | 构建、运行、测试与 CI 命令 |
| [10-glossary.md](10-glossary.md) | 领域术语表 |

## 快速开始

从 npm 运行：

```sh
npx @deepseek-ai/dsh web
```

从源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

Web UI 默认监听 `http://127.0.0.1:3080`，`--no-open` 可禁止自动打开浏览器。完整命令见 [09-build-and-run.md](09-build-and-run.md)。

## 建议的阅读路径

1. 想快速理解"这是什么"：本文件 → [01-architecture.md](01-architecture.md)。
2. 想改代码：先读 [01-architecture.md](01-architecture.md) 与 [08-dependencies.md](08-dependencies.md)，再按分组进入 [02-repository-and-packages.md](02-repository-and-packages.md)。
3. 想理解 Agent 主循环：直接读 [03-core-spine.md](03-core-spine.md)，并对照 `docs/agent-lifecycle.md` 的时序图。
4. 想接入新能力（模型、工具、后端）：读 [04-capability-seams.md](04-capability-seams.md) 的三角色模型。
5. 想部署/运行：读 [09-build-and-run.md](09-build-and-run.md) 与 [05-runtime-composition.md](05-runtime-composition.md)。

## 说明

- 本 Wiki 是面向 onboarding 的导读性文档，仓库的权威规范以根 `AGENTS.md`、`docs/` 与各包 README 为准。
- 涉及"当前状态"的描述以源码与生成文档为准；生成类文档（如 `docs/module-graph.md`、`docs/capability-seams.md`）请勿手工编辑。
