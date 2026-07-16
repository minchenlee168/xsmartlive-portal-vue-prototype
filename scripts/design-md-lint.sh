#!/usr/bin/env bash
#
# document/design.md lint — 抓最容易違反的 pattern
#
# 使用：
#   scripts/design-md-lint.sh --files <file>...       # 直接 lint 檔案（pre-commit / CI 用）
#   scripts/design-md-lint.sh --claude-hook           # 從 stdin 讀 Claude JSON 抓 new content lint
#   scripts/design-md-lint.sh --all                   # lint 全部 src/**/*.vue
#
# Exit code：
#   0 = 沒違反 或 只有 soft 警告
#   1 = 有 hard 違反（block）
#
# Rule 格式：pattern@@reason（用 @@ 分隔避免跟 regex 內的 | 衝突）

set -u

RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
NC=$'\033[0m'

HARD_HITS=0
SOFT_HITS=0

# ── Hard 違反：一律 block ────────────────────
HARD_RULES=(
  'text-\[(9|10|10\.5|11|11\.5|15|17|17\.5|22)px\]@@document/design.md 三：字級不在階梯（用 text-xs / sm / base / lg / xl / 2xl）'
  'rounded-\[[0-9]+px\]@@document/design.md 7.3：圓角不用硬值（用 rounded-sm / md / lg / xl / full）'
  'label="查詢"@@document/design.md 7.6：搜尋按鈕文字統一「搜尋」，禁用「查詢」'
  'gap-[0-9]+\.5@@document/design.md 四：間距用階梯 4/8/12/16/24/32（避免 gap-N.5）'
  '(py|px|pt|pb|pl|pr|mt|mb|ml|mr)-[0-9]+\.5"@@document/design.md 四：間距用階梯（避免 py/px/mt 等半格；py-0.5 給 Tag 除外請透過 :pt）'
)

# ── Soft 警告：印出但 exit 0 ────────────────────
SOFT_RULES=(
  'label="搜尋".*icon=@@document/design.md 7.6：搜尋按鈕不加 icon'
  'icon=[^ ]* label="搜尋"@@document/design.md 7.6：搜尋按鈕不加 icon'
  'inline-flex.*rounded-full.*font-(bold|semibold)@@document/design.md 7.0：手刻 badge 改用 <Tag :severity>'
  'inline-flex.*rounded-md.*font-(bold|semibold)@@document/design.md 7.0：手刻 badge 改用 <Tag :severity>'
  '#f97316@@document/design.md 二：警告色用 #CA8A04 非 #f97316（若是 accent 用途可忽略）'
  '#fef3c7@@document/design.md 二：警告底色用 #FEF9C3 非 #fef3c7'
  'class="!text-@@document/design.md 7.5：不用 !text-* 覆蓋 PrimeVue Tag / Button 內建樣式'
  'py-(8|10)"@@document/design.md 7.5：空狀態 padding ≥ py-12'
  'text-sm font-(medium|bold|semibold) text-\[var\(--p-text-color\)\][^<]*}}</span>@@document/design.md 7.5：DataTable cell 主資訊用預設 14px / 400（不加 text-sm font-medium 覆蓋）'
  'gap-1[^0-9]@@document/design.md 7.8：表單相鄰 input 一律 gap-2（8px）；gap-1 = 4px 過窄'
  'flex[^"]*items-(end|center)[^"]*gap-1"@@document/design.md 7.8：form 元件間距 ≥ 8px，避免 InputNumber stepper / Select chevron 撞到旁邊欄位'
  'grid-template-columns:[^]]*1(4|5|6)0px[^]]*1(4|5|6)0px@@document/design.md 7.8：欄寬留餘裕 — InputNumber show-buttons stacked / currency ≥ 200px、horizontal ≥ 220px（Select / DatePicker 160px 可）'
)

# 掃描一段內容
scan_content() {
  local content="$1"
  local label="$2"

  local rule pattern reason line
  for rule in "${HARD_RULES[@]}"; do
    pattern="${rule%%@@*}"
    reason="${rule#*@@}"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      # 忽略註解行
      echo "$line" | grep -qE '^[[:space:]]*[0-9]+:[[:space:]]*(<!--|//|\*)' && continue
      echo "${RED}✗ HARD${NC}  ${CYAN}${label}${NC}"
      echo "        ${line}"
      echo "        ${reason}"
      HARD_HITS=$((HARD_HITS + 1))
    done < <(echo "$content" | grep -nE "$pattern" 2>/dev/null || true)
  done

  for rule in "${SOFT_RULES[@]}"; do
    pattern="${rule%%@@*}"
    reason="${rule#*@@}"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      echo "$line" | grep -qE '^[[:space:]]*[0-9]+:[[:space:]]*(<!--|//|\*)' && continue
      echo "${YELLOW}⚠ SOFT${NC}  ${CYAN}${label}${NC}"
      echo "        ${line}"
      echo "        ${reason}"
      SOFT_HITS=$((SOFT_HITS + 1))
    done < <(echo "$content" | grep -nE "$pattern" 2>/dev/null || true)
  done
}

scan_file() {
  local file="$1"
  scan_content "$(cat "$file")" "$file"
}

MODE="${1:-}"
case "$MODE" in
  --claude-hook)
    JSON=$(cat)
    TOOL=$(echo "$JSON" | jq -r '.tool_name // ""')
    FILE=$(echo "$JSON" | jq -r '.tool_input.file_path // ""')
    [[ "$FILE" != *.vue ]] && exit 0
    case "$TOOL" in
      Write)
        scan_content "$(echo "$JSON" | jq -r '.tool_input.content // ""')" "$FILE (Write)"
        ;;
      Edit)
        scan_content "$(echo "$JSON" | jq -r '.tool_input.new_string // ""')" "$FILE (Edit)"
        ;;
      MultiEdit)
        COUNT=$(echo "$JSON" | jq -r '.tool_input.edits | length')
        for i in $(seq 0 $((COUNT - 1))); do
          scan_content "$(echo "$JSON" | jq -r ".tool_input.edits[$i].new_string // \"\"")" "$FILE (MultiEdit #$((i + 1)))"
        done
        ;;
    esac
    ;;
  --files)
    shift
    for f in "$@"; do
      [[ -f "$f" && "$f" == *.vue ]] && scan_file "$f"
    done
    ;;
  --all)
    while IFS= read -r f; do
      scan_file "$f"
    done < <(find src -name "*.vue" 2>/dev/null)
    ;;
  *)
    echo "Usage: $0 --claude-hook | --files <file>... | --all"
    exit 2
    ;;
esac

if [[ $HARD_HITS -gt 0 ]]; then
  echo ""
  echo "${RED}✗ document/design.md lint 失敗：${HARD_HITS} 個 hard 違反、${SOFT_HITS} 個 soft 警告${NC}"
  echo "  hard 違反必須修正才能繼續。查閱 document/design.md 對照規則。"
  exit 1
fi

if [[ $SOFT_HITS -gt 0 ]]; then
  echo ""
  echo "${YELLOW}⚠ document/design.md lint：${SOFT_HITS} 個 soft 警告（不 block，請確認是否為正當使用）${NC}"
fi
exit 0
