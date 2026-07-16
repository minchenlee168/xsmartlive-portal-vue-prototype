<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ManagedProduct, ManagedProductSpec } from '../utils/productMock'

/**
 * 批量調整庫存 dialog（從商品列表 → 庫存欄旁筆 icon 開啟）。
 *
 * 結構：
 * - 上半部：規格庫存調整 table — 每個 spec 一列，可輸入庫存增減 + 選原因，
 *   即時顯示「調整後」庫存。送出時 emit 一份完整的調整清單。
 * - 下半部：近十筆調整紀錄（accordion 可收合）+ 規格篩選 chips + 原因關鍵字搜尋。
 *   歷史紀錄目前是 mock，方便視覺驗證；之後接 API 替換 mockHistory 即可。
 */

interface AdjustmentReason {
  label: string
  value: string
  /** 此原因適用的調整方向；隨第一步「增加 / 減少」過濾可選項 */
  modes: AdjustMode[]
}
const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  // 增加庫存
  { label: '進貨', value: 'restock', modes: ['increase'] },
  { label: '退貨', value: 'return', modes: ['increase'] },
  { label: '庫存回補', value: 'replenish', modes: ['increase'] },
  // 減少庫存
  { label: '銷售', value: 'sale', modes: ['decrease'] },
  { label: '內部使用', value: 'internal', modes: ['decrease'] },
  { label: '報廢', value: 'discard', modes: ['decrease'] },
  // 兩者皆可
  { label: '盤點', value: 'inventory', modes: ['increase', 'decrease'] },
  { label: '其他', value: 'other', modes: ['increase', 'decrease'] },
]

/** 第一步：先選調整方向。增加 → 可填進貨成本；減少 → 成本鎖定為平均成本（disabled） */
type AdjustMode = 'increase' | 'decrease'
const ADJUST_MODES: { label: string; value: AdjustMode }[] = [
  { label: '增加庫存', value: 'increase' },
  { label: '減少庫存', value: 'decrease' },
]

interface AdjustmentRow {
  specId: number
  specName: string
  currentStock: number
  /** 調整數量（正數）；實際增減方向由 adjustMode 決定 */
  delta: number
  reason: string
  /** 成本單價；僅「增加庫存」的進貨原因可編輯 */
  price: number
}

export interface StockAdjustmentPayload {
  productId: number
  adjustments: AdjustmentRow[]
}

interface Props {
  visible?: boolean
  product?: ManagedProduct | null
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  product: null,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [payload: StockAdjustmentPayload]
}>()

const adjustments = ref<AdjustmentRow[]>([])
/** 第一步選的調整方向；預設增加庫存 */
const adjustMode = ref<AdjustMode>('increase')
/** 依方向把「調整數量」換成帶正負號的實際增減值 */
function effectiveDelta(row: AdjustmentRow): number {
  return adjustMode.value === 'increase' ? (row.delta ?? 0) : -(row.delta ?? 0)
}
/** 調整原因選項：依目前調整方向過濾 */
const reasonOptions = computed(() => ADJUSTMENT_REASONS.filter((r) => r.modes.includes(adjustMode.value)))
/** 成本單價欄：只在「增加庫存」且至少一列為進貨時顯示；其餘情況隱藏並把空間讓給調整原因 */
const showCostColumn = computed(
  () => adjustMode.value === 'increase' && adjustments.value.some((r) => r.reason === 'restock'),
)
/** 切換方向時，把各列已選但不適用新方向的原因重置為該方向的預設原因 */
watch(adjustMode, (mode) => {
  const validValues = reasonOptions.value.map((r) => r.value)
  const fallback = mode === 'increase' ? 'restock' : 'sale'
  adjustments.value.forEach((row) => {
    if (!validValues.includes(row.reason)) row.reason = fallback
  })
})
const showHistory = ref(true)
const historyFilter = ref<number | 'all'>('all')
const historyKeyword = ref('')

