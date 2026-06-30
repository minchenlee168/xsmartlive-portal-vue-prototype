<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PortalProductForm from '../portal-product-form/PortalProductForm.vue'
import OrderSettingForm, { type OrderSettingFormData } from './OrderSettingForm.vue'
import type {
  PortalProduct,
  PortalProductSpec,
  PortalProductSpecChild,
  PortalProductVariant,
} from '../portal-product-form/schemas'

/** save payload：商品表單資料 + 得標設定。 */
export type EditProductSave = PortalProduct & { orderSetting?: OrderSettingFormData }

/**
 * EditProductDialog — 用 PrimeVue Dialog 包住 PortalProductForm，
 * 給 LiveProductCard 編輯既有商品用。
 *
 * 表單頂層的 cancel/submit 由 dialog footer 接手（PortalProductForm `hideActions`），
 * 透過 `formContainer.querySelector('form').requestSubmit()` 觸發內部 PrimeVue Form
 * 的驗證流程，再經 submit emit 把表單資料原封不動往外送，由 LiveProductCard 的
 * onSettingSave 套回 product。
 */

interface ProductSpecLike {
  id?: number
  name?: string
  sku?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface LiveProductLike {
  id?: number
  name?: string
  keyword?: string
  sku?: string
  cost?: number
  price?: number
  stock?: number
  weight?: number
  allowMixColor?: boolean
  pickSpecAfterWinning?: boolean
  intro?: string
  note?: string
  tags?: string[]
  categoryIds?: number[]
  specs?: ProductSpecLike[]
  selectedSpecs?: ProductSpecLike[]
  [key: string]: unknown
}

interface Props {
  visible?: boolean
  product?: LiveProductLike
  /** 開啟時要落在哪個分頁；商品卡的「設定」按鈕用 'order' 直接打開得標設定。 */
  initialTab?: 'product' | 'order'
  /** 是否只顯示得標設定分頁（隱藏「編輯商品」tab）。 */
  orderOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  product: () => ({}),
  initialTab: 'product',
  orderOnly: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [data: EditProductSave]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
// 分頁：'product'(編輯商品) | 'order'(得標設定)；開啟時切到 prop 指定的初始分頁
const activeTab = ref<'product' | 'order'>(props.initialTab)
watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) activeTab.value = props.initialTab
  },
)

const formContainerRef = useTemplateRef<HTMLDivElement>('formContainerRef')
const orderSettingRef = useTemplateRef<InstanceType<typeof OrderSettingForm>>('orderSettingRef')

/**
 * 把 LiveProductCard 上的精簡 product 結構轉成 PortalProductForm 接受的
 * Partial<PortalProduct>，讓表單可以正確 pre-fill。
 */
const initialData = computed(() => {
  const p = props.product ?? {}
  // 規格來源：優先 selectedSpecs（從 AddProductDialog picker 帶進來），
  // 否則 specs（EditProductDialog 之前儲存的）；兩者擇一非空即視為有規格。
  const rawSpecs = (p.selectedSpecs?.length ? p.selectedSpecs : p.specs) ?? []
  const specs = mapSpecsToPortal(rawSpecs)
  const variants = mapVariantsFromSpecs(rawSpecs, p)

  const data: Partial<PortalProduct> = {
    id: p.id,
    name: p.name ?? '',
    keyword: p.keyword,
    note: p.note,
    intro: p.intro,
    weight: p.weight ?? 0,
    tags: Array.isArray(p.tags) ? [...p.tags] : [],
    categoryIds: Array.isArray(p.categoryIds) ? [...p.categoryIds] : [],
    hasSpec: rawSpecs.length > 0,
    allowOversell: false,
    isCouponEnabled: true,
  }

  if (data.hasSpec) {
    data.specs = specs
    data.variants = variants
  } else {
    data.variants = [
      {
        id: 0,
        cost: p.cost ?? 0,
        originalPrice: p.price ?? 0,
        salePrice: p.price ?? 0,
        stock: p.stock ?? 0,
        specIndex: [],
      },
    ]
  }

  return data
})

