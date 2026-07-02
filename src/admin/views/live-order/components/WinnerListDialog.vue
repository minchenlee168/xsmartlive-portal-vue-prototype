<template>
  <Dialog
    v-model:visible="innerVisible"
    modal :draggable="false"
    :style="{ width: 'min(1100px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="v => emit('update:visible', v)">

    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size:17.5px">{{ t('live_order.dialog.winner_list_header') }}</span>
    </template>

    <div class="flex flex-col gap-4">
      <DataTable
        :value="visibleOrders"
        :striped-rows="true"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
        current-page-report-template="第 {first}-{last} 筆，共 {totalRecords} 筆"
        class="w-full"
        :pt="{
          column: {
            headerCell: { style: 'white-space: nowrap;' },
          },
        }"
      >
        <Column field="orderNo" :header="t('live_order.table.column.order_no')">
          <template #body="{ data }"><span class="text-base text-[var(--p-text-color)]">{{ data.orderNo }}</span></template>
        </Column>
        <Column field="member" :header="t('live_order.table.column.member')">
          <template #body="{ data }"><span class="text-base text-[var(--p-text-color)]">{{ data.member }}</span></template>
        </Column>
        <Column field="spec" :header="t('live_order.table.column.product_spec')">
          <template #body="{ data }"><span class="text-base text-[var(--p-text-color)]">{{ data.spec }}</span></template>
        </Column>
        <Column field="qty" :header="t('live_order.table.column.qty')">
          <template #body="{ data }"><span class="text-base text-[var(--p-text-color)]">{{ data.qty }}</span></template>
        </Column>
        <Column field="paid" :header="t('live_order.table.column.checkout_status')">
          <template #body="{ data }">
            <span
              class="inline-flex items-center px-[7px] py-[3.5px] rounded-xl text-xs font-bold leading-none"
              :class="data.paid ? 'checkout-paid' : 'checkout-unpaid'">
              {{ data.paid ? t('live_order.table.value.checkout_paid') : t('live_order.table.value.checkout_unpaid') }}
            </span>
          </template>
        </Column>
        <Column field="createdAt" :header="t('live_order.table.column.created_at')">
          <template #body="{ data }"><span class="text-base text-[var(--p-text-color)]">{{ data.createdAt }}</span></template>
        </Column>
        <Column :header="t('live_order.table.column.actions')">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <button
                v-tooltip.top="t('live_order.tooltip.order_detail')"
                class="w-[32px] h-[32px] rounded-md flex items-center justify-center text-[var(--p-primary-color)] hover:bg-[var(--p-primary-50)]"
                @click="openDetail(data)"
              >
                <i class="pi pi-search" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="t('live_order.button.remove_order')"
                class="w-[32px] h-[32px] rounded-md flex items-center justify-center text-[#ef4444] hover:bg-[#fee2e2]"
                @click="removeOrder(data.orderNo)"
              >
                <FontAwesomeIcon :icon="['far', 'trash']" class="text-sm" />
              </button>
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="py-6 text-center text-base text-[var(--p-text-muted-color)]">{{ t('live_order.empty.no_order') }}</div>
        </template>
      </DataTable>

      <div class="flex justify-end items-center">
        <span class="text-sm text-[var(--p-text-color)] leading-[21px]">{{ t('live_order.label.subtotal') }}</span>
        <span class="text-base font-medium text-[var(--p-text-color)]">：</span>
        <span class="text-sm font-bold text-[#f97316]">${{ subtotal.toLocaleString() }}</span>
      </div>
    </div>

    <!-- 訂單明細 Dialog：點得標清單列「訂單明細」開啟 -->
    <OrderDetailDialog
      v-model:visible="detailVisible"
      :comment="detailComment"
      :items="detailItems"
      @remove="removeOrder(detailOrder?.orderNo)"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OrderDetailDialog from './OrderDetailDialog.vue'
import { getWinnersByProduct, removeWinnerByOrderNo } from '../utils/liveWinners'
import { commentTemplates } from '../utils/liveComments'

const { t } = useI18n()

