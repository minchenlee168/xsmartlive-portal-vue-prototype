<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import EditProductDialog from './EditProductDialog.vue'
import WinnerListDialog from './WinnerListDialog.vue'
import GiftFormDialog, { type GiftSubmitPayload } from './GiftFormDialog.vue'

/**
 * 貼文收單頁的商品 table；與 LiveProductCard 顯示同一份資料但走表格。
 * 主操作集中在「操作」欄：得標清單 / 編輯 / 推播 / 開始or結束收單 / 刪除。
 */

interface ProductSpec {
  id?: number
  name?: string
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
  price?: number
  stock?: number
  sold?: number
  status?: string
  isGift?: boolean
  specs?: ProductSpec[]
  selectedSpecs?: ProductSpec[]
  [key: string]: unknown
}

interface Props {
  products: LiveProduct[]
  orderingEnabled?: boolean
  /** 貼文/社團模式下該貼文的收單期間起點；按下「開始收單」時若 startAt 尚未到 → 跳提示問是否調整時間 */
  periodStartAt?: Date | null
}
const props = withDefaults(defineProps<Props>(), {
  orderingEnabled: false,
  periodStartAt: null,
})

const emit = defineEmits<{
  delete: [id: number]
  'end-ordering': [id: number]
  /** 使用者選擇「調整時間」→ 父層開 PostPeriodDialog */
  'adjust-period': []
}>()

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

// 共用 dialog state
const editDialogVisible = ref(false)
const giftDialogVisible = ref(false)
const winnerDialogVisible = ref(false)
const activeProduct = ref<LiveProduct | null>(null)

function statusMeta(p: LiveProduct): { label: string; bg: string; color: string; icon?: string } {
  const map: Record<string, { label: string; bg: string; color: string; icon?: string }> = {
    ready: { label: t('live_order.label.ready'), bg: 'bg-[var(--p-content-hover-background)]', color: 'var(--p-text-muted-color)', icon: 'pi pi-history' },
    live:  { label: t('live_order.label.live'),  bg: 'bg-[#fee2e2]', color: '#dc2626' },
  }
  return map[p.status ?? 'ready'] ?? map.ready
}

function priceRange(p: LiveProduct): string {
  const specs = (p.selectedSpecs?.length ? p.selectedSpecs : p.specs) ?? []
  if (specs.length > 1) {
    const prices = specs.map(s => s.price ?? p.price ?? 0)
    const min = Math.min(...prices), max = Math.max(...prices)
    if (min !== max) return `$${min.toLocaleString()} ~ ${max.toLocaleString()}`
  }
  return `$${(p.price ?? 0).toLocaleString()}`
}

function specSummary(p: LiveProduct): string {
  const specs = (p.selectedSpecs?.length ? p.selectedSpecs : p.specs) ?? []
  if (specs.length === 0) return t('live_order.label.no_spec')
  if (specs.length <= 3) return specs.map(s => s.name).filter(Boolean).join(' / ')
  return `${specs.slice(0, 3).map(s => s.name).filter(Boolean).join(' / ')} +${specs.length - 3}`
}

function salesAmount(p: LiveProduct): number {
  return (p.price ?? 0) * (p.sold ?? 0)
}

function openEdit(p: LiveProduct): void {
  activeProduct.value = p
  if (p.isGift) giftDialogVisible.value = true
  else editDialogVisible.value = true
}

function openWinnerList(p: LiveProduct): void {
  activeProduct.value = p
  winnerDialogVisible.value = true
}

function onPushClick(_p: LiveProduct): void {
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.push_sent'),
    life: 2000,
  })
}

function toggleStatus(p: LiveProduct): void {
  if (p.status === 'live') {
    // 比照 LiveProductCard 的「停止收單」：
    // - 禮物 → 走父層的「結束發送」彙總彈窗
    // - 一般商品 → 直接 status 回 ready（不寫紀錄，要寫紀錄要用右上「一鍵結束收單」）
    if (p.isGift) {
      emit('end-ordering', p.id)
      return
    }
    p.status = 'ready'
    return
  }
  if (!props.orderingEnabled) return
  // 收單期間還沒到 → 跳提示讓使用者決定調整時間 / 取消
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
  p.status = 'live'
}

