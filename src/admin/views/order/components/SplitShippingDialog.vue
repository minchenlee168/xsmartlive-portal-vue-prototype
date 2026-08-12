<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useShippingBatches, type OrderBatch, type BatchCarrier } from '../composables/useShippingBatches'
import ShippingConfigDialog from './ShippingConfigDialog.vue'

/**
 * 分批出貨作業 Dialog。
 *
 * 工作流：
 * - 主原始訂單視圖：顯示每項商品的剩餘可分配數量 + stepper 決定下一批要放多少
 *   → 按「建立新批次」把 stepper 數量搬到新批次
 * - 批次視圖（第 N 批）：顯示批次明細（狀態卡 + 商品表 + 小計 + 出貨單備註），可切換狀態 / 配送設定 / 刪除此批
 *
 * 遵照 Design.md：
 * - 狀態 / 待分配 chip 用 <Tag :severity>
 * - 商品表用 <DataTable>
 * - 出貨進度用 <Timeline>
 * - 圓角走 rounded-md / rounded-lg（Aura token）
 * - 警告色用 Design.md 定義的 #CA8A04
 */

interface OrderLite {
  orderNo: string
  buyerName: string
  amount: number
  itemCount: number
  cartTag: { label: string; bg: string; color: string }
  /** 付款方式顯示文字；'貨到付款' 時才顯示 COD 運費代收設定區 */
  paymentMethodLabel?: string
  /** 分批數量（儲存時回寫，讓訂單列表「已分批 N 批」tag 同步） */
  dispatchBatchCount?: number
}
interface Props {
  visible: boolean
  order: OrderLite
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

interface ProductLine {
  id: number
  name: string
  spec: string
  unitPrice: number
  ordered: number
}
const products = ref<ProductLine[]>([])

type BatchStatus = 'pending' | 'preparing' | 'shipping' | 'arrived' | 'completed'
interface Batch {
  name: string
  items: Array<{ productId: number; qty: number }>
  status: BatchStatus
  note: string
  /** 明細層級設定的配送物流；在此彈窗不編輯，僅隨批次保留、儲存時回寫 */
  carrier?: BatchCarrier
}
const batches = ref<Batch[]>([])
/** -1 = 主原始訂單；≥0 = 對應 batches 索引 */
const currentBatchIdx = ref<number>(-1)
/** 主原始訂單視圖 stepper 值：productId → qty（下一次建立新批次時使用） */
const pendingAllocation = ref<Record<number, number>>({})

const { setBatches, getBatches } = useShippingBatches()

watch(() => [props.visible, props.order], () => {
  if (!props.visible) return
  const unitPrice = Math.round(props.order.amount / Math.max(1, props.order.itemCount) - 120 / Math.max(1, props.order.itemCount))
  products.value = [{
    id: 1,
    name: props.order.cartTag.label === '服飾專區' ? '韓版寬鬆連帽外套（米白）' : '示意商品',
    spec: props.order.cartTag.label === '服飾專區' ? '尺寸 M / 米白色內裡' : '預設規格',
    unitPrice,
    ordered: props.order.itemCount,
  }]
  // 已分批：從共享狀態還原批次，讓「管理分批出貨」開啟時看到已建好的批次；否則從空白開始
  const stored = getBatches(props.order.orderNo)
  batches.value = stored.map((b, i) => ({
    name: `第 ${i + 1} 批`,
    items: b.items.map(it => ({ productId: 1, qty: it.qty })),
    status: b.status,
    note: b.note,
    carrier: b.carrier,
  }))
  currentBatchIdx.value = -1
  pendingAllocation.value = {}
  products.value.forEach(p => { pendingAllocation.value[p.id] = 0 })
}, { immediate: true })

/** 已分配到 batches 的總數量（單一商品） */
function allocatedTotal(productId: number): number {
  return batches.value.reduce((s, b) => {
    const it = b.items.find(i => i.productId === productId)
    return s + (it?.qty ?? 0)
  }, 0)
}
/** 剩餘可分配 = 訂購 - 已在 batches 內的 */
function remainingOf(p: ProductLine): number {
  return Math.max(0, p.ordered - allocatedTotal(p.id))
}

const originalPending = computed<number>(() => products.value.reduce((s, p) => s + remainingOf(p), 0))
const originalTotal = computed<number>(() => products.value.reduce((s, p) => s + p.unitPrice * p.ordered, 0))
const unallocatedCount = computed<number>(() => originalPending.value)

function allocateAll(): void {
  products.value.forEach((p) => {
    pendingAllocation.value[p.id] = remainingOf(p)
  })
}

function createNewBatch(): void {
  const items = products.value
    .map(p => ({ productId: p.id, qty: pendingAllocation.value[p.id] ?? 0 }))
    .filter(it => it.qty > 0)
  if (items.length === 0) return
  batches.value.push({
    name: `第 ${batches.value.length + 1} 批`,
    items,
    status: 'pending',
    note: '',
  })
  products.value.forEach(p => { pendingAllocation.value[p.id] = 0 })
  // 建立後留在主原始訂單，方便接著把剩餘商品繼續拆到下一批
  currentBatchIdx.value = -1
}

function deleteBatch(idx: number): void {
  batches.value.splice(idx, 1)
  batches.value.forEach((b, i) => { b.name = `第 ${i + 1} 批` })
  currentBatchIdx.value = -1
}

const currentBatch = computed<Batch | null>(() =>
  currentBatchIdx.value >= 0 ? batches.value[currentBatchIdx.value] ?? null : null,
)

// ── COD（貨到付款）運費批次代收：指定全單運費由哪一批向買家代收，避免漏收/重複收 ──
const SHIPPING_FEE = 120
const isCod = computed(() => props.order.paymentMethodLabel === '貨到付款')
/** 僅「貨到付款 + 全單運費 > 0 + 已有批次」才顯示設定區 */
const showFreightSetting = computed(() => isCod.value && SHIPPING_FEE > 0 && batches.value.length > 0)
/** 代收運費的批次索引；-1 = 不指定（運費由商家吸收）。用 -1 而非 null：PrimeVue RadioButton 不支援 null value。預設首批 */
const FREIGHT_NONE = -1
const freightBatchIdx = ref<number>(0)
/** 批次刪減後校正：指定的批次若已不存在，回退到首批（無批次則不指定） */
watch(() => batches.value.length, (len) => {
  if (freightBatchIdx.value !== FREIGHT_NONE && freightBatchIdx.value >= len) {
    freightBatchIdx.value = len > 0 ? 0 : FREIGHT_NONE
  }
})
/** 目前檢視的批次是否為代收運費批次 */
const currentIsFreightBatch = computed(() => isCod.value && currentBatchIdx.value >= 0 && currentBatchIdx.value === freightBatchIdx.value)

/** 目前批次「設定配送 / 修改」：委派共用 ShippingConfigDialog，confirm 後寫回該批 carrier */
const configDialogVisible = ref(false)
const configOrder = computed(() => {
  const b = currentBatch.value
  return {
    orderNo: props.order.orderNo,
    buyerName: props.order.buyerName,
    carrierStatus: (b?.carrier ? 'configured' : 'unconfigured') as 'configured' | 'unconfigured',
    carrierName: b?.carrier?.name,
    trackingStatus: b?.carrier?.tracking ?? null,
  }
})
function onConfigConfirm(payload: { carrierName: string; method: string; trackingNo: string | null }): void {
  const b = currentBatch.value
  if (b) b.carrier = { name: payload.carrierName, tracking: payload.trackingNo, method: payload.method }
}

/** 點 Timeline 圓點 → 二次確認後切換此批次的出貨狀態 */
const confirm = useConfirm()
function setBatchStatus(status: BatchStatus): void {
  const b = currentBatch.value
  if (!b || b.status === status) return
  const from = statusMeta(b.status).label
  const to = statusMeta(status).label
  confirm.require({
    header: '切換批次貨態',
    message: `確定要將此批貨態由「${from}」切換為「${to}」嗎？`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '確定切換',
    rejectLabel: '取消',
    defaultFocus: 'reject',
    accept: () => { b.status = status },
  })
}

/** 「切換狀態」按鈕：推進到下一階段（沿用 setBatchStatus 的確認流程）；已完成則無下一階段 */
const BATCH_STATUS_FLOW: BatchStatus[] = ['pending', 'preparing', 'shipping', 'arrived', 'completed']
const nextBatchStatus = computed<BatchStatus | null>(() => {
  const s = currentBatch.value?.status
  if (!s) return null
  const i = BATCH_STATUS_FLOW.indexOf(s)
  return i >= 0 && i < BATCH_STATUS_FLOW.length - 1 ? BATCH_STATUS_FLOW[i + 1] : null
})
function advanceBatchStatus(): void {
  if (nextBatchStatus.value) setBatchStatus(nextBatchStatus.value)
}

function batchTotal(b: Batch): number {
  return b.items.reduce((s, it) => {
    const p = products.value.find(pr => pr.id === it.productId)
    return s + (p?.unitPrice ?? 0) * it.qty
  }, 0)
}
const currentBatchTotal = computed(() => currentBatch.value ? batchTotal(currentBatch.value) : 0)

/** 5 階段進度（Timeline items） */
interface StepItem { key: BatchStatus; label: string; icon: string; isCurrent: boolean; isPast: boolean }
const currentBatchSteps = computed<StepItem[]>(() => {
  const flow: Array<{ key: BatchStatus; label: string; icon: string }> = [
    { key: 'pending',   label: '待出貨', icon: 'pi pi-clock' },
    { key: 'preparing', label: '備貨中', icon: 'pi pi-box' },
    { key: 'shipping',  label: '已出貨', icon: 'pi pi-truck' },
    { key: 'arrived',   label: '已送達', icon: 'pi pi-map-marker' },
    { key: 'completed', label: '已完成', icon: 'pi pi-check-circle' },
  ]
  const currentIdx = currentBatch.value
    ? flow.findIndex(s => s.key === currentBatch.value!.status)
    : -1
  return flow.map((s, i) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    isCurrent: i === currentIdx,
    isPast: i < currentIdx,
  }))
})

