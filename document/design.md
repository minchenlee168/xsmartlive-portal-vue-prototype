# 直播管家後台 — 設計規範

本文件涵蓋產品後台（xsmartlive-portal-vue）的視覺設計規範，包含色票、字級、間距、layout、設計原則、元素規格等。元件層級的細部規格見「十二、延伸資源」。

> 品牌網站、行銷頁等對外視覺另有獨立文件，本文件不涵蓋。

## 十條鐵則（先讀這裡）

1. **顏色一律走 token**：中性色用 `surface-*`、邊框用 `var(--p-content-border-color)`、語意色成對 `text-red-600 dark:text-red-400`；禁止 `bg-white` / `text-gray-*` / `border-gray-*` / `bg-zinc-*`（見 2.4）。
2. **淺色與深色同等重要**，每頁兩個主題都要驗過（見 2.4）。
3. **icon 一律 FontAwesome**，禁 `pi pi-*`、禁 emoji（見 5.4）。
4. **先用 PrimeVue 元件，再考慮手刻**；不用 `:pt` 覆寫顏色（見 7.0）。
5. **一頁只有一顆實心主色功能鈕**（搜尋鈕、彈窗 footer、Table 操作欄的 text 按鈕不計）；其餘操作一律 outlined / secondary（見 5.2、6.9）。
6. **頁面主標題放頁首列（Card 外、與麵包屑同列）**，用 `PageHeader`（見 6.7）。
7. **字級只用 Tailwind 階梯**，禁 `text-[13px]` 等任意值（見 3.1）。
8. **間距 4px 階梯**：4 / 8 / 12 / 16 / 24 / 32（見 四）。
9. **搜尋按鈕只寫「搜尋」二字、不加 icon、不用「查詢」**（見 7.6）。
10. **表單 label 永遠可見、放 input 上方**，唯一例外是搜尋區緊湊模式（見 7.8、7.6）。

## 一、產品定位

| 項目 | 內容 |
| --- | --- |
| 系統 | 直播管家後台（商城後台系統，`xsmartlive-portal-vue`） |
| 主要使用者 | 個人賣家、微型團隊，以及 2–10 人規模的中小型電商營運團隊 |
| 設計調性 | 現代簡約 × 商務專業（SaaS 工具感） |

## 二、色票系統

### 2.1 品牌主色

| 用途 | 色碼 | 說明 |
| --- | --- | --- |
| 主色（Primary） | `#7008E7` | 深紫，用於主要 CTA、品牌標識、強調區塊 |
| 主色 Soft | `#F2EBFF` | 淡紫底，用於 hover 背景、選中狀態、tag 底色 |

### 2.2 功能色（狀態語意色）

| 語意 | Strong | Soft | 用途 |
| --- | --- | --- | --- |
| 成功 / 啟用 | `#16A34A` | `#DCFCE7` | 成功提示、啟用狀態、進行中徽章 |
| 危險 / 停用 | `#DC2626` | `#FEE2E2` | 錯誤、刪除、停用狀態 |
| 警告 / 未開始 | `#CA8A04` | `#FEF9C3` | 警示、未開始狀態 |
| 資訊 | `#2563EB` | `#DBEAFE` | 一般資訊提示、**超連結 / 外部連結文字** |

### 2.3 中性色

> `surface-*` 由 `tailwindcss-primeui` 提供，本專案對應 Tailwind **slate** 色階（依 `main.css` 設定為準）。下表色碼是 token 在淺色主題下的**參考值**，實作請寫 token（見 2.4），不要寫色碼。

| 用途 | 色碼 | 說明 |
| --- | --- | --- |
| 文字主色 | `#334155` | 標題與內文 |
| 文字次色 | `#64748B` | 輔助說明文字 |
| 邊框 | `var(--p-content-border-color)`（淺色約 `#E2E8F0`） | 一般邊框、分隔線；全站唯一邊框色，DataTable 分隔線亦同 |
| 內容區背景 | `#F1F5F9`（`bg-surface-100 dark:bg-surface-950`） | 後台 DefaultLayout 內容區底色，與卡片白底對比 |
| AuthLayout 背景 | 同內容區背景（`bg-surface-100 dark:bg-surface-950`） | 登入／註冊／忘記密碼頁背景，與後台內容區共用同一 token |
| 主底色 | `#FFFFFF`（`bg-surface-0 dark:bg-surface-900`） | 卡片、TopBar、Sidebar 等主要背景 |

> 上表的色碼是**淺色主題**下的值。深色主題請一律改用下節的 token 寫法，不要把這些色碼寫死進 class。

### 2.4 深色模式（Dark Mode）

淺色與深色是**同等的一級主題**，不是「淺色為主、深色為輔」。每個頁面都必須在兩個主題下都能看。

**機制**（三個 app 一致，backend / scm / ops）：

| 層 | 設定 |
| --- | --- |
| 切換 | `stores/config.ts` 在 `<html>` 上 toggle `.dark` |
| PrimeVue | `main.ts` 的 `darkModeSelector: '.dark'` |
| Tailwind | `main.css` 的 `@custom-variant dark (&:where(.dark, .dark *))` |

**鐵則：顏色一律走 token，不裸寫單一色階。**

`bg-white`、`text-gray-700`、`border-gray-200`、`bg-zinc-100` 這類 class 在深色主題下**不會變**，是目前最主要的破圖來源（lint 會以 SOFT 警告提示）。改用 `surface-*` 色階（由 `tailwindcss-primeui` 提供，隨主題自動翻轉）或 PrimeVue CSS 變數。

中性色映射：

| 用途 | 淺色 | 深色 | 建議寫法 |
| --- | --- | --- | --- |
| 主底色（卡片、TopBar、Sidebar） | `surface-0` | `surface-900` | `bg-surface-0 dark:bg-surface-900` |
| 內容區背景 | `surface-100` | `surface-950` | `bg-surface-100 dark:bg-surface-950` |
| 文字主色 | `surface-700` | `surface-100` | `text-surface-700 dark:text-surface-100` |
| 文字次色 | `surface-500` | `surface-400` | `text-surface-500 dark:text-surface-400` |
| 邊框 | `surface-200` | `surface-700` | `border-surface-200 dark:border-surface-700`，或直接用 `var(--p-content-border-color)`（本身已隨主題變） |

語意色映射（深色底下需提高亮度才夠對比，一律成對指定）：

| 語意 | 淺色 | 深色 |
| --- | --- | --- |
| 成功 / 啟用 | `text-green-600` | `dark:text-green-400` |
| 危險 / 停用 | `text-red-600` | `dark:text-red-400` |
| 警告 / 未開始 | `text-yellow-600` | `dark:text-yellow-400` |
| 資訊 / 超連結 | `text-blue-600` | `dark:text-blue-400` |

**其他規則：**

