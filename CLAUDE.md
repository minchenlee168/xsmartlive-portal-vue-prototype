# CLAUDE.md — Project rules for AI coding

## 設計規範（強制遵守）

所有 UI 改動一律以專案根目錄的 [`Design.md`](./Design.md) 為準（涵蓋色票、字級、間距、layout、元件規格、Do's/Don'ts）。動手前先讀對應章節,不要憑通用設計常識自由發揮。

## Prototype changelog 慣例
本 repo 是 `xsmartlive-portal-vue-prototype`。TopBar 有 info icon 點開的 Dialog,自動讀最近 10 筆 commit 顯示給用戶。
- Commit subject 用 conventional 風格：`feat:` / `fix:` / `refactor:` / `chore:`
- Commit body 用 `-` 開頭條列式,寫**用戶看得懂**的更新內容（不寫實作細節）
- vite.config 用 `git log --format=%cI|%s%n%b%x00` 抓資料,deploy 後才會刷新

## 專案結構備註
- 觸控友善：`.p-inputtext` / `.p-select` / `.p-button:not(.sm):not(.lg):not(.icon-only)` 已在 `src/style.css` 統一 `min-height: 44px`
</content>
</invoke>