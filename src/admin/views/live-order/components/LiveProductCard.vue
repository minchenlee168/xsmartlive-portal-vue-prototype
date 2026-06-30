<template>
  <!-- 直播商品卡：h-266，寬度跟著 grid cell 撐滿（卡片+gap 總寬對齊快速新增）；
       locked=true 時整張卡 pointer-events-none + 透明度降低（其他競價商品收單中時鎖住） -->
  <div
    class="rounded-[12px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden relative h-[266px] w-full bg-[var(--p-content-background)] transition-opacity"
    :class="locked ? 'pointer-events-none opacity-50' : ''"
  >

    <!-- 狀態 Tag（左上絕對定位）— 規範：直播收單區 status-badge -->
    <div :class="['absolute top-2 left-2 flex items-center gap-1.5 px-[7px] py-[3.5px] rounded-[12px] z-10', statusMeta.bg]">
      <span
        v-if="status === 'live'"
        class="w-1.5 h-1.5 rounded-full bg-[#dc2626] animate-pulse"
      ></span>
      <i
        v-else-if="statusMeta.icon"
        :class="statusMeta.icon"
        :style="`font-size:11px; color:${statusMeta.color}`"
      ></i>
      <span class="font-bold text-[12.25px] leading-none" :style="`color:${statusMeta.color}`">{{ statusMeta.label }}</span>
    </div>

    <div class="flex flex-col h-full px-2 py-1.5 justify-between">
      <div class="flex flex-col gap-2 flex-1 min-h-0">

        <!-- Caption row：圖片 + 名稱/簡碼/價格（編輯模式時可撐高，與下方灰色區塊保持間距） -->
        <div class="flex gap-[7px] items-start min-h-[68px]">
          <!-- 商品圖：依名稱對應到對應的 Unsplash 圖；無法解析時保留虛線框 + 灰 icon -->
          <div
            v-if="productImage"
            class="w-[68px] h-[68px] shrink-0 rounded overflow-hidden bg-[var(--p-content-hover-background)]"
          >
            <img :src="productImage" :alt="displayName" class="w-full h-full object-cover" />
          </div>
          <div
            v-else
            class="w-[68px] h-[68px] shrink-0 rounded border-2 border-dashed border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] flex items-center justify-center"
          >
            <i class="pi pi-image text-[var(--p-text-muted-color)]" style="font-size:20px"></i>
          </div>

          <!-- 右側 3 列：每列獨立 per-field 編輯 -->
          <div class="flex-1 min-w-0 flex flex-col gap-1 items-end">

            <!-- 名稱列 -->
            <div class="flex gap-1 items-center w-full justify-end">
              <template v-if="editingName">
                <InputText
                  v-model="editName"
                  size="small"
                  class="flex-1 min-w-0"
                  @keyup.enter="saveName"
                />
                <Button
                  icon="pi pi-check"
                  severity="success"
                  text
                  rounded
                  size="small"
                  class="!w-7 !h-7 !p-0"
                  @click="saveName"
                />
              </template>
              <template v-else>
                <!-- 禮物 tag：置於禮物名稱左側 -->
                <span
                  v-if="isGift"
                  v-tooltip.top="t('live_order.label.gift_badge')"
                  class="shrink-0 w-[18px] h-[18px] rounded-full bg-[var(--p-primary-color)] text-white flex items-center justify-center"
                >
                  <i class="pi pi-gift" style="font-size:10px"></i>
                </span>
                <!-- 組合商品 tag：用綠色「組」字標示（與商品列表的綠色組 tag 同色） -->
                <span
                  v-if="isBundle"
                  v-tooltip.top="'組合商品'"
                  class="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-[6px] text-[12.25px] font-bold leading-none bg-[#dcfce7] text-[#15803d]"
                >組</span>
                <!-- 名稱靠右對齊（與下方關鍵字 tag 同一邊）— 移除 flex-1 / text-left，
                     讓 parent 的 justify-end 把 tag + 名稱整組包到右側 -->
                <span ref="nameRef" v-tooltip.top="nameTruncated ? displayName : ''" class="font-bold text-[16px] text-[var(--p-text-color)] truncate min-w-0">{{ displayName }}</span>
              </template>
            </div>

            <!-- 關鍵字列（與商品管理「直播關鍵字」同源；空值顯示「—」） -->
            <div class="flex gap-1 items-center w-full justify-end">
              <template v-if="isEditingShort">
                <InputText
                  v-model="editShort"
                  size="small"
                  :placeholder="t('live_order.form.placeholder.keyword_short')"
                  class="flex-1 min-w-0"
                  @keyup.enter="saveShort"
                />
                <Button
                  icon="pi pi-check"
                  severity="success"
                  text
                  rounded
                  size="small"
                  class="!w-7 !h-7 !p-0"
                  @click="saveShort"
                />
              </template>
              <template v-else>
                <span
                  v-if="shortCode"
                  class="bg-[#e0f2fe] text-[#0369a1] text-[12.25px] font-bold px-[7px] py-[3.5px] rounded-[12px] leading-none"
                >{{ shortCode }}</span>
                <span
                  v-else
                  class="text-[12.25px] text-[var(--p-text-muted-color)] leading-none"
                >—</span>
              </template>
            </div>

            <!-- 價格列（編輯中 → InputNumber 步進器；競價模式 / 禮物鎖定） -->
            <div class="flex gap-1 items-center w-full justify-end">
              <template v-if="isEditingPrice && !isBidding && !isGift">
                <InputNumber
                  v-model="editPrice"
                  :step="10"
                  :min="0"
                  show-buttons
                  button-layout="horizontal"
                  increment-button-icon="pi pi-plus"
                  decrement-button-icon="pi pi-minus"
                  size="small"
                  class="flex-1 min-w-0 price-stepper"
                  :input-class="'!text-center !text-[14px] !min-h-0'"
                />
                <Button
                  icon="pi pi-check"
                  severity="success"
                  text
                  rounded
                  size="small"
                  class="!w-7 !h-7 !p-0"
                  @click="savePrice"
                />
              </template>
              <template v-else-if="isBidding">
                <span class="font-bold text-[14px] text-[var(--p-primary-color)] whitespace-nowrap">{{ t('live_order.label.bidding_active') }}</span>
              </template>
              <template v-else>
                <span class="font-bold text-[16px] text-[var(--p-primary-color)]">{{ priceDisplay }}</span>
              </template>
            </div>

          </div>
        </div>

        <!-- 統計列（點擊開啟得標人 Dialog） -->
        <button @click="winnerDialogVisible = true" class="bg-[var(--p-content-hover-background)] hover:bg-[var(--p-content-border-color)] rounded-[6px] px-1.5 py-1 flex items-center gap-2 w-full">
          <div class="flex-1 flex items-center gap-2 min-w-0">
            <div class="flex items-center gap-1 w-[100px] shrink-0">
              <div v-tooltip.top="t('live_order.label.stock_with_value', { value: stats.stock })" class="flex-1 flex items-center gap-1">
                <i class="pi pi-box text-[var(--p-text-muted-color)]" style="font-size:12px"></i>
                <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ stats.stock }}</span>
              </div>
              <div v-tooltip.top="t('live_order.label.sold_with_value', { value: stats.sold })" class="flex-1 flex items-center gap-1 justify-center">
                <i class="pi pi-shopping-bag text-[#f97316]" style="font-size:12px"></i>
                <span class="text-[12px] font-bold text-[#f97316]">{{ stats.sold }}</span>
              </div>
            </div>
            <div class="w-px self-stretch bg-[var(--p-content-border-color)]"></div>
            <div v-tooltip.top="t('live_order.label.subtotal_with_value', { value: stats.amount })" class="flex-1 flex items-center gap-1 min-w-0">
              <i class="pi pi-dollar text-[#f97316]" style="font-size:12px"></i>
              <span class="text-[12px] font-bold text-[#f97316] truncate">{{ stats.amount }}</span>
            </div>
          </div>
          <i class="pi pi-angle-right text-[var(--p-text-muted-color)]" style="font-size:14px"></i>
        </button>

        <!-- 規格區域：組合商品 → 顯示子商品內容；一般商品 → 規格 chips -->
        <div v-if="isBundle && bundleChildren.length" class="max-h-[104px] overflow-hidden">
          <div class="flex flex-col gap-1">
            <div
              v-for="(it, i) in displayBundleChildren"
              :key="i"
              class="flex items-center justify-between text-[13px] gap-2"
            >
              <span class="truncate text-[var(--p-text-color)]">{{ it.name }}</span>
              <span class="shrink-0 text-[var(--p-text-muted-color)] font-medium">× {{ it.qty }}</span>
            </div>
            <button
              v-if="moreBundleChildrenCount > 0"
              @mouseenter="onMoreEnter"
              @mouseleave="onMoreLeave"
              class="self-start text-[12.25px] font-medium text-[var(--p-primary-color)] hover:underline"
            >
              {{ t('live_order.label.more_specs', { count: moreBundleChildrenCount }) }}
            </button>
          </div>
        </div>
        <div v-else-if="displaySpecs.length" class="max-h-[104px] overflow-hidden">
          <div class="flex flex-wrap gap-1 content-start">
            <div v-for="spec in displaySpecs" :key="spec.label"
              v-tooltip.top="{
                value: t('live_order.label.spec_summary_with_price', { sold: spec.sold, stock: spec.stock, price: spec.price.toLocaleString() }),
                escape: false,
              }"
              class="border border-[var(--p-text-muted-color)] rounded-[6px] flex overflow-hidden text-[14px] font-bold text-[var(--p-text-color)] h-[26px] cursor-default">
              <span class="bg-[var(--p-content-hover-background)] border-r border-[var(--p-text-muted-color)] px-2 flex items-center justify-center leading-none">{{ spec.label }}</span>
              <span class="bg-[var(--p-content-background)] px-2 flex items-center justify-center min-w-[36px] leading-none">{{ spec.stock }}</span>
            </div>
            <!-- +N 更多：hover 開啟所有規格 popover -->
            <button v-if="moreSpecsCount > 0"
              @mouseenter="onMoreEnter"
              @mouseleave="onMoreLeave"
              class="border border-[var(--p-primary-300)] rounded-[6px] text-[12.25px] font-medium text-[var(--p-primary-color)] px-[9.75px] h-[26px] hover:bg-[var(--p-primary-50)]">
              {{ t('live_order.label.more_specs', { count: moreSpecsCount }) }}
            </button>
          </div>
        </div>
        <div v-else class="h-[104px]"></div>

        <!-- 所有規格 / 組合內容 Popover（teleport 到 body，不受卡片 overflow-hidden 影響） -->
        <Popover ref="morePopoverRef" :dismissable="false"
          @mouseenter="cancelHideMore" @mouseleave="onMoreLeave">
          <!-- 組合商品：列出全部子商品 -->
          <div v-if="isBundle" class="p-3 min-w-[260px] max-w-[320px]">
            <div class="text-[14px] font-medium text-[var(--p-text-color)] mb-2">組合內容（共 {{ bundleChildren.length }} 件）</div>
            <div class="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
              <div
                v-for="(it, i) in bundleChildren"
                :key="i"
                class="flex items-center justify-between text-[13px] gap-2"
              >
                <span class="truncate text-[var(--p-text-color)]">{{ it.name }}</span>
                <span class="shrink-0 text-[var(--p-text-muted-color)] font-medium">× {{ it.qty }}</span>
              </div>
            </div>
          </div>
          <!-- 一般商品：列出全部規格 chips -->
          <div v-else class="p-3 min-w-[280px] max-w-[320px]">
            <div class="text-[14px] font-medium text-[var(--p-text-color)] mb-2">{{ t('live_order.label.all_specs', { count: allSpecs.length }) }}</div>
            <div class="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
              <div v-for="spec in allSpecs" :key="spec.label"
                v-tooltip.top="{
                value: t('live_order.label.spec_summary_with_price', { sold: spec.sold, stock: spec.stock, price: spec.price.toLocaleString() }),
                escape: false,
              }"
                class="border border-[var(--p-text-muted-color)] rounded-[6px] flex overflow-hidden text-[14px] font-bold text-[var(--p-text-color)] h-[26px] cursor-default">
                <span class="bg-[var(--p-content-hover-background)] border-r border-[var(--p-text-muted-color)] px-2 flex-1 flex items-center justify-center leading-none">{{ spec.label }}</span>
                <span class="bg-[var(--p-content-background)] px-2 flex items-center justify-center min-w-[40px] leading-none">{{ spec.stock }}</span>
              </div>
            </div>
          </div>
        </Popover>
      </div>

      <!-- Footer：依狀態切換 -->
      <div class="flex gap-[7px] items-center">
        <div class="flex-1 flex gap-2">
          <!-- 得標清單（最左） -->
          <button
            @click="winnerDialogVisible = true"
            class="w-[35px] h-[30px] border border-[var(--p-content-border-color)] rounded-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
            v-tooltip.top="t('live_order.tooltip.winner_list')">
            <i class="pi pi-list text-[var(--p-text-color)]" style="font-size:14px"></i>
          </button>
          <!-- 設定：禮物→新增禮物彈窗；一般商品→直接開「得標設定」（隱藏編輯商品 tab） -->
          <button @click="openProductEdit"
            class="w-[35px] h-[30px] border border-[var(--p-content-border-color)] rounded-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
            v-tooltip.top="t('live_order.tab.order_setting')">
            <FontAwesomeIcon :icon="['far', 'gear']" class="text-[var(--p-text-color)] text-[14px]" />
          </button>
          <!-- 刪除：破壞性操作；只有準備中（非收單中）才顯示，避免誤刪正在收單的商品 -->
          <button
            v-if="status !== 'live'"
            @click="onDeleteClick"
            class="w-[35px] h-[30px] border border-[#ef4444] rounded-[6px] flex items-center justify-center hover:bg-[#fee2e2]" v-tooltip.top="t('live_order.tooltip.delete')">
            <i class="pi pi-trash text-[#ef4444]" style="font-size:14px"></i>
          </button>
        </div>

        <!-- 右側動作 -->
        <template v-if="status === 'live'">
          <!-- 紅色喇叭（推播，outlined） -->
          <button @click="onPushClick"
            class="w-[35px] h-[35px] rounded-full bg-[var(--p-content-background)] border border-[#ef4444] hover:bg-[#fee2e2] flex items-center justify-center"
            v-tooltip.top="t('live_order.tooltip.push')">
            <FontAwesomeIcon :icon="['far', 'bullhorn']" class="text-[#ef4444] text-[13px]" />
          </button>
          <!-- 紅色勾：禮物為「結束發送」開彙總彈窗；商品為「停止收單」直接回準備中、ticker 停止 -->
          <button @click="onStopOrEnd"
            class="w-[35px] h-[35px] rounded-full bg-[#ef4444] hover:bg-[#dc2626] flex items-center justify-center" v-tooltip.top="isGift ? t('live_order.tooltip.end_sending') : t('live_order.tooltip.stop_ordering')">
            <i class="pi pi-check text-white" style="font-size:14px"></i>
          </button>
        </template>
        <template v-else>
          <!-- 準備中：紫色播放（開始收單／禮物為開始發送，filled） -->
          <button @click="onStartOrdering"
            class="w-[35px] h-[35px] rounded-full bg-[var(--p-primary-color)] hover:bg-[var(--p-primary-hover-color)] flex items-center justify-center" v-tooltip.top="isGift ? t('live_order.tooltip.start_sending') : t((props.product.sold ?? 0) > 0 ? 'live_order.tooltip.resume_ordering' : 'live_order.tooltip.start_ordering')">
            <i class="pi pi-play text-white" style="font-size:14px"></i>
          </button>
        </template>
      </div>
    </div>

    <!-- 得標人 Dialog -->
    <WinnerListDialog v-model:visible="winnerDialogVisible" :product="product" />
    <!-- 商品設定 Dialog（portal-vue 版表單） -->
    <EditProductDialog
      v-model:visible="editProductDialogVisible"
      :product="product"
      initial-tab="order"
      order-only
      @save="onSettingSave"
    />
    <!-- 庫存問題提示 Dialog：開始收單前若有 stock=0 → 跳出選擇處理方式 -->
    <StockIssueDialog
      v-model:visible="stockIssueDialogVisible"
      @confirm="onStockIssueResolve"
    />
    <!-- 禮物編輯 Dialog：與「新增禮物」同一彈窗，帶入現有禮物資料 -->
    <GiftFormDialog v-model:visible="giftFormVisible" :product="product" @submit="onGiftEdit" />
    <!-- 規格價格編輯 Dialog（僅多規格商品開啟） -->
    <SpecPriceEditDialog
      v-model:visible="specPriceDialogVisible"
      :product-name="product.name"
      :specs="priceEditableSpecs"
      @apply="onSpecPriceApply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import WinnerListDialog from './WinnerListDialog.vue'
