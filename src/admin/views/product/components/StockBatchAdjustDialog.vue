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
}
const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  { label: '進貨', value: 'restock' },
  { label: '退貨', value: 'return' },
  { label: '盤點', value: 'inventory' },
  { label: '內部使用', value: 'internal' },
  { label: '報廢', value: 'discard' },
  { label: '其他', value: 'other' },
]

interface AdjustmentRow {
  specId: number
  specName: string
  currentStock: number
  delta: number
  reason: string
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
    adjustments.value = (p as ManagedProduct).specs.map((s) => ({
      specId: s.id,
      specName: s.name,
      currentStock: s.stock,
      delta: 0,
      reason: 'restock',
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
  // 只送有實際增減的列（delta != 0）
  const changes = adjustments.value.filter((a) => a.delta !== 0)
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
  const reasons = ['進貨', '進貨', '盤點', '退貨', '作廢', '內部使用']
  const operators = ['Test Name', '阿明', '小芳', '王太太']
  const list: HistoryEntry[] = []
  let id = 1
  p.specs.forEach((s, si) => {
    for (let i = 0; i < 4; i++) {
      const delta = i % 2 === 0 ? 100 : -100
      const before = s.stock + (4 - i) * 100
      list.push({
        id: id++,
        time: `2026-03-${(24 - i).toString().padStart(2, '0')} ${(14 - i).toString().padStart(2, '0')}:30`,
        specId: s.id,
        specName: s.name,
        before,
        delta,
        after: before + delta,
        reason: reasons[(si + i) % reasons.length],
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
      <span class="text-[13px] text-[var(--p-text-muted-color)]">規格庫存調整</span>

      <!-- 規格庫存調整 table（PrimeVue DataTable + Column，cell 字級 / 背景交回 Aura 預設） -->
      <DataTable
        :value="adjustments"
        data-key="specId"
        class="w-full"
      >
        <Column field="specName" header="規格名稱" />
        <Column field="currentStock" header="目前庫存" style="width: 100px" />
        <Column header="庫存調整" style="width: 180px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.delta"
              show-buttons
              button-layout="stacked"
              fluid
            />
          </template>
        </Column>
        <Column header="調整原因" style="width: 200px">
          <template #body="{ data }">
            <Select
              v-model="data.reason"
              :options="ADJUSTMENT_REASONS"
              option-label="label"
              option-value="value"
              fluid
            />
          </template>
        </Column>
        <Column header="調整後" style="width: 100px">
          <template #body="{ data }">
            {{ data.currentStock + (data.delta ?? 0) }}
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
