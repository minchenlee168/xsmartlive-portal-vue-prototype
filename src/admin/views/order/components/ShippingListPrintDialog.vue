<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 出貨單列印 Dialog（依規範第 4 節「出貨單列印格式」）。
 *
 * 結構：
 * - 「原始出貨單」在前：兩欄式訂單資訊 + 全部商品表 + 訂單金額
 * - 「本批出貨明細」附在後：只有物流 / 取號差異才顯示；商品表三欄（商品名稱/規格/數量）+ 本批出貨件數
 *
 * 列印範圍：
 * - 全部商品 → 原始出貨單 + 所有批次明細
 * - 批次 N → 原始出貨單 + 該批明細
 */

interface OrderLite {
  orderNo: string
  createdAt: string
  buyerName: string
  buyerPhone: string
  amount: number
  itemCount: number
  shippingMethod: string
  carrierName?: string
  trackingStatus?: string | null
  dispatchBatchCount?: number
  couponActivity?: string
  couponDiscount?: number
  pointsDiscount?: number
  cartTag: { label: string; bg: string; color: string }
}
interface Props {
  visible: boolean
  order: OrderLite | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

/** 商品明細:依 cartTag 對應到一組候選商品,再依 itemCount 拆成多列(prototype 展示用)。 */
interface ProductLine { name: string; spec: string; price: number; qty: number }
const PRODUCT_POOLS: Record<string, ProductLine[]> = {
  服飾專區: [
    { name: '韓版寬鬆連帽外套（米白）', spec: '尺寸 M / 米白色內裡',       price: 890, qty: 1 },
    { name: '純棉素色短 T（黑）',         spec: '尺寸 M / 100% 棉',            price: 590, qty: 1 },
    { name: '高腰寬管牛仔褲',             spec: '尺寸 27 / 淺藍水洗',          price: 780, qty: 1 },
    { name: '仿羊絨圍巾',                 spec: '駝色 / 180 × 40 cm',          price: 320, qty: 1 },
  ],
  生活雜貨: [
    { name: '北歐風玻璃保鮮盒 4 入',      spec: '含蓋 / 700ml × 4',           price: 480, qty: 1 },
    { name: '不鏽鋼保溫瓶 500ml',         spec: '霧面白 / 雙層真空',          price: 520, qty: 1 },
    { name: '無印風亞麻餐墊 2 入',        spec: '35 × 45 cm / 灰色',          price: 260, qty: 1 },
  ],
}
const products = computed<ProductLine[]>(() => {
  if (!props.order) return []
  const o = props.order
  const pool = PRODUCT_POOLS[o.cartTag.label] ?? [
    { name: '示意商品 A', spec: '預設規格', price: 500, qty: 1 },
    { name: '示意商品 B', spec: '預設規格', price: 300, qty: 1 },
  ]
  // 挑前 N 個 (N = min(itemCount, pool.length)),剩下的件數塞到最後一個當多入
  const lineCount = Math.min(o.itemCount, pool.length)
  const lines = pool.slice(0, lineCount).map((p) => ({ ...p }))
  const extra = o.itemCount - lineCount
  if (extra > 0 && lines.length > 0) lines[lines.length - 1].qty += extra
  return lines
})
const subtotal = computed(() => products.value.reduce((s, r) => s + r.price * r.qty, 0))
const shippingFee = 120
const couponDiscount = computed(() => props.order?.couponDiscount ?? 0)
const pointsDiscount = computed(() => props.order?.pointsDiscount ?? 0)
const total = computed(() => subtotal.value + shippingFee - couponDiscount.value - pointsDiscount.value)

/** 批次選項：全部商品 + 每個批次 */
const batchCount = computed(() => props.order?.dispatchBatchCount ?? 0)
const printScopeOptions = computed(() => {
  const opts = [{ label: '全部商品', value: 'all' }]
  for (let i = 1; i <= batchCount.value; i++) {
    opts.push({ label: `第 ${i} 批`, value: `batch_${i}` })
  }
  return opts
})
const printScope = ref<string>('all')

/** 批次 mock：dispatchBatchCount > 0 時，切訂購件數為多批（示意） */
interface BatchMock { index: number; itemQty: number; carrierDiff?: string; trackingDiff?: string }
const batchMocks = computed<BatchMock[]>(() => {
  const n = batchCount.value
  if (n === 0 || !props.order) return []
  const per = Math.max(1, Math.floor(props.order.itemCount / n))
  const rem = props.order.itemCount - per * (n - 1)
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    itemQty: i === n - 1 ? rem : per,
  }))
})
/** 依選擇的 scope 決定要印哪幾個批次 */
const printedBatches = computed<BatchMock[]>(() => {
  if (printScope.value === 'all') return batchMocks.value
  const m = printScope.value.match(/^batch_(\d+)$/)
  if (!m) return []
  const idx = Number(m[1])
  return batchMocks.value.filter(b => b.index === idx)
})