/**
 * LiveProductCard 上的規格只記錄群組級 name + 庫存（無多層結構），這裡簡化為
 * 單層規格群組「規格 / [spec.name...]」結構。
 */
function mapSpecsToPortal(specs: ProductSpecLike[]): PortalProductSpec[] {
  if (!specs.length) return []
  const children: PortalProductSpecChild[] = specs.map((s, idx) => ({
    id: typeof s.id === 'number' ? s.id : idx,
    name: String(s.name ?? s.sku ?? `Option ${idx + 1}`),
  }))
  return [
    {
      id: 0,
      name: t('portal_product.spec_table.label.spec_group'),
      children,
    },
  ]
}

function mapVariantsFromSpecs(
  specs: ProductSpecLike[],
  parent: LiveProductLike,
): PortalProductVariant[] {
  if (!specs.length) return []
  return specs.map((s, idx) => ({
    id: typeof s.id === 'number' ? s.id : 0,
    cost: parent.cost ?? 0,
    originalPrice: s.price ?? parent.price ?? 0,
    salePrice: s.price ?? parent.price ?? 0,
    stock: s.stock ?? 0,
    specIndex: [idx],
  }))
}

function closeDialog(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function handleVisibilityChange(value: boolean): void {
  emit('update:visible', value)
}

function handleSave(): void {
  // 找到 PrimeVue <Form> 渲染出來的真正 <form> element 並觸發 submit；
  // 走 Form 內建的 zod 驗證流程，通過後 PortalProductForm 會 emit 'submit'。
  const formEl = formContainerRef.value?.querySelector('form')
  if (formEl) {
    formEl.requestSubmit()
  }
}

function onFormSubmit(data: PortalProduct): void {
  // 一併帶上得標設定（兩個表單都常駐掛載，可直接取值）
  const orderSetting = orderSettingRef.value?.getSettings?.()
  emit('save', { ...data, orderSetting })
  closeDialog()
}

function onFormCancel(): void {
  closeDialog()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(1200px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="handleVisibilityChange"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        {{ t('live_order.dialog.edit_header') }}
      </span>
    </template>

    <!-- 分頁切換：編輯商品 / 得標設定（兩個表單皆常駐掛載，僅以 v-show 切顯示）；
         orderOnly=true 時隱藏整個 tab 列，僅顯示得標設定 -->
    <div v-if="!orderOnly" class="flex gap-1 border-b border-[var(--p-content-border-color)] mb-4">
      <button
        type="button"
        class="px-4 py-2 text-[14px] font-medium -mb-px border-b-2 transition-colors"
        :class="activeTab === 'product'
          ? 'border-[var(--p-primary-color)] text-[var(--p-primary-color)]'
          : 'border-transparent text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]'"
        @click="activeTab = 'product'"
      >
        {{ t('live_order.tab.edit_product') }}
      </button>
      <button
        type="button"
        class="px-4 py-2 text-[14px] font-medium -mb-px border-b-2 transition-colors"
        :class="activeTab === 'order'
          ? 'border-[var(--p-primary-color)] text-[var(--p-primary-color)]'
          : 'border-transparent text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]'"
        @click="activeTab = 'order'"
      >
        {{ t('live_order.tab.order_setting') }}
      </button>
    </div>

    <div v-show="activeTab === 'product'" ref="formContainerRef">
      <PortalProductForm
        mode="update"
        :initial-data="initialData"
        hide-actions
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </div>

    <div v-show="activeTab === 'order'">
      <OrderSettingForm ref="orderSettingRef" :product="product" />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('portal_product.button.cancel')"
          severity="secondary"
          variant="outlined"
          @click="onFormCancel"
        />
        <Button
          :label="t('portal_product.button.save')"
          icon="pi pi-save"
          @click="handleSave"
        />
      </div>
    </template>
  </Dialog>
</template>
