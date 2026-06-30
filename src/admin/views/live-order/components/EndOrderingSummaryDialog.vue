<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 結束收單彙總彈窗：列出當前場次每筆商品的銷售總結（含規格 sub-table），
 * 允許勾選單品免運；按「儲存」會 emit submit，父層把 payload 寫進收單紀錄。
 */

interface ProductSpecInput {
  id?: number
  name?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface ProductInput {
  id: number
  name?: string
  keyword?: string
  price?: number
  stock?: number
  sold?: number
  selectedSpecs?: ProductSpecInput[]
  specs?: ProductSpecInput[]
  [key: string]: unknown
}

export interface SpecSummary {
  name: string
  stock: number
  winnerCount: number
  sold: number
  total: number
}

export interface ProductSummary {
  id: number
  name: string
  keyword?: string
  price: number
  winnerCount: number
  sold: number
  total: number
  freeShipping: boolean
  specs: SpecSummary[]
}

export interface EndOrderingPayload {
  sessionName: string
  products: ProductSummary[]
  totalAmount: number
  /** 結束收單後是否要把商品上架到「加購區」 */
  publishToAddOn: boolean
  /** 加購區下架日期；null 代表不自動下架 */
  unlistDate: Date | null
}

interface Props {
  visible?: boolean
  sessionName: string
  products: ProductInput[]
  /** 'live' → 場次相關文案；'post' → 貼文相關文案。 */
  mode?: 'live' | 'post'
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  mode: 'live',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: EndOrderingPayload]
}>()

const { t } = useI18n()

/** 已勾選免運的商品 id。Dialog 每次重開時重置。 */
const freeShippingIds = ref<Set<number>>(new Set())
/** 上架加購區開關 + 下架日期。Dialog 每次重開時重置。 */
const publishToAddOn = ref(false)
const unlistDate = ref<Date | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    freeShippingIds.value = new Set()
    publishToAddOn.value = false
    unlistDate.value = null
  }
})

/** 把 ProductInput 攤平成 ProductSummary：以 spec 為 sub-row；無 spec 視為單筆。 */
function buildSpecs(p: ProductInput): SpecSummary[] {
  const specs = (p.selectedSpecs?.length ? p.selectedSpecs : p.specs) ?? []
  if (specs.length === 0) {
    const sold = p.sold ?? 0
    return [{
      name: t('live_order.label.no_spec'),
      stock: p.stock ?? 0,
      winnerCount: sold,
      sold,
      total: (p.price ?? 0) * sold,
    }]
  }
  return specs.map((s) => {
    const sold = s.sold ?? 0
    return {
      name: s.name ?? '',
      stock: s.stock ?? 0,
      winnerCount: sold,
      sold,
      total: (s.price ?? p.price ?? 0) * sold,
    }
  })
}

const summaries = computed<ProductSummary[]>(() => props.products.map((p) => {
  const specs = buildSpecs(p)
  const sold = p.sold ?? specs.reduce((sum, s) => sum + s.sold, 0)
  const total = specs.reduce((sum, s) => sum + s.total, 0) || (p.price ?? 0) * sold
  return {
    id: p.id,
    name: p.name ?? '',
    keyword: p.keyword,
    price: p.price ?? 0,
    winnerCount: sold,
    sold,
    total,
    freeShipping: freeShippingIds.value.has(p.id),
    specs,
  }
}))

const grandTotal = computed(() => summaries.value.reduce((sum, p) => sum + p.total, 0))

