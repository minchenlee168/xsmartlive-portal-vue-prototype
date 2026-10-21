<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DOMPurify from 'dompurify'
import type { FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'

import BaseFormField from '@/admin/components/ui/BaseFormField.vue'
import LoaderSpinner from '@/admin/components/portal-ui/LoaderSpinner.vue'
import { useGlobalToast } from '@/admin/composables/useGlobalToast'
import { applyCategoryDefaultImageApi } from '@/admin/api/portal-product'
import { getApiErrorMessage } from '@/admin/utils/api-error'

import MultiImageUploader from './MultiImageUploaderStub.vue'
import SpecTable from './SpecTable.vue'
import CategorySelector from './CategorySelector.vue'
import { productFormSchema } from './schemas'
import type {
  PortalProduct as Product,
  PortalProductSpec as Spec,
  PortalProductVariant as Variant,
} from './schemas'
import { PRODUCT_IMAGE_MAX_FILE_SIZE } from './constants'
import { useProductFormOptions } from './composables/useProductFormOptions'
import {
  findCategoryNode,
  isCategoryCovered,
} from './utils/categorySelection'

const { t } = useI18n()

const resolver = zodResolver(productFormSchema)

interface Props {
  /** 表單模式：create（新增）、update（編輯）、detail（檢視） */
  mode: 'create' | 'update' | 'detail'
  /** 初始表單資料 */
  initialData?: Partial<Product>
  /** 載入狀態（由父組件控制） */
  loading?: boolean
  /** 提交中狀態（由父組件控制） */
  submitting?: boolean
  /** 強制唯讀模式（優先於 mode 的判斷） */
  readonly?: boolean
  /** 在 Dialog 中使用時，隱藏 cancel/submit 按鈕（由 Dialog footer 控制） */
  hideActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialData: undefined,
  loading: false,
  submitting: false,
  readonly: undefined,
  hideActions: false,
})

const emit = defineEmits<{
  /** 提交表單 */
  submit: [data: Product]
  /** 取消操作 */
  cancel: []
}>()

const { showError, showSuccess } = useGlobalToast()
const { availableCategories, availableTags, loadOptions } = useProductFormOptions()

const formData = ref<Partial<Product>>({
  name: '',
  categoryIds: [],
  intro: '',
  tags: [],
  note: '',
  weight: 0,
  hasSpec: false,
  allowOversell: false,
  keyword: '',
  publishAt: '',
  unpublishAt: '',
  productImageIds: [],
  productImages: [],
  variants: [],
  isCouponEnabled: true,
})

const formInitialValues = computed(() => ({
  name: props.initialData?.name ?? '',
  intro: props.initialData?.intro ?? '',
  keyword: props.initialData?.keyword ?? '',
  note: props.initialData?.note ?? '',
  weight: props.initialData?.weight ?? 0,
  allowOversell: props.initialData?.allowOversell ?? false,
  tags: props.initialData?.tags ?? [],
  categoryIds: props.initialData?.categoryIds ?? [],
  isCouponEnabled: props.initialData?.isCouponEnabled ?? true,
}))

/** 是否唯讀（props.readonly 優先；未設定時以 mode === 'detail' 判斷） */
const isReadonly = computed(() => props.readonly ?? props.mode === 'detail')

const MAX_IMAGES = 9

const hasSpec = computed({
  get: () => formData.value.hasSpec === true,
  set: (value: boolean) => {
    formData.value.hasSpec = value
  },
})

function handleEnableSpec(): void {
  hasSpec.value = true
}

function handleSpecTableUpdate(data: { specs: Spec[]; variants: Variant[] }): void {
  formData.value.specs = data.specs
  formData.value.variants = data.variants
}

function handleCancelSpec(): void {
  hasSpec.value = false
  formData.value.specs = []
  formData.value.variants = []
}

const noSpecVariant = ref<Variant>({
  id: 0,
  cost: 0,
  originalPrice: 0,
  salePrice: 0,
  stock: 0,
  specIndex: [],
})

function initializeForm(data?: Partial<Product>): void {
  if (!data) return
  formData.value = { ...data }
  if (data.variants && data.variants.length === 1 && !data.hasSpec) {
    noSpecVariant.value = { ...data.variants[0] }
  }
}

