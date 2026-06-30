<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="true"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 18px 20px' },
      content: { style: 'padding: 0' },
      footer: { style: 'padding: 16px 20px' },
    }"
    @update:visible="onVisibleChange"
  >
    <template #header>
      <div class="flex items-baseline gap-2">
        <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
          {{ t('live_order.dialog.order_detail_header') }}
        </span>
        <span class="text-[14px] text-[var(--p-text-muted-color)]">#{{ detail.orderNo }}</span>
      </div>
    </template>

    <!-- 商品明細區 -->
    <section class="px-5 pt-2">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[14px] font-semibold text-[var(--p-text-color)]">
          {{ t('live_order.label.product_detail') }}
        </span>
        <span class="text-[12px] text-[var(--p-text-muted-color)]">
          {{ t('live_order.label.total_items', { count: detail.totalCount }) }}
        </span>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="(item, i) in detail.items"
          :key="item.id ?? i"
          class="flex items-start gap-3"
        >
          <!-- 圖片 + index 角標 -->
          <div class="relative w-[44px] h-[44px] rounded-[10px] bg-[var(--p-primary-50)] flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="['far', 'bag-shopping']" class="text-[var(--p-primary-color)] text-[18px]" />
            <span class="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--p-primary-color)] text-white text-[10px] font-bold flex items-center justify-center">
              {{ i + 1 }}
            </span>
          </div>
          <!-- 名稱 + 規格 + 價數量 -->
          <div class="flex-1 min-w-0 flex justify-between gap-3">
            <div class="min-w-0 flex flex-col">
              <span class="text-[14px] font-medium text-[var(--p-text-color)] truncate">{{ item.name }}</span>
              <span v-if="item.spec" class="text-[12px] text-[var(--p-text-muted-color)] truncate">{{ item.spec }}</span>
            </div>
            <div class="flex flex-col items-end shrink-0">
              <span class="text-[14px] font-bold text-[var(--p-text-color)]">
                {{ t('live_order.label.currency_ntd') }} {{ item.subtotal.toLocaleString() }}
              </span>
              <span class="text-[12px] text-[var(--p-text-muted-color)]">
                {{ item.unitPrice.toLocaleString() }} × {{ item.qty }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 訂單金額 highlight row -->
    <div class="mx-5 my-4 px-3 py-2.5 rounded-[8px] bg-[var(--p-primary-50)] flex items-center justify-between">
      <span class="text-[14px] font-semibold text-[var(--p-text-color)]">
        {{ t('live_order.label.order_amount') }}
      </span>
      <span class="text-[20px] font-bold text-[var(--p-primary-color)]">
        {{ t('live_order.label.currency_ntd') }} {{ detail.totalAmount.toLocaleString() }}
      </span>
    </div>

    <Divider class="!m-0" />

    <!-- 留言內容 -->
    <section class="px-5 py-4">
      <div class="text-[14px] font-semibold text-[var(--p-text-color)] mb-3">
        {{ t('live_order.label.comment_content') }}
      </div>
      <div class="flex items-start gap-2">
        <FontAwesomeIcon :icon="['far', 'comment']" class="text-[var(--p-text-muted-color)] text-[14px] mt-0.5" />
        <span class="text-[14px] text-[var(--p-text-color)] break-words leading-relaxed">
          {{ detail.keyword || '—' }}
        </span>
      </div>
    </section>

  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface LiveComment {
  id?: number | string
  user?: string
  text?: string
  time?: string
  tagType?: string
  platform?: string
  [key: string]: unknown
}

interface PlatformMeta {
  platformIcon: [string, string]
  platformColor: string
}

/** 由 LiveCommentCard 算好餵進來的訂單明細項；對應留言匹配 (orderMatch) 或追加訂單 (manualOrder) */
export interface DetailItemInput {
  name: string
  spec: string
  qty: number
  unitPrice: number
  /** 該項是否為禮物商品；任一項為 true → 結帳狀態顯示「無需結帳」 */
  isGift?: boolean
}

interface Props {
  visible?: boolean
  comment: LiveComment
  /** 由父層算好的訂單項；orderMatch 一筆、追加訂單多筆。沒項目 → 顯示 mock fallback */
  items?: DetailItemInput[]
  /** 保留以相容呼叫端；本卡片不再顯示平台圖示 */
  platformMeta?: PlatformMeta
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  items: () => [],
  platformMeta: undefined,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  remove: []
}>()

function onVisibleChange(v: boolean): void { emit('update:visible', v) }

// 內部列項型別：在 DetailItemInput 之上加 id / subtotal（v-for / 顯示用）
interface DetailItem {
  id: number
  name: string
  spec: string
  qty: number
  unitPrice: number
  subtotal: number
  isGift: boolean
}

const MOCK_PRODUCTS = [
  { name: '經典白色T恤（直播卡）', spec: '白色T恤 · 白色 / S', unit: 1290 },
  { name: '日系棉麻襯衫',           spec: '卡其 / M',            unit: 980 },
  { name: '機能防風外套',           spec: '黑色 / L',            unit: 1480 },
  { name: '韓版針織毛衣',           spec: '米白 / F',            unit: 880 },
  { name: '純棉圓領上衣',           spec: '深藍 / XL',           unit: 690 },
]

const detail = computed(() => {
  const c = props.comment
  const idNum = typeof c.id === 'number' ? c.id : Number(c.id) || 0
  const seedSource = `${c.id ?? ''}${c.text ?? ''}` || 'x'
  const seed = seedSource.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)

  let items: DetailItem[]
  if (props.items.length > 0) {
    // 由父層餵入：忠實對應留言匹配（含 spec、spec.price）或追加訂單
    items = props.items.map((it, i) => ({
      id: (idNum || seed) + i,
      name: it.name,
      spec: it.spec,
      qty: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.qty,
      isGift: !!it.isGift,
    }))
  } else {
    // 完全找不到對應 → 用 mock 一筆避免空白
    const fallback = MOCK_PRODUCTS[seed % MOCK_PRODUCTS.length]
    items = [{
      id: idNum || seed,
      name: fallback.name,
      spec: fallback.spec,
      qty: 1,
      unitPrice: fallback.unit,
      subtotal: fallback.unit,
      isGift: false,
    }]
  }

  const totalCount = items.reduce((sum, it) => sum + it.qty, 0)
  const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0)
  // 整單若所有項皆為禮物（且至少 1 項）→ 結帳狀態顯示「無需結帳」
  const isGiftOrder = items.length > 0 && items.every((it) => it.isGift)
  const user = c.user ?? ''

  return {
    orderNo: `A${String(idNum || (seed % 999) + 1).padStart(3, '0')}`,
    items,
    totalCount,
    totalAmount,
    isGiftOrder,
    keyword: c.text ?? '',
    memberName: user,
    initial: user.trim().charAt(0).toUpperCase() || '?',
    isVip: c.tagType === 'vip',
    createdAt: c.time ?? '',
    daysAgo: daysAgoFrom(c.time),
  }
})

function daysAgoFrom(time?: string): number | null {
  if (!time) return null
  const then = new Date(time.replace(' ', 'T')).getTime()
  if (Number.isNaN(then)) return null
  const diff = Math.floor((Date.now() - then) / 86_400_000)
  return diff >= 0 ? diff : null
}
</script>
