#!/usr/bin/env bash
#
# 重新打包設計系統 bundle —— design.md / agents / lint / hook 有更新後執行，
# 產出可攜的 design-system-bundle.tar.gz（給別的專案用 install.sh 安裝）。
#
# 用法：
#   bash scripts/pack-design-system.sh [輸出路徑]
#     省略輸出路徑 → 預設 ~/Desktop/design-system-bundle.tar.gz
#
# 來源皆取 repo 現況，install.sh / README 取自 scripts/bundle-assets/，
# CLAUDE 設計段落由 CLAUDE.md 動態擷取（自動與規範同步）。

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HOME/Desktop/design-system-bundle.tar.gz}"
ASSETS="$REPO/scripts/bundle-assets"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
B="$STAGE/design-system-bundle"
mkdir -p "$B/payload/document" "$B/payload/.claude/agents" "$B/payload/scripts/bundle-assets" "$B/payload/.githooks"

# 1) payload：取 repo 現況
cp "$REPO/document/design.md"        "$B/payload/document/"
cp "$REPO/.claude/agents/"*.md       "$B/payload/.claude/agents/"
cp "$REPO/.claude/settings.json"     "$B/payload/.claude/"
cp "$REPO/scripts/design-md-lint.sh" "$B/payload/scripts/"
cp "$REPO/.githooks/pre-commit"      "$B/payload/.githooks/"
# 把打包工具本身也放進 payload → 裝過的專案能就地重打包回桌面（自我傳播）
cp "$REPO/scripts/pack-design-system.sh" "$B/payload/scripts/"
cp "$REPO/scripts/bundle-assets/"*       "$B/payload/scripts/bundle-assets/"
cp "$REPO/scripts/DESIGN-SYSTEM.md"      "$B/payload/scripts/"

# 2) CLAUDE.design-system.md：comment header + CLAUDE.md 從「## 設計規範」到「## Prototype changelog」前
{
  cat <<'HDR'
<!--
  設計系統相關的 CLAUDE.md 段落 —— 請「合併」進目標專案的 CLAUDE.md，不要整份覆蓋。
  若目標專案的 design.md 放在不同路徑，記得同步改路徑引用。
-->

HDR
  awk '/^## / { p = ($0 ~ /^## 設計規範/ || $0 ~ /^## 設計工作流/) } p' "$REPO/CLAUDE.md"
} > "$B/payload/CLAUDE.design-system.md"

# 3) install.sh + README：取自 bundle-assets
cp "$ASSETS/install.sh"       "$B/install.sh"
cp "$ASSETS/BUNDLE-README.md" "$B/BUNDLE-README.md"

# 4) 權限 + 打包
chmod +x "$B/install.sh" "$B/payload/scripts/design-md-lint.sh" "$B/payload/.githooks/pre-commit"
mkdir -p "$(dirname "$OUT")"
tar -C "$STAGE" --exclude='.DS_Store' -czf "$OUT" design-system-bundle

echo "✅ 已打包：$OUT"
echo "   大小：$(du -h "$OUT" | cut -f1)"
echo "   內容："
tar -tzf "$OUT" | sed 's/^/     /'
