# 09 · 构建、运行、测试与 CI

命令与门禁的权威清单在根 `package.json` 与 `scripts/run-gates.ts`；本页给出常用路径与心智模型。

## 1. 前置条件

- Node.js `^22.19.0 || >=24.0.0`（CI 覆盖 22.19、24、26）。
- Node.js 的 TypeScript type stripping 需启用：根构建脚本用 tsdown 的原生 config loader 加载 `tsdown.config.ts`，若 `NODE_OPTIONS` 含 `--no-experimental-strip-types` 会失败；`pnpm run build` 会先检查并指出原因。
- 启用 Corepack 的 pnpm（仓库在 `package.json` 固定 `pnpm@11.7.0`）。
- Git ≥ 2.26。
- 可选：DeepSeek API key，用于 Web / headless / ACP demo 与真 API e2e。

```sh
pnpm install      # 同时经 scripts/install-lefthook.mjs 配置 worktree 本地钩子
pnpm run typecheck  # 首次克隆后跑一次；成功即视为环境就绪
```

若钩子缺失（依赖来自缓存或 postinstall 被跳过）：`node scripts/install-lefthook.mjs`。

## 2. 构建

根构建遵循生成的依赖顺序（`pnpm run build` 的展开）：

```sh
tsc -b tsconfig.host.json              # Host 类型与声明
tsdown --env.DSH_BUILD_FACE host       # Host 运行时打包（含 Typert 生成）
pnpm --filter @deepseek-ai/dsh-desktop run bundle
tsc -b tsconfig.client.json            # Client 类型与声明
tsdown --env.DSH_BUILD_FACE client     # Client 运行时打包
pnpm run build:web                     # 构建 Web 前端
```

要点：

- 两次 tsdown 的匹配范围是 `vendor/*`、`packages/*/*`、`apps/cli`，Host pass 另含 `apps/desktop-host`。它们不扫描构建产物来发现 Client 包。
- 包内 tsdown 配置经 `DSH_BUILD_FACE` 选择本阶段 entry；普通 Client 插件在 Client 阶段同时产出 Node loader 与浏览器 bundle。
- `tsc` 先产出到 `lib/types`，tsdown 只消费其中的 JavaScript。
- Typert **只在 Host tsdown 阶段**运行；因此 `typecheck` 会先跑完整 Host lib 阶段再做 Client tsc，而 `build` 继续完成 Client tsdown 与 Web 构建。
- `pnpm run build` 会嵌入根包版本、7 位源码 commit 与 dirty 标记；`pnpm run build:official` 是 CI/发布的跨平台等价物且省略 dirty 标记。

其他构建入口：`pnpm run clean`（清理产物与安全残留）、`build:native-system`（原生 system addon）。

## 3. 运行

### 3.1 从 npm

```sh
npx @deepseek-ai/dsh web
```

### 3.2 从源码

```sh
pnpm run build          # 单独准备产物
pnpm dsh web            # 使用已构建产物，不再重建
```

`pnpm dsh <args...>` 实际执行 `node --import tsx/esm apps/cli/src/bin.ts`。生产运行需要已构建的包与前端产物。

### 3.3 profile 运行

```sh
pnpm dsh --profile headless "summarize this workspace"   # 需要 DEEPSEEK_API_KEY
pnpm run demo:ptc -- "summarize this workspace"          # headless + PTC 呈现
pnpm dsh --profile web --dump-config                     # 查看组合树
```

### 3.4 Web 与 Desktop

`start:*` 启动既有构建产物，`dev:*` 先构建再启动：

```sh
pnpm run start:web       # 用源码 launcher 服务已构建的 Web 产物
pnpm run dev:web         # 构建、服务、并在源码改动时重建 client bundle
pnpm run start:desktop   # 启动已构建的 Desktop 产物
pnpm run dev:desktop     # 构建后启动 Desktop
```

`dev:web` 额外接受 `--skip-build`（复用现有产物树）与 `--no-serve`（只跑重建 watcher）。Make 目标等价：`make web | dev-web | desktop | dev-desktop | build`，`ARGS='--no-open'` 可转发选项。

### 3.5 环境变量

真 DeepSeek 适配器与 key-backed demo 从环境或仓库根 gitignored `.env` 读取：