import EditProductDialog from './EditProductDialog.vue'
import GiftFormDialog, { type GiftSubmitPayload } from './GiftFormDialog.vue'
import StockIssueDialog, { type StockIssueChoice } from './StockIssueDialog.vue'
import SpecPriceEditDialog from './SpecPriceEditDialog.vue'
import { imageForProductName } from '../utils/productImage'
import { productCatalog } from '../utils/productCatalog'

interface ProductSpec {
  id?: number
  name?: string
  sku?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface LiveProduct {
  id: number
  name?: string
  keyword?: string
  sku?: string
  cost?: number
  price?: number
  stock?: number
  /** 累計已售；ticker 在 'live' + orderingEnabled 時遞增（cap 在 stock）。 */
  sold?: number
  weight?: number
  allowMixColor?: boolean
  pickSpecAfterWinning?: boolean
  /** 直播主送禮物來源（無價、是否扣庫存待規劃） */
  isGift?: boolean
  specs?: ProductSpec[]
  selectedSpecs?: ProductSpec[]
  [key: string]: unknown
}

interface DisplaySpec {
  /** Chip 左半顯示文字；依關鍵字規則組出來的下單關鍵字 */
  label: string
  /** 原規格名稱，保留給 tooltip 對照 */
  specName: string
  stock: number
  sold: number
  /** 規格售價；hover tooltip 用。沒設規格價時 fallback 商品本身 price。 */
  price: number
}

interface PopoverApi {
  show: (event: Event) => void
  hide: () => void
}

interface Props {
  product: LiveProduct
  /** 是否啟用收單模擬 ticker（有收單來源時為 true）。 */
  orderingEnabled?: boolean
  /** 貼文收單模式：不跑動態數字 ticker，按下開始收單直接賣完。 */
  isPostMode?: boolean
  /** 貼文/社團模式下該貼文的收單期間起點；按下「開始收單」時若 startAt 尚未到 → 跳提示問是否調整時間 */
  periodStartAt?: Date | null
  /** 整張卡片被鎖定（例如：其他競價商品在收單中時，此卡不可操作）。 */
  locked?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  orderingEnabled: false,
  isPostMode: false,
  locked: false,
  periodStartAt: null,
})
const isGift = computed(() => props.product?.isGift === true)
const emit = defineEmits<{
  delete: [id: number]
  'end-ordering': [id: number]
  /** 使用者選擇「調整時間」→ 父層開 PostPeriodDialog */
  'adjust-period': []
}>()
const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

