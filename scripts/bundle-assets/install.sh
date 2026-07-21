#!/usr/bin/env bash
#
# 設計系統安裝腳本 —— 把規範 / sub-agents / lint / git hook 裝進目標專案。
#
# 用法：
#   ./install.sh [目標專案根目錄]      # 省略則預設當前目錄
#
# 行為：
#   - 可安全覆蓋的檔案 → 直接複製
#   - 需要合併的檔案（.claude/settings.json、CLAUDE.md）→ 若已存在，改放 *.design-system.* 供你手動合併
#   - 自動接線 git hook（core.hooksPath = .githooks）

set -euo pipefail

TARGET="${1:-$(pwd)}"
SRC="$(cd "$(dirname "$0")" && pwd)/payload"

if [[ ! -d "$SRC" ]]; then
  echo "✗ 找不到 payload 目錄（$SRC）—— 請在解壓後的 bundle 目錄裡執行" >&2
  exit 1
fi

echo "＝＝ 安裝設計系統 ＝＝"
echo "來源：$SRC"
echo "目標：$TARGET"
echo

# 1) 直接複製（可安全覆蓋）
mkdir -p "$TARGET/document" "$TARGET/.claude/agents" "$TARGET/scripts/bundle-assets" "$TARGET/.githooks"
cp "$SRC/document/design.md"        "$TARGET/document/design.md"
cp "$SRC/.claude/agents/"*.md       "$TARGET/.claude/agents/"
cp "$SRC/scripts/design-md-lint.sh" "$TARGET/scripts/design-md-lint.sh"
cp "$SRC/.githooks/pre-commit"      "$TARGET/.githooks/pre-commit"
# 打包工具一起裝進去 → 目標專案改完規範後可就地重打包回桌面
cp "$SRC/scripts/pack-design-system.sh" "$TARGET/scripts/pack-design-system.sh"
cp "$SRC/scripts/bundle-assets/"*       "$TARGET/scripts/bundle-assets/"
[[ -f "$SRC/scripts/DESIGN-SYSTEM.md" ]] && cp "$SRC/scripts/DESIGN-SYSTEM.md" "$TARGET/scripts/DESIGN-SYSTEM.md"
chmod +x "$TARGET/.githooks/pre-commit" "$TARGET/scripts/design-md-lint.sh" "$TARGET/scripts/pack-design-system.sh" "$TARGET/scripts/bundle-assets/install.sh"
echo "✓ 已複製：design.md、agents、lint、hook、打包工具（pack-design-system.sh + bundle-assets）"

# 2) 需合併：.claude/settings.json
if [[ -f "$TARGET/.claude/settings.json" ]]; then
  cp "$SRC/.claude/settings.json" "$TARGET/.claude/settings.design-system.json"
  echo "⚠  .claude/settings.json 已存在 → 已放 .claude/settings.design-system.json，請手動把其中的 hooks.PreToolUse 段合併進去"
  NEED_MERGE=1
else
  cp "$SRC/.claude/settings.json" "$TARGET/.claude/settings.json"
  echo "✓ 已複製：.claude/settings.json"
fi

# 3) 需合併：CLAUDE.md
if [[ -f "$TARGET/CLAUDE.md" ]]; then
  cp "$SRC/CLAUDE.design-system.md" "$TARGET/CLAUDE.design-system.md"
  echo "⚠  CLAUDE.md 已存在 → 已放 CLAUDE.design-system.md，請把「設計規範」「設計工作流」兩段合併進去"
  NEED_MERGE=1
else
  cp "$SRC/CLAUDE.design-system.md" "$TARGET/CLAUDE.md"
  echo "✓ 已複製：CLAUDE.md"
fi

# 4) 接線 git hook
if git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  CUR="$(git -C "$TARGET" config core.hooksPath || true)"
  if [[ -n "$CUR" && "$CUR" != ".githooks" ]]; then
    echo "⚠  core.hooksPath 目前是 '$CUR'（非 .githooks）→ 未自動更動，請自行決定是否改成 .githooks"
  else
    git -C "$TARGET" config core.hooksPath .githooks
    echo "✓ 已設 git core.hooksPath = .githooks（commit 前會掃 staged .vue）"
  fi
else
  echo "⚠  目標不是 git repo → 略過 hook 接線（之後在該 repo 執行：git config core.hooksPath .githooks）"
fi

echo
echo "＝＝ 完成 ＝＝"
if [[ "${NEED_MERGE:-0}" == "1" ]]; then
  echo "❗ 有檔案需要你手動合併（見上面 ⚠ 標記）。"
fi
echo "可選：package.json 加一行 \"lint:design\": \"bash scripts/design-md-lint.sh --all\""
echo "驗證：bash scripts/design-md-lint.sh --all"