/** 抽屜內視圖切換：main = 庫存調整 + 近十筆預覽；history = 調整紀錄全表 + 返回 */
type DrawerView = 'main' | 'history'
const view = ref<DrawerView>('main')

/** dialog 開啟時：依商品的規格初始化空 adjustment rows（沒人改就 delta=0、reason=空） */
watch(
  () => [props.visible, props.product] as const,
  ([v, p]) => {
    if (!v || !p) return
    view.value = 'main'
    adjustMode.value = 'increase'
    adjustments.value = (p as ManagedProduct).specs.map((s) => ({
      specId: s.id,
      specName: s.name,
      currentStock: s.stock,
      delta: 0,
      reason: 'restock',
      price: s.cost,
    }))
    historyFilter.value = 'all'
    historyKeyword.value = ''
    showHistory.value = true
  },
  { immediate: true },
)

function close(): void { emit('update:visible', false) }
function onSave(): void {
  if (!props.product) return
  // 只送有實際數量的列（delta != 0），並把調整數量依方向換成帶正負號的實際增減值
  const changes = adjustments.value
    .filter((a) => a.delta !== 0)
    .map((a) => ({ ...a, delta: effectiveDelta(a) }))
  // 把這次調整也寫進下方「近十筆調整紀錄」最前面
  if (changes.length > 0) {
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const reasonLabelMap = Object.fromEntries(ADJUSTMENT_REASONS.map((r) => [r.value, r.label]))
    changes.forEach((c) => {
      userHistory.value.unshift({
        id: Date.now() + Math.random(),
        time: stamp,
        specId: c.specId,
        specName: c.specName,
        before: c.currentStock,
        delta: c.delta,
        after: c.currentStock + c.delta,
        reason: reasonLabelMap[c.reason] ?? c.reason,
        operator: 'Test Name',
      })
    })
  }
  emit('save', { productId: props.product.id, adjustments: changes })
  close()
}

// ── 近十筆調整紀錄（mock）─────────────────────
interface HistoryEntry {
  id: number
  time: string
  specId: number
  specName: string
  before: number
  delta: number
  after: number
  reason: string
  operator: string
}
/**
 * mock 假歷史紀錄：開好幾筆方便驗證；每個規格塞 4 筆，這樣切到「查看更多紀錄」
 * 才會看到比主畫面預覽多出來的列。真實情境會從 API 拉。
 */
function buildMockHistory(p: ManagedProduct | null): HistoryEntry[] {
  if (!p) return []
  const reasons = ['進貨', '銷售', '盤點', '退貨', '庫存回補', '內部使用']
  const operators = ['Test Name', '阿明', '小芳', '王太太']
  // 原因 label → 適用方向，用來讓異動符號與原因一致
  const labelModes = Object.fromEntries(ADJUSTMENT_REASONS.map((r) => [r.label, r.modes]))
  const list: HistoryEntry[] = []
  let id = 1
  p.specs.forEach((s, si) => {
    for (let i = 0; i < 4; i++) {
      const reason = reasons[(si + i) % reasons.length]
      const modes = labelModes[reason] ?? (['increase', 'decrease'] as AdjustMode[])
      // 增加類原因 → 正；減少類 → 負；兩者皆可（盤點 / 其他）→ 依序交替
      const magnitude = 100
      const delta = modes.length === 1
        ? (modes[0] === 'increase' ? magnitude : -magnitude)
        : (i % 2 === 0 ? magnitude : -magnitude)
      const before = s.stock + (4 - i) * 100
      list.push({
        id: id++,
        time: `2026-03-${(24 - i).toString().padStart(2, '0')} ${(14 - i).toString().padStart(2, '0')}:30`,
        specId: s.id,
        specName: s.name,
        before,
        delta,
        after: before + delta,
        reason,
        operator: operators[(si + i) % operators.length],
      })
    }
  })
  return list
}