1. **PrimeVue 元件不要用 `:pt` 覆寫顏色。** Aura theme 本身已同時定義兩個主題的值；一旦手動覆寫，深色主題就會脫節。按鈕請用 `severity`，不要自己塗色。
2. **品牌主色 `#7008E7` 不要寫死。** 它在深色底上對比不足，PrimeVue 的 primary token 會在深色主題自動改用較亮的階；用 `severity="primary"` 或 primary token，不要用 `bg-[#7008E7]`。
3. **兩個主題都要達 WCAG AA（一般文字 4.5:1、大字 3:1）。** 只在淺色下驗證不算數。
4. **既有的 `dark:bg-slate-800`、`dark:text-slate-300` 這類手寫配對是舊寫法**，能動但不成系統。新頁面一律用 `surface-*`；碰到舊檔案順手換掉。

## 三、字體與字級

- 中文：**Noto Sans TC**（Regular 400 / Medium 500 / SemiBold 600 / Bold 700）
- 英文與數字：沿用 system-ui fallback

### 3.1 字級階梯

| 層級 | 規格（字級 / 字重 / 行高） | Tailwind | 用途 |
| --- | --- | --- | --- |
| Display | 24px / 700 / 32px | `text-2xl font-bold` | 頁面主標題（頁首標題列，與麵包屑同列；見 6.7） |
| Title | 20px / 500 / 28px | `text-xl font-medium` | 大區塊標題（一頁只有少數幾個、需要強烈分界時） |
| Subtitle | 18px / 700 / 28px | `text-lg font-bold` | Dialog / Drawer 標頭等次標題 |
| **Section** | **16px / 600 / 24px** | **`text-base font-semibold`** | **卡片內的區塊標題**（對齊 PrimeVue `p-panel-title`）。卡片內分區用這一級，不用 Title——Title 會與頁面主標題爭焦點 |
| Body | 16px / 400 / 24px | `text-base` | 內文、設定項名稱、DataTable 主資訊（見 7.5） |
| Label | 14px / 400 / 20px | `text-sm` | 表單標籤、按鈕文字、手機卡片列表（見 7.5） |
| Helper | 12px / 400 / 16px | `text-xs` | 輔助說明、註解、提示文字、表格內的次要 metadata |

> **Section 與 Body 同為 16px**，靠字重（600 vs 400/500）區分。若某頁區塊標題與內文貼得太近而糊在一起，把該頁的設定項名稱降回 Label（14px），不要把區塊標題放大到 Title。
>
> **禁止使用 13px（`text-[13px]`）。** 它不在 Tailwind 預設階梯上（只有 `text-xs` 12px 與 `text-sm` 14px），也不是 PrimeVue 的值（Aura 的 `Message size="small"` 是 14px），只能靠任意值語法寫出來——誰都不對齊。它是舊程式碼的歷史殘留，非設計決策。輔助說明一律用 Helper（`text-xs`）。
>
> **本專案的輔助說明比 PrimeVue 慣例小**（12px vs Aura `Message size="small"` 的 14px）：這是刻意選擇，後台資訊密度高，說明文字不需與元件內文同級。

## 四、間距節奏

統一以 **4px 為基準**的間距階梯，提升版面節奏一致性。

`4px` ・ `8px` ・ `12px` ・ `16px` ・ `24px` ・ `32px`

> 避免使用 13.25px、9.75px 等不規則小數值，所有 padding / margin / gap 應對齊上述階梯。

## 五、設計原則

1. **視覺強度 = 動作重要性**
   越重要的動作給越強的視覺（實心主色），次要動作遞減，引導使用者視線落點。
2. **一頁只有一顆實心主色功能鈕**
   範圍是**整個頁面本體**（頁首操作列、搜尋 Card、Table 上方工具列、卡片 footer、批次操作列……全部合計），不是「每個群組各一顆」。整頁只留一個最主導的動作（通常是「新增 / 建立」）用實心主色，其餘操作一律 outlined 或 `severity="secondary"`；兩顆以上會彼此稀釋，使用者不知該按哪個。

   **不計入的三種情況**（各有自己的規則，不佔這個名額）：
   - **搜尋鈕**：搜尋 Card 內的「搜尋」固定為實心主色（見 7.6），它是查詢動作不是功能動作。
   - **Dialog / Drawer footer**：彈窗開啟時蓋住頁面，是獨立情境，footer 可有自己的一顆主色鈕（見 7.4）。
   - **Table 操作欄的「編輯」**：icon-only 的 `variant="text"` 按鈕，無底色，不算實心主色鈕（見 7.4、7.5）。
3. **顏色不可單獨承載語意**
   狀態、層級必須同時用文字 / 圖示 / 形狀傳達，確保色盲使用者可辨識。例如「啟用」標籤不只用綠色，要有文字 +（必要時）圓點圖示。
4. **不使用 emoji / 表情符號當作 UI 元素**
   icon、狀態標記、地點/警告等符號一律用 FontAwesome（`<FontAwesomeIcon :icon>`，已全域註冊），**禁用 PrimeVue Icon（`pi pi-*`）、禁止用 emoji（📍✅⚠️🔴🟢 等）**。emoji 跨平台 / 字體渲染不一致、無法統一配色與尺寸、也不符品牌調性；需要視覺符號時挑對應語意的 icon（地點 `['fas','location-dot']`、警告 `['fas','triangle-exclamation']`、成功 `['fas','circle-check']`…），並用 utility（`size-4` / `text-primary`）控制尺寸與顏色。

## 六、Layout 設計規則

> 主要設計寬度為 **1440px**（後台原型基準），實際採 fluid layout — 靠 Sidebar 固定寬 + 內容區 `flex-1` 自適應，無 max-width 限制。
>
> **PC 為主，手機為輔**：先在 1440px 下把排版、元件寬度、留白節奏做到位，再往手機尺寸適配；不能為了手機呈現犧牲 1440px PC 版的視覺與資訊密度。

### 6.1 整體骨架（DefaultLayout — 已登入頁面）

```
┌─────────────────────────────────────┐
│ TopBar (h-[60px] / px-6)             │
├─────┬───────────────────────────────┤
│     │                               │
│ Side│  內容區（bg-surface-100）      │
│ bar │  padding 16px (p-4)           │
│     │  區塊間距 16px (gap-4)        │
│     │                               │
└─────┴───────────────────────────────┘
```

| 區塊 | 規格 | 說明 |
| --- | --- | --- |
| 整體容器 | `w-screen h-screen` + `flex flex-col` | 全螢幕、垂直堆疊 |
| TopBar | `h-[60px]`、`px-6`、底邊 `border-b` | 高度固定 60px |
| Sidebar 展開 | `w-64`（256px） | 預設展開狀態 |
| Sidebar 收合 | `w-14`（56px） | hover 時浮層展開為 `w-64` |
| 內容區背景 | `bg-surface-100 dark:bg-surface-950` | 與卡片白底形成對比（token 見 2.4） |
| 內容區 padding | `p-4`（16px 四周） | 統一邊距 |
| 區塊堆疊間距 | `gap-4`（16px） | 頁面內多個區塊垂直排列 |
| 內容欄 shrink | Sidebar+內容欄 flex row 中，內容欄需加 `min-w-0` | flex-item 預設 `min-width: auto`，寬子元素（多欄 DataTable、超寬 grid）會撐大 flex-item 突破 `w-screen`；`min-w-0` 允許 shrink 至分配空間 |
| 內容欄溢出 | 內容捲動容器用 `overflow-auto`（非 `overflow-y-auto`） | 若寬內容真的超過視窗寬（如超寬表格），出橫向捲軸而非被 clip 或撐爆版面 |

