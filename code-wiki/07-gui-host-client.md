# 07 · Web GUI：Host / Client / API Remote / Typert / Desktop

dsh 的 Web GUI 是一次"Host 服务 + 浏览器半侧插件"的分层组合。本页说明各层的职责、通信方式与生成物。

## 1. 总体分层

```text
浏览器 (packages/client/*)           Host 进程
  ui-* 插件  ──►  ctx.remote / agentCtx.remote
  连接层      ──►  ctx.connection  ◄──►  api/gateway (Typert RPC)
                                          │  经 @Remote / @RemoteScope 生成的描述符
                                          ▼
                                      业务服务：api/*-controller、workspace、session、jobs、settings、terminal…
```

- **Host** 提供实现、持久化与安全边界；**Client** 只做渲染与交互，经生成的 Remote 命名空间调用 Host。
- 业务服务在 Host 上以 `@Remote` 或 `@RemoteScope` 声明可调用方法；Host 构建生成 **Host-for-Client** 类型与运行时贡献；Client 的 `api-remotes` 组合把这些贡献加载到 `ctx.remote` 与作用域化的 `agentCtx.remote` 命名空间下。

## 2. Host 侧

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `host/webserver` | `ctx.webServer`（`WebServer extends Service`） | 纯 `node:http` 载体：具名路由注册表、index transform tap、静态 dist 回退；web-transport 插件注册各自路由 |
| `host/directory-picker` | `ctx.directoryPicker`（抽象 `DirectoryPicker`） | 可区分的交互能力：原生后端打开一个 OS 选择器，browse 后端为应用内浏览器提供列举/创建原语 |
| `host/frontend-static` | — | 已构建前端静态资源的服务（消费 `ctx.connection`） |
| `host/product-telemetry-otel` | `ctx.productTelemetry` | 经 OTLP/HTTP 导出显式提交的分析事件；**仅挂载不采集任何东西** |
| `host/*` | — | Host GUI 服务、应用启动、插件清单等 |

`ctx.webServer` 的消费者是 `client-connection`、`client-modules`、`client-hmr`——即 Client 数据面本身由 Host 的 HTTP 载体托管。

## 3. Client 侧（浏览器半侧）

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `client/connection` | `ctx.connection` | 拥有浏览器认证与共享 HTTP 请求派发；API 适配器注册端点与流 |
| `client/modules` | `ctx.clientModules`（`ClientModuleRegistry`） | 从增量 `dsh.client` 扫描组装 `__DSH_BOOT__` entry 图，服务插件 bundle，通知重建/图变更 |
| `client/hmr` | — | 消费 `ctx.clientModules` 与 `ctx.webServer`，把源码改动推给浏览器 |
| `client/ui-*` | 各 slots / 对象服务 | 具体界面：会话、对话、设置、模型选择、文件上传、命令、插件清单、文档预览等 |

Client 侧的典型服务类（源码中验证）：

- `SlotRegistry`（`ui-renderer`）：UI 插槽注册表。
- `ConfigForms`、`SettingsSchemaService`（`ui-settings`）：设置表单与 schema。
- `UiSession`（`ui-session`）、`UiConversation` / `ConversationController`（`ui-conversation`）：会话与对话的客户端投影。
- `CommandUiRuntime`（`ui-commands`）、`FileUploadRuntime`（`file-upload`）、`ModelDirectoryResolver`（`ui-model-selection`）、`InputTriggerService`（`ui-input-trigger`）、`ClientTimerService`（实验区 `cordis-client-runner`）。

Client Remote 适配器（消费 Host 的生成命名空间）：`ClientTerminals`（`api/terminal-controller`）、`WorkspaceController`（`api/workspace-controller`）、`ClientJobs`（`api/job-controller`）、`HostConnectionService`（`client/connection`）。

## 4. API 层与 Remote 生成

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `api/gateway` | `ctx.typertGateway`（`TypertGatewayService`） | 把生成的 Remote 描述符关联到活 Cordis 服务，解析已注册身份，并经共享 Connection RPC 载体暴露一元调用 |
| `api/remotes` | — | Remote 组合入口；其 Host 入口参与 Host Typert 图，Client 入口导入生成的 `/remote` 声明 |
| `api/session-controller` 等 | 见 [04-capability-seams.md](04-capability-seams.md) 的「Host 侧 Remote 控制器」一节 | 各业务面的 Host Remote 控制器 |

Host 与 Client 是两个**独立的 TypeScript aggregate 程序**：两侧都在相同 key 下对 cordis `Context` 做声明合并（declaration merging），但服务不同。一个程序同时看到两侧会报告冲突，因此：

- `tsconfig.host.json` 与 `tsconfig.client.json` 各成一个程序；
- 只有 `tsconfig.base.json`（无 `include`）作为共享 `paths` 门面；
- 少数包同时存在于两侧（`host/webserver`、`compaction/compaction`、`typert/registry` 作为共享叶子；另有 `api/remotes`、`api/gateway`、`api/session-controller`、`api/workspace-controller`、`client/connection`、`session-query/session-log-export` 拆分 Host/Client 叶子配置）。

细节见 [08-dependencies.md](08-dependencies.md) 与 `docs/development.md`。

## 5. Typert：类型图与 RPC

| 包 | `ctx` 键 | 职责 |
|---|---|---|
| `typert/registry` | `ctx.typert`（`TypertRegistry`） | 插件直接或经 loader 注册活体 zod 贡献；API gateway 消费调用描述符与 provider，其他运行时消费者在各自边界查询 schema 与反射元数据 |
| `typert/loader` | — | 经 `ctx.typert` 注册贡献的加载器 |
| `typert/generator` | — | 类型图生成器（Host tsdown 阶段运行） |

Typert **只在 Host tsdown 阶段运行**，由 `tsconfig.host.json` 播种；它分析 Host 类型并同时生成 Host 反射产物与 Host-for-Client 的 Remote 投影。Client tsdown 不启动 Typert。

## 6. Desktop（Electron）

- 应用位于 `apps/desktop` + `apps/desktop-host`，在签名资源中携带其精确的 dsh 生产运行时，并独占保留 `$DSH_HOME/profiles/desktop`。
- 启动路径：Electron 以 **Electron Node 模式**启动私有 Desktop Host → Host 调用共享 CLI 的 profile runner 与完整 Web 应用 → 窗口立即加载打包的 Web 资源 → 等待 boot injection 后在**同一文档内**激活 client 插件。
- 通信：Web 拥有 RPC 与流；desktop carrier 把本地页面连接到已认证的 Host；**Node IPC** 承载 boot injection、就绪、致命错误与关机。
- 端口：默认监听 OS 分配的端口，profile 配置可覆盖。
- Shell 拥有的 UI 通过捆绑的 pnpm、在正常用户与 profile 配置下运行插件事务。
- Desktop 与 npm CLI 共享产品数据，但保持包、激活与 lockfile 相互独立；Desktop 的捆绑 CLI 管理其已初始化的插件。
