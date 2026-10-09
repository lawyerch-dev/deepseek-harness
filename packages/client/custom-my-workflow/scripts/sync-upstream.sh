#!/usr/bin/env bash
# 与官方上游合并升级的一键流程。只动我们自己的注册点，官方冲突分别对待：
#
#   1. fetch 上游 + rebase
#   2. 冲突时提示：官方自身改动走 rebase 冲突解决；我们的 2 处注册由脚本重放
#   3. 重放注册点（ensure-registration.mjs）
#   4. 重新生成 lockfile + 安装
#   5. 重新编译本插件
#
#   ./packages/client/custom-my-workflow/scripts/sync-upstream.sh [--rebase]
#     --rebase  自动执行 git rebase（默认只拉取并 dry-run，先看会发生什么）

set -euo pipefail

# 切到仓库根目录（本文件位于 packages/client/custom-my-workflow/scripts/，上溯四级）
cd "$(dirname "$0")/../../../../"

AUTO_REBASE=false
for arg in "$@"; do
  case "$arg" in
    --rebase) AUTO_REBASE=true ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

echo "==> 确保有 upstream 远程"
git remote get-url upstream >/dev/null 2>&1 || {
  echo "  添加 upstream: https://github.com/deepseek-ai/deepseek-harness.git"
  git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
}

echo "==> 拉取上游"
git fetch upstream master

if [ "$AUTO_REBASE" = true ]; then
  echo "==> rebase 到 upstream/master"
  git rebase upstream/master
else
  echo "==> dry-run: 预计落后多少（未实际 rebase，加 --rebase 才推进）"
  git rev-list --count HEAD..upstream/master | xargs echo "    上游领先本分支: 条提交"
fi

echo "==> 重放我们的注册点（tsconfig + web-app deps）"
node packages/client/custom-my-workflow/scripts/ensure-registration.mjs

echo "==> 刷新 lockfile + 安装"
pnpm install --no-frozen-lockfile

echo "==> 重新编译本插件"
pnpm exec tsc -b tsconfig.client.json
pnpm --filter @deepseek-ai/dsh-client-custom-my-workflow bundle

echo "==> 完成。手动核对：git status，确认自定义插件与官方改动都已就位。"