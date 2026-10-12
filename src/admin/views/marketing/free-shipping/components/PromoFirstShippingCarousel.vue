<script setup lang="ts">
import orderImageUrl from '@/admin/assets/images/order.png'
import packImageUrl from '@/admin/assets/images/pack.png'
import { computed, ref } from 'vue'

/**
 * 「首購後免運」示意輪播：以 Carousel 逐張演示「第一筆收運費、之後免運、合併一次寄」。
 * 版面＝上方檔期進度條（四段里程碑隨頁次點亮）＋中段兩區塊（進來的訂單條列／系統分好的包裹）＋下方統計。
 * 純展示，資料與金額均為示意。
 */
const FEE = 60
const DATE_RANGE = '10/1～10/14'

const CHECKPOINTS: { slideIndex: number; dateLabel: string; titleKey: string }[] = [
  { slideIndex: 1, dateLabel: '10/1', titleKey: 'free_shipping.free_type_info.promo_demo.timeline.checkpoint.first' },
  { slideIndex: 2, dateLabel: '10/6', titleKey: 'free_shipping.free_type_info.promo_demo.timeline.checkpoint.second' },
  { slideIndex: 3, dateLabel: '10/11', titleKey: 'free_shipping.free_type_info.promo_demo.timeline.checkpoint.third' },
  { slideIndex: 4, dateLabel: '10/15', titleKey: 'free_shipping.free_type_info.promo_demo.timeline.checkpoint.ship' },
]

const ITEM_JACKET = 'free_shipping.free_type_info.promo_demo.item.jacket'
const ITEM_SNACK = 'free_shipping.free_type_info.promo_demo.item.snack'
const ITEM_SCARF = 'free_shipping.free_type_info.promo_demo.item.scarf'

const ORDERS: { n: number; itemKey: string; feeValue: string; isFirst: boolean }[] = [
  { n: 1, itemKey: ITEM_JACKET, feeValue: `$${FEE}`, isFirst: true },
  { n: 2, itemKey: ITEM_SNACK, feeValue: '$0', isFirst: false },
  { n: 3, itemKey: ITEM_SCARF, feeValue: '$0', isFirst: false },
]

function ordersUpTo(count: number) {
  return ORDERS.slice(0, count)
}

interface Slide {
  orderCount: number
  isShipped: boolean
  isCancelled?: boolean
  packageCount: number
  feeCharged: number
  captionKey: string
}