### 6.2 AuthLayout（登入／註冊／忘記密碼）

| 區塊 | 規格 | 說明 |
| --- | --- | --- |
| 整體容器 | `w-screen min-h-screen` | 全螢幕高度 |
| 背景色 | `bg-surface-100 dark:bg-surface-950` | 與後台內容區共用同一 token |
| 主排版 | `flex flex-col items-center justify-center` | 內容完全置中 |
| 右上工具列 | `absolute right-2 top-2` + `gap-2` | 主題切換、語言切換 |
| Footer | 底部固定 | 版權聲明 |

### 6.3 響應式斷點

後台只用**兩個斷點**，各自負責一件事，不做 lg / xl 細分（後台預設大螢幕使用）：

| 斷點 | 寬度 | 負責 | 行為 |
| --- | --- | --- | --- |
| `sm` | 640px | **版面骨架（Sidebar）** | `< sm` Sidebar 變抽屜（Mask 蓋全螢幕，點擊外部關閉）；`≥ sm` 常駐側邊（展開 256px / 收合 56px） |
| `md` | 768px | **資料表格** | `< md` DataTable 改手機卡片列表（見 7.5）；`≥ md` 用 DataTable |

> 640–768px 之間 Sidebar 已常駐、表格仍是卡片版，這是預期行為（平板直立）。除這兩處外，不再新增斷點。

### 6.4 通用間距規範

頁面骨架與一般容器的間距節奏：

| 場景 | Class | 像素 |
| --- | --- | --- |
| 一般同列元素間距 | `gap-4` | 16px |
| 密集同列元素間距 | `gap-2` / `gap-3` | 8px / 12px |
| 容器內 padding | `p-4` | 16px |

### 6.5 巢狀容器原則

- 頁面內容已被 Card 包住時，內部區塊**不再使用 Card**，改以底線（`border-t`）、間距或區塊標題區隔
- 巢狀 Card 會產生重複陰影與邊框，造成層級混亂
- 一層 Card 已足以界定一個獨立內容區

### 6.6 Table 頁面排版

當 Table 上方有分類功能時，**一律使用頁籤（Tabs）**，並依空間採以下三種排版之一：

**模式一：由上而下三層**

```
┌──────────────────────────┐
│ Tabs（分類）              │
├──────────────────────────┤
│ 功能鈕（新增、匯出等）     │
├──────────────────────────┤
│ Table                    │
└──────────────────────────┘
```

**模式二：同列分左右**

```
┌──────────────────────────┐
│ Tabs（分類） │ 功能鈕      │
├──────────────────────────┤
│ Table                    │
└──────────────────────────┘
```

**模式三：標題 + 功能鈕 + Table（無搜尋區的頁面）**

標題與功能鈕同列，標題靠左、功能鈕靠右；Table 在下方。

```
┌──────────────────────────┐
│ 標題           │ 功能鈕   │
├──────────────────────────┤
│ Table                    │
└──────────────────────────┘
```

> **頁面主標題一律放在「頁首標題列」**（Card 外、與麵包屑同一列），不放進 Card 內——本模式的「標題」即指該頁首列標題，功能鈕仍留在 Table 上方。頁首列與麵包屑規格見 6.7。

### 6.7 列表頁範式（搜尋 / 篩選 / 批次操作）

有搜尋區的資料列表頁（訂單管理、商品列表等），由上而下的標準結構：

```
┌──────────────────────────────────────────────┐
│ 頁首列：頁面標題 (左) ─────────── 麵包屑 (右)      │  ← Card 外，獨立一行
├──────────────────────────────────────────────┤
│ 搜尋 Card                                       │
│  ├ （Tabs 分類，如有）                            │
│  ├ 搜尋列：關鍵字 + 搜尋鈕 (左) ── 頁首操作鈕列 (右) │
│  ├ 進階篩選（可收合，顯示已套用數量）              │
│  └ 快速篩選 tag 列 ─────────────── 共 N 筆 (右)  │
├──────────────────────────────────────────────┤
│ 資料 Card：DataTable（批次模式時首欄加勾選框）      │
└──────────────────────────────────────────────┘
```

- **頁面標題 + 麵包屑**放在**頁首列（Card 外、獨立一行）**：標題靠左（Display 級，`text-2xl font-bold text-surface-700 dark:text-surface-100`），麵包屑靠右（`ml-auto`）。**標題不放進 Card 內**（此為現行標準，取代舊版「標題放搜尋 Card 內」寫法；同步見 6.6、7.6）。
  - 頁首列容器：`flex flex-wrap items-center gap-3`。
  - **麵包屑**：`ml-auto flex items-center gap-2 text-sm`；上層節點（分類/選單群組，通常不可點）用 `text-muted-color`，分隔符 `<FontAwesomeIcon :icon="['far','chevron-right']" class="text-muted-color text-xs" />`，**當前頁**用 `text-primary`。麵包屑文字用 i18n，不硬寫。
  - 標題與麵包屑**同一列**：桌機左右對齊（標題左、麵包屑 `ml-auto` 靠右）；窄螢幕靠 `flex-wrap` 自動換行、不擠壓。
- **頁首操作鈕列**（新增/建立、批次作業、匯出、設定入口…）放搜尋 Card 內、搜尋列右側（`justify-between`：搜尋群組靠左、操作鈕靠右）。整頁只能有一顆實心主色功能鈕（見 5.2）：若頁面有「新增 / 建立」這類主導動作，實心主色給它，其餘操作（批次作業、匯出、設定入口…）全部 outlined；沒有主導動作時全部 outlined（見 6.9）。下拉型操作用 PrimeVue `<Menu :popup>`（`#start`/`#end` slot 放說明與提示），不要手刻 `<button>`。
- **即時 vs 按鈕套用要一致區分**：快速篩選 tag chip 即時套用；進階篩選 / 下拉搜尋條件按「搜尋」才套用（pending → applied）。
- **批次操作**：進入批次模式後 DataTable 首欄出現勾選框，並出現批次操作 banner / 列；未進入批次模式不顯示勾選框。
- **「共 N 筆」**放篩選列最右。
- **實作一律用共用元件**：頁首列（標題 + 麵包屑）用 `PageHeader`；列表骨架用 `BasePageContainer` + `PaginationTable` + `PaginationTableToolbar`（承載搜尋 / 篩選 / 操作鈕）。本節描述的是版面意圖，元件的唯一接法與 props 契約見專案 `component-rule` 與 `libs/ui` catalog，不手刻等價物。

### 6.8 彈窗內容版型選用

彈窗內容依「可編輯與否 / 是否為矩陣 / 資料量」選版型，**不要一律套 DataTable**：