/** 推播：原型階段直接彈成功 toast，不接後端。 */
function onPushClick(): void {
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.push_sent'),
    life: 2000,
  })
}

const winnerDialogVisible = ref(false)
/** 「編輯」按鈕（pencil）開啟的商品設定彈窗。 */
const editProductDialogVisible = ref(false)
const giftFormVisible = ref(false)
const specPriceDialogVisible = ref(false)

/**
 * 規格價編輯能讀寫的資料來源：優先 selectedSpecs（從 AddProductDialog 帶入），
 * 否則 specs（從 EditProductDialog 補的）。商品卡價格區間/編輯彈窗都統一走這個。
 */
const priceEditableSpecs = computed<ProductSpec[]>(() =>
  props.product.selectedSpecs?.length
    ? props.product.selectedSpecs
    : (props.product.specs ?? []),
)

const hasMultiSpec = computed(() => priceEditableSpecs.value.length > 0)

/** 點價格 pencil：多規格走 dialog；單品 / 無規格維持原本 inline 編輯。 */
function onPriceEditClick(): void {
  if (hasMultiSpec.value) specPriceDialogVisible.value = true
  else isEditingPrice.value = true
}

/** 套用規格價：依 spec id 對應更新規格的 price；同步把 product.price 設為最低價。 */
function onSpecPriceApply(priceMap: Record<number, number>): void {
  const specs = priceEditableSpecs.value
  if (!specs.length) return
  specs.forEach((s) => {
    if (typeof s.id === 'number' && priceMap[s.id] !== undefined) {
      s.price = priceMap[s.id]
    }
  })
  const prices = specs.map((s) => s.price ?? 0).filter((n) => n > 0)
  if (prices.length > 0) props.product.price = Math.min(...prices)
}