/** 使用者按下確認後本機累積的調整紀錄（unshift 到最前面，最新先看到） */
const userHistory = ref<HistoryEntry[]>([])

/** 全部紀錄 = 本次累積 + mock 假紀錄 */
const allHistory = computed<HistoryEntry[]>(() => [
  ...userHistory.value,
  ...buildMockHistory(props.product),
])

const filteredHistory = computed(() => {
  let list = allHistory.value
  if (historyFilter.value !== 'all') {
    list = list.filter((h) => h.specId === historyFilter.value)
  }
  const k = historyKeyword.value.trim()
  if (k) list = list.filter((h) => h.reason.includes(k))
  return list
})

/** 主畫面預覽：只列前 N 筆，剩下的留給「查看更多紀錄」全表 */
const PREVIEW_LIMIT = 5
const previewHistory = computed(() => filteredHistory.value.slice(0, PREVIEW_LIMIT))
const hasMoreHistory = computed(() => filteredHistory.value.length > PREVIEW_LIMIT)

/** 規格 chip 篩選選項：[全部規格, ...每個規格]。用 PrimeVue SelectButton 呈現。 */
const specFilterOptions = computed<Array<{ label: string; value: number | 'all' }>>(() => [
  { label: '全部規格', value: 'all' },
  ...((props.product?.specs ?? []).map((s) => ({ label: s.name, value: s.id }))),
])
</script>

