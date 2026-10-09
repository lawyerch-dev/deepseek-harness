#!/usr/bin/env bash
# 一条命令启动 Web，并自动带上本自定义插件包（custom- 前缀）。
#
#   ./packages/client/custom-my-workflow/run.sh            # 默认端口，自动打开浏览器
#   ./packages/client/custom-my-workflow/run.sh --no-open  # 不打开浏览器
#
# 令牌从环境变量 MY_API_TOKEN 读取（在 cordis.yml 里配置变量名）：
#   export MY_API_TOKEN=xxxx && ./packages/client/custom-my-workflow/run.sh --no-open

set -euo pipefail

# 切到仓库根目录（本文件位于 packages/client/custom-my-workflow/，上溯三级），
# 保证相对路径与依赖解析正确。
cd "$(dirname "$0")/../../.."

exec pnpm dsh web --patch ./packages/client/custom-my-workflow/cordis.yml "$@"