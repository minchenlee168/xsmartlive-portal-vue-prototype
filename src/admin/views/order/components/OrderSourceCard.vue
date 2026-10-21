<script setup lang="ts">
/**
 * 訂單來源卡：訂單狀態 / 訂單來源 / 社群平台 / 多購物車 / 場次名稱。
 * 對齊正式專案 OrderSourceCard：純呈現，由 order 自行推導各顯示文字。
 */
import { computed } from 'vue'
import type { OrderRow } from '../orderTypes'
import { ORDER_SOURCE_LABEL, SESSION_LABEL, SOCIAL_LABEL, type TagSeverity } from '../orderLabels'
import { orderStatusOf, orderStatusMeta, orderAbnormalReason } from '../orderStatus'

const props = defineProps<{
  order: OrderRow
  /** 原始訂單檢視模式：隱藏訂單狀態（已併入合併單，狀態以合併單為準）。 */
  hideShipping?: boolean
}>()

/** 訂單狀態：依貨態×付款矩陣推導（與列表頁一致）。 */
const orderStatusBadge = computed<{ label: string; severity: TagSeverity }>(() => orderStatusMeta(orderStatusOf(props.order)))
/** 異常處理時的原因說明（供 tooltip）；非異常為 null。 */
const orderStatusReason = computed<string | null>(() => orderAbnormalReason(props.order))

/** 合併單若子訂單來源分歧 → 顯示「多種訂單來源」。 */
const isMixedMergeSource = computed(
  () => !!props.order.mergeRecord && new Set(props.order.mergeRecord.sources.map((s) => s.orderSource)).size > 1,
)
const orderSourceCardLabel = computed(() =>
  isMixedMergeSource.value ? '多種訂單來源' : ORDER_SOURCE_LABEL[props.order.orderSource].full,
)
const socialLabel = computed(() => (props.order.socialPlatform ? SOCIAL_LABEL[props.order.socialPlatform] : '—'))
const sessionLabel = computed(() => (props.order.sessionName ? SESSION_LABEL[props.order.sessionName] : '—'))
</script>

<template>
  <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
    <span class="text-sm font-bold text-[var(--p-text-color)]">訂單來源</span>
    <!-- 訂單狀態:原始訂單檢視隱藏(已併入合併單,狀態以合併單為準) -->
    <div v-if="!hideShipping" class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">訂單狀態</span>
      <!-- 異常處理:tag 內文字後加驚嘆號,hover 顯示異常原因 -->
      <Tag
        v-if="orderStatusReason"
        :severity="orderStatusBadge.severity"
        class="cursor-help"
        v-tooltip.top="orderStatusReason"
      >
        <span class="inline-flex items-center gap-1">
          {{ orderStatusBadge.label }}
          <i class="pi pi-exclamation-circle text-xs"></i>
        </span>
      </Tag>
      <Tag v-else :value="orderStatusBadge.label" :severity="orderStatusBadge.severity" />
    </div>
    <div class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">訂單來源</span>
      <span class="font-medium text-[var(--p-text-color)]">{{ orderSourceCardLabel }}</span>
    </div>
    <div class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">社群平台</span>
      <span class="text-[var(--p-text-color)]">{{ socialLabel }}</span>
    </div>
    <div class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">多購物車</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">{{ order.cartTag.label }}</span>
    </div>
    <div class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">場次名稱</span>
      <span class="text-[var(--p-text-color)]">{{ sessionLabel }}</span>
    </div>
  </div>
</template>