| 內容型態 | 選用 | 例 |
| --- | --- | --- |
| **可編輯的設定矩陣**（每格是輸入框、可能有跨欄列） | **CSS grid**（`grid-cols-[...]` + `col-span-*`） | 預設配送設定（配送方式 × 溫層） |
| **唯讀資料列**（需排序 / 分頁 / 多筆掃讀比對） | **DataTable** | 庫存調整紀錄、多列商品明細 |
| **一般單值欄位表單**（非矩陣） | **flex flex-col**（label 在上，見 7.8） | 合併訂單編輯、開立發票 |

判準：

- DataTable 是「展示資料列」的元件——**不要拿它做整片可編輯的下拉 / 輸入矩陣**。它的 `<Column>` 各自獨立，做不到單列 cell 跨欄（`col-span`），編輯也得走 inline-edit，較繁瑣。
- 矩陣式表單（label × 維度）用 grid：維度標頭用 `<Tag :severity>`（不手刻上色）；缺格用「—」佔位，**高度與同列輸入框等高**（沿用 PrimeVue 輸入框預設高度，不另寫死 px）；不分維度的列讓其輸入框 `col-span-*` 橫跨維度欄，併入同一矩陣而非另開區塊。
- 拿不準時自問：使用者是來「**填**」還是「**看**」？填 → grid / form；看 → DataTable。

### 6.9 頁面操作按鈕分群

後台頁面本體**只有一顆實心主色功能鈕**（見 5.2）。各群組的慣例如下；「佔名額」一欄標示該群組的主色鈕是否算進這一顆：

| 群組 | 位置 | 佔名額 | 慣例 |
| --- | --- | --- | --- |
| **頁首操作列** | 列表頁搜尋 Card 右上 | **是** | 若有單一主導的「新增 / 建立」動作，實心主色給它（如多購物車頁的「新增多購物車」、商品頁的建立按鈕）；其餘操作（批次作業 / 合併訂單 / 匯出 / 設定入口）**全部 outlined**。頁面沒有主導動作時（如訂單頁）全部 outlined |
| **Table 上方工具列、卡片 footer、批次操作列** | 頁面本體其他區塊 | **是** | 與頁首操作列**共用同一個名額**：頁首已有主色鈕時，這些區塊的按鈕一律 outlined / secondary |
| **搜尋 / 篩選列** | 搜尋 Card 內 | 否 | 「搜尋」固定實心主色（見 7.6）；清除、進階篩選切換為次要 |
| **Table 操作欄** | 每列最右 | 否 | icon-only `variant="text"` + tooltip + `aria-label`；編輯=主色 text、刪除=danger、其餘 secondary（見 7.5） |
| **彈窗 footer** | Dialog / Drawer 底部 | 否（獨立情境） | 主要動作（儲存 / 確認 / 送出）為 footer 唯一實心主色鈕，靠右；取消 outlined secondary（見 7.4） |

拿不準時自問：**這一頁使用者最常、最該做的一件事是什麼？**只有那一件用實心主色。

## 七、元素規格

> 本節收錄常用元件的尺寸、內距、形狀規格。新增元件時優先沿用既有規格，不重複造輪子。

### 7.0 先用 PrimeVue 元件，再考慮手刻

新元件 / 新區塊先檢查 PrimeVue 是否已有對應元件，**有就直接用，不要拿 `<span>` / `<div>` 自製樣式**。手刻不只缺少 a11y、theming 也會跟全站不一致。

| 場景 | PrimeVue 元件 |
| --- | --- |
| 狀態 / 標籤 chip（status badge、count badge、屬性 tag） | `<Tag :severity="info \| success \| warn \| danger \| secondary \| contrast">` |
| 開關（啟用 / 關閉） | `<ToggleSwitch>` |
| 多選 checkbox / 全選 | `<Checkbox binary>` |
| 單選 | `<RadioButton>` |
| 下拉選單 | `<Select>` / `<MultiSelect>` |
| 數字輸入 | `<InputNumber>` |
| 一般文字輸入 | `<InputText>` |
| 多行文字 | `<Textarea>` |
| 富文本 | `<Editor>` |
| 日期 / 時間選擇 | `<DatePicker>` |
| 按鈕 | `<Button>`（含 severity / variant 變體） |
| 對話框 | `<Dialog>` / `<Drawer>` |
| 分頁 | `<Paginator>` |
| 表格 | `<DataTable>` + `<Column>` |
| Tabs | `<Tabs>` + `<TabList>` + `<Tab>` |
| Tooltip | `v-tooltip` directive |
| Toast / Confirm | `useToast()` / `useConfirm()` |

**例外可手刻的情況**：商品卡 / 規格表細項列 / 自訂佈局容器（divide-y 區塊…）等 PrimeVue 沒有對應元件的 layout pattern；但其內部的可互動元素（buttons / inputs / tags）仍須優先用 PrimeVue。

### 7.1 元素內距

| 元素 | Class | 像素 |
| --- | --- | --- |
| 選單 item padding | `px-3 py-2` | 左右 12px / 上下 8px |
| TopBar 左右 padding | `px-6` | 24px |
| Tabs（Card 內）| `TabList :pt="{ root: { class: 'px-6' } }"` | TabList 加 `px-6` 對齊上下兄弟元素的內距；TabList 底線不會貼到 Card 最左右邊 |

### 7.2 元素高度

| 元素 | 規格 | 像素 | 用途 |
| --- | --- | --- | --- |
| 按鈕（預設） | PrimeVue `<Button>` 預設尺寸，**不加 `h-*`** | ≈40px，與 InputText / Select / DatePicker 等高 | 頁面本體所有按鈕：主色 CTA、outlined、secondary 一律同高 |
| 按鈕（small） | `size="small"` | ≈36px | **整列切換**，限三種情境：Table 操作欄、彈窗內空間受限的區塊（與 `size="small"` 的 DataTable 同區）、TopBar 內的切換鈕 |
| 選單項 | `h-12` | 48px | Sidebar 選單、Dropdown item |
| TopBar | `h-[60px]` | 60px | 頂部固定列 |

**按鈕尺寸由「所在的列」決定，不由重要性決定。**重要性已經靠實心 / outlined 表達；若再用尺寸區分，同一列會出現 40px 實心鈕挨著 36px outlined 鈕，底邊對不齊、旁邊的輸入框也對不齊，看起來是沒對齊而非有層級。

- 同一列的按鈕**一律同尺寸**；要用 small 就整列 small，包含那顆主色鈕。
- 不用 `h-9` / `h-10` 手寫高度，尺寸走 PrimeVue `size` prop（見 7.0、7.4）。
- **「畫面擁擠」不是改用 small 的理由**——那通常代表動作太多。先收：次要操作收進 `<Menu :popup>`（見 6.7），非主導動作降 outlined（見 6.9）；縮小按鈕是最後手段，且不低於 36px 點擊高度。

### 7.3 圓角、邊框與過渡