/** 「編輯」入口（pencil）：禮物商品開「新增禮物」彈窗，一般商品開商品設定（含得標設定欄位）彈窗。 */
function openProductEdit(): void {
  if (isGift.value) giftFormVisible.value = true
  else editProductDialogVisible.value = true
}

// ── 開始收單前的庫存檢查 ──────────────────────────
const stockIssueDialogVisible = ref(false)
/** 是否有庫存問題：商品本身 stock=0 或任一規格 stock=0。 */
function hasStockIssue(): boolean {
  const productStock = props.product.stock ?? 0
  if (productStock === 0) return true
  const specs = (props.product.selectedSpecs?.length ? props.product.selectedSpecs : props.product.specs) ?? []
  return specs.some(s => (s.stock ?? 0) === 0)
}
/** 點下開始收單：先檢查收單期間 → 庫存 → 直接 status=live */
function onStartOrdering(): void {
  // 收單期間還沒到 → 跳提示，讓使用者決定要去調整時間還是取消
  if (props.periodStartAt && props.periodStartAt.getTime() > Date.now()) {
    const d = props.periodStartAt
    const pad = (n: number): string => String(n).padStart(2, '0')
    const display = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    confirm.require({
      header: '收單期間還沒到',
      message: `此貼文設定的收單期間從 ${display} 開始，是否要調整時間？`,
      icon: 'pi pi-clock',
      acceptLabel: '調整時間',
      rejectLabel: '取消',
      accept: () => emit('adjust-period'),
    })
    return
  }
  if (hasStockIssue()) {
    stockIssueDialogVisible.value = true
    return
  }
  status.value = 'live'
}