interface ProductSpec {
  name?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface ProductLike {
  id?: number
  name?: string
  sku?: string
  price?: number
  isGift?: boolean
  specs?: ProductSpec[]
  selectedSpecs?: ProductSpec[]
  [key: string]: unknown
}

interface WinnerOrder {
  orderNo: string
  member: string
  spec: string
  qty: number
  paid: boolean
  createdAt: string
  /** 對應的規格名（解析自 spec 字串），給訂單明細彈窗用 */
  specName: string
  /** 來源留言文字 — 訂單明細彈窗顯示用 */
  commentText?: string
  /** 商品名稱（給訂單明細） */
  productName?: string
  /** 單價（給訂單明細） */
  unitPrice?: number
  /** 是否禮物 */
  isGift?: boolean
}

interface Props {
  visible?: boolean
  product?: ProductLike
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  product: () => ({}),
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const innerVisible = ref(props.visible)
/** 解除訂單記在這個 set；visibleOrders 會過濾掉。每次打開 dialog 重置。 */
const removedOrderNos = ref<Set<string>>(new Set())

watch(() => props.visible, v => {
  innerVisible.value = v
  if (v) removedOrderNos.value = new Set()
})

/**
 * 得標清單優先列真實留言 winners;若該商品有 sold > 0 但 store 內無 winner
 * (例:mock 進來的 collection 或直接手動加 sold),依 sold 數量從留言範本生成
 * mock winners,讓有得標紀錄的商品點進來至少能看到對應數量的名單。
 */
const liveWinners = computed(() => {
  const productId = props.product.id
  if (typeof productId !== 'number') return []
  const list = getWinnersByProduct(productId).value
  const productName = props.product.name || t('live_order.table.value.unnamed_product')
  if (list.length > 0) {
    return list.map<WinnerOrder>(w => ({
      orderNo: w.orderNo,
      member: w.member,
      spec: w.specName ? `${productName} / ${w.specName}` : productName,
      specName: w.specName ?? '',
      qty: w.qty,
      paid: w.paid,
      createdAt: w.createdAt,
      commentText: w.commentText,
      unitPrice: w.unitPrice,
      isGift: w.isGift,
      productName: w.productName ?? productName,
    }))
  }
  const sold = Number(props.product.sold ?? 0)
  if (sold <= 0) return []
  const memberPool = commentTemplates
    .filter((c) => c.tagType !== 'official' && c.tagType !== 'blacklist')
    .map((c) => c.user)
  const price = Number(props.product.price ?? 0)
  return Array.from({ length: sold }, (_, i) => {
    const member = memberPool[i % memberPool.length] ?? `會員${i + 1}`
    return {
      orderNo: `M-${productId}-${String(i + 1).padStart(3, '0')}`,
      member,
      spec: productName,
      specName: '',
      qty: 1,
      paid: i % 3 !== 0,
      createdAt: '',
      commentText: '',
      unitPrice: price,
      isGift: false,
      productName,
    } satisfies WinnerOrder
  })
})

const visibleOrders = computed(() =>
  liveWinners.value.filter(o => !removedOrderNos.value.has(o.orderNo)),
)

const subtotal = computed(() => {
  const price = props.product.price ?? 0
  return visibleOrders.value.reduce((sum, o) => sum + price * o.qty, 0)
})

// 訂單明細彈窗：留言原文（commentText）+ 該筆得標 item，內容取自留言卡同步過來的真實資料
const detailVisible = ref(false)
const detailOrder = ref<WinnerOrder | null>(null)
const detailComment = computed(() => {
  const o = detailOrder.value
  return {
    id: o?.orderNo ?? '',
    user: o?.member ?? '',
    text: o?.commentText ?? o?.spec ?? '',
    time: o?.createdAt ?? '',
  }
})
const detailItems = computed(() => {
  const o = detailOrder.value
  if (!o) return []
  return [{
    name: o.productName ?? props.product.name ?? '',
    spec: o.specName,
    qty: o.qty,
    unitPrice: o.unitPrice ?? props.product.price ?? 0,
    isGift: !!o.isGift,
  }]
})
function openDetail(order: WinnerOrder): void {
  detailOrder.value = order
  detailVisible.value = true
}
function removeOrder(orderNo?: string): void {
  if (!orderNo) return
  removedOrderNos.value = new Set([...removedOrderNos.value, orderNo])
  // 若是來自留言卡 store 的真實 winner，也從 store 移除
  removeWinnerByOrderNo(orderNo)
}
</script>

<!-- 結帳狀態為功能色（已結帳=綠 / 未結帳=琥珀），依 style-class-rule §4.2 例外保留寫死 -->
<style scoped>
.checkout-paid {
  @apply bg-[#dcfce7] text-[#16a34a];
}
.checkout-unpaid {
  @apply bg-[#fef3c7] text-[#d97706];
}
</style>