watch(
  () => props.initialData,
  (data) => initializeForm(data),
  { immediate: true },
)

/**
 * 提交表單（由 Form 的 @submit 觸發，已完成 Zod schema 驗證）
 */
function handleFormSubmit({ valid }: FormSubmitEvent): void {
  if (!valid) return

  if (hasSpec.value) {
    if (formData.value.variants === undefined || formData.value.variants.length === 0) {
      showError({ detail: t('portal_product.form.validation.spec_variant_required') })
      return
    }

    for (const variant of formData.value.variants) {
      if (!variant.salePrice || variant.salePrice <= 0) {
        showError({ detail: t('portal_product.form.validation.sale_price_required') })
        return
      }
    }
  } else {
    if (!noSpecVariant.value.salePrice || noSpecVariant.value.salePrice <= 0) {
      showError({ detail: t('portal_product.form.validation.sale_price_required') })
      return
    }
  }

  const submitData: Product = {
    id: props.initialData?.id,
    name: formData.value.name ?? '',
    categoryIds: formData.value.categoryIds ?? [],
    intro: formData.value.intro,
    tags: formData.value.tags,
    note: formData.value.note,
    weight: formData.value.weight,
    hasSpec: hasSpec.value,
    allowOversell: formData.value.allowOversell ?? false,
    keyword: formData.value.keyword,
    publishAt: formData.value.publishAt,
    unpublishAt: formData.value.unpublishAt,
    isCouponEnabled: formData.value.isCouponEnabled ?? true,
  }

  if (hasSpec.value && formData.value.variants) {
    submitData.specs = formData.value.specs
    submitData.variants = formData.value.variants
  } else {
    submitData.variants = [noSpecVariant.value]
  }

  if (formData.value.productImages?.length) {
    submitData.productImageIds = formData.value.productImages.map((item) => item.id)
    submitData.productImages = formData.value.productImages
  }

  emit('submit', submitData)
}

function handleCancel(): void {
  emit('cancel')
}

onMounted(() => {
  loadOptions()
})

const safeIntroHtml = computed(() => DOMPurify.sanitize(formData.value.intro || ''))

const multiImageUploaderRef = useTemplateRef<{ isCachingBase64: boolean }>(
  'multiImageUploaderRef',
)

const specTableRef = useTemplateRef<{ importSpecs: (specs: Spec[]) => void }>('specTableRef')

/**
 * 商品分類最多可選 N 個。
 * 業務上一個商品同時掛在多個分類會稀釋 SEO 與搜尋權重，
 * 因此 dialog UI 在此邊界守住。
 */
const MAX_CATEGORIES = 2

// 分類預設圖建議卡 — 商家沒上傳商品圖時，可一鍵套用主分類的預設圖
const isApplyingDefaultImage = ref(false)
let lastRequestedCategoryId: number | null = null

const suggestedCategories = computed(() => {
  const ids = formData.value.categoryIds ?? []
  if (!ids.length) return []
  const tree = availableCategories.value
  return ids
    .map((id) => findCategoryNode(tree, id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node?.imageUrl))
})

const canSuggestCategoryImages = computed<boolean>(() => {
  if (props.loading) return false
  if (isReadonly.value) return false
  if ((formData.value.productImages?.length ?? 0) > 0) return false
  return suggestedCategories.value.length > 0
})