function doPrint(): void {
  // 用瀏覽器 print — CSS @media print 隱藏非列印區塊（style.css 需一併加規則）
  window.print()
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(860px, calc(100vw - 32px))' }"
    :pt="{
      content: { style: 'padding: 0' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-center gap-2 print:hidden">
        <i class="pi pi-print text-[var(--p-text-color)]" style="font-size: 16px"></i>
        <span class="text-base font-bold text-[var(--p-text-color)]">
          出貨單預覽<span v-if="order"> — {{ order.orderNo }}</span>
        </span>
        <!-- 批次時可切換範圍;無批次時單顯示「全部商品」tag -->
        <template v-if="batchCount > 0">
          <SelectButton
            v-model="printScope"
            :options="printScopeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
          />
        </template>
        <Tag v-else value="全部商品" severity="info" />
      </div>
    </template>

    <!-- 出貨單內容(列印時只印這一區) -->
    <div v-if="order" class="shipping-print-area">
      <section class="p-5 flex flex-col gap-4">
        <!-- 區塊標題 -->
        <div class="flex items-center gap-2 pb-3 border-b border-[var(--p-content-border-color)]">
          <i class="pi pi-file text-[var(--p-text-muted-color)]" style="font-size: 14px"></i>
          <span class="font-bold text-[var(--p-text-color)]">出貨單 · 原始訂單</span>
        </div>

        <!-- 兩欄式訂單資訊 -->
        <div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">訂單編號：</span><span class="text-[var(--p-text-color)] font-medium">{{ order.orderNo }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">訂單日期：</span><span class="text-[var(--p-text-color)]">{{ order.createdAt }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">客戶姓名：</span><span class="text-[var(--p-text-color)]">{{ order.buyerName }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">收件人：</span><span class="text-[var(--p-text-color)]">{{ order.buyerName }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">聯絡電話：</span><span class="text-[var(--p-text-color)]">{{ order.buyerPhone }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">E-mail：</span><span class="text-[var(--p-text-color)]">{{ order.buyerName === '周庭安' ? 'zhou.ta@example.com' : 'customer@example.com' }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">物流商：</span><span class="text-[var(--p-text-color)]">{{ order.carrierName ?? '—' }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">送貨方式：</span><span class="text-[var(--p-text-color)]">{{ order.shippingMethod }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">物流取號：</span><span class="text-[var(--p-text-color)]">{{ order.trackingStatus ?? '尚未取號' }}</span></div>
          <div class="flex gap-1"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">支付方式：</span><span class="text-[var(--p-text-color)]">信用卡一次付清（已付款）</span></div>
          <div class="flex gap-1 col-span-2"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">出貨地址：</span><span class="text-[var(--p-text-color)]">台北市大安區敦化南路二段100號</span></div>
          <div class="flex gap-1 col-span-2"><span class="text-[var(--p-text-muted-color)] w-[76px] shrink-0 text-right">用戶備註：</span><span class="text-[var(--p-text-color)]">—</span></div>
        </div>

        <!-- 商品表:PrimeVue DataTable + show-gridlines,自然帶入 Aura 格線 -->
        <DataTable :value="products" show-gridlines data-key="name" size="small">
          <Column field="name" header="商品名稱" />
          <Column field="spec" header="規格" />
          <Column header="單價" header-class="text-right" body-class="text-right" style="width: 100px">
            <template #body="{ data }">${{ data.price.toLocaleString() }}</template>
          </Column>
          <Column field="qty" header="數量" header-class="text-right" body-class="text-right" style="width: 80px" />
          <Column header="小計" header-class="text-right" body-class="text-right" style="width: 120px">
            <template #body="{ data }">${{ (data.price * data.qty).toLocaleString() }}</template>
          </Column>
        </DataTable>

        <!-- 訂單共 N 件(連結色) -->
        <div class="text-right text-xs text-[#2563EB]">訂單共 {{ order.itemCount }} 件</div>

        <!-- 訂單金額 -->
        <div class="flex justify-end">
          <div class="flex flex-col gap-2 text-sm min-w-[240px]">
            <div class="flex items-center justify-between">
              <span class="text-[var(--p-text-color)]">商品總額</span>
              <span class="text-[var(--p-text-color)]">${{ subtotal.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[var(--p-text-color)]">運費</span>
              <span class="text-[var(--p-text-color)]">${{ shippingFee }}</span>
            </div>
            <div v-if="couponDiscount > 0" class="flex items-center justify-between">
              <span class="text-[var(--p-text-color)]">優惠券</span>
              <span class="text-[var(--p-text-color)]">-${{ couponDiscount.toLocaleString() }}</span>
            </div>
            <div v-if="pointsDiscount > 0" class="flex items-center justify-between">
              <span class="text-[var(--p-text-color)]">紅利折抵</span>
              <span class="text-[var(--p-text-color)]">-${{ pointsDiscount.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-[var(--p-content-border-color)]">
              <span class="text-lg font-bold text-[var(--p-text-color)]">訂單總計</span>
              <span class="text-lg font-bold text-[var(--p-primary-color)]">${{ total.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── 本批出貨明細(有批次時另附) ─── -->
      <section
        v-for="b in printedBatches"
        :key="b.index"
        class="p-5 border-t border-dashed border-[var(--p-content-border-color)] flex flex-col gap-3"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-[var(--p-text-color)]">本批出貨明細 — 第 {{ b.index }} 批</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">本批出貨件數：<span class="font-bold text-[var(--p-text-color)]">{{ b.itemQty }} 件</span></span>
        </div>
        <div class="text-sm text-[var(--p-text-color)]">收件資訊：同原始出貨單</div>
        <DataTable :value="products" show-gridlines data-key="name" size="small">
          <Column field="name" header="商品名稱" />
          <Column field="spec" header="規格" />
          <Column header="數量" header-class="text-right" body-class="text-right" style="width: 100px">
            <template #body>{{ b.itemQty }}</template>
          </Column>
        </DataTable>
      </section>
    </div>

    <template #footer>
      <div class="print:hidden flex items-center justify-end">
        <Button label="列印" icon="pi pi-print" @click="doPrint" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* 列印時只顯示出貨單內容，隱藏 Dialog header / footer / SelectButton */
@media print {
  .print\:hidden {
    display: none !important;
  }
}
</style>
