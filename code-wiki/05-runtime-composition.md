# 05 · 运行装配：Profile / Bundle / Boot / CLI

本页说明"一次 `dsh` 启动是如何把几百个插件组装成一棵树的"，以及各应用表面如何选择这棵树。

## 1. 唯一受支持的应用启动器：`dsh`

规则（由 `scripts/verify-application-entrypoints.ts` 强制）：受支持的 Node 应用**只能**通过具名 `dsh` profile 启动；package bins、仅构建/仅测试的可执行文件、根 demo、以及直接进程内挂载插件都不算应用启动器。SDK 与 ACP 是 profile，而不是彼此独立的公开 bin。

## 2. CLI 入口模式

`apps/cli/src/args.ts` 拥有命令语法，`apps/cli/src/bin.ts` 只加载被选中的 runner。源码入口为 `apps/cli/src/bin.ts`（`pnpm dsh` 经 `node --import tsx/esm` 运行它）。

| 命令 | 用途 |
|---|---|
| `dsh <name>` / `dsh --profile <name>` | 在 `$DSH_HOME/profiles/<name>` 下启动具名 profile |
| `dsh --profile <name> --from-default-profile <template>` | 由内置模板创建新的自定义 profile 再启动 |
| `dsh --profile acp` | 通过 ACP stdio 服务自动化客户端，直到断开 |
| `dsh --profile headless "job"` | 运行一个全新的持久会话，打印最终答案后退出 |
| `dsh --profile sdk` | 通过 JSON-RPC stdio 服务 SDK 客户端 |
| `dsh --profile sdk-minimal` | 以独立的最小 agent 树服务 SDK 客户端 |
| `dsh web` | 启动 Web profile |
| `dsh plugin --profile <name> <pnpm args>` | 在 profile 目录内转发给 pnpm，管理该 profile 的插件 |

启动器只解析自己的 flag，把其余参数交给被启动的 profile。第一个无法识别的 token 即开始应用的参数（如 `dsh --profile web --port 8080`）。

检查组合树（不真正启动）：

```sh
dsh --profile web --dump-config          # 打印组合后的配置树
dsh --profile web --dump-default-config  # 打印默认组合
dsh --profile web --dump-config-schema   # 打印 entry/patch 的 JSON Schema
```

`desktop` 名称保留给 Electron 拥有的 profile，CLI 会拒绝启动或 dump 它。

## 3. Profile 与 Bundle

### 3.1 profile 目录构成

- `package.json`：树外插件依赖，加上 profile 清单 `dsh.profile`（含有序 `bundles` 列表）。
- `cordis.patch.yml`：用户自己的补丁层。

`dsh-hmr`（当 YAML 中启用时）监听 profile 清单、profile 补丁与 home 补丁，并通过一次串行 reload 重新组合所有层；未启用 HMR 时，改动在重启后生效。

### 3.2 层叠顺序（作用于空 entry 列表）

1. 按 `dsh.profile.bundles` 顺序叠加每个 bundle 的补丁；
2. profile 的 `cordis.patch.yml`；
3. home 级 `$DSH_HOME/cordis.patch.yml`；
4. `--patch` 覆盖层。

### 3.3 内置 bundle

| Bundle | 作用 | `ctx` 键 |
|---|---|---|
| `base`（`@deepseek-ai/dsh-base`） | 所有 base-backed profile 的共享核心：模型适配器、工具、持久化、沙箱与审批策略、设置、凭证、遥测 | —（仅补丁） |
| `web-app`（`@deepseek-ai/dsh-web-app`） | base 之上的浏览器应用层 | 挂载 Web 相关行 |
| `headless`（`@deepseek-ai/dsh-headless`） | base 之上的单次命令行任务应用 | `headless-runner` |
| `sdk-app`（`@deepseek-ai/dsh-sdk-app`） | base 之上的 SDK JSON-RPC stdio 应用 | 挂载 SDK server |
| `sdk-minimal`（`@deepseek-ai/dsh-sdk-minimal`） | 不依赖 base 与 Web 的独立最小 SDK 应用 | —（完整补丁树） |
| `acp-app`（`@deepseek-ai/dsh-acp-app`） | base 之上的仅自动化 ACP stdio 应用 | 挂载 ACP bridge |

bundle 解析顺序：先从 dsh 安装内解析（`@deepseek-ai/dsh-base`、`-web-app`、`-headless`、`-sdk-app`、`-sdk-minimal`、`-acp-app`），再从 profile 自己的 `node_modules`（pnpm 把树外插件装在这里）。

YAML 还控制 HMR：base 启用 config-only 的 `dsh-hmr`；headless / SDK / ACP 关闭它；`sdk-minimal` 不包含它。

## 4. Boot 层

`packages/boot/*` 提供共享启动胶水：

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `app-boot` | `ctx.profileContext`、`ctx.hmr` | 共享 app-bin 启动胶水：`.env` 加载、Loader 守卫、config 解析、启动序列、profile 解析层叠；launcher 提供纯数据型 profile 位置与组合输入，重载调度归 `dsh-hmr` |
| `plugin-manager` | `ctx.pluginManager` | 与 CLI 共享 profile 包操作与 profile 写锁，向 Web 与 agent 调用者报告持久态与运行态；保留被禁用的 bundle 选择 |
| `config-editor` | `ctx.configEditor` | 在应用文件锁与 HMR 队列下持久化 profile config 补丁，随后对齐 Loader entries |
| `cmdline` | — | 承载启动器移交后的不可变快照，供注入的应用插件解析自身 flag |
| `hmr` | `ctx.hmr` | 拥有模块与精确配置监听器；应用变更共享其队列，自动 reload 等待应用文件锁 |

启动与 reload 失败对照表见 `packages/boot/app-boot/README.md`。

## 5. 版本兼容与豁免

安装与 profile 启动时，会针对 `dsh --version` 显示的同一运行时版本，强制校验插件声明的 DSH peer 范围。不兼容插件需要显式确认的精确版本豁免；豁免的持久化与风险见 plugin-manager 的兼容性参考。

## 6. 应用表面

- **web**：`apps/web` + `packages/bundle/web-app` + `host/*` + `client/*`。Host 从源码运行、浏览器加载已构建的 client bundle；`pnpm run dev:web` 在源码改动时重建 client bundle。
- **desktop**：`apps/desktop` 的 Electron 应用。Electron 以 Electron Node 模式启动私有 Desktop Host，Host 调用共享 CLI 的 profile runner 与完整 Web 应用；窗口先加载打包的 Web 资源，等待 boot injection 后才在同一文档内激活 client 插件。Node IPC 承载 boot injection、就绪、致命错误与关机。默认监听 OS 分配的端口，可被 profile 配置覆盖。
- **sdk**：`packages/sdk` 的 JSON-RPC 协议与 TS client/server；`sdk-minimal` 为其最小化树。
- **acp**：`packages/acp` 的仅自动化 Agent Client Protocol server。
- **headless**：单次任务运行器，无 server。

Python SDK 遵循同一应用架构：runtime wheel 打包正常 `dsh` CLI，客户端默认以 `dsh --profile sdk` 启动并指定显式 Harness home；Python 只暴露 profile 选择与有序补丁文件，不暴露完整 Cordis 树，持久的外部插件通过 `dsh plugin` 安装。

## 7. 可选覆盖层

`apps/cli/config/examples/` 提供 opt-in 覆盖层（GitHub 评审 webhook、memory MCP server、运行时 Cordis 工具）。它们**从不**属于默认 profile。
