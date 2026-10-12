<script setup lang="ts">
import PromoFirstShippingCarousel from './PromoFirstShippingCarousel.vue'
import firstOrderImageUrl from '@/admin/assets/images/first-order-free-shipping.svg'
import singleItemImageUrl from '@/admin/assets/images/free-shipping.svg'
import orderImageUrl from '@/admin/assets/images/order.png'
import periodImageUrl from '@/admin/assets/images/period-free-shipping.svg'
import quantityImageUrl from '@/admin/assets/images/quantity-free-shipping.svg'
import thresholdImageUrl from '@/admin/assets/images/threshold-free-shipping.svg'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { computed, ref, watch } from 'vue'
import { FreeShippingFreeType, type FreeShippingFreeTypeValue } from '../types'

/**
 * 免運方式說明彈窗：左側垂直頁籤列出六種免運方式，右側呈現該方式說明。
 * 一般方式顯示訂單圖＋說明；選到「首購後免運」改以 PromoFirstShippingCarousel 示意輪播呈現。
 */
const visible = defineModel<boolean>('visible', { default: false })

/** 各免運方式頁籤：值、頁籤圖示、內容區說明圖、名稱 key、說明 key。 */
const FREE_TYPE_INFO_ITEMS: readonly { value: FreeShippingFreeTypeValue; icon: IconProp; image: string; labelKey: string; descriptionKey: string }[] = [
  { value: FreeShippingFreeType.FirstPurchase, icon: ['far', 'star'], image: firstOrderImageUrl, labelKey: 'free_shipping.option.free_type.first_purchase', descriptionKey: 'free_shipping.free_type_info.description.first_purchase' },
  { value: FreeShippingFreeType.SingleItem, icon: ['far', 'box'], image: singleItemImageUrl, labelKey: 'free_shipping.option.free_type.single_item', descriptionKey: 'free_shipping.free_type_info.description.single_item' },
  { value: FreeShippingFreeType.MinAmount, icon: ['far', 'circle-dollar'], image: thresholdImageUrl, labelKey: 'free_shipping.option.free_type.min_amount', descriptionKey: 'free_shipping.free_type_info.description.min_amount' },
  { value: FreeShippingFreeType.MinQuantity, icon: ['far', 'boxes-stacked'], image: quantityImageUrl, labelKey: 'free_shipping.option.free_type.min_quantity', descriptionKey: 'free_shipping.free_type_info.description.min_quantity' },
  { value: FreeShippingFreeType.LimitedTime, icon: ['far', 'clock'], image: periodImageUrl, labelKey: 'free_shipping.option.free_type.limited_time', descriptionKey: 'free_shipping.free_type_info.description.limited_time' },
  { value: FreeShippingFreeType.PromoFirst, icon: ['far', 'arrows-rotate'], image: orderImageUrl, labelKey: 'free_shipping.option.free_type.promo_first', descriptionKey: 'free_shipping.free_type_info.description.promo_first' },
]

const activeValue = ref<FreeShippingFreeTypeValue>(FREE_TYPE_INFO_ITEMS[0].value)

const activeItem = computed(
  () => FREE_TYPE_INFO_ITEMS.find((item) => item.value === activeValue.value) ?? FREE_TYPE_INFO_ITEMS[0],
)
const isPromoFirstActive = computed(() => activeValue.value === FreeShippingFreeType.PromoFirst)

// 每次開窗回到第一個頁籤
watch(visible, (isVisible) => {
  if (isVisible) {
    activeValue.value = FREE_TYPE_INFO_ITEMS[0].value
  }
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="$t('free_shipping.free_type_info.title')"
    :style="{ width: 'min(1088px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-5 sm:flex-row sm:gap-6">
      <!-- 垂直頁籤：由上而下、靠左 -->
      <div
        class="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible"
        role="tablist"
        aria-orientation="vertical"
      >
        <button
          v-for="item in FREE_TYPE_INFO_ITEMS"
          :key="item.value"
          type="button"
          role="tab"
          :aria-selected="item.value === activeValue"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors"
          :class="item.value === activeValue
            ? 'bg-[color-mix(in_srgb,var(--p-primary-color)_14%,transparent)] font-semibold text-primary'
            : 'text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800'"
          @click="activeValue = item.value"
        >
          <FontAwesomeIcon
            :icon="item.icon"
            class="w-4 shrink-0 text-center"
          />
          <span>{{ $t(item.labelKey) }}</span>
        </button>
      </div>

      <!-- 內容區 -->
      <div
        class="min-w-0 flex-1"
        role="tabpanel"
      >
        <PromoFirstShippingCarousel v-if="isPromoFirstActive" />

        <div
          v-else
          class="flex flex-col items-center gap-4 px-4 py-10 text-center"
        >
          <img
            :src="activeItem.image"
            :alt="$t(activeItem.labelKey)"
            class="size-36 object-contain"
          >
          <p class="max-w-md text-muted-color">
            {{ $t(activeItem.descriptionKey) }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="$t('free_shipping.button.close')"
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>
