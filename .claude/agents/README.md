# 設計 × 排版 Sub-agent 範本

一套用於「畫面設計與排版」的 Claude Code sub-agent 設定檔，採協調者（orchestrator）模式：由你直接對話的主 Agent 分派任務給四個專門的 sub-agent，各自在獨立 context 中工作，只回報精簡結論。

## 內含的 sub-agent

| 檔案 | 職責 | 工具 |
|------|------|------|
| `ui-layout-designer.md` | 版面結構、格線、區塊安排、響應式 | 唯讀 |
| `ui-visual-style.md` | 配色、字體、間距、design token | 唯讀 |
| `ui-content-writer.md` | 介面文案、按鈕字、空狀態與錯誤訊息 | 唯讀 |
| `ui-design-reviewer.md` | 交付前的一致性／無障礙／跑版審查 | 唯讀 |

四個都設為唯讀（`Read, Grep, Glob`），因為它們的工作是分析與建議。若你要讓某個 agent 直接產出／修改程式碼，再把 `Write`、`Edit`、`Bash` 加進該檔的 `tools` 欄位。

## 安裝

**專案層級**（只在這個案子生效，建議做法）：

```bash
mkdir -p .claude/agents
cp agents/*.md .claude/agents/
```

**使用者層級**（所有專案都能用）：

```bash
mkdir -p ~/.claude/agents
cp agents/*.md ~/.claude/agents/
```

安裝後若在既有 session 中看不到，重啟一次 Claude Code 即可（新建的 agents 目錄需要重載）。之後透過 `/agents` 建立或編輯的變更會即時生效。

## 使用

裝好後不用特別呼叫，主 Agent 會依每個 agent 的 `description` 自動分派。你也可以在提示裡指名，例如：

> 幫我設計一個 SaaS 定價頁。先用 ui-layout-designer 規劃版面，
> 再用 ui-visual-style 定調配色與字體，接著 ui-content-writer 填文案，
> 最後用 ui-design-reviewer 檢查一遍。

## 搭配 Figma

若你已連接 Figma MCP，可以把 Figma 工具掛給需要它的 agent（例如讓 ui-layout-designer 直接讀取現有設計稿）。最穩妥的做法是用 `/agents` 互動介面編輯該 agent、在工具清單中勾選 Figma 相關工具，讓 Claude Code 自動填入正確的工具名稱，而非手動猜測字串。

## 兩個提醒

1. **改檔要重載**：直接編輯磁碟上的 `.md` 通常需重啟 session；透過 `/agents` 的編輯則立即生效。
2. **token 成本**：多 agent 工作流較耗 token（Anthropic 指 subagent 密集的流程可能達單執行緒的約 7 倍）。時間緊就讓 agent 平行跑，預算緊就循序跑。

## 調整建議

- `description` 是分派的關鍵。若某個 agent 該觸發時沒觸發，多半是描述太籠統——把觸發情境、關鍵詞寫得更具體。
- 避免兩個 agent 的描述重疊，否則主 Agent 會亂選。
- 想加新角色（如 `icon-designer`、`motion-designer`），複製任一檔案改寫即可。