const SLIDES: readonly Slide[] = [
  { orderCount: 0, isShipped: false, packageCount: 0, feeCharged: 0, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s0' },
  { orderCount: 1, isShipped: false, packageCount: 1, feeCharged: FEE, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s1' },
  { orderCount: 2, isShipped: false, packageCount: 1, feeCharged: FEE, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s2' },
  { orderCount: 3, isShipped: false, packageCount: 1, feeCharged: FEE, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s3' },
  { orderCount: 3, isShipped: true, packageCount: 1, feeCharged: FEE, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s4' },
  { orderCount: 3, isShipped: false, isCancelled: true, packageCount: 1, feeCharged: FEE, captionKey: 'free_shipping.free_type_info.promo_demo.caption.s5' },
]

const page = ref(0)

const fillPercent = computed(
  () => (CHECKPOINTS.filter((checkpoint) => page.value >= checkpoint.slideIndex).length / CHECKPOINTS.length) * 100,
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 檔期進度條：上方日期、條內四段里程碑，隨 Carousel 推進逐段點亮 -->
    <div aria-hidden="true">
      <span class="text-xs font-medium text-primary">
        {{ $t('free_shipping.free_type_info.promo_demo.timeline.band', { range: DATE_RANGE }) }}
      </span>
      <div class="mt-2 flex">
        <span
          v-for="checkpoint in CHECKPOINTS"
          :key="checkpoint.titleKey"
          class="flex-1 text-center text-xs tabular-nums transition-colors"
          :class="page >= checkpoint.slideIndex ? 'font-medium text-color' : 'text-muted-color'"
        >{{ checkpoint.dateLabel }}</span>
      </div>
      <div class="relative mt-1 h-7 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
        <div
          class="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500"
          :style="{ width: `${fillPercent}%` }"
        />
        <div class="relative flex h-full">
          <div
            v-for="checkpoint in CHECKPOINTS"
            :key="checkpoint.titleKey"
            class="flex flex-1 items-center justify-center text-xs font-medium transition-colors"
            :class="page >= checkpoint.slideIndex ? 'text-white' : 'text-color'"
          >
            {{ $t(checkpoint.titleKey) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 逐張場景：左進來的訂單、右系統分好的包裹，下方統計 -->
    <Carousel
      v-model:page="page"
      :value="SLIDES"
      :num-visible="1"
      :num-scroll="1"
    >
      <template #item="{ data }">
        <div class="flex flex-col gap-4 px-2">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- 進來的訂單 -->
            <div class="flex flex-col items-center gap-3 rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 px-4 py-5 text-center dark:bg-surface-900">
              <div class="flex items-center justify-center gap-2">
                <p class="text-xs tracking-wide text-muted-color">
                  {{ $t('free_shipping.free_type_info.promo_demo.block.orders') }}
                </p>
                <span
                  v-if="data.orderCount > 0"
                  class="rounded-full bg-[color-mix(in_srgb,var(--p-primary-color)_18%,transparent)] px-2 py-0.5 text-xs font-bold text-primary"
                >{{ data.orderCount }}</span>
              </div>
              <img
                :src="orderImageUrl"
                :alt="$t('free_shipping.free_type_info.promo_demo.block.orders')"
                class="size-20 object-contain"
                :class="{ 'opacity-40': data.orderCount === 0 }"
              >
              <div
                v-if="data.orderCount > 0"
                class="flex w-full flex-col gap-2"
              >
                <span
                  v-for="order in ordersUpTo(data.orderCount)"
                  :key="order.n"
                  class="rounded-md px-2.5 py-1 text-xs"
                  :class="(data.isCancelled && order.isFirst)
                    ? 'bg-surface-100 text-muted-color line-through dark:bg-surface-800'
                    : order.isFirst
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'"
                >{{ $t('free_shipping.free_type_info.promo_demo.orders.list_item', {
                  order: order.n,
                  item: $t(order.itemKey),
                  fee: $t('free_shipping.free_type_info.promo_demo.orders.fee', { value: order.feeValue }),
                }) }}</span>
              </div>
              <span
                v-else
                class="text-sm text-muted-color"
              >{{ $t('free_shipping.free_type_info.promo_demo.orders.empty') }}</span>
            </div>

            <!-- 系統分好的包裹 -->
            <div
              class="flex flex-col gap-3 rounded-xl border bg-surface-0 px-4 py-5 dark:bg-surface-900"
              :class="data.isCancelled ? 'border-amber-400' : 'border-[var(--p-content-border-color)]'"
            >
              <div class="flex items-center justify-center gap-2">
                <p class="text-xs tracking-wide text-muted-color">
                  {{ $t('free_shipping.free_type_info.promo_demo.block.packages') }}
                </p>
                <span
                  v-if="data.orderCount > 0"
                  class="rounded-full px-2 py-0.5 text-xs font-bold"
                  :class="data.isCancelled
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : data.isShipped
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-[color-mix(in_srgb,var(--p-primary-color)_18%,transparent)] text-primary'"
                >{{ $t(data.isCancelled
                  ? 'free_shipping.free_type_info.promo_demo.package.status.confirm_fee'
                  : data.isShipped
                    ? 'free_shipping.free_type_info.promo_demo.package.status.shipped'
                    : 'free_shipping.free_type_info.promo_demo.package.status.collecting') }}</span>
              </div>

              <template v-if="data.orderCount > 0">
                <img
                  :src="packImageUrl"
                  :alt="$t('free_shipping.free_type_info.promo_demo.package.label')"
                  class="mx-auto size-20 object-contain"
                >
                <p class="text-center text-xs tracking-wide text-muted-color">
                  {{ $t('free_shipping.free_type_info.promo_demo.package.contents_title') }}
                </p>
                <div class="flex flex-wrap justify-center gap-2">
                  <span
                    v-for="order in ordersUpTo(data.orderCount)"
                    :key="order.n"
                    class="rounded-md bg-surface-100 px-2 py-0.5 text-xs whitespace-nowrap text-color dark:bg-surface-800"
                    :class="{ 'text-muted-color line-through': data.isCancelled && order.isFirst }"
                  >{{ $t(order.itemKey) }}</span>
                </div>
                <div
                  v-if="data.isShipped"
                  class="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <FontAwesomeIcon :icon="['far', 'truck']" />
                  {{ $t('free_shipping.free_type_info.promo_demo.package.shipped_note') }}
                </div>
                <div
                  v-if="data.isCancelled"
                  class="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-xs text-color dark:bg-amber-950/40"
                >
                  <span>{{ $t('free_shipping.free_type_info.promo_demo.package.alert.message') }}</span>
                  <div class="flex flex-wrap justify-center gap-2">
                    <span class="rounded-full border border-amber-500 bg-surface-0 px-3 py-0.5 font-medium text-amber-700 dark:bg-surface-900 dark:text-amber-300">{{ $t('free_shipping.free_type_info.promo_demo.package.alert.refunded') }}</span>
                    <span class="rounded-full border border-amber-500 bg-surface-0 px-3 py-0.5 font-medium text-amber-700 dark:bg-surface-900 dark:text-amber-300">{{ $t('free_shipping.free_type_info.promo_demo.package.alert.absorb') }}</span>
                  </div>
                </div>
              </template>
              <div
                v-else
                class="flex flex-1 items-center justify-center py-4 text-sm text-muted-color"
              >
                {{ $t('free_shipping.free_type_info.promo_demo.package.empty') }}
              </div>
            </div>
          </div>

          <!-- 統計列（灰底面板） -->
          <div class="grid grid-cols-2 gap-3 rounded-xl bg-surface-100 px-4 py-3.5 tabular-nums sm:grid-cols-4 dark:bg-surface-800">
            <div>
              <div class="text-xs text-muted-color">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.orders.label') }}
              </div>
              <div class="text-2xl">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.orders.value', { count: data.orderCount }) }}
              </div>
            </div>
            <div>
              <div class="text-xs text-muted-color">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.packages.label') }}
              </div>
              <div class="text-2xl">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.packages.value', { count: data.packageCount }) }}
              </div>
              <div class="min-h-4 text-xs text-muted-color">
                {{ data.orderCount > data.packageCount
                  ? $t('free_shipping.free_type_info.promo_demo.stats.packages.sub', { count: data.orderCount })
                  : '' }}
              </div>
            </div>
            <div>
              <div class="text-xs text-muted-color">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.fee.label') }}
              </div>
              <div class="text-2xl text-orange-600 dark:text-orange-400">
                {{ `$${data.feeCharged}` }}
              </div>
            </div>
            <div>
              <div class="text-xs text-muted-color">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.cost.label') }}
              </div>
              <div class="text-2xl">
                {{ `$${data.packageCount * FEE}` }}
              </div>
              <div class="text-xs text-muted-color">
                {{ $t('free_shipping.free_type_info.promo_demo.stats.cost.sub', { value: `$${FEE}` }) }}
              </div>
            </div>
          </div>

          <!-- 本張說明 -->
          <p class="min-h-10 text-center text-sm leading-relaxed text-muted-color">
            {{ $t(data.captionKey) }}
          </p>
        </div>
      </template>
    </Carousel>
  </div>
</template>