async function handleApplyCategoryDefaultImage(categoryId: number): Promise<void> {
  if (isApplyingDefaultImage.value) return
  if (!categoryId) return

  if ((formData.value.productImages?.length ?? 0) >= MAX_IMAGES) {
    showError({
      detail: t('portal_product.toast.image_limit_reached', { max: MAX_IMAGES }),
    })
    return
  }

  isApplyingDefaultImage.value = true
  lastRequestedCategoryId = categoryId
  try {
    const response = await applyCategoryDefaultImageApi(categoryId)

    // Race guard 1：使用者 inflight 期間又點別張卡，丟棄舊結果
    if (lastRequestedCategoryId !== categoryId) return

    // Race guard 2：使用者 inflight 期間從表單把該分類整個移掉
    const tree = availableCategories.value
    const currentIds = formData.value.categoryIds ?? []
    if (!isCategoryCovered(tree, currentIds, categoryId)) return

    if ((formData.value.productImages?.length ?? 0) >= MAX_IMAGES) {
      showError({
        detail: t('portal_product.toast.image_limit_reached', { max: MAX_IMAGES }),
      })
      return
    }

    const { data } = response
    formData.value.productImages = [
      ...(formData.value.productImages ?? []),
      { id: data.id, url: data.url },
    ]
    showSuccess({ detail: t('portal_product.toast.category_default_image_applied') })
  } catch (error) {
    showError({
      detail: getApiErrorMessage(
        error,
        t('portal_product.toast.category_default_image_failed'),
      ),
    })
  } finally {
    isApplyingDefaultImage.value = false
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex justify-center items-center py-8"
  >
    <LoaderSpinner />
  </div>

  <Form
    v-else
    v-slot="$form"
    :initial-values="formInitialValues"
    :resolver="resolver"
    :validate-on-value-update="true"
    class="grid grid-cols-1 gap-4"
    @submit="handleFormSubmit"
  >
    <!-- 基本資料 -->
    <section class="border-b border-[var(--p-content-border-color)] pb-5">
      <h3 class="text-base font-semibold text-[var(--p-text-color)] mb-4">
        {{ t('portal_product.form.section.basic') }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <BaseFormField
            :label="t('portal_product.form.field.name')"
            class-name="max-w-none col-span-2"
          >
            <InputText
              v-model="formData.name"
              name="product-name"
              :disabled="isReadonly"
              :placeholder="t('portal_product.form.placeholder.name')"
              class="w-full"
            />
            <Message
              v-if="$form.name?.invalid"
              size="small"
              severity="error"
              variant="simple"
            >
              {{ $form.name.error?.message }}
            </Message>
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.category')"
            class-name="max-w-none col-span-2"
          >
            <CategorySelector
              v-model:categories="formData.categoryIds"
              :category-options="availableCategories"
              :max-category-selection="MAX_CATEGORIES"
              :is-disabled="isReadonly"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.live_keyword')"
            class-name="max-w-none col-span-2"
          >
            <InputText
              v-model="formData.keyword"
              name="keyword"
              :disabled="isReadonly"
              :placeholder="t('portal_product.form.placeholder.live_keyword')"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.tags')"
            class-name="max-w-none col-span-2"
          >
            <MultiSelect
              v-model="formData.tags"
              name="tags"
              input-id="product-tags-input"
              :disabled="isReadonly"
              :placeholder="t('portal_product.form.placeholder.tags')"
              display="chip"
              filter
              :options="availableTags"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.coupon_enabled')"
            class-name="max-w-none col-span-2"
          >
            <ToggleSwitch
              v-model="formData.isCouponEnabled"
              name="isCouponEnabled"
              :disabled="isReadonly"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.weight', { unit: t('portal_product.text.unit_gram') })"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="formData.weight"
              name="weight"
              :disabled="isReadonly"
              :min="0"
              suffix=" g"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.intro')"
            class-name="max-w-none col-span-2"
          >
            <div
              v-if="isReadonly"
              class="p-2 border border-gray-300 cursor-default min-h-18 rounded bg-gray-50 text-gray-700"
              v-html="safeIntroHtml"
            />
            <Editor
              v-else
              v-model="formData.intro"
              name="intro"
              editor-style="height: 320px"
            />
          </BaseFormField>
        </div>
    </section>

    <!-- 商品圖片 -->
    <section class="border-b border-[var(--p-content-border-color)] pb-5">
      <h3 class="text-base font-semibold text-[var(--p-text-color)] mb-4">
        {{ t('portal_product.form.section.images') }}
      </h3>
        <MultiImageUploader
          ref="multiImageUploaderRef"
          v-model:images="formData.productImages"
          :editor-aspect-ratio="1"
          :max-count="MAX_IMAGES"
          :max-file-size="PRODUCT_IMAGE_MAX_FILE_SIZE"
          :disabled="isReadonly"
        />

        <div
          v-if="canSuggestCategoryImages"
          class="mt-4 flex flex-wrap gap-3"
        >
          <div
            v-for="category in suggestedCategories"
            :key="category.id"
            class="flex w-96 items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:bg-gray-800"
          >
            <img
              :src="category.imageUrl ?? ''"
              :alt="category.name"
              class="h-14 w-14 shrink-0 rounded object-cover"
            >
            <div class="min-w-0 flex-1 truncate text-sm font-medium">
              {{ t('portal_product.form.hint.images.suggest_category_default', { category: category.name }) }}
            </div>
            <Button
              type="button"
              size="small"
              :label="t('portal_product.button.use_category_default_image')"
              :loading="isApplyingDefaultImage"
              :disabled="isApplyingDefaultImage"
              @click="handleApplyCategoryDefaultImage(category.id)"
            />
          </div>
        </div>

        <div
          v-else-if="formData.productImages?.length === 0"
          class="flex gap-2 items-center justify-center py-8 text-gray-400"
        >
          <i class="pi pi-image text-4xl" />
          {{ t('portal_product.form.hint.images.empty') }}
        </div>
    </section>

    <!-- 規格設定（無規格時的價格與庫存） -->
    <section v-if="!hasSpec" class="border-b border-[var(--p-content-border-color)] pb-5">
      <h3 class="text-base font-semibold text-[var(--p-text-color)] mb-4">
        {{ t('portal_product.form.section.sales_options') }}
      </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BaseFormField
            :label="t('portal_product.form.field.cost_price')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="noSpecVariant.cost"
              name="cost"
              :disabled="isReadonly"
              mode="currency"
              currency="TWD"
              locale="zh-TW"
              :min="0"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.original_price')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="noSpecVariant.originalPrice"
              name="original-price"
              :disabled="isReadonly"
              mode="currency"
              currency="TWD"
              locale="zh-TW"
              :min="0"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.sale_price')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="noSpecVariant.salePrice"
              name="sale-price"
              :disabled="isReadonly"
              mode="currency"
              currency="TWD"
              locale="zh-TW"
              :min="0"
              class="w-full"
            />
          </BaseFormField>

          <BaseFormField
            :label="t('portal_product.form.field.stock')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="noSpecVariant.stock"
              name="stock"
              :disabled="isReadonly"
              :min="0"
              class="w-full"
            />
          </BaseFormField>

          <div class="text-center py-8 col-span-4 flex flex-col items-center gap-4">
            <p class="text-sm text-gray-600">
              {{ t('portal_product.form.hint.spec_setup') }}
            </p>
            <Button
              v-if="!isReadonly"
              :label="t('portal_product.button.create_spec')"
              @click="handleEnableSpec"
            >
              <template #icon>
                <i class="pi pi-plus" />
              </template>
            </Button>
          </div>
        </div>
    </section>

    <!-- 規格表格 -->
    <SpecTable
      v-if="hasSpec"
      ref="specTableRef"
      :readonly="isReadonly"
      :initial-specs="formData.specs"
      :initial-variants="formData.variants"
      @update:data="handleSpecTableUpdate"
      @close-spec="handleCancelSpec"
    />

    <!-- 商品詳情 -->
    <section>
      <h3 class="text-base font-semibold text-[var(--p-text-color)] mb-4">
        {{ t('portal_product.form.section.details') }}
      </h3>
        <div class="grid grid-cols-1 gap-4 max-w-2xl">
          <BaseFormField
            :label="t('portal_product.form.field.note')"
            class-name="max-w-none"
          >
            <Textarea
              v-model="formData.note"
              name="note"
              :disabled="isReadonly"
              rows="5"
              :placeholder="t('portal_product.form.placeholder.note')"
              class="w-full"
            />
          </BaseFormField>
        </div>
    </section>

    <div
      v-if="!hideActions"
      class="flex justify-end gap-3"
    >
      <Button
        :label="t('portal_product.button.cancel')"
        severity="secondary"
        @click="handleCancel"
      />
      <Button
        v-if="!isReadonly"
        :label="mode === 'create' ? t('portal_product.button.add') : t('portal_product.button.save')"
        :loading="submitting"
        type="submit"
      />
    </div>

    <!-- 提供 hidden submit button so external buttons can trigger form submission via requestSubmit -->
    <button
      v-if="hideActions"
      type="submit"
      class="hidden"
      aria-hidden="true"
      tabindex="-1"
    />
  </Form>
</template>
