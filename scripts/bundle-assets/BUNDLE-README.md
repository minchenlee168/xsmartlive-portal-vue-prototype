# 設計系統 Bundle

把「設計規範 + 4 個唯讀設計 sub-agent + lint + git hook」搬到另一個專案用。
來源：`xsmartlive-portal-vue-prototype`。

## 內容

```
payload/
  document/design.md            設計規範本體（真正的 source of truth）
  .claude/agents/*.md           4 個 sub-agent（layout / visual / content / reviewer）+ README
  .claude/settings.json         Claude Edit/Write 時即時跑 lint 的 hook
  scripts/design-md-lint.sh     規範 lint（純 bash、無外部依賴）
  .githooks/pre-commit          commit 前掃 staged .vue
  CLAUDE.design-system.md       要合併進目標 CLAUDE.md 的設計段落
install.sh                      一鍵安裝
```

## 安裝

```bash
tar xzf design-system-bundle.tar.gz
cd design-system-bundle
./install.sh /path/to/目標專案        # 省略路徑則裝到當前目錄
```

安裝腳本會：
- **直接複製**：design.md、agents、lint、pre-commit hook
- **需合併**：`.claude/settings.json`、`CLAUDE.md` —— 若目標已存在，會改放 `*.design-system.*` 讓你手動合併（不覆蓋）
- **自動接線**：`git config core.hooksPath .githooks`

## 手動步驟（若安裝時有 ⚠）

1. **`.claude/settings.json`**：把 `settings.design-system.json` 裡的 `hooks.PreToolUse` 段合併進目標的 settings。
2. **`CLAUDE.md`**：把 `CLAUDE.design-system.md` 的「設計規範」「設計工作流」兩段貼進目標 CLAUDE.md。

## 注意

- **路徑相依**：agents 與 CLAUDE 片段都寫死指向 `document/design.md`。目標若放別的路徑，要一起改引用。
- **lint 依賴**：`design-md-lint.sh` 只用 bash + grep，無 node/npm 依賴；規則對照 design.md 的章節（§三/§四/§7.x…），規則與規範一起搬即可。
- **驗證**：安裝後跑 `bash scripts/design-md-lint.sh --all` 應該要能執行。

---
_此 bundle 由來源專案的 `scripts/pack-design-system.sh` 產生；規範/agents 更新後重跑該腳本即可重新打包。_
