<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { productCatalog } from '../utils/productCatalog'

/**
 * 單規格商品快速新增表單；只在已選擇場次時顯示。
 *
 * 單列：常用分類 Select / 名稱 / 關鍵字 / 售價 / 庫存 / 新增鈕。
 * 按 Enter 或新增鈕即送出，送出後欄位重設（分類選擇保留，方便連續新增同類）。
 */

interface QuickAddProductPayload {
  id: number
  name: string
  keyword: string
  price: number
  stock: number
  /** 單規格商品：specs 留空陣列 */
  specs: never[]
  /** 商品分類；未選為空字串 */
  category: string
}

interface Props {
  /** bare = 拿掉外框 / 背景 / padding + 隱藏 inline「新增」鈕（給 dialog 嵌入用，submit 由 dialog footer 觸發） */
  bare?: boolean
}
const props = withDefaults(defineProps<Props>(), { bare: false })
const emit = defineEmits<{
  submit: [payloads: QuickAddProductPayload[]]
}>()

const { t } = useI18n()

const name = ref('')
const keyword = ref('')
const price = ref<number | null>(null)
const stock = ref<number | null>(null)
const category = ref('')

/** 常用分類下拉選項：取 productCatalog 內出現頻率最高的前 6 個分類 */
const categoryOptions = computed<Array<{ label: string; value: string }>>(() => {
  const count = new Map<string, number>()
  productCatalog.forEach((p) => count.set(p.category, (count.get(p.category) ?? 0) + 1))
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat]) => ({ label: cat, value: cat }))
})

const canSubmit = computed(() => name.value.trim().length > 0 && typeof price.value === 'number' && price.value >= 0)

function reset(): void {
  name.value = ''
  keyword.value = ''
  price.value = null
  stock.value = null
  // 分類保留，方便連續新增同類商品
}

function onSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', [{
    id: Date.now(),
    name: name.value.trim(),
    keyword: keyword.value.trim(),
    price: price.value ?? 0,
    stock: stock.value ?? 0,
    specs: [],
    category: category.value,
  }])
  reset()
}

/** 給父層程式化收合用 — 沿用 API（這版沒有收合需求，呼叫不做事） */
function collapse(): void { /* no-op：表單一直顯示 */ }
/** 給 dialog 外層觸發用 — bare 模式時 dialog footer 的「新增」鈕透過 ref 呼叫 */
defineExpose({ collapse, submit: onSubmit, canSubmit })
</script>

<template>
  <!-- 手機 → 每個 input 全寬 stack；桌機 ≥ sm → 固定寬度 inline；
       bare 模式（dialog 內）→ 拿掉外框 / 背景 / padding -->
  <div
    class="flex flex-wrap items-center gap-2"
    :class="bare ? '' : 'rounded-md border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-2'"
  >
    <Select
      v-model="category"
      :options="categoryOptions"
      option-label="label"
      option-value="value"
      placeholder="常用分類"
      show-clear
      class="!w-full sm:!w-[140px]"
    />
    <InputText
      v-model="name"
      :placeholder="t('live_order.quick_add.placeholder.name')"
      class="!w-full sm:!w-[200px]"
      size="small"
      @keyup.enter="onSubmit"
    />
    <InputText
      v-model="keyword"
      :placeholder="t('live_order.quick_add.placeholder.keyword')"
      class="!w-full sm:!w-[120px]"
      size="small"
      @keyup.enter="onSubmit"
    />
    <InputNumber
      v-model="price"
      :placeholder="t('live_order.quick_add.placeholder.price')"
      :min="0"
      :use-grouping="false"
      input-class="!w-full sm:!w-[110px]"
      size="small"
      fluid
      class="w-full sm:w-auto"
      @keyup.enter="onSubmit"
    />
    <InputNumber
      v-model="stock"
      :placeholder="t('live_order.quick_add.placeholder.stock')"
      :min="0"
      :use-grouping="false"
      input-class="!w-full sm:!w-[110px]"
      size="small"
      fluid
      class="w-full sm:w-auto"
      @keyup.enter="onSubmit"
    />
    <!-- bare 模式時隱藏 inline 新增鈕，由 dialog footer 觸發 -->
    <Button
      v-if="!bare"
      icon="pi pi-plus"
      :label="t('live_order.quick_add.button.add_one')"
      size="small"
      class="w-full sm:w-auto"
      :disabled="!canSubmit"
      @click="onSubmit"
    />
  </div>
</template>