/**
 * 商品卡的紅色勾：
 * - 禮物（isGift）→ emit end-ordering，由父層開「結束發送」彙總彈窗
 * - 一般商品 → 「停止收單」：status 回 ready；sold / 規格 sold 維持當下數字（不歸零、不開彙總）
 */
function onStopOrEnd(): void {
  if (isGift.value) {
    emit('end-ordering', props.product.id)
    return
  }
  status.value = 'ready'
}
/**
 * 庫存問題彈窗使用者選好處理方式：
 * - oversell → 把商品的 allowOversell 開啟，直接進入收單
 * - skip-zero → 關閉提示，維持 ready 狀態，使用者可自行透過「設定」調整再開始收單
 */
function onStockIssueResolve(choice: StockIssueChoice): void {
  if (choice === 'oversell') {
    ;(props.product as Record<string, unknown>).allowOversell = true
    status.value = 'live'
  }
  // skip-zero：什麼都不做，停在 ready
}

/** 禮物編輯送出：把禮物表單值併回現有商品（與新增禮物的欄位對映一致）。 */
function onGiftEdit(payload: GiftSubmitPayload): void {
  const p = props.product as Record<string, unknown>
  p.name = payload.name
  p.keyword = payload.keyword
  p.stock = payload.quantity
  p.note = payload.message
  if (payload.imageUrl !== undefined) p.imageUrl = payload.imageUrl
}