| 項目 | 規格 |
| --- | --- |
| 一般元件圓角（Button、Input、Tag 以外的小元件） | `rounded-md`（6px） |
| 容器圓角（Card、Dialog、Drawer、Panel） | `rounded-lg`（8px） |
| Tag / Badge 圓角 | `rounded-full`（完全圓） |
| 邊框寬度 | 1px |
| 邊框配色 | `var(--p-content-border-color)`（全站唯一邊框色，隨主題翻轉；見 2.3） |
| 一般過渡 | `transition-all duration-200` |
| Fade 過渡 | `0.2s ease` |
| Sidebar 寬度過渡 | `200ms ease`（寬度 + box-shadow） |

### 7.4 按鈕規範

| 規則 | 說明 |
| --- | --- |
| **Icon 使用** | 主要功能按鈕（CTA、新增、儲存等）**前面加 icon**；次要、輔助、文字按鈕不一定要加 |
| **Table 操作欄 icon 唯一性** | Table 操作欄的按鈕（檢視、編輯、刪除等）**避免不同功能用同一個 icon**，否則使用者難以辨識 |
| **同列按鈕同尺寸** | 同一列的按鈕一律同尺寸（預設或整列 small），主色鈕**不放大也不縮小**；尺寸依情境整列切換，規則見 7.2 |
| **Table 操作欄按鈕樣式** | 通常**只放 icon**（無文字），並以 **tooltip** 顯示操作名稱。**例外於 7.6 搜尋按鈕的 icon-only 禁令** — 此情境多按鈕密集排列，靠 tooltip 補語意更省空間 |
| **Table 操作欄「編輯」規格** | icon 一律用 FontAwesome `['far','edit']`（鉛筆＋方框），**不用 `pi-*` 或其他變體**；配色走**主色紫**（`<Button>` 不指定 `severity`，即 PrimeVue 預設 primary），**不用 `severity="info"`**，作為列內主要操作的視覺焦點 |
| **Table 操作欄「刪除」規格** | icon 一律用 FontAwesome `['far','trash']`；配色走**危險紅**（`severity="danger"`），對應色票系統的「危險 / 停用」語意 |
| **Table 操作欄其餘次要操作** | 檢視、更多等次要操作用 `severity="secondary"` |
| **Table 操作欄按鈕共通屬性** | 一律用共用元件 `TableActionButton`（已封裝 `variant="text"`、`size="small"`、`v-tooltip.top` 與 `aria-label`；`label` 為已翻譯字串、兼作 tooltip 與 `aria-label`，**不可省略**），不手刻 `<Button>`。細節見專案 `component-rule` 與 `libs/ui` catalog |
| **次要按鈕樣式** | 次要按鈕用**紫色框線**樣式（`outlined`，主色框線），與頁面唯一的實心主色鈕形成階層；頁面本體的其餘功能鈕一律用這個或 `severity="secondary"`（見 5.2） |
| **新增按鈕 icon** | 「新增」類按鈕（新增 XXX、Add、Create 等）一律用 FontAwesome `['fas','plus']`，不用 `circle-plus` 或其他變體。目的：跨頁面視覺一致 |
| **Dialog 主色按鈕不加 icon** | Dialog footer 的主色 CTA 按鈕（`確認 / 儲存 / 送出 / 合併` 等）**不加 icon**（**覆蓋上面的「Icon 使用」規則**）;Dialog 內文字已聚焦、footer 空間有限,按鈕文字已足夠表意,加 icon 反而視覺雜訊。次要按鈕（取消、關閉）本來就不加 icon |
| **「送出申請」按鈕規格** | 申請送出類動作（金鑰申請、配號模式異動申請等）一律統一：label 用「**送出申請**」、icon 用 FontAwesome `['far', 'paper-plane']`（透過 `#icon` slot）、**主色實心**（`<Button>` 不指定 `severity`）。paper-plane 為此類動作的識別標記，**跨頁面一致**。此為上一列「Dialog 主色按鈕不加 icon」的**具名例外**——一般 `送出` 表單仍不加 icon，唯「送出**申請**」需 paper-plane 強化「提出申請」語意 |

### 7.5 Table 規範

