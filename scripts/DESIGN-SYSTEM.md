# 設計系統 — 使用說明

一套可攜的後台設計系統：**規範 + 4 個唯讀設計 sub-agent + lint + git hook**，可打包搬到其他專案，並雙向同步。

---

## 組成

| 位置 | 檔案 | 作用 |
| --- | --- | --- |
| repo | `document/design.md` | **設計規範本體**（真正的 source of truth） |
| repo | `.claude/agents/*.md` | 4 個 sub-agent：`ui-layout-designer` / `ui-visual-style` / `ui-content-writer` / `ui-design-reviewer` |
| repo | `.claude/settings.json` | Claude Edit/Write 時即時跑 lint 的 hook |
| repo | `scripts/design-md-lint.sh` | 規範 lint（純 bash、無外部依賴） |
| repo | `.githooks/pre-commit` | commit 前掃 staged `.vue` |
| repo | `scripts/pack-design-system.sh` | **打包工具**（把上述打包成可攜 bundle） |
| repo | `scripts/bundle-assets/` | 目標專案用的 `install.sh` + 說明 |
| 本機桌面 | `design-system-bundle.tar.gz` | 打包快照（非版控，`pack` 產生） |
| 本機桌面 | `裝設計系統.sh` | 一鍵安裝指令（非版控，方便用） |

---

## 兩個指令

**① 打包回桌面**（改完規範/agents 後，在任一裝過的專案執行）
```bash
bash scripts/pack-design-system.sh
# 產出 ~/Desktop/design-system-bundle.tar.gz；也可指定路徑：
# bash scripts/pack-design-system.sh /自訂/路徑.tar.gz
```

**② 裝進別的專案**（在目標專案根目錄執行）
```bash
cd /path/to/目標專案
~/Desktop/裝設計系統.sh
```
> 沒有桌面小指令時，等同：
> ```bash
> tar xzf ~/Desktop/design-system-bundle.tar.gz -C /tmp
> /tmp/design-system-bundle/install.sh "$(pwd)"
> ```

---

## 雙向流程

```
任一裝過的專案改完規範
   │  bash scripts/pack-design-system.sh   ← 打包「回」桌面
   ▼
~/Desktop/design-system-bundle.tar.gz
   │  ~/Desktop/裝設計系統.sh              ← 從桌面裝「進」其他專案
   ▼
其他專案更新到最新
```
打包工具會**隨安裝一起帶到目標專案**，所以任何裝過的專案都能就地重打包 → 對稱往返。

---

## 安裝時的行為

- **直接覆蓋**：`design.md`、`.claude/agents/`、`lint`、`pre-commit hook`、打包工具
- **不覆蓋、改放暫存供手動合併**：`.claude/settings.json`、`CLAUDE.md`
  （若目標已存在 → 放成 `*.design-system.*`，把設計相關段落自行合併進去）
- **自動接線**：`git config core.hooksPath .githooks`（目標已有別的 hooksPath 會提醒、不硬改）

---

## 設計工作流（來自 `CLAUDE.md`）

- **標準流程**：`ui-layout-designer → ui-visual-style → ui-content-writer → ui-design-reviewer`
- **大幅版面改動**（新頁面／重寫區塊／新增 dialog／多欄表單…）：動手前先過 `ui-layout-designer`、交付前再過 `ui-design-reviewer`
- **小改動**（改文案、Tag 顏色、rename、區塊搬移）不必動用 sub-agent
- Sub-agent 唯讀，只回報不改檔；修正由主 session 或對應 agent 執行

---

## 注意事項

1. **先打包再安裝**：在來源改了規範，要先 `pack` 刷新桌面包，目標端 `裝` 才拿得到新版；不先打包等於用舊快照覆蓋。
2. **單一主來源**：桌面包是「最後一次打包的專案」的快照。建議指定一個專案當主來源、統一在那裡改與打包，其他專案只「裝進去」，避免多邊互相覆蓋。
3. **覆蓋會洗掉在地修改**：目標若曾自行改過 `design.md` 或某個 agent，重裝會被蓋掉；有專屬調整先備份。
4. **路徑相依**：agents 與 CLAUDE 片段寫死指向 `document/design.md`；目標若放別的路徑，要一起改引用。
5. **桌面兩支是本機檔**（非版控）：換電腦或清桌面後，重跑 `pack` 即可再生 `tar.gz`；`裝設計系統.sh` 則可重寫或從 bundle 內的 `install.sh` 直接用。