// 狀態：'ready'(準備中) | 'live'(收單中) | 'done'(已結束)
// 可由 v-model:status 控制；預設新增即為「準備中」
const status = defineModel<string>('status', { default: 'ready' })

/**
 * 直播收單區狀態 badge — 顏色 / icon 規範對齊 design-tokens.json `status-badge.直播收單區`：
 * - 準備中：bg var(--p-content-hover-background) / text var(--p-text-muted-color) / icon pi pi-history
 * - 收單中：bg #fee2e2 / text #dc2626 / 6px animate-pulse dot（不用 icon）
 * - 已結束：bg var(--p-content-hover-background) / text var(--p-text-muted-color) / 無 icon
 */
interface StatusMeta {
  label: string
  bg: string
  color: string
  icon?: string
}
const statusMeta = computed<StatusMeta>(() => {
  const map: Record<string, StatusMeta> = {
    ready: { label: t('live_order.label.ready'), bg: 'bg-[var(--p-content-hover-background)]', color: 'var(--p-text-muted-color)', icon: 'pi pi-history' },
    live:  { label: t('live_order.label.live'),  bg: 'bg-[#fee2e2]', color: '#dc2626' },
    done:  { label: t('live_order.label.done'),  bg: 'bg-[var(--p-content-hover-background)]', color: 'var(--p-text-muted-color)' },
  }
  return map[status.value ?? 'ready'] ?? map.ready
})

const displayName = computed(() => props.product.name || t('live_order.table.value.unnamed_product'))

/** 商品縮圖：禮物吃 product.imageUrl；一般商品依名稱關鍵字映射 Unsplash 圖。 */
const productImage = computed<string>(() => {
  const url = (props.product as Record<string, unknown>).imageUrl
  if (typeof url === 'string' && url) return url
  return imageForProductName(displayName.value)
})

// 關鍵字 — 與「設定商品」Dialog 的「關鍵字」欄位、商品管理「直播關鍵字」同源 product.keyword
const keyword = computed(() => props.product.keyword ?? '')
const shortCode = computed(() => keyword.value)

/** 競價模式：關鍵字與金額由競價決定，商品卡不可內嵌編輯這兩欄 */
const isBidding = computed(() => !!props.product.bidding)

const priceDisplay = computed(() => {
  const specs = priceEditableSpecs.value
  if (specs.length > 1) {
    const prices = specs.map(s => s.price ?? props.product.price ?? 0)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min !== max) return `$${min.toLocaleString()} ~ ${max.toLocaleString()}`
  }
  return `$${(props.product.price ?? 0).toLocaleString()}`
})

// Per-field 編輯狀態
const editingName  = ref(false)
const isEditingShort = ref(false)
const isEditingPrice = ref(false)

// 編輯緩衝值（進入編輯時帶入）
const editName  = ref('')
const editShort = ref('')
const editPrice = ref<number>(0)
watch(editingName,  v => { if (v) editName.value  = displayName.value })
watch(isEditingShort, v => { if (v) editShort.value = keyword.value })
watch(isEditingPrice, v => { if (v) editPrice.value = props.product.price ?? 0 })

// 名稱溢出偵測：超出 max-w 時才掛 tooltip 顯示完整名稱（未溢出 tooltip 值為空不顯示）
const nameRef = ref<HTMLElement | null>(null)
const nameTruncated = ref(false)
function checkNameTruncated(): void {
  const el = nameRef.value
  nameTruncated.value = !!el && el.scrollWidth > el.clientWidth
}
onMounted(() => { void nextTick(checkNameTruncated) })
watch([displayName, editingName], () => { void nextTick(checkNameTruncated) })

// 確認按鈕：寫回到 product.keyword（與設定 Dialog 的關鍵字欄位同源）
/** Persist the name edit buffer back onto the product. */
function saveName(): void {
  props.product.name = editName.value
  editingName.value = false
}

/** Persist the short-code edit buffer back onto the product. */
function saveShort(): void {
  props.product.keyword = editShort.value
  isEditingShort.value = false
}

/** Persist the price edit buffer back onto the product. */
function savePrice(): void {
  props.product.price = Number(editPrice.value) || 0
  isEditingPrice.value = false
}

/**
 * Merge selected fields from EditProductDialog back into product.
 *
 * EditProductDialog 同時包含商品屬性（名稱/規格/售價/庫存）與得標設定欄位，
 * 商品卡這顆「編輯」按鈕統一走它。
 */