<template>
  <Drawer
    :visible="visible"
    position="right"
    :modal="true"
    :dismissable="true"
    :style="{ width: 'min(900px, calc(100vw - 32px))' }"
    :pt="{ root: { class: '!max-w-[95vw]' } }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="text-lg font-semibold text-[var(--p-text-color)]">
        {{ view === 'history' ? '調整紀錄' : `批量調整庫存 - ${product?.name ?? ''}` }}
      </span>
    </template>

    <!-- ========== Main 視圖：規格調整 + 近十筆預覽 ========== -->
    <div v-if="view === 'main'" class="flex flex-col gap-3">
      <!-- 第一步：先選調整方向；減少庫存時成本欄鎖定為平均成本 -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-[var(--p-text-color)]">調整方式</span>
        <SelectButton
          v-model="adjustMode"
          :options="ADJUST_MODES"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>
      <span class="text-xs text-[var(--p-text-muted-color)]">規格庫存調整</span>

      <!-- 規格庫存調整 table（PrimeVue DataTable + Column，cell 字級 / 背景交回 Aura 預設） -->
      <DataTable
        :value="adjustments"
        data-key="specId"
        class="w-full"
      >
        <Column field="specName" header="規格名稱" />
        <Column field="currentStock" header="目前庫存" style="width: 100px" />
        <Column header="調整數量" style="width: 180px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.delta"
              show-buttons
              button-layout="stacked"
              :min="0"
              fluid
            />
          </template>
        </Column>
        <!-- 成本單價欄隱藏時（減少庫存，或增加但無進貨列），讓出的空間給調整原因（200 → 350），其餘欄寬不變 -->
        <Column header="調整原因" :style="showCostColumn ? 'width: 200px' : 'width: 350px'">
          <template #body="{ data }">
            <Select
              v-model="data.reason"
              :options="reasonOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </template>
        </Column>
        <!-- 成本單價：僅「增加庫存」且有進貨列時顯示；進貨原因可編輯進貨成本，其餘原因顯示「—」 -->
        <Column v-if="showCostColumn" header="成本單價" style="width: 150px">
          <template #body="{ data }">
            <InputNumber
              v-if="data.reason === 'restock'"
              v-model="data.price"
              prefix="$"
              :min="0"
              fluid
            />
            <span v-else class="text-[var(--p-text-muted-color)]">—</span>
          </template>
        </Column>
        <Column header="調整後" style="width: 100px">
          <template #body="{ data }">
            {{ Math.max(0, data.currentStock + effectiveDelta(data)) }}
          </template>
        </Column>
      </DataTable>

      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="close" />
        <Button label="確認" @click="onSave" />
      </div>
    </div>

    <!-- 分隔線（只在 main 視圖顯示，避免切到 history 後上面還殘留預覽） -->
    <div v-if="view === 'main'" class="border-t border-[var(--p-content-border-color)] my-4"></div>

    <!-- 近十筆調整紀錄（main 視圖預覽）：PrimeVue Panel toggleable 替代手刻 chevron button -->
    <Panel
      v-if="view === 'main'"
      header="近十筆調整紀錄"
      toggleable
      :collapsed="!showHistory"
      @update:collapsed="(c) => showHistory = !c"
    >
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <SelectButton
            v-model="historyFilter"
            :options="specFilterOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
          <InputGroup class="!w-fit">
            <InputText v-model="historyKeyword" placeholder="搜尋調整原因" class="!w-[260px]" />
            <Button label="搜尋" />
          </InputGroup>
        </div>

        <!-- 預覽 table：cell 字級 / 背景交回 Aura 預設 -->
        <DataTable
          :value="previewHistory"
          data-key="id"
          class="w-full"
        >
          <Column field="time" header="時間" style="width: 160px" />
          <Column field="specName" header="規格" style="width: 80px" />
          <Column field="before" header="調整前" style="width: 80px" />
          <Column header="異動" style="width: 80px">
            <template #body="{ data }">
              <Tag
                :value="`${data.delta >= 0 ? '+' : ''}${data.delta}`"
                :severity="data.delta >= 0 ? 'success' : 'danger'"
              />
            </template>
          </Column>
          <Column field="after" header="調整後" style="width: 80px" />
          <Column field="reason" header="調整原因" style="width: 120px" />
          <Column field="operator" header="操作人員" />
          <template #empty>
            <div class="py-6 text-center text-sm text-[var(--p-text-muted-color)]">
              沒有符合條件的調整紀錄
            </div>
          </template>
        </DataTable>

        <div v-if="hasMoreHistory" class="flex justify-center">
          <Button label="查看更多紀錄" severity="primary" outlined size="small" @click="view = 'history'" />
        </div>
      </div>
    </Panel>

    <!-- ========== History 視圖：調整紀錄全表 + 返回 ========== -->
    <div v-if="view === 'history'" class="flex flex-col gap-3">
      <!-- 規格 SelectButton + 原因搜尋（與 main 視圖共用 state） -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <SelectButton
          v-model="historyFilter"
          :options="specFilterOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <InputText v-model="historyKeyword" placeholder="搜尋調整原因" class="!w-[260px]" />
      </div>

      <!-- 全表：cell 字級 / 背景交回 Aura 預設 -->
      <DataTable
        :value="filteredHistory"
        data-key="id"
        :striped-rows="true"
        :paginator="true"
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        class="w-full"
      >
        <Column field="time" header="時間" style="width: 160px" />
        <Column field="specName" header="規格" style="width: 80px" />
        <Column field="before" header="調整前" style="width: 80px" />
        <Column header="異動" style="width: 80px">
          <template #body="{ data }">
            <Tag
              :value="`${data.delta >= 0 ? '+' : ''}${data.delta}`"
              :severity="data.delta >= 0 ? 'success' : 'danger'"
            />
          </template>
        </Column>
        <Column field="after" header="調整後" style="width: 80px" />
        <Column field="reason" header="調整原因" style="width: 120px" />
        <Column field="operator" header="操作人員" />
        <template #empty>
          <div class="py-6 text-center text-sm text-[var(--p-text-muted-color)]">
            沒有符合條件的調整紀錄
          </div>
        </template>
      </DataTable>

      <div class="flex justify-end mt-2">
        <Button label="返回" severity="primary" outlined @click="view = 'main'" />
      </div>
    </div>
  </Drawer>
</template>