| 規則 | 說明 |
| --- | --- |
| **全選 checkbox 位置** | 統一放在 table header（第一欄表頭內），**不獨立放在 table 外部上方** |
| **欄位對齊** | 一律**靠左**對齊。數字、數量、金額不強制靠右——後台表格欄位數多、寬度不一，靠右反而讓視線在欄與欄之間跳動；需要縱向比較數值的場景（如財務報表）再個別評估 |
| **沿用 PrimeVue Aura 預設樣式** | DataTable **不寫 `:pt` 客製化** `headerCell` / `bodyCell` 的 background、padding、font-size、font-weight；header / body padding（≈12px 縱、16px 橫）、weight（600 表頭、400 內文）、分隔線色（`var(--p-content-border-color)`）全部走 Aura theme tokens。字級方面 Aura 未對 cell 設 font-size token，cell 繼承 root **16px**（見上方「Cell 內字級」列）——不需、也不要新增 font-size token 或全域 CSS 覆寫 |
| **隔行底色** | 一律加 `striped-rows`（PaginationTable / BaseDataTable 也預設開啟），讓多列資料更易視覺掃讀 |
| **dataKey 必填** | DataTable 一律設 `dataKey`（通常 `"id"`），給選取 / 展開 / 群組功能依賴 |
| **Cell 內字級** | 主資訊用 **16px（Body 級）**；補充說明 / 變體名 / metadata 等次要文字用 `text-xs`（12px）+ `text-surface-500 dark:text-surface-400`（**不要用 `text-gray-500`**，深色主題下不會變，見 2.4），與主資訊形成階層。**16px 為全站表格內文標準**，且是「零設定」的預設：DataTable cell 不繼承任何 14px base、PrimeVue 也沒對 cell 寫 font-size，故 cell **直接繼承 root 16px**——主資訊欄位**維持不加字級 class 即可**（`text-base` 只在需明示時用）。**不要對主資訊加 `text-sm`**（那會降成 14px；舊程式碼常見此殘留，屬待清） |
| **空狀態** | 用 `<template #empty>` 渲染，文字色用 `text-muted-color`，垂直 padding ≥ `py-12` |
| **緊湊模式** | 對話框內或空間受限時加 `size="small"`（≈8-10px 縱 / 12px 橫 padding），不關掉 `striped-rows` |
| **格線模式** | 需要顯示縱橫格線時加 `show-gridlines`；適用場景：規格表 / 群組合併，以及**列印預覽 / 出貨單 / 發票 / 收據等**需列印或視覺對照的表格（讓每格邊界清楚，印刷後仍能辨識欄位）；**一般資料列表不開**，避免視覺過重 |
| **凍結欄 + 橫向捲動提示** | Table 用**凍結欄**（如固定在右側的「操作」欄）且資料會橫向捲動時，**一律加捲動可發現性提示**，避免使用者不知後面還有隱藏欄位：<br>① 水平捲軸**常駐可見**（`overflow-x: scroll` + `scrollbar-gutter: stable`）；<br>② 在可捲資料區左右邊緣疊**漸層 fade + 可點的 chevron**（`‹` / `›`，點擊捲動約 60% 視寬）；右側提示要**貼齊凍結欄內側**（`right: 凍結欄寬`，避免蓋到操作 icon）；<br>③ 依捲動位置顯示：捲到最左隱藏 `‹`、最右隱藏 `›`。判斷「還能往右」時**要扣掉常駐捲軸保留的殘差**：`scrollWidth − (scrollLeft + clientWidth) > ~16px` 才算，否則捲到底 `›` 仍會誤顯示；<br>④ 提示顏色一律走 `var(--p-*)` token（深色安全）。實作範例見 `OrderListPage.vue` |
| **窄螢幕改手機卡片列表** | 資料表格在 `< md`（<768px）**改用手機卡片列表**，不要讓多欄表格在手機硬橫向捲動（捲動僅適用桌機超寬表格，見上一列）。做法（雙渲染，純 Tailwind 斷點、無 JS）：<br>① 桌機 DataTable 加 `class="hidden md:block"`；<br>② 另以 `<div class="md:hidden divide-y divide-[var(--p-content-border-color)]">` 渲染卡片列——**每列用 `divide-y` 分隔，不各自包 `border`/`rounded` 卡片**（表格已在外層 Card 內，避免巢狀 Card，見 6.5）；<br>③ 每列 `flex flex-col gap-2 px-1 py-3`，由上而下分層：**主要識別**（`font-semibold`，如名稱／抬頭）＋同列右側放**狀態 Tag**（`shrink-0`）→ **次要資訊**（字級與呈現見下方「手機卡片字級一致」「多資訊欄位收為一區」）→ **操作列靠右**（`flex justify-end gap-2`）；<br>④ 手機操作鈕**加回文字 label**（tooltip 在觸控裝置不觸發，不用 icon-only）；<br>⑤ 空狀態放兩個容器之外或各自渲染一次，`py-12 text-center`；長名稱／抬頭 `break-words` 不 truncate。實作範例見 `BlankListPage.vue`（下載空白發票號碼檔）；原型參照為會員列表 `MemberListPage.vue` |
| **手機卡片字級一致** | 手機卡片內容**一律 `text-sm`（14px）**，與搜尋區 chip 一致（桌機 DataTable 主資訊為 16px，手機刻意縮一級換取密度）；**不要混用 `text-xs`／`text-base`**（否則出現 12／14／16 三種字級、顯得雜亂）。層級改用**顏色與字重**表現：欄位 label 用 muted（`text-surface-400 dark:text-surface-500`）、值用 `text-surface-600/700 dark:text-surface-200/300`；需強調的數值（如金額）用 `font-semibold`、**不放大字級**。僅次級 id／彩色徽章文字可保留 `text-xs` |
| **多資訊欄位收為一區** | 桌機同一欄塞多筆資訊時（如「標單來源/收單方式/場次/留言」），手機卡片要把該欄**收成一個底色區塊**（`rounded-md bg-surface-50 dark:bg-surface-800/40 px-2 py-2`，內部 `flex flex-col gap-1`）以視覺群組，區塊內每筆資訊加 muted label（`label value`）；**單一資訊欄**則直接一行 `label value`（label muted、`shrink-0`）、不加框。原則：**一個桌機欄＝手機卡片一個視覺群組，每筆資訊都要有 label**，避免多欄資訊混成一片無法辨識 |

### 7.6 搜尋區規範

| 規則 | 說明 |
| --- | --- |
| **獨立 Card** | 搜尋條件區（含條件欄位 + 搜尋按鈕）**統一包在獨立 Card 內**，與 table、功能鈕視覺分離 |
| **搜尋按鈕樣式與位置** | 「搜尋」按鈕放在搜尋 Card 內（通常右下或最後一個欄位旁），**不獨立放在 Card 外**；**只放「搜尋」二字、不加 `pi-search` 或其他 icon**（此為 7.6 特例，覆蓋 7.4「主要功能按鈕前面加 icon」，目的是讓搜尋 Card 視覺更乾淨）|
| **按鈕文字統一** | 一律使用「**搜尋**」二字。禁止：「查詢」、其他同義詞 |
| **禁用 icon-only** | 不使用單獨的放大鏡 icon 按鈕（無文字會影響辨識，違反「圖示+文字並用」原則） |
| **清除按鈕** | 搜尋條件**超過 4 個**時，加上「清除」按鈕（灰色 outlined 樣式）。少於 4 個可省略 |
| **按鈕尺寸** | 搜尋、清除按鈕**一律用預設尺寸**（與同列輸入框等高），不加 `size="small"`、不手寫 `h-*`（見 7.2） |
| **頁面標題位置** | 頁面主標題**放在「頁首標題列」**（Card 外、獨立一行，與麵包屑同列），**不放進搜尋 Card 內**（現行標準，取代舊版寫法；規格見 6.7） |
| **緊湊模式（label 收進欄位）** | 搜尋條件多、常駐 label 佔掉過多垂直空間時，可改用 **placeholder 當 label**（見下方「搜尋區緊湊模式」）。此為 7.8「label 永遠可見」的**唯一例外**，僅限搜尋區，一般表單不適用 |
| **下拉選項依內容寬、不截斷** | 搜尋 / 篩選列的 `<Select>` **觸發器可以窄，但展開的選項面板要依最長選項自適應寬度**，選項文字**完整顯示、不可出現截斷的「…」**（例：「7-11 B2C 冷凍到府收件」這種長選項在 160px 窄欄下不能被切）。作法：讓 overlay 面板 `width: auto`（`min-width` 對齊觸發器、再往內容寬成長）、選項 `white-space: nowrap` 不 truncate（PrimeVue 可透過 `:pt` 的 overlay / list slot 或全域 CSS 處理）；**不要靠加寬觸發器來解**（會撐爆搜尋列版面） |

#### 搜尋區緊湊模式

搜尋條件在 6 個以上、每個欄位都掛常駐 label 會讓搜尋區高度翻倍時，允許把 label 收進欄位，用 placeholder 承擔標示。

**採用時必須同時滿足以下三點**，否則不如維持常駐 label：

| 條件 | 原因 |
| --- | --- |
| **所有欄位預設值為 `null`** | PrimeVue Select 只在值為 null / undefined 時顯示 placeholder。若欄位預設就帶值（如 `'all'`、`'order_no'`），placeholder 從頭到尾不會出現，label 等於直接消失 |
| **每個 Select 加 `show-clear`** | 讓使用者能把值清回 null。否則選了值之後就再也回不到「未選」狀態，該欄位永久失去標示 |
| **`null` 語意等同「不限 / 全部」** | 送查詢時要明確處理 null（帶「全部」或省略該參數），不能讓它變成漏送條件 |

**已知取捨**：使用者選定值之後，該欄位的 placeholder 會被選中的值取代，當下就看不出這欄是什麼條件。條件越多、使用者停留越久，這個問題越明顯——所以這是「省空間」換「填完後的可辨識性」，不是免費的優化。