function onSettingSave(data: Record<string, unknown> | null | undefined): void {
  if (!data) return
  const fields: Array<keyof LiveProduct> = [
    'name', 'keyword', 'sku', 'cost', 'price', 'stock', 'weight',
    'allowMixColor', 'pickSpecAfterWinning',
  ]
  fields.forEach((k) => {
    if (data[k as string] !== undefined) {
      ;(props.product as Record<string, unknown>)[k as string] = data[k as string]
    }
  })

  const flatSpecs = buildFlatSpecsFromData(data)
  if (flatSpecs !== undefined) {
    ;(props.product as Record<string, unknown>).specs = flatSpecs
    ;(props.product as Record<string, unknown>).selectedSpecs = []
  }

  // 得標設定：併回 product 保存，下次開啟可預填
  if (data.orderSetting && typeof data.orderSetting === 'object') {
    Object.assign(props.product as Record<string, unknown>, data.orderSetting)
  }
}

/**
 * 從表單回傳的資料抽出扁平 specs 給商品卡用。
 *
 * - portal 形狀：以 variants 為主，combo 名稱由 specs[i].children 對應索引組成
 * - 扁平形狀：直接回傳（舊 ProductSettingForm 流程）
 * - 完全無 specs / variants：回 undefined，呼叫端略過（不誤清原資料）
 */
function buildFlatSpecsFromData(data: Record<string, unknown>): ProductSpec[] | undefined {
  const variants = data.variants as
    | Array<{ specIndex: number[]; stock?: number; salePrice?: number }>
    | undefined
  const portalSpecs = data.specs as
    | Array<{ name?: string; children?: Array<{ name?: string }> }>
    | undefined

  // Portal-vue 形狀：specs 內每個 group 有 children
  const isPortalShape = Array.isArray(portalSpecs)
    && portalSpecs.length > 0
    && portalSpecs.every((s) => Array.isArray(s?.children))

  if (isPortalShape && Array.isArray(variants) && variants.length > 0) {
    return variants.map((v, idx) => {
      const parts = (v.specIndex ?? []).map((childIdx, dim) => {
        return portalSpecs![dim]?.children?.[childIdx]?.name ?? ''
      })
      return {
        id: idx,
        name: parts.filter(Boolean).join(' / '),
        stock: v.stock ?? 0,
        sold: 0,
        price: v.salePrice ?? 0,
      }
    })
  }

  // 已經是扁平 [{id, name, stock, ...}] 形狀
  if (Array.isArray(portalSpecs) && portalSpecs.length > 0 && !isPortalShape) {
    return portalSpecs as unknown as ProductSpec[]
  }

  // portal 形狀但 variants 為空（使用者沒設規格） → 回空陣列清掉舊 specs
  if (Array.isArray(portalSpecs) && portalSpecs.length === 0) return []

  return undefined
}

const stats = computed(() => {
  const stock = props.product.stock ?? 0
  const sold  = props.product.sold  ?? 0
  const price = props.product.price ?? 0
  return {
    stock,
    sold,
    amount: formatK(price * sold),
  }
})

/** Format a number using a "k" suffix once it crosses 10,000. */
function formatK(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k'
  return n.toLocaleString()
}

// ── 收單模擬 ticker ───────────────────────────────
// 'live' + orderingEnabled 時，依隨機 800~1800ms 把 product.sold +1（cap 在 stock）。
// 狀態變 'ready' / 'done' 或失去收單來源 → 自動停。賣完也停。
let saleTimer: ReturnType<typeof setTimeout> | null = null

function shouldTick(): boolean {
  if (!props.orderingEnabled) return false
  if (status.value !== 'live') return false
  // 結束收單彙總彈窗開啟期間，product.frozen=true → ticker 暫停，數字凍結在那一刻
  if ((props.product as Record<string, unknown>).frozen) return false
  const stock = props.product.stock ?? 0
  const sold  = props.product.sold  ?? 0
  return sold < stock
}

function scheduleNextTick(): void {
  stopTicker()
  if (!shouldTick()) return
  const delay = 800 + Math.random() * 1000
  saleTimer = setTimeout(() => {
    const stock = props.product.stock ?? 0
    const sold  = props.product.sold  ?? 0
    if (sold < stock) {
      ;(props.product as Record<string, unknown>).sold = sold + 1
      // 同步把一個還有庫存的規格的 sold +1，讓結束收單彙總的規格欄也有數字
      const specs = (props.product.selectedSpecs?.length
        ? props.product.selectedSpecs
        : props.product.specs) ?? []
      const available = specs.filter(s => (s.sold ?? 0) < (s.stock ?? 0))
      if (available.length > 0) {
        const pick = available[Math.floor(Math.random() * available.length)]
        pick.sold = (pick.sold ?? 0) + 1
      }
    }
    scheduleNextTick()
  }, delay)
}

function stopTicker(): void {
  if (saleTimer) { clearTimeout(saleTimer); saleTimer = null }
}

