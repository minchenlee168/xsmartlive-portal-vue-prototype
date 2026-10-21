<script setup lang="ts">
/**
 * 合併訂單「原始訂單 · 合併紀錄」面板：僅合併訂單（有 mergeRecord）顯示，置於明細最上方。
 * 對齊正式專案 OrderMergeRecordPanel：預設收合，展開後列出摘要 + 各原始訂單（桌機表 / 手機卡片列）。
 */
import { computed, ref } from 'vue'
import type { OrderRow } from '../orderTypes'
import { ORDER_SOURCE_LABEL, paymentBadgeOf, shortShipping, sourceFullLabel, type TagSeverity } from '../orderLabels'
import TableActionButton from '@/admin/components/ui/TableActionButton.vue'

const props = defineProps<{ order: OrderRow }>()
const emit = defineEmits<{ 'open-source-order': [orderNo: string] }>()

/** 預設收合，點標題列展開。 */
const mergeExpanded = ref(false)

const paymentBadge = computed<{ label: string; severity: TagSeverity }>(() => paymentBadgeOf(props.order.paymentStatus))
/** 子訂單付款方式 / 訂單來源分歧 → 摘要顯示「多種…」。 */
const isMixedMergePayment = computed(
  () => !!props.order.mergeRecord && new Set(props.order.mergeRecord.sources.map((s) => s.paymentMethodLabel ?? '—')).size > 1,
)
const isMixedMergeSource = computed(
  () => !!props.order.mergeRecord && new Set(props.order.mergeRecord.sources.map((s) => s.orderSource)).size > 1,
)
const orderSourceCardLabel = computed(() =>
  isMixedMergeSource.value ? '多種訂單來源' : ORDER_SOURCE_LABEL[props.order.orderSource].full,
)

function openSourceOrder(orderNo: string): void {
  emit('open-source-order', orderNo)
}
function copyOrderNo(no: string): void {
  navigator.clipboard?.writeText(no)
}
</script>