function onDeleteClick(p: LiveProduct, event: Event): void {
  if (p.status === 'live') return  // disabled 按鈕被點時的二道防線
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: t('live_order.dialog.confirm_delete_product_header'),
    message: t('live_order.dialog.confirm_delete_product_message', { name: p.name ?? '' }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('live_order.dialog.remove'),
    rejectLabel: t('live_order.button.cancel'),
    acceptClass: 'p-button-danger',
    accept: () => emit('delete', p.id),
  })
}

function onSettingSave(data: Record<string, unknown> | null | undefined): void {
  if (!data || !activeProduct.value) return
  Object.assign(activeProduct.value as Record<string, unknown>, data)
}

function onGiftEdit(payload: GiftSubmitPayload): void {
  if (!activeProduct.value) return
  const p = activeProduct.value as Record<string, unknown>
  p.name = payload.name
  p.keyword = payload.keyword
  p.stock = payload.quantity
  p.note = payload.message
  if (payload.imageUrl !== undefined) p.imageUrl = payload.imageUrl
}

const startBtnDisabled = computed(() => !props.orderingEnabled)
</script>

<template>
  <!-- min-w-0 讓本容器在 flex 父層內可以縮到 0；overflow-x-auto 讓內部 DataTable 過寬時水平捲動，不再撐爆右側 panel -->
  <div class="bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] rounded-[8px] overflow-x-auto overflow-y-hidden min-w-0">
    <DataTable
      :value="products"
      :striped-rows="true"
      class="w-full"
      :pt="{
        column: { headerCell: { style: 'white-space: nowrap;' } },
      }"
    >
      <Column field="name" :header="t('live_order.table.column.product')">
        <template #body="{ data }">
          <div class="flex items-center gap-3">
            <div class="w-[40px] h-[40px] rounded-[6px] bg-[var(--p-primary-50)] flex items-center justify-center shrink-0">
              <FontAwesomeIcon
                :icon="['far', data.isGift ? 'gift' : 'bag-shopping']"
                :style="{ fontSize: '16px', color: 'var(--p-primary-color)' }"
              />
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-medium text-[14px] text-[var(--p-text-color)] truncate max-w-[280px]">{{ data.name }}</span>
                <span
                  v-if="data.keyword"
                  class="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded-full leading-none shrink-0"
                >
                  {{ data.keyword }}
                </span>
              </div>
              <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ data.sku || `#${data.id}` }}</span>
            </div>
          </div>
        </template>
      </Column>

      <Column field="spec" :header="t('live_order.label.spec_name')">
        <template #body="{ data }">
          <span class="text-[13px] text-[var(--p-text-color)]">{{ specSummary(data) }}</span>
        </template>
      </Column>

      <Column field="price" :header="t('live_order.label.price')">
        <template #body="{ data }">
          <span class="text-[13px] font-bold text-[var(--p-primary-color)]">{{ priceRange(data) }}</span>
        </template>
      </Column>

      <Column field="stock" :header="t('live_order.label.stock')">
        <template #body="{ data }">
          <span class="text-[13px]" :class="(data.stock ?? 0) <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">
            {{ data.stock ?? 0 }}
          </span>
        </template>
      </Column>

      <Column field="sold" :header="t('live_order.label.sold')">
        <template #body="{ data }">
          <span class="text-[13px] font-bold text-[#f97316]">{{ data.sold ?? 0 }}</span>
        </template>
      </Column>

      <Column field="amount" :header="t('live_order.label.sales_total')">
        <template #body="{ data }">
          <span class="text-[13px] text-[var(--p-text-color)]">${{ salesAmount(data).toLocaleString() }}</span>
        </template>
      </Column>


      <Column field="status" :header="t('live_order.table.column.checkout_status')">
        <template #body="{ data }">
          <span
            :class="['inline-flex items-center gap-1.5 px-[7px] py-[3.5px] rounded-[12px] font-bold text-[12.25px] leading-none', statusMeta(data).bg]"
            :style="{ color: statusMeta(data).color }"
          >
            <span v-if="data.status === 'live'" class="w-1.5 h-1.5 rounded-full bg-[#dc2626] animate-pulse"></span>
            <i v-else-if="statusMeta(data).icon" :class="statusMeta(data).icon" :style="{ fontSize: '11px', color: statusMeta(data).color }"></i>
            {{ statusMeta(data).label }}
          </span>
        </template>
      </Column>

      <Column :header="t('live_order.table.column.actions')">
        <template #body="{ data }">
          <div class="flex items-center gap-1">
            <button
              v-tooltip.top="t('live_order.tooltip.winner_list')"
              class="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              @click="openWinnerList(data)"
            >
              <i class="pi pi-list" style="font-size:13px"></i>
            </button>
            <button
              v-tooltip.top="t('live_order.tab.order_setting')"
              class="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              @click="openEdit(data)"
            >
              <FontAwesomeIcon :icon="['far', 'gear']" class="text-[13px]" />
            </button>
            <button
              v-if="data.status === 'live'"
              v-tooltip.top="t('live_order.tooltip.push')"
              class="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[#ef4444] hover:bg-[#fee2e2] border border-[#ef4444]"
              @click="onPushClick(data)"
            >
              <FontAwesomeIcon :icon="['far', 'bullhorn']" class="text-[12px]" />
            </button>
            <button
              :disabled="startBtnDisabled && data.status !== 'live'"
              v-tooltip.top="data.status === 'live'
                ? (data.isGift ? t('live_order.tooltip.end_sending') : t('live_order.tooltip.stop_ordering'))
                : (data.isGift ? t('live_order.tooltip.start_sending') : t('live_order.tooltip.start_ordering'))"
              :class="['w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-white',
                data.status === 'live' ? 'bg-[#ef4444] hover:bg-[#dc2626]' : 'bg-[var(--p-primary-color)] hover:bg-[var(--p-primary-hover-color)]',
                startBtnDisabled && data.status !== 'live' ? 'opacity-50 cursor-not-allowed' : '']"
              @click="toggleStatus(data)"
            >
              <i :class="data.status === 'live' ? 'pi pi-check' : 'pi pi-play'" style="font-size:12px"></i>
            </button>
            <!-- 收單中不可移除 → 必須先按「停止收單」回 ready 才開放 -->
            <button
              v-tooltip.top="data.status === 'live' ? '請先停止收單再移除' : t('live_order.tooltip.delete')"
              :disabled="data.status === 'live'"
              :class="['w-[28px] h-[28px] rounded-[6px] flex items-center justify-center',
                data.status === 'live'
                  ? 'text-[var(--p-text-muted-color)] opacity-50 cursor-not-allowed'
                  : 'text-[#ef4444] hover:bg-[#fee2e2]']"
              @click="onDeleteClick(data, $event)"
            >
              <FontAwesomeIcon :icon="['far', 'trash']" class="text-[13px]" />
            </button>
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="py-8 text-center text-[14px] text-[var(--p-text-muted-color)]">
          {{ t('live_order.empty.no_product_content') }}
        </div>
      </template>
    </DataTable>

    <!-- 共用 dialog -->
    <EditProductDialog
      v-if="activeProduct"
      v-model:visible="editDialogVisible"
      :product="activeProduct"
      initial-tab="order"
      order-only
      @save="onSettingSave"
    />
    <GiftFormDialog
      v-if="activeProduct"
      v-model:visible="giftDialogVisible"
      :product="activeProduct"
      @submit="onGiftEdit"
    />
    <WinnerListDialog
      v-if="activeProduct"
      v-model:visible="winnerDialogVisible"
      :product="activeProduct"
    />
  </div>
</template>