```sh
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://...   # 可选，默认公共 API
```

真 API e2e 在未设置 `DEEPSEEK_API_KEY` 时自动跳过。**切勿提交真实凭证。**

## 4. 测试

| 命令 | 内容 |
|---|---|
| `pnpm run test` | 单元测试（会先构建 native system） |
| `pnpm run test:coverage` | **CI 覆盖率门禁**（对 `packages/*/*/src` 逐文件 100%） |
| `pnpm run test:e2e` | 真 API 测试；无 key 时自我跳过 |
| `pnpm run test:snapshot` | keyless 录制会话重放，走已发布 profile；`-t <name>` 过滤 |
| `pnpm run test:snapshot:record` | 重新录制期望输出（需 key） |
| `pnpm run test:expected` | owner-local 进程期望 |
| `pnpm run test:web` | 构建后跑 Web 快照（`test:web:built` 复用产物） |
| `pnpm run test:bench` | 基准（先构建 bench 与 web） |
| `pnpm run test:gui` | `packages/client` 与 `packages/host` |

测试策略要点：`test:coverage`（而非 `test`）是 CI 覆盖率门禁；spec 在 fork 的 worker 中与其它门禁进程**并发**运行，因此每个 spec 必须自己拥有并回收端口、临时路径与子进程——"单独跑才过"的 spec 是有缺陷的 spec。

## 5. 静态门禁与本地检查

| 命令 | 内容 |
|---|---|
| `pnpm run typecheck` | Host lib 阶段 + Client tsc |
| `pnpm run lint` / `lint:fix` | oxlint |
| `pnpm run duplication` | jscpd 跨文件 TS 克隆检测 |
| `pnpm run hygiene` | publint + workspace/包/依赖检查 + NodeNext 消费者检查（消费已构建产物，需先 `pnpm run build`） |
| `pnpm run doc-sync` | 文档门禁（`scripts/run-gates.ts`） |
| `pnpm run test:docs` | 快速文档检查（无构建，doc-quick 聚合） |
| `pnpm run website:build` | VitePress 构建（兼作死链检查） |
| `pnpm run check:all` | 综合本地门禁集（与 Git 钩子独立） |
| `pnpm run check:ci` | CI 主组 |

`pnpm run gen-*` / `verify-*` 成对存在（如 `gen-module-graph` / `verify-module-graph`、`gen-tool-catalog` / `verify-tool-catalog`、`gen-config-catalog`、`gen-dependency-catalog`、`gen-doc-graphs`、`gen-session-format-catalog` 等），生成物在 CI 中有 freshness 门禁。

**选择最小覆盖集**：按改动面对齐证据（聚焦行为测试、模型/用户输出快照、`doc-sync`、已构建冒烟、真 API e2e）。不要因为提交或推送就默认跑全套，也不要重复已通过的门禁；CI 负责穷尽覆盖与平台矩阵。

## 6. Git 钩子（lefthook）

- `pre-commit`：校验暂存的 i18n 配对记录、用 `.oxlintrc.staged.json` 校验并修复暂存文件、按需重生成 `THIRD_PARTY_NOTICES.md`、检查空白错误、运行 vendor 清单守卫。
- `pre-merge-commit`：在 Git 生成自动合并提交前做同样的索引配对检查。
- `pre-push`：运行 `pnpm run typecheck`。

钩子**有意不跑**测试、快照、文档检查、构建或 hygiene——这些由贡献者按改动面选择性执行，CI 负责穷尽。

## 7. TODO 标记

按紧急度三档：

- `FIXME`：应阻塞新发布的问题（除非评审明确同意照常合并）。
- `TODO`：应尽快修，等资源。
- `XXX`：也许某天修，最低优先级，无承诺。

## 8. 常见坑

- 依赖来自缓存导致缺钩子：重跑 `node scripts/install-lefthook.mjs`。
- `pnpm run hygiene` / 已构建冒烟需要先 `pnpm run build`（干净 worktree 没有 `lib/*.js` 与声明）。
- 移动 checkout 后需重跑 lefthook 安装脚本以重建受管路径。
- HMR：YAML 控制是否启用（base 启用 config-only `dsh-hmr`；headless/SDK/ACP 关闭；`sdk-minimal` 不含）。