**不適用的情境**：一般表單（新增 / 編輯頁）、欄位少於 6 個的搜尋區、需要反覆回頭比對條件的報表查詢——這些一律回到 7.8 的常駐 label。

**空間仍然不夠時**，優先考慮「收合進階篩選」（常用條件常駐、其餘收進展開區塊），它能同時保住 label 與版面。

### 7.7 連結（Link）規範

| 規則 | 說明 |
| --- | --- |
| **文字色** | 超連結 / 外部連結文字一律用資訊藍 `#2563EB`，與「資訊提示」共用色票。**不用綠色 / 紫色**（綠色屬成功語意、紫色是主色 CTA） |
| **Hover 樣式** | `hover:underline` 提示可點；不改字色 |
| **外部連結另開分頁** | `target="_blank"` + `rel="noopener noreferrer"`（安全 + 防止 reverse tabnabbing） |
| **可選 icon** | 連結前可加小型 icon（FontAwesome `['far','book']` / `['far','arrow-up-right-from-square']` 等）幫助辨識用途；icon 顏色沿用文字色 |

### 7.8 表單排版規範

> 表單一律用共用元件承載：欄位用 `BaseFormField`（label / 錯誤 / 提示排版）、可儲存的視窗用 `BaseFormDialog`、金額用 `CurrencyInputNumber`、日期用 `BaseDatePicker`。下表為版面意圖，元件唯一接法見專案 `component-rule` 與 `libs/ui` catalog。

| 規則 | 說明 |
| --- | --- |
| **相鄰 input 間距** | 同一列的 form 元件（InputText / InputNumber / Select / DatePicker 等）之間一律 **8px**（`gap-2`），欄位到按鈕亦同。Select 的 chevron、DatePicker 的日曆 icon 在 8px 下已有足夠留白，不需額外加寬——24px 會讓搜尋列顯得鬆散、佔用過多水平空間 |
| **上下欄寬對齊** | 表單有多列時，**所有列共用同一個 grid** 讓欄寬垂直對齊：Row 1 用 `1fr 200px 200px`，Row 2 / Row 3 也用同一組 grid columns，欄位不足時放空 div 佔位。**禁止** Row 1 用 3 欄、Row 2 用 2 欄、Row 3 又寫 `max-w-[280px]` 各自為政（視覺會參差不齊） |
| **grid 欄寬留餘裕** | 多欄 form 用 grid 分欄時，每欄寬度預留元件內部裝飾至少 40px 空間：<br>• **InputText / 純 InputNumber（無 show-buttons）**：最窄 140px<br>• **InputNumber `show-buttons stacked`**（上下 stepper）：最窄 **200px**（stepper 佔 ~40px + 數字空間）<br>• **InputNumber `show-buttons horizontal`**（左右 stepper）：最窄 **220px**（−/+ 兩側 + 數字）<br>• **InputNumber mode="currency"**：最窄 **200px**（currency prefix "NT$" + 大數字）<br>• **Select / DatePicker**：最窄 160px（chevron / icon 佔 ~30px）<br>寧可寬 20-40px，不要拿最緊寬度 |
| **label 位置** | 一律**放在 input 上方**（`flex flex-col gap-2`），不採用 label 左、input 右的橫式排列（RWD 相容性差） |
| **必填標示** | 由 `BaseFormField`（傳 `required`）承載；若需手寫，紅色星號色走 token（`text-[var(--p-red-500)]`），**不硬編碼色碼**、不加圓點、不加空格 |
| **placeholder** | 只寫「提示 / 範例」（如「請輸入品名」），**不當 label 用**；label 永遠可見（Design.md 十）。**唯一例外**：搜尋區條件過多時可用緊湊模式（見 7.6），一般表單不適用 |
| **disabled input placeholder** | 依賴其他欄位自動帶入的欄位，placeholder 用「↑ 選擇 XXX 後自動帶入」提示來源 |
| **選填 label** | label 後面加淺灰 `<span class="text-xs text-[var(--p-text-muted-color)]">（選填）</span>` |
| **輔助說明位置** | 欄位下方，用 `text-xs text-[var(--p-text-muted-color)]`（Helper 12px） |
| **InputNumber 用 fluid 撐滿寬度** | PrimeVue 4 的 InputNumber **內部 `<input>` 預設不會填滿 container**（focus area 會比外框窄）→ 一律加 `fluid` prop 讓 input flex-grow 撐滿。**不要**用 `class="w-full"` 代替（w-full 只作用在最外層 wrapper，input 內部還是不填滿） |
| **InputNumber 增減鈕（stepper）樣式** | 數字欄需要 stepper 時一律用 `<InputNumber show-buttons button-layout="horizontal">`（左右 `−  值  +`，非上下 stacked），並用 `#incrementbuttonicon` / `#decrementbuttonicon` slot 覆寫成 FontAwesome `['far', 'plus']` / `['far', 'minus']`，統一顯示 **−／＋** 符號，**不留 PrimeVue 預設 chevron**。全站數量／時數等數字欄一致採此樣式（如標單設定、編輯資料、手動下標彈窗）：<br>`<InputNumber show-buttons button-layout="horizontal" fluid><template #incrementbuttonicon><FontAwesomeIcon :icon="['far', 'plus']" /></template><template #decrementbuttonicon><FontAwesomeIcon :icon="['far', 'minus']" /></template></InputNumber>` |
| **表單區塊間距** | 兩個 field 群組間 `gap-4`（16px）；同一群組內欄位 `gap-2`（8px） |

### 7.9 日期時間格式

| 規則 | 範例 | 說明 |
| --- | --- | --- |
| **日期** | `2026/07/01` | 一律 `YYYY/MM/DD`，分隔符用斜線 `/`，不用 `-` 或 `.` |
| **日期 + 時間** | `2026/07/01 14:26` | 日期後空一格接 24 小時制 `HH:mm`，**不顯示秒** |
| **DatePicker 顯示** | `date-format="yy/mm/dd"` | PrimeVue DatePicker 用 `yy/mm/dd`（等於 `YYYY/MM/DD`） |
| **日期區間（DatePicker）** | `2026/07/01 - 2026/07/14` | 原生 DatePicker range 模式，起訖以內建 ` - ` 分隔；空欄 placeholder 統一顯示格式提示 `YYYY/MM/DD - YYYY/MM/DD` |
| **例外：需要精確到秒** | `2026/07/01 14:26:23` | 僅日誌 / 稽核 / 交易紀錄等需要秒級精度的情境使用 `HH:mm:ss`；一般列表 / metadata 不加秒 |

### 7.10 Sidebar 選單狀態

各 app（backend / ops / scm）的 `MenuItem.vue` **一律沿用同一套狀態樣式**，不各自發明。

| 狀態 | Class | 說明 |
| --- | --- | --- |
| **父層選中**（有子選單、目前路由在其底下） | `bg-primary text-primary-contrast hover:text-primary-contrast` | 實心主色整塊反白，僅 `level === 0` 適用 |
| **子層選中**（有子選單的非頂層） | `text-primary` | 只變文字色，不加底色 |
| **葉節點選中**（頁面連結、無子選單） | `text-primary` + `border-r-4 border-primary` | 文字變主色 + **右側** 4px 主色邊條；**不加底色**、**不用左邊條** |
| **hover** | `hover:text-primary` | 僅變文字色 |