/** 批次狀態 → Tag severity（走 Design.md 語意色）；textClass 為深色成對的語意文字色 */
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
function statusMeta(s: BatchStatus): { label: string; severity: TagSeverity; icon: string; textClass: string } {
  const map: Record<BatchStatus, { label: string; severity: TagSeverity; icon: string; textClass: string }> = {
    pending:   { label: '待出貨',   severity: 'warn',      icon: 'pi pi-truck',        textClass: 'text-yellow-600 dark:text-yellow-400' },
    preparing: { label: '備貨中',   severity: 'info',      icon: 'pi pi-box',          textClass: 'text-blue-600 dark:text-blue-400' },
    shipping:  { label: '已出貨',   severity: 'warn',      icon: 'pi pi-truck',        textClass: 'text-yellow-600 dark:text-yellow-400' },
    arrived:   { label: '已送達',   severity: 'success',   icon: 'pi pi-map-marker',   textClass: 'text-green-600 dark:text-green-400' },
    completed: { label: '已完成',   severity: 'secondary', icon: 'pi pi-check-circle', textClass: 'text-surface-700 dark:text-surface-100' },
  }
  return map[s]
}

/** 已分配商品 table rows（含商品 metadata） */
const currentBatchTableRows = computed(() => {
  if (!currentBatch.value) return []
  return currentBatch.value.items.map((it) => {
    const p = products.value.find(pr => pr.id === it.productId)!
    return {
      productId: p.id,
      name: p.name,
      spec: p.spec,
      unitPrice: p.unitPrice,
      qty: it.qty,
      subtotal: p.unitPrice * it.qty,
    }
  })
})

