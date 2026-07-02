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
  /** 貼文/社團模式：收單中商品操作欄拆成「暫停收單 + 結束收單」；結束收單走 end-ordering 開彙總彈窗 */
  isPostMode?: boolean
  /** 已結束的收單：唯讀狀態,操作欄只保留得標清單,不顯示訂單設定 / 開始收單 / 刪除 */
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  orderingEnabled: false,
  periodStartAt: null,
  isPostMode: false,
  readonly: false,
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

/** 商品狀態 → PrimeVue Tag severity（Design.md 7.0 用元件 + 二 語意色） */
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
function statusMeta(p: LiveProduct): { label: string; severity: TagSeverity } {
  // 已結束的 collection(readonly) 或商品已個別結束 → 統一顯示「已結束」
  if (props.readonly || p.status === 'done') return { label: t('live_order.label.done'), severity: 'secondary' }
  if (p.status === 'live') return { label: t('live_order.label.live'), severity: 'danger' }
  return { label: t('live_order.label.ready'), severity: 'secondary' }
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

/** 貼文/社團模式：暫停收單（status → ready,不開彙總彈窗；比照直播模式的「停止收單」）。 */
function onPauseOrdering(p: LiveProduct): void {
  p.status = 'ready'
}
/** 貼文/社團模式：結束收單 → 走父層 end-ordering 開彙總彈窗,跟直播「結束收單」一致。 */
function onEndOrdering(p: LiveProduct): void {
  emit('end-ordering', p.id)
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
  <!-- min-w-0 讓本容器在 flex 父層內可以縮到 0；overflow-x-auto 讓內部 DataTable 過寬時水平捲動，不再撐爆右側 panel
       依 Design.md 6.5 巢狀容器原則：外層 Card 已在頁面提供視覺容器，這裡不再套 border/rounded 避免雙重外框 -->
  <div class="min-w-0">
    <!-- 手機條列式 view：對齊 PostCollectionOverview 的 label : value + divide-y 樣式 -->
    <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
      <div
        v-for="p in products"
        :key="p.id"
        class="py-3 flex flex-col gap-2"
      >
        <!-- 頂部：商品 icon + 名稱 + keyword Tag + 狀態 Tag -->
        <div class="flex items-start gap-3">
          <div class="size-10 rounded-md bg-[var(--p-primary-50)] flex items-center justify-center shrink-0">
            <FontAwesomeIcon
              :icon="['far', p.isGift ? 'gift' : 'bag-shopping']"
              :style="{ fontSize: '16px', color: 'var(--p-primary-color)' }"
            />
          </div>
          <div class="flex flex-col gap-1 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-[var(--p-text-color)] truncate">{{ p.name }}</span>
              <Tag v-if="p.keyword" :value="p.keyword" severity="info" class="shrink-0" />
            </div>
            <span class="text-xs text-[var(--p-text-muted-color)]">{{ p.sku || `#${p.id}` }}</span>
          </div>
          <Tag
            :value="statusMeta(p).label"
            :severity="statusMeta(p).severity"
            class="shrink-0"
          />
        </div>
        <!-- 規格 -->
        <div class="flex items-center gap-2 text-[13px]">
          <span class="text-[var(--p-text-muted-color)] w-[68px] shrink-0">{{ t('live_order.label.spec_name') }}</span>
          <span class="text-[var(--p-text-color)]">{{ specSummary(p) }}</span>
        </div>
        <!-- 售價 -->
        <div class="flex items-center gap-2 text-[13px]">
          <span class="text-[var(--p-text-muted-color)] w-[68px] shrink-0">{{ t('live_order.label.price') }}</span>
          <span class="font-bold text-[var(--p-primary-color)]">{{ priceRange(p) }}</span>
        </div>
        <!-- 庫存 / 已成單（同一列） -->
        <div class="flex items-center gap-4 text-[13px]">
          <div class="flex items-center gap-2">
            <span class="text-[var(--p-text-muted-color)]">{{ t('live_order.label.stock') }}</span>
            <span :class="(p.stock ?? 0) <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">
              {{ p.stock ?? 0 }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[var(--p-text-muted-color)]">{{ t('live_order.label.sold') }}</span>
            <span class="font-bold text-[#f97316]">{{ p.sold ?? 0 }}</span>
          </div>
        </div>
        <!-- 銷售額 -->
        <div class="flex items-center gap-2 text-[13px]">
          <span class="text-[var(--p-text-muted-color)] w-[68px] shrink-0">{{ t('live_order.label.sales_total') }}</span>
          <span class="text-[var(--p-text-color)]">${{ salesAmount(p).toLocaleString() }}</span>
        </div>
        <!-- 操作 -->
        <div class="flex items-center gap-1 pt-1 flex-wrap">
          <Button
            v-tooltip.top="t('live_order.tooltip.winner_list')"
            icon="pi pi-list"
            severity="secondary"
            variant="text"
            size="small"
            rounded
            @click="openWinnerList(p)"
          />
          <template v-if="!readonly && p.status !== 'done'">
            <Button
              v-tooltip.top="t('live_order.tab.order_setting')"
              severity="secondary"
              variant="text"
              size="small"
              rounded
              @click="openEdit(p)"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'gear']" />
              </template>
            </Button>
            <Button
              v-if="p.status === 'live'"
              v-tooltip.top="t('live_order.tooltip.push')"
              severity="danger"
              variant="outlined"
              size="small"
              rounded
              @click="onPushClick(p)"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'bullhorn']" />
              </template>
            </Button>
            <!-- 貼文/社團模式 + 收單中:暫停收單(secondary) + 結束收單(danger,走彙總彈窗) -->
            <template v-if="p.status === 'live' && !p.isGift">
              <Button
                v-tooltip.top="t('live_order.tooltip.pause_ordering')"
                icon="pi pi-pause"
                severity="secondary"
                variant="outlined"
                size="small"
                rounded
                @click="onPauseOrdering(p)"
              />
              <Button
                v-tooltip.top="t('live_order.tooltip.end_ordering')"
                icon="pi pi-check"
                severity="danger"
                size="small"
                rounded
                @click="onEndOrdering(p)"
              />
            </template>
            <Button
              v-else
              :disabled="startBtnDisabled && p.status !== 'live'"
              v-tooltip.top="p.status === 'live'
                ? (p.isGift ? t('live_order.tooltip.end_sending') : t('live_order.tooltip.stop_ordering'))
                : (p.isGift ? t('live_order.tooltip.start_sending') : t('live_order.tooltip.start_ordering'))"
              :icon="p.status === 'live' ? 'pi pi-check' : 'pi pi-play'"
              :severity="p.status === 'live' ? 'danger' : 'primary'"
              size="small"
              rounded
              @click="toggleStatus(p)"
            />
            <Button
              v-tooltip.top="p.status === 'live' ? '請先停止收單再移除' : t('live_order.tooltip.delete')"
              :disabled="p.status === 'live'"
              severity="danger"
              variant="text"
              size="small"
              rounded
              @click="onDeleteClick(p, $event)"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'trash']" />
              </template>
            </Button>
          </template>
        </div>
      </div>
      <div
        v-if="products.length === 0"
        class="py-12 text-center text-sm text-[var(--p-text-muted-color)]"
      >
        {{ t('live_order.empty.no_product_content') }}
      </div>
    </div>

    <!-- 桌機 DataTable view -->
    <div class="hidden md:block overflow-x-auto overflow-y-hidden">
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
            <div class="size-10 rounded-md bg-[var(--p-primary-50)] flex items-center justify-center shrink-0">
              <FontAwesomeIcon
                :icon="['far', data.isGift ? 'gift' : 'bag-shopping']"
                :style="{ fontSize: '16px', color: 'var(--p-primary-color)' }"
              />
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-[var(--p-text-color)] truncate max-w-[280px]">{{ data.name }}</span>
                <Tag v-if="data.keyword" v-tooltip.top="'關鍵字'" :value="data.keyword" severity="info" class="shrink-0" />
              </div>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ data.sku || `#${data.id}` }}</span>
            </div>
          </div>
        </template>
      </Column>

      <Column field="spec" :header="t('live_order.label.spec_name')">
        <template #body="{ data }">
          <span class="text-[var(--p-text-color)]">{{ specSummary(data) }}</span>
        </template>
      </Column>

      <Column field="price" :header="t('live_order.label.price')">
        <template #body="{ data }">
          <span class="font-bold text-[var(--p-primary-color)]">{{ priceRange(data) }}</span>
        </template>
      </Column>

      <Column field="stock" :header="t('live_order.label.stock')">
        <template #body="{ data }">
          <span :class="(data.stock ?? 0) <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">
            {{ data.stock ?? 0 }}
          </span>
        </template>
      </Column>

      <Column field="sold" :header="t('live_order.label.sold')">
        <template #body="{ data }">
          <span class="font-bold text-[#f97316]">{{ data.sold ?? 0 }}</span>
        </template>
      </Column>

      <Column field="amount" :header="t('live_order.label.sales_total')">
        <template #body="{ data }">
          <span class="text-[var(--p-text-color)]">${{ salesAmount(data).toLocaleString() }}</span>
        </template>
      </Column>


      <Column field="status" :header="t('live_order.table.column.checkout_status')">
        <template #body="{ data }">
          <Tag :value="statusMeta(data).label" :severity="statusMeta(data).severity" />
        </template>
      </Column>

      <Column :header="t('live_order.table.column.actions')">
        <template #body="{ data }">
          <!-- Design.md 7.5：Table 操作欄用 PrimeVue Button icon-only + tooltip -->
          <div class="flex items-center gap-1">
            <Button
              v-tooltip.top="t('live_order.tooltip.winner_list')"
              icon="pi pi-list"
              severity="secondary"
              variant="text"
              size="small"
              rounded
              @click="openWinnerList(data)"
            />
            <template v-if="!readonly && data.status !== 'done'">
              <Button
                v-tooltip.top="t('live_order.tab.order_setting')"
                severity="secondary"
                variant="text"
                size="small"
                rounded
                @click="openEdit(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'gear']" />
                </template>
              </Button>
              <Button
                v-if="data.status === 'live'"
                v-tooltip.top="t('live_order.tooltip.push')"
                severity="danger"
                variant="outlined"
                size="small"
                rounded
                @click="onPushClick(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'bullhorn']" />
                </template>
              </Button>
              <!-- 貼文/社團模式 + 收單中:暫停收單(secondary) + 結束收單(danger,走彙總彈窗) -->
              <template v-if="data.status === 'live' && !data.isGift">
                <Button
                  v-tooltip.top="t('live_order.tooltip.pause_ordering')"
                  icon="pi pi-pause"
                  severity="secondary"
                  variant="outlined"
                  size="small"
                  rounded
                  @click="onPauseOrdering(data)"
                />
                <Button
                  v-tooltip.top="t('live_order.tooltip.end_ordering')"
                  icon="pi pi-check"
                  severity="danger"
                  size="small"
                  rounded
                  @click="onEndOrdering(data)"
                />
              </template>
              <Button
                v-else
                :disabled="startBtnDisabled && data.status !== 'live'"
                v-tooltip.top="data.status === 'live'
                  ? (data.isGift ? t('live_order.tooltip.end_sending') : t('live_order.tooltip.stop_ordering'))
                  : (data.isGift ? t('live_order.tooltip.start_sending') : t('live_order.tooltip.start_ordering'))"
                :icon="data.status === 'live' ? 'pi pi-check' : 'pi pi-play'"
                :severity="data.status === 'live' ? 'danger' : 'primary'"
                size="small"
                rounded
                @click="toggleStatus(data)"
              />
              <!-- 收單中不可移除 → 必須先按「停止收單」回 ready 才開放 -->
              <Button
                v-tooltip.top="data.status === 'live' ? '請先停止收單再移除' : t('live_order.tooltip.delete')"
                :disabled="data.status === 'live'"
                severity="danger"
                variant="text"
                size="small"
                rounded
                @click="onDeleteClick(data, $event)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'trash']" />
                </template>
              </Button>
            </template>
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">
          {{ t('live_order.empty.no_product_content') }}
        </div>
      </template>
    </DataTable>
    </div>

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
