<script setup lang="ts">
import PromoFirstShippingCarousel from './PromoFirstShippingCarousel.vue'
import firstOrderImageUrl from '@/admin/assets/images/first-order-free-shipping.svg'
import singleItemImageUrl from '@/admin/assets/images/free-shipping.svg'
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

/**
 * 各免運方式頁籤：值、頁籤圖示、名稱 key、說明 key，以及實例場景設定。
 * 5 種簡單方式右側用「達成/未達」兩張對照卡（scene）；promo_first 改走 PromoFirstShippingCarousel。
 * scene.key 對應 i18n `free_type_info.scene.<key>`；failTone 決定未達卡語氣：
 *   warn（琥珀，還能補救達標）／ neutral（灰，已無法挽回）。
 */
const FREE_TYPE_INFO_ITEMS: readonly { value: FreeShippingFreeTypeValue; icon: IconProp; image?: string; labelKey: string; descriptionKey: string; scene?: { key: string; failTone: 'warn' | 'neutral' } }[] = [
  { value: FreeShippingFreeType.FirstPurchase, icon: ['far', 'star'], image: firstOrderImageUrl, labelKey: 'free_shipping.option.free_type.first_purchase', descriptionKey: 'free_shipping.free_type_info.description.first_purchase', scene: { key: 'first_purchase', failTone: 'neutral' } },
  { value: FreeShippingFreeType.SingleItem, icon: ['far', 'box'], image: singleItemImageUrl, labelKey: 'free_shipping.option.free_type.single_item', descriptionKey: 'free_shipping.free_type_info.description.single_item', scene: { key: 'single_item', failTone: 'warn' } },
  { value: FreeShippingFreeType.MinAmount, icon: ['far', 'circle-dollar'], image: thresholdImageUrl, labelKey: 'free_shipping.option.free_type.min_amount', descriptionKey: 'free_shipping.free_type_info.description.min_amount', scene: { key: 'min_amount', failTone: 'warn' } },
  { value: FreeShippingFreeType.MinQuantity, icon: ['far', 'boxes-stacked'], image: quantityImageUrl, labelKey: 'free_shipping.option.free_type.min_quantity', descriptionKey: 'free_shipping.free_type_info.description.min_quantity', scene: { key: 'min_quantity', failTone: 'warn' } },
  { value: FreeShippingFreeType.LimitedTime, icon: ['far', 'clock'], image: periodImageUrl, labelKey: 'free_shipping.option.free_type.limited_time', descriptionKey: 'free_shipping.free_type_info.description.limited_time', scene: { key: 'limited_time', failTone: 'neutral' } },
  { value: FreeShippingFreeType.PromoFirst, icon: ['far', 'arrows-rotate'], labelKey: 'free_shipping.option.free_type.promo_first', descriptionKey: 'free_shipping.free_type_info.description.promo_first' },
]

const activeValue = ref<FreeShippingFreeTypeValue>(FREE_TYPE_INFO_ITEMS[0].value)

const activeItem = computed(
  () => FREE_TYPE_INFO_ITEMS.find((item) => item.value === activeValue.value) ?? FREE_TYPE_INFO_ITEMS[0],
)
const isPromoFirstActive = computed(() => activeValue.value === FreeShippingFreeType.PromoFirst)

/** 依當前方式組出實例場景的 i18n key（無 scene 的 promo_first 回 null）。 */
const activeScene = computed(() => {
  const scene = activeItem.value.scene
  if (!scene) return null
  const base = `free_shipping.free_type_info.scene.${scene.key}`
  return {
    failTone: scene.failTone,
    passFact: `${base}.pass_fact`,
    passResult: `${base}.pass_result`,
    failFact: `${base}.fail_fact`,
    failResult: `${base}.fail_result`,
  }
})

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
          v-else-if="activeScene"
          class="flex flex-col items-center gap-6 px-2 py-6"
        >
          <!-- 示意圖 + 規則說明句（引導），下方以對照卡示意 -->
          <img
            v-if="activeItem.image"
            :src="activeItem.image"
            :alt="$t(activeItem.labelKey)"
            class="size-28 object-contain"
          >
          <p class="max-w-md text-center text-muted-color">
            {{ $t(activeItem.descriptionKey) }}
          </p>

          <!-- 達成（左）／未達（右）對照卡 -->
          <div class="grid w-full max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
            <!-- 達成卡 -->
            <div class="flex flex-col items-center gap-3 rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 px-4 py-4 text-center dark:bg-surface-900">
              <div class="flex items-center gap-2 text-xs text-muted-color">
                <FontAwesomeIcon
                  :icon="['far', 'circle-check']"
                  class="text-emerald-500 dark:text-emerald-400"
                />
                {{ $t('free_shipping.free_type_info.scene.eyebrow.pass') }}
              </div>
              <p class="text-sm font-semibold text-color tabular-nums">
                {{ $t(activeScene.passFact) }}
              </p>
              <span class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {{ $t(activeScene.passResult) }}
              </span>
            </div>

            <!-- 未達卡 -->
            <div class="flex flex-col items-center gap-3 rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 px-4 py-4 text-center dark:bg-surface-900">
              <div class="flex items-center gap-2 text-xs text-muted-color">
                <FontAwesomeIcon
                  :icon="['far', 'circle-xmark']"
                  :class="activeScene.failTone === 'warn'
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-muted-color'"
                />
                {{ $t('free_shipping.free_type_info.scene.eyebrow.fail') }}
              </div>
              <p class="text-sm font-semibold text-color tabular-nums">
                {{ $t(activeScene.failFact) }}
              </p>
              <span
                class="rounded-full px-3 py-1 text-sm font-semibold"
                :class="activeScene.failTone === 'warn'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-200'"
              >
                {{ $t(activeScene.failResult) }}
              </span>
            </div>
          </div>
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