/**
 * 貼文收單模式：按下開始收單 → 不跑 ticker，直接把商品本體與每個規格的 sold
 * 設成 stock（賣完）；已售/小計/規格庫存數字一次到位。
 */
function settlePostModeSoldOut(): void {
  const stock = props.product.stock ?? 0
  ;(props.product as Record<string, unknown>).sold = stock
  const specs = (props.product.selectedSpecs?.length
    ? props.product.selectedSpecs
    : props.product.specs) ?? []
  specs.forEach((s) => {
    s.sold = s.stock ?? 0
  })
}

watch(
  [() => status.value, () => props.orderingEnabled, () => (props.product as Record<string, unknown>).frozen],
  () => {
    if (props.isPostMode) {
      stopTicker()
      if (status.value === 'live' && props.orderingEnabled) settlePostModeSoldOut()
      return
    }
    if (shouldTick()) scheduleNextTick()
    else stopTicker()
  },
  { immediate: true },
)

onUnmounted(stopTicker)

// 卡片內最多顯示 3 顆 chip + 1 個「+N 更多」按鈕。
// 由於 chip 標籤已含關鍵字（例：「A原味+1」），單顆 chip 寬度約 90~110px，
// 240px 卡寬內每列 2 顆，3 顆 + 更多按鈕約 2 列高度（≈ 56px），
// 確保 max-h-[104px] 內完整呈現不會被裁切。超過 3 顆走 popover 顯示全部。
const MAX_SPECS = 3
const sourceSpecs = computed<ProductSpec[]>(() => {
  const picked = props.product.selectedSpecs || []
  if (picked.length > 0) return picked
  return props.product.specs || []
})
/**
 * 商品卡下方 chip 顯示規則：
 * - 沒設定規格 → 不顯示任何 chip
 * - 有設定規格 → 每個規格一個 chip，左半顯示規格名（例：「紅色」），右半顯示庫存
 *
 * 註：下單關鍵字（例：紅色1、A紅色+1、A包+1）只用於後端比對留言，不在這裡的 chip 上顯示。
 */
const allSpecs = computed<DisplaySpec[]>(() => {
  const specs = sourceSpecs.value
  if (specs.length === 0) return []

  const fallbackPrice = props.product.price ?? 0
  return specs.map((s) => {
    const name = s.name || s.sku || ''
    return {
      label: name,
      specName: name,
      stock: s.stock ?? 0,
      sold: s.sold ?? Math.max(0, Math.floor((s.stock ?? 0) * 0.4)),
      price: s.price ?? fallbackPrice,
    }
  })
})
const displaySpecs = computed(() => allSpecs.value.slice(0, MAX_SPECS))
const moreSpecsCount = computed(() => Math.max(0, allSpecs.value.length - MAX_SPECS))

// ── 組合商品：把 spec 區域改顯示「組合商品內容」（子商品清單） ─────
const isBundle = computed(() => Boolean((props.product as Record<string, unknown>).isBundle))

interface BundleChildView {
  name: string
  qty: number
}
const bundleChildren = computed<BundleChildView[]>(() => {
  const raw = (props.product as Record<string, unknown>).bundleItems
  if (!Array.isArray(raw)) return []
  return (raw as Array<{ catalogProductId: number; qty: number }>).map((it) => {
    const child = productCatalog.find((p) => p.id === it.catalogProductId)
    return {
      name: child?.name ?? `商品 #${it.catalogProductId}`,
      qty: it.qty,
    }
  })
})
const displayBundleChildren = computed(() => bundleChildren.value.slice(0, MAX_SPECS))
const moreBundleChildrenCount = computed(() => Math.max(0, bundleChildren.value.length - MAX_SPECS))

/** Confirm-then-emit delete; parent removes the card from its session products. */
function onDeleteClick(event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: t('live_order.dialog.confirm_delete_product_header'),
    message: t('live_order.dialog.confirm_delete_product_message', { name: displayName.value }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('live_order.dialog.remove'),
    rejectLabel: t('live_order.button.cancel'),
    acceptClass: 'p-button-danger',
    accept: () => emit('delete', props.product.id),
  })
}

// ── 「更多」hover popover ───────────────────────
const morePopoverRef = ref<PopoverApi | null>(null)
let hideMoreTimer: ReturnType<typeof setTimeout> | null = null
function onMoreEnter(e: Event): void {
  if (hideMoreTimer) { clearTimeout(hideMoreTimer); hideMoreTimer = null }
  morePopoverRef.value?.show(e)
}
function cancelHideMore(): void {
  if (hideMoreTimer) { clearTimeout(hideMoreTimer); hideMoreTimer = null }
}
function onMoreLeave(): void {
  hideMoreTimer = setTimeout(() => morePopoverRef.value?.hide(), 120)
}
</script>