> 葉節點選中不用淡紫底色（`bg-primary-50`）：父層已經是實心紫，子項再加底色會讓同一條選單出現兩層色塊，層級反而模糊。

## 八、整體調性

- 大量白底留白，深紫色作為品牌主色與 CTA 重點
- 圓角卡片（`rounded-lg` 8px，見 7.3），細邊框分隔內容區塊
- 結構化排版，資訊層次清楚，符合後台工具用戶對「易讀、可信賴」的期待
- 適度動態（fade transition、hover 漸變），不過度誇張
- 視覺基底參考 PrimeVue Aura design system

## 九、設計關鍵字

> 專業 ・ 簡潔 ・ 可信賴 ・ 效率導向 ・ 直播感（紫色點綴）

## 十、Do's and Don'ts

| 範疇 | ✅ Do | ❌ Don't |
| --- | --- | --- |
| **配色** | 用色票系統內定義的顏色；主色點到為止，作為視線焦點 | 過度飽和的螢光色搭配；自創色票語意 |
| **視覺基調** | 用線條風格、抽象幾何或實拍截圖 | 卡通插畫、Q 版吉祥物（與商務專業定位不符） |
| **明暗** | 顏色走 `surface-*` token 與成對的 `dark:` 語意色，淺色／深色主題都要驗過（見 2.4） | 裸寫 `bg-white`、`text-gray-*`、`border-gray-*`（深色主題下不會變，直接破圖）；用 `:pt` 覆寫 PrimeVue 元件顏色 |
| **邊框** | 一律 `var(--p-content-border-color)`，讓區塊輕柔分隔 | 用黑色或深灰高對比邊框（視覺突兀，與簡約調性衝突） |
| **圖示** | 一律 FontAwesome（`<FontAwesomeIcon :icon>`，全域註冊）;優先選擇語意最貼近的圖示;FA 無對應時才退 SVG asset | 用 PrimeVue Icon（`pi pi-*`）——與全站 icon 系統分裂;在 UI 文案中混入 emoji 字元(跨平台渲染不一致) |
| **狀態語意** | 同類狀態跨頁面一律使用相同色（成功=綠、危險=紅） | 為每個新狀態自創新色 |
| **層級** | 一層 Card 已足以界定獨立內容區；內部用底線 / 間距區隔 | 巢狀 Card（重複陰影與邊框造成層級混亂） |
| **操作** | 整頁只有一顆實心主色功能鈕（搜尋鈕、彈窗 footer 不計），給最主導的動作，置於視線終點（群組最右側）；其餘 outlined / secondary | 頁首「新增」是實心主色、Table 工具列「匯出」也是實心主色（兩顆彼此稀釋）；把「每個區塊各一顆」當成允許 |
| **回饋** | Loading 期間按鈕進入 disabled + spinner，避免重複提交 | 停用狀態仍保留 hover 變色（造成可點擊錯覺） |
| **表單** | label 永遠可見（搜尋區緊湊模式例外，見 7.6）；錯誤訊息具體說明如何修正 | 在一般表單用 placeholder 取代 label；只用紅框表示錯誤（無文字） |
| **破壞性動作** | 一律經二次確認對話框；對話框預設焦點放取消鈕 | 列表中直接放實心紅刪除鈕（無確認） |

## 十一、已知未涵蓋範疇

本文件聚焦色票、字級、間距、layout、設計原則。以下項目尚未納入，遇到需求時：

1. **動畫 / Motion 設計** — 除了基本 fade 0.2s 與 hover 過渡外，沒定義頁面切換、stagger、loading 動畫等規範。
2. **圖片與插圖風格** — 截圖、示意圖、空狀態插畫、行銷用圖等視覺資產風格未定義。
3. **Loading / Skeleton 狀態** — `PaginationTable` 已內建載入狀態（`loading` / `load-failed`）；其餘 spinner、骨架屏、進度條等狀態樣式尚未系統化定義。
4. **多語系視覺適配** — 中英文字寬差異、長字串截斷策略未列。
5. **品牌網站 / 對外行銷視覺** — 另有獨立文件（尚未建立），不在本文件範圍。

> 上述項目實作時，先沿用 PrimeVue Aura 預設並與設計討論，後續再回補至本文件。

## 十二、延伸資源

- **產品實作基準**：`apps/backend/`（PrimeVue Aura theme + Tailwind CSS 4 + Noto Sans TC 的實際整合範例）
- **元件層級規格**（button、status-badge、form-field、confirm-dialog 等的完整 hierarchy、states、do/dont 與無障礙標準）：見專案 `.claude/rules/component-rule.md` 與 `libs/ui/README.md`（共用元件 catalog）

## 十三、變更紀錄

| 日期 | 變更 |
| --- | --- |
| 2026-09-15 | 新增「十條鐵則」與本節。收斂內部矛盾：邊框色統一 `var(--p-content-border-color)`；內容區 / AuthLayout 背景統一 `bg-surface-100 dark:bg-surface-950`（原 `bg-gray-100` / `bg-zinc-100`）；危險色 Strong 只留 `#DC2626`；圓角拆「元件 rounded-md / 容器 rounded-lg」；斷點明定 `sm`（Sidebar）與 `md`（表格）兩個；頁首標題改 `surface-*`；Sidebar 父層選中改 `text-primary-contrast`；字級表依大小重排並補行高；手機卡片字級註明與桌機 16px 不同；第二、三章小節補編號（2.1–2.4、3.1）供交叉引用。lint 同步：HARD 加 `text-[13px]`，SOFT 新增裸寫 `bg-white` / `text-gray-*` / `border-gray-*` / `bg-zinc-*` 警告，cell 字級規則由 14px 更正為 16px。 |

| 2026-09-15 | **主色鈕規則收緊**：由「每個按鈕群組各一顆」改為「**整頁只有一顆實心主色功能鈕**」。不計入：搜尋鈕（固定主色）、Dialog / Drawer footer（獨立情境）、Table 操作欄的 text 按鈕。同步修改 5.2、6.7、6.9（新增「佔名額」欄）、7.4 次要按鈕、第十章「操作」列、鐵則 #5。 |

| 2026-09-15 | **按鈕高度規則改寫**：7.2 由「一般 h-9 / 主要 h-10」改為「預設尺寸（PrimeVue 預設，與輸入框等高）／ `size="small"` 整列切換，限 Table 操作欄、彈窗受限區塊、TopBar」；同列按鈕一律同尺寸，主色鈕不以尺寸區分；「畫面擁擠」先收操作（Menu / outlined）再考慮 small。7.4 新增「同列按鈕同尺寸」列，7.6 按鈕尺寸列改為引用 7.2。 |

> 待確認：Subtitle（18px / 700）字重比 Title（20px / 500）重，階梯不單調；若無實際用例可考慮移除或改 600。