function saveAndClose(): void {
  // 把彈窗內批次寫入共享狀態，供訂單明細「出貨管理」渲染分批版（保留各批已設定的物流）
  const stored: OrderBatch[] = batches.value.map(b => ({
    status: b.status,
    note: b.note,
    carrier: b.carrier,
    items: b.items.map((it) => {
      const p = products.value.find(pr => pr.id === it.productId)
      return { name: p?.name ?? '商品', spec: p?.spec, qty: it.qty, unitPrice: p?.unitPrice ?? 0 }
    }),
  }))
  setBatches(props.order.orderNo, stored)
  props.order.dispatchBatchCount = stored.length
  emit('update:visible', false)
}
function cancel(): void { emit('update:visible', false) }
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(1200px, calc(100vw - 32px))' }"
    :pt="{ content: { style: 'padding: 0' } }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-bold text-[var(--p-text-color)]">分批出貨作業</span>
        <span class="text-xs text-[var(--p-text-muted-color)]">
          訂單 {{ order.orderNo }}
          <span class="mx-1">·</span> 客戶 {{ order.buyerName }}
          <span class="mx-1">·</span> 共 {{ order.itemCount }} 件商品
          <span class="mx-1">·</span> 訂單總計 <span class="font-bold text-[var(--p-text-color)]">${{ order.amount.toLocaleString() }}</span>
        </span>
      </div>
    </template>

    <!-- 灰底區塊：COD 運費設定區 + 分批兩欄同置一容器 -->
    <div class="p-4 bg-[var(--p-content-hover-background)] flex flex-col gap-4">
    <!-- COD 運費代收設定區：僅貨到付款且已建批次時顯示（指定全單運費由哪一批向買家代收） -->
    <div
      v-if="showFreightSetting"
      class="rounded-lg border border-[var(--p-primary-color)] bg-[var(--p-primary-50)] p-4 flex flex-col gap-3"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="inline-flex items-center gap-2 text-sm font-bold text-[var(--p-text-color)]">
          <i class="pi pi-truck text-[var(--p-primary-color)]"></i>
          設定 — 指定運費由哪一批向買家代收
        </span>
        <span class="text-xs font-medium text-[var(--p-text-color)]">貨到付款 · 全單運費 NT$ {{ SHIPPING_FEE }}</span>
      </div>

      <!-- 未分配完提醒 -->
      <div
        v-if="unallocatedCount > 0"
        class="inline-flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
      >
        <i class="pi pi-info-circle"></i>
        還有 <span class="font-bold">{{ unallocatedCount }}</span> 件商品未分配至任何批次，請完成分批後再確認運費負擔批次。
      </div>

      <!-- radio：各批次 + 不指定（外層用 div + @click 直接設值，避免包 label 造成 RadioButton 雙重 toggle 抵消） -->
      <div class="flex items-center gap-2 flex-wrap">
        <div
          v-for="(b, i) in batches"
          :key="i"
          class="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors"
          :class="freightBatchIdx === i
            ? 'border-[var(--p-primary-color)] bg-[var(--p-content-background)]'
            : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)] hover:border-[var(--p-primary-300)]'"
          @click="freightBatchIdx = i"
        >
          <RadioButton v-model="freightBatchIdx" :value="i" :input-id="`freight-${i}`" />
          <span class="text-sm font-medium text-[var(--p-text-color)]">{{ b.name }}</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">{{ statusMeta(b.status).label }}</span>
        </div>
        <div
          class="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors"
          :class="freightBatchIdx === FREIGHT_NONE
            ? 'border-[var(--p-primary-color)] bg-[var(--p-content-background)]'
            : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)] hover:border-[var(--p-primary-300)]'"
          @click="freightBatchIdx = FREIGHT_NONE"
        >
          <RadioButton v-model="freightBatchIdx" :value="FREIGHT_NONE" input-id="freight-none" />
          <span class="text-sm font-medium text-[var(--p-text-color)]">不指定</span>
        </div>
      </div>

      <!-- 不指定 → 運費由商家吸收提醒 -->
      <span v-if="freightBatchIdx === FREIGHT_NONE" class="text-xs text-yellow-700 dark:text-yellow-400">
        提醒：未指定批次代收運費，買家僅支付商品金額，運費將由商家自行吸收。
      </span>
    </div>

    <div class="flex gap-4">
      <!-- 左：分批結構 -->
      <div class="w-[240px] shrink-0 flex flex-col gap-2">
        <span class="text-sm font-medium text-[var(--p-text-muted-color)] px-1">分批結構</span>
        <button
          type="button"
          class="text-left rounded-md border p-3 flex flex-col gap-2 transition-colors"
          :class="currentBatchIdx === -1
            ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]'
            : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)] hover:border-[var(--p-primary-300)]'"
          @click="currentBatchIdx = -1"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-2 text-sm font-medium text-[var(--p-text-color)]">
              <i class="pi pi-box text-sm"></i>
              主原始訂單
            </span>
            <Tag
              v-if="originalPending > 0"
              :value="`待分配 ${originalPending}`"
              severity="danger"
            />
          </div>
          <span class="text-xs text-[var(--p-text-muted-color)]">
            {{ products.length }} 件商品 · 原始總額 ${{ originalTotal.toLocaleString() }}
          </span>
        </button>
        <button
          v-for="(b, i) in batches"
          :key="i"
          type="button"
          class="text-left rounded-md border p-3 flex flex-col gap-2 transition-colors"
          :class="currentBatchIdx === i
            ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]'
            : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)] hover:border-[var(--p-primary-300)]'"
          @click="currentBatchIdx = i"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-2 text-sm font-medium text-[var(--p-text-color)]">
              <i class="pi pi-inbox text-sm"></i>
              {{ b.name }}
            </span>
            <Tag
              :value="`${statusMeta(b.status).label} ${b.items.reduce((s, it) => s + it.qty, 0)} 件`"
              :severity="statusMeta(b.status).severity"
            />
          </div>
        </button>
      </div>

      <!-- 右：主原始訂單 or 批次詳情 -->
      <div class="flex-1 min-w-0 rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
        <!-- ── 主原始訂單視圖 ── -->
        <template v-if="currentBatchIdx === -1">
          <div class="flex items-center gap-2">
            <i class="pi pi-box text-[var(--p-primary-color)]"></i>
            <span class="text-base font-bold text-[var(--p-text-color)]">主原始訂單</span>
            <Tag
              v-if="originalPending > 0"
              :value="`待分配 ${originalPending} 件`"
              severity="danger"
            />
          </div>
          <p class="text-sm text-[var(--p-text-muted-color)]">
            設定每項商品的分配數量，建立新批次或一鍵全部待出。
          </p>

          <div class="flex flex-col divide-y divide-[var(--p-content-border-color)]">
            <div
              v-for="p in products"
              :key="p.id"
              class="py-3 flex items-center gap-3"
            >
              <!-- 未分配完 → 紅點；已全部分配 → 綠點 -->
              <span
                class="size-2 rounded-full shrink-0"
                :class="remainingOf(p) > 0 ? 'bg-red-500 dark:bg-red-400' : 'bg-green-500 dark:bg-green-400'"
              ></span>
              <div class="flex-1 min-w-0 flex flex-col gap-1">
                <span class="text-sm font-medium text-[var(--p-text-color)]">{{ p.name }}</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">
                  規格：{{ p.spec }}
                  <span class="mx-1">·</span> 單價：${{ p.unitPrice.toLocaleString() }}
                  <span class="mx-1">·</span> 訂購 {{ p.ordered }} 件
                </span>
              </div>
              <span class="text-xs text-[var(--p-text-muted-color)] shrink-0">剩餘可分配 {{ remainingOf(p) }} 件</span>
              <InputNumber
                v-model="pendingAllocation[p.id]"
                show-buttons
                :min="0"
                :max="remainingOf(p)"
                button-layout="horizontal"
                increment-button-icon="pi pi-plus"
                decrement-button-icon="pi pi-minus"
                size="small"
                input-class="!w-[50px] text-center"
              />
            </div>
            <div v-if="products.length === 0" class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">
              沒有商品
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 pt-2 border-t border-[var(--p-content-border-color)]">
            <span class="text-sm text-[var(--p-text-muted-color)]">
              原始總額 <span class="text-[var(--p-text-color)] font-bold">${{ originalTotal.toLocaleString() }}</span>
              <span class="mx-2">·</span>
              預計分配 <span class="text-[var(--p-text-color)] font-bold">{{ Object.values(pendingAllocation).reduce((s, v) => s + v, 0) }}</span> 件
            </span>
            <div class="flex items-center gap-2">
              <Button
                label="全部待出"
                icon="pi pi-arrow-up-right"
                severity="secondary"
                variant="outlined"
                size="small"
                :disabled="originalPending === 0"
                @click="allocateAll"
              />
              <Button
                label="建立新批次"
                icon="pi pi-plus"
                size="small"
                :disabled="Object.values(pendingAllocation).every(v => v === 0)"
                @click="createNewBatch"
              />
            </div>
          </div>
        </template>

        <!-- ── 批次詳情視圖 ── -->
        <template v-else-if="currentBatch">
          <!-- Header：第 N 批 明細 + 刪除此批 -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col gap-1">
              <span class="text-base font-bold text-[var(--p-text-color)]">{{ currentBatch.name }} 明細</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">此批次已拆分商品細節與物流發貨階段控制。</span>
            </div>
            <Button
              label="刪除此批"
              icon="pi pi-trash"
              severity="danger"
              variant="outlined"
              size="small"
              @click="deleteBatch(currentBatchIdx)"
            />
          </div>

          <!-- 狀態卡：狀態文字 + 切換狀態 / 配送設定 + Timeline -->
          <div class="rounded-md border border-[var(--p-content-border-color)] p-4 flex flex-col gap-4">
            <!-- 物流資訊（左） + 切換狀態 / 配送設定（右）；貨態改由下方 Timeline 呈現 -->
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span v-if="currentBatch.carrier" class="inline-flex items-center gap-1 text-sm text-[var(--p-text-color)] min-w-0">
                <i class="pi pi-truck text-[var(--p-primary-color)] text-sm"></i>
                <span class="font-medium">{{ currentBatch.carrier.name }}</span>
                <template v-if="currentBatch.carrier.tracking"><span class="text-[var(--p-text-muted-color)]">·</span> 取號 {{ currentBatch.carrier.tracking }}</template>
                <span class="text-[var(--p-text-muted-color)]">·</span> {{ currentBatch.carrier.method }}
              </span>
              <span v-else class="inline-flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400 min-w-0">
                <i class="pi pi-exclamation-circle text-sm"></i>
                尚未指派物流商
              </span>
              <div class="flex items-center gap-2 shrink-0">
                <Button
                  label="切換狀態" icon="pi pi-sync" severity="secondary" variant="outlined" size="small"
                  :disabled="!nextBatchStatus" @click="advanceBatchStatus"
                />
                <Button
                  label="配送設定" icon="pi pi-cog" severity="secondary" size="small"
                  @click="configDialogVisible = true"
                />
              </div>
            </div>

            <!-- 5 階段 Timeline（PrimeVue horizontal）— 點圓點 / 標籤即切換此批狀態 -->
            <Timeline :value="currentBatchSteps" layout="horizontal" align="top" class="w-full">
              <template #marker="{ item }">
                <button
                  type="button"
                  class="rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-110"
                  :style="{
                    width: item.isCurrent ? '32px' : '24px',
                    height: item.isCurrent ? '32px' : '24px',
                    background: item.isPast || item.isCurrent ? 'var(--p-primary-color)' : 'var(--p-content-hover-background)',
                    color: item.isPast || item.isCurrent ? '#fff' : 'var(--p-text-muted-color)',
                    border: item.isPast || item.isCurrent ? 'none' : '1px solid var(--p-content-border-color)',
                  }"
                  :aria-label="`切換至${item.label}`"
                  @click="setBatchStatus(item.key)"
                >
                  <i :class="item.icon" class="text-xs"></i>
                </button>
              </template>
              <template #content="{ item }">
                <button
                  type="button"
                  class="flex flex-col items-center gap-1 pt-1 whitespace-nowrap cursor-pointer bg-transparent border-0 w-full"
                  :aria-label="`切換至${item.label}`"
                  @click="setBatchStatus(item.key)"
                >
                  <span
                    class="text-xs"
                    :style="item.isCurrent
                      ? 'color: var(--p-primary-color); font-weight: 600'
                      : 'color: var(--p-text-muted-color)'"
                  >{{ item.label }}</span>
                  <span class="text-xs text-[var(--p-text-muted-color)]">—</span>
                </button>
              </template>
              <template #connector>
                <span class="block h-px w-full" style="background: var(--p-content-border-color)"></span>
              </template>
            </Timeline>
          </div>

          <!-- 已分配商品：DataTable + 小計 / 總額 footer row -->
          <div class="flex flex-col gap-2">
            <span class="text-sm text-[var(--p-text-color)]">已分配商品</span>
            <DataTable
              :value="currentBatchTableRows"
              data-key="productId"
              class="w-full"
              :pt="{ column: { headerCell: { style: 'white-space: nowrap;' } } }"
            >
              <Column header="商品名稱 / 規格">
                <template #body="{ data }">
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-[var(--p-text-color)]">{{ data.name }}</span>
                    <span class="text-xs text-[var(--p-text-muted-color)]">{{ data.spec }}</span>
                  </div>
                </template>
              </Column>
              <Column header="單價" body-class="text-right" header-class="text-right">
                <template #body="{ data }">${{ data.unitPrice.toLocaleString() }}</template>
              </Column>
              <Column header="數量" body-class="text-right" header-class="text-right">
                <template #body="{ data }">× {{ data.qty }}</template>
              </Column>
              <Column header="小計" body-class="text-right" header-class="text-right">
                <template #body="{ data }">
                  <span class="font-bold">${{ data.subtotal.toLocaleString() }}</span>
                </template>
              </Column>
            </DataTable>
            <!-- 小計 / 本批總額（Table 下方；沿用表格列本身的分隔線，不另加 border-t） -->
            <div class="flex flex-col gap-2 pt-1">
              <div class="flex items-center justify-between text-sm">
                <span class="text-[var(--p-text-color)]">商品小計</span>
                <span class="font-medium text-[var(--p-text-color)]">${{ currentBatchTotal.toLocaleString() }}</span>
              </div>
              <!-- COD 代收運費：此批被指定代收全單運費時顯示 -->
              <div v-if="currentIsFreightBatch" class="flex items-center justify-between text-sm">
                <span class="inline-flex items-center gap-1 text-[var(--p-text-color)]">
                  代收運費
                  <span class="text-xs text-[var(--p-text-muted-color)]">（含全單運費代收）</span>
                </span>
                <span class="font-medium text-[var(--p-text-color)]">+${{ SHIPPING_FEE }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-[var(--p-text-color)]">本批總額</span>
                <span class="text-base font-bold text-[var(--p-primary-color)]">${{ (currentBatchTotal + (currentIsFreightBatch ? SHIPPING_FEE : 0)).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 出貨單備註 -->
          <div class="flex flex-col gap-2">
            <span class="text-sm text-[var(--p-text-color)]">出貨單備註</span>
            <Textarea v-model="currentBatch.note" rows="3" placeholder="輸入此批次出貨單備註..." class="w-full resize-none" />
          </div>
        </template>
      </div>
    </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full gap-3">
        <span
          v-if="unallocatedCount > 0"
          class="inline-flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400"
        >
          <i class="pi pi-info-circle text-sm"></i>
          尚有 <span class="font-bold">{{ unallocatedCount }}</span> 件商品未分配至任何批次
        </span>
        <span
          v-else
          class="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
        >
          <i class="pi pi-check-circle text-sm"></i>
          所有商品皆已分配完成
        </span>
        <div class="flex items-center gap-2">
          <Button label="取消" severity="secondary" variant="outlined" @click="cancel" />
          <Button label="儲存並返回" @click="saveAndClose" />
        </div>
      </div>
    </template>
  </Dialog>

  <!-- 此批「設定配送 / 修改」Dialog（共用元件，寫回目前批次 carrier） -->
  <ShippingConfigDialog
    v-model:visible="configDialogVisible"
    :order="configOrder"
    @confirm="onConfigConfirm"
  />
</template>