<template>
  <div
    v-if="order.mergeRecord"
    class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4"
  >
    <!-- 標題列（可點收合/展開）：icon + 標題 + 由 N 筆合併 tag + 合併時間 + chevron。預設收合 -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer select-none"
      role="button"
      tabindex="0"
      :aria-expanded="mergeExpanded"
      @click="mergeExpanded = !mergeExpanded"
      @keydown.enter.prevent="mergeExpanded = !mergeExpanded"
      @keydown.space.prevent="mergeExpanded = !mergeExpanded"
    >
      <FontAwesomeIcon :icon="['far', 'sitemap']" class="text-[var(--p-primary-color)] shrink-0" />
      <Tag value="原始訂單" />
      <span class="text-sm font-bold text-[var(--p-text-color)] shrink-0">合併紀錄</span>
      <span class="text-sm text-[var(--p-text-muted-color)] shrink-0">（由 {{ order.mergeRecord.sources.length }} 筆合併）</span>
      <span class="ml-auto text-xs text-[var(--p-text-muted-color)] shrink-0">
        合併時間 {{ order.mergeRecord.mergedAt }}
      </span>
      <FontAwesomeIcon
        :icon="['far', 'chevron-down']"
        class="text-xs text-[var(--p-text-muted-color)] shrink-0 transition-transform"
        :class="{ 'rotate-180': mergeExpanded }"
      />
    </div>

    <!-- 展開內容：摘要 + 原始訂單表 + footer（預設收合） -->
    <template v-if="mergeExpanded">
      <!-- 摘要：付款狀態 / 付款方式(label 左、值接續) -->
      <div class="flex flex-col gap-2 text-sm">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="w-16 shrink-0 text-[var(--p-text-muted-color)]">付款狀態</span>
          <Tag :value="paymentBadge.label" :severity="paymentBadge.severity" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-16 shrink-0 text-[var(--p-text-muted-color)]">付款方式</span>
          <span class="text-[var(--p-text-color)]">{{ isMixedMergePayment ? '多種付款方式' : order.mergeRecord.paymentMethodLabel }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="w-16 shrink-0 text-[var(--p-text-muted-color)]">訂單來源</span>
          <span class="text-[var(--p-text-color)]">{{ orderSourceCardLabel }}</span>
        </div>
      </div>

      <!-- 原始訂單：桌機 DataTable(整列可點) / 手機卡片列(design.md §7.5：多欄表格手機不橫向捲動) -->
      <DataTable :value="order.mergeRecord.sources" data-key="orderNo" striped-rows class="hidden md:block w-full"
        :pt="{ column: { headerCell: { style: 'white-space: nowrap;' } }, bodyRow: { style: 'cursor: pointer' } }"
        @row-click="(e) => openSourceOrder(e.data.orderNo)">
        <Column header="建立時間" field="createdAt" />
        <Column header="訂單編號">
          <template #body="{ data }">
            <span class="inline-flex items-center gap-1">
              <span class="font-bold text-[var(--p-text-color)]">{{ data.orderNo }}</span>
              <TableActionButton
                label="複製"
                :icon="['far', 'copy']"
                severity="secondary"
                @click="copyOrderNo(data.orderNo)"
              />
            </span>
          </template>
        </Column>
        <Column header="訂購人" field="buyerName" />
        <Column header="金額">
          <template #body="{ data }">
            <span class="font-bold text-[var(--p-text-color)]">${{ data.amount.toLocaleString() }}</span>
          </template>
        </Column>
        <Column header="件數" field="itemCount" />
        <Column header="出貨方式">
          <template #body="{ data }">{{ shortShipping(data.shippingMethod) }}</template>
        </Column>
        <Column header="付款方式">
          <template #body="{ data }">
            <span class="block max-w-[140px] truncate" :title="data.paymentMethodLabel">{{ data.paymentMethodLabel ?? '—' }}</span>
          </template>
        </Column>
        <Column header="訂單來源">
          <template #body="{ data }">{{ sourceFullLabel(data.orderSource) }}</template>
        </Column>
        <Column header="付款">
          <template #body="{ data }">
            <Tag :value="paymentBadgeOf(data.paymentStatus).label" :severity="paymentBadgeOf(data.paymentStatus).severity" />
          </template>
        </Column>
        <Column header="操作" body-class="text-right">
          <template #body="{ data }">
            <TableActionButton
              label="另開原始訂單檢視頁"
              :icon="['far', 'arrow-up-right-from-square']"
              severity="secondary"
              @click="openSourceOrder(data.orderNo)"
            />
          </template>
        </Column>
      </DataTable>

      <!-- 手機卡片列 -->
      <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
        <div v-for="src in order.mergeRecord.sources" :key="src.orderNo" class="flex flex-col gap-2 py-3 first:pt-0 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1 min-w-0">
              <span class="font-bold text-[var(--p-text-color)]">{{ src.orderNo }}</span>
              <TableActionButton
                label="複製"
                :icon="['far', 'copy']"
                severity="secondary"
                @click="copyOrderNo(src.orderNo)"
              />
            </span>
            <Tag :value="paymentBadgeOf(src.paymentStatus).label" :severity="paymentBadgeOf(src.paymentStatus).severity" class="shrink-0" />
          </div>
          <div class="rounded-md bg-[var(--p-content-hover-background)] px-3 py-2 flex flex-col gap-1">
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">建立時間</span><span class="text-[var(--p-text-color)]">{{ src.createdAt }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">訂購人</span><span class="text-[var(--p-text-color)]">{{ src.buyerName }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">金額</span><span class="font-bold text-[var(--p-text-color)]">${{ src.amount.toLocaleString() }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">件數</span><span class="text-[var(--p-text-color)]">{{ src.itemCount }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">出貨方式</span><span class="text-[var(--p-text-color)]">{{ shortShipping(src.shippingMethod) }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)] shrink-0">付款方式</span><span class="text-[var(--p-text-color)] truncate">{{ src.paymentMethodLabel ?? '—' }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[var(--p-text-muted-color)]">訂單來源</span><span class="text-[var(--p-text-color)]">{{ sourceFullLabel(src.orderSource) }}</span></div>
          </div>
          <div class="flex justify-end">
            <Button label="查看原始訂單" severity="secondary" variant="outlined" size="small" @click="openSourceOrder(src.orderNo)">
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'arrow-up-right-from-square']" />
              </template>
            </Button>
          </div>
        </div>
      </div>

      <!-- footer 提示 -->
      <div class="flex items-center gap-2 text-xs text-[var(--p-text-muted-color)]">
        <FontAwesomeIcon :icon="['far', 'circle-info']" class="text-xs" />
        <span>點任一筆另開原始訂單檢視頁</span>
      </div>
    </template>
  </div>
</template>