function toggleFreeShipping(id: number): void {
  const next = new Set(freeShippingIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  freeShippingIds.value = next
}

function close(): void { emit('update:visible', false) }

function onSave(): void {
  emit('submit', {
    sessionName: props.sessionName,
    products: summaries.value,
    totalAmount: grandTotal.value,
    publishToAddOn: publishToAddOn.value,
    unlistDate: unlistDate.value,
  })
  close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(880px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 12px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-baseline gap-2">
        <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
          {{ t('live_order.dialog.end_ordering_summary_header') }}
        </span>
        <span class="text-[13px] text-[var(--p-text-muted-color)]">{{ sessionName }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-4 pt-1">

      <!-- 每筆商品 section -->
      <section
        v-for="p in summaries"
        :key="p.id"
        class="rounded-[8px] border border-[var(--p-content-border-color)] overflow-hidden"
      >
        <!-- 商品 header：名稱 + 主要指標 -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--p-content-hover-background)] border-b border-[var(--p-content-border-color)]">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-bold text-[15px] text-[var(--p-text-color)] truncate">{{ p.name }}</span>
            <span
              v-if="p.keyword"
              class="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded-full leading-none shrink-0"
            >
              {{ p.keyword }}
            </span>
          </div>
          <div class="flex items-center gap-5 shrink-0 text-[13px]">
            <span class="text-[var(--p-text-muted-color)]">
              {{ t('live_order.label.price') }}
              <span class="text-[var(--p-primary-color)] font-bold ml-1">${{ p.price.toLocaleString() }}</span>
            </span>
            <span class="text-[var(--p-text-muted-color)]">
              {{ t('live_order.summary.winner_count') }}
              <span class="text-[var(--p-text-color)] font-bold ml-1">{{ p.winnerCount }}</span>
            </span>
            <span class="text-[var(--p-text-muted-color)]">
              {{ t('live_order.summary.sold_count') }}
              <span class="text-[#f97316] font-bold ml-1">{{ p.sold }}</span>
            </span>
            <span class="text-[var(--p-text-muted-color)]">
              {{ t('live_order.summary.product_total') }}
              <span class="text-[var(--p-primary-color)] font-bold ml-1">${{ p.total.toLocaleString() }}</span>
            </span>
          </div>
        </div>

        <!-- 規格 sub-table -->
        <table class="w-full border-collapse">
          <thead>
            <tr class="text-[12.5px] text-[var(--p-text-muted-color)] bg-[var(--p-content-background)]">
              <th class="text-left font-medium px-4 py-2 border-b border-[var(--p-content-border-color)] w-[30%]">{{ t('live_order.label.spec_name') }}</th>
              <th class="text-right font-medium px-4 py-2 border-b border-[var(--p-content-border-color)]">{{ t('live_order.label.stock') }}</th>
              <th class="text-right font-medium px-4 py-2 border-b border-[var(--p-content-border-color)]">{{ t('live_order.summary.winner_count') }}</th>
              <th class="text-right font-medium px-4 py-2 border-b border-[var(--p-content-border-color)]">{{ t('live_order.summary.sold_count') }}</th>
              <th class="text-right font-medium px-4 py-2 border-b border-[var(--p-content-border-color)]">{{ t('live_order.summary.spec_total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(s, si) in p.specs"
              :key="si"
              class="text-[13px] text-[var(--p-text-color)]"
            >
              <td class="px-4 py-2 border-b border-[var(--p-content-border-color)]">{{ s.name }}</td>
              <td class="px-4 py-2 text-right border-b border-[var(--p-content-border-color)]">{{ s.stock }}</td>
              <td class="px-4 py-2 text-right border-b border-[var(--p-content-border-color)]">{{ s.winnerCount }}</td>
              <td class="px-4 py-2 text-right border-b border-[var(--p-content-border-color)] font-medium text-[#f97316]">{{ s.sold }}</td>
              <td class="px-4 py-2 text-right border-b border-[var(--p-content-border-color)] font-medium">${{ s.total.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 單品免運 checkbox -->
        <div class="flex items-center gap-2 px-4 py-3">
          <Checkbox
            :model-value="freeShippingIds.has(p.id)"
            binary
            :input-id="`fs-${p.id}`"
            @change="toggleFreeShipping(p.id)"
          />
          <label :for="`fs-${p.id}`" class="text-[13px] text-[var(--p-text-color)] cursor-pointer">
            {{ t('live_order.summary.free_shipping') }}
          </label>
          <span class="text-[11.5px] text-[var(--p-text-muted-color)]">
            ※ {{ t('live_order.summary.free_shipping_note') }}
          </span>
        </div>
      </section>

      <!-- 上架加購區設定 -->
      <section class="rounded-[8px] border border-[var(--p-content-border-color)] overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <div class="flex flex-col gap-1">
            <span class="text-[14px] font-medium text-[var(--p-text-color)]">上架加購區</span>
            <span class="text-[12px] text-[var(--p-text-muted-color)]">結束收單後，把這批商品丟到購物車加購區，提升客單價</span>
          </div>
          <ToggleSwitch v-model="publishToAddOn" />
        </div>
        <!-- 下架日期：與上架加購區獨立設定，可單獨填寫 -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--p-content-border-color)]">
          <div class="flex flex-col gap-1">
            <span class="text-[14px] font-medium text-[var(--p-text-color)]">下架日期</span>
            <span class="text-[12px] font-medium" style="color: #ef4444">※ 未填寫將自動延展 7 天</span>
          </div>
          <DatePicker
            v-model="unlistDate"
            show-icon
            date-format="yy/mm/dd"
            placeholder="年 / 月 / 日"
            class="!w-[200px]"
          />
        </div>
      </section>

      <!-- 場次 / 貼文 總計 -->
      <div class="flex items-center justify-end gap-2 px-2 py-1">
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ mode === 'post'
            ? t('live_order.summary.post_total')
            : t('live_order.summary.grand_total') }}
        </span>
        <span class="text-[20px] font-bold text-[var(--p-primary-color)]">
          ${{ grandTotal.toLocaleString() }}
        </span>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <Button :label="t('live_order.button.cancel')" severity="secondary" outlined @click="close" />
        <Button :label="t('live_order.button.save')" icon="pi pi-save" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>
