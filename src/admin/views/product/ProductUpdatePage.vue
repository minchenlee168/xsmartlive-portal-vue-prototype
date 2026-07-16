<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { RouteName } from '@/admin/router'
import {
  managedProducts,
  addManagedProduct,
  syncManagedProduct,
  PRODUCT_CATEGORIES,
  PRODUCT_TAGS,
  type ManagedProduct,
} from './utils/productMock'
import SpecTable, { type SpecGroup, type Variant } from './components/SpecTable.vue'
import PromoteTable, { type PromoteData } from './components/PromoteTable.vue'
import MultiImageUploader, { type UploaderItem } from './components/MultiImageUploader.vue'
import AISuggestPanel, { type AiApplyPayload } from './components/AISuggestPanel.vue'

/**
 * 編輯商品頁（Phase 1）：商品列表 → 編輯按鈕進來。
 *
 * 區塊：
 * - 基本資料：商品名稱 / 分類 / 直播關鍵字 / 商品標籤 / 啟用優惠券 / 商品重量 / 商品介紹
 * - 商品圖片：佔位（Phase 2 接 MultiImageUploader）
 * - 規格設定：規格 table（可新增 / 移除），單一規格時直接編價格庫存
 * - 多件優惠：階梯定價 table（達 N 件 → 折抵金額 / 百分比折扣）
 * - 商品詳情：商品備註
 *
 * 存檔走 mock：直接覆寫 productCatalog 內對應 id 的商品 + toast。
 */

/**
 * Props：本元件支援兩種使用模式
 * - 一般 route page：直接 mount 在 router，依 route.name / route.params 判斷 create / update
 * - dialog 嵌入（embedded = true）：藏掉頁首返回 / 麵包屑 + sticky footer，由父元件
 *   （ProductCreateDialog）負責 Dialog header / footer，並透過 expose 出來的方法觸發儲存
 */
const props = withDefaults(defineProps<{
  embedded?: boolean
  /** dialog 嵌入模式時，若帶 id 視為「編輯」該 MP；不帶 = 新增 */
  initialProductId?: number
  /** 純檢視模式：所有 input 都鎖住，AI / 儲存 button 由父層隱藏 */
  readonly?: boolean
}>(), {
  embedded: false,
  initialProductId: undefined,
  readonly: false,
})
const emit = defineEmits<{
  saved: [product: ManagedProduct]
  cancel: []
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

/** 嵌入模式用 initialProductId；route 模式用 route.params.id */
const productId = computed(() =>
  props.embedded ? (props.initialProductId ?? NaN) : Number(route.params.id),
)
const original = computed<ManagedProduct | undefined>(() =>
  managedProducts.find((p) => p.id === productId.value),
)

/** 嵌入沒帶 id = 新增；嵌入帶 id = 編輯；route 模式照 route.name / params 判斷 */
const isCreateMode = computed(() => {
  if (props.embedded) return !props.initialProductId
  return route.name === RouteName.ProductCreate || !route.params.id
})
const pageTitle = computed(() => isCreateMode.value ? '新增一般商品' : '編輯商品')

/**
 * 表單編輯 buffer：載入後 deep copy，按下儲存才寫回 mock，可隨時取消放棄。
 * Phase B 起：
 * - specs / variants 改用 SpecGroup[] + Variant[]（規格層 + cross product 變體）
 * - promotes 改用 PromoteData（startAt / endAt / tiers[]）
 */
/** 沒規格時的「銷售設定」欄位（單一商品的成本/原價/售價/庫存） */
interface NoSpecVariant {
  cost: number
  originalPrice: number
  salePrice: number
  stock: number
}

interface FormState {
  name: string
  category: string
  keyword: string
  tags: string[]
  enableCoupon: boolean
  weight: number
  description: string
  remark: string
  /** 規格群組；空陣列 = 未設定規格，呈現「銷售設定」Card */
  specs: SpecGroup[]
  variants: Variant[]
  /** 沒規格時的銷售欄位 */
  noSpecVariant: NoSpecVariant
  promote: PromoteData
  images: UploaderItem[]
}
const form = ref<FormState>(emptyForm())

function emptyForm(): FormState {
  return {
    name: '',
    category: '',
    keyword: '',
    tags: [],
    enableCoupon: false,
    weight: 0,
    description: '',
    remark: '',
    specs: [],
    variants: [],
    noSpecVariant: { cost: 0, originalPrice: 0, salePrice: 0, stock: 0 },
    promote: { startAt: null, endAt: null, tiers: [] },
    images: [],
  }
}

/**
 * 把 mock 上的 flat specs（{id,name,stock,price}[]）轉成 SpecTable 用的 SpecGroup[] + Variant[]：
 * - 「單一規格」或長度 ≤ 1 → 不建 spec group（無規格商品）
 * - 多筆 → 包成單一 spec group「規格」，options = 原 specs
 *   variants 1:1 對應，cost / 原價 / 售價 沿用 price，stock 沿用 stock
 */
function adaptSpecsFromMock(p: ManagedProduct): { specs: SpecGroup[]; variants: Variant[] } {
  const isSingle = p.specs.length <= 1 || (p.specs.length === 1 && p.specs[0].name === '單一規格')
  if (isSingle) return { specs: [], variants: [] }
  const groupId = Date.now()
  const options = p.specs.map((s) => ({ id: s.id, name: s.name }))
  const variants: Variant[] = p.specs.map((s, i) => ({
    id: s.id + 1_000_000 + i,
    optionIds: [s.id],
    cost: 0,
    originalPrice: 0,
    salePrice: s.price,
    stock: s.stock,
  }))
  // 群組名優先用 MP 持久化的 specGroupNames[0]，沒存過則 fallback '規格'
  const groupName = p.specGroupNames?.[0] || '規格'
  return {
    specs: [{ id: groupId, name: groupName, options }],
    variants,
  }
}

onMounted(() => {
  // 新增模式：不載入既有資料，form 維持 emptyForm()
  if (isCreateMode.value) return
  const p = original.value
  if (!p) {
    toast.add({ severity: 'warn', summary: '找不到商品', life: 1800 })
    // 嵌入模式無法 router.replace；emit cancel 讓父層關掉 dialog
    if (props.embedded) emit('cancel')
    else router.replace({ name: RouteName.ProductList })
    return
  }
  const adapted = adaptSpecsFromMock(p)
  // 沒規格時，從 mock 的第一筆 spec 借出價格 / 庫存當銷售設定預設值
  const firstSpec = p.specs[0]
  const noSpecDefault: NoSpecVariant = adapted.specs.length === 0 && firstSpec
    ? { cost: 0, originalPrice: 0, salePrice: firstSpec.price ?? 0, stock: firstSpec.stock ?? 0 }
    : { cost: 0, originalPrice: 0, salePrice: 0, stock: 0 }

  form.value = {
    name: p.name,
    category: p.category,
    keyword: p.keyword ?? '',
    tags: [...(p.tags ?? [])],
    enableCoupon: p.enableCoupon ?? false,
    weight: p.weight ?? 0,
    description: p.description ?? '',
    remark: p.remark ?? '',
    specs: adapted.specs,
    variants: adapted.variants,
    noSpecVariant: noSpecDefault,
    // 多件優惠 mock 起點空白
    promote: { startAt: null, endAt: null, tiers: [] },
    images: (p.images ?? []).map((img) => ({ ...img })),
  }
})

/** 「建立規格」：開啟規格設定 → 預先放一個空 spec group。 */
function enableSpec(): void {
  const id = Date.now()
  form.value.specs = [{
    id,
    name: '',
    options: [{ id: id + 1, name: '' }],
  }]
}

const categoryOptions = computed(() => PRODUCT_CATEGORIES.map((c) => ({ label: c, value: c })))
const tagOptions = computed(() => PRODUCT_TAGS.map((c) => ({ label: c, value: c })))

// ── AI 商品建議面板 ───────────────────────────────
const aiPanelVisible = ref(false)
/** 已採用的建議快照，用來讓 chip 顯示 success severity（再點一次撤銷） */
const adopted = ref<{
  productName: string | null
  description: string | null
  category: string | null
  keyword: string | null
  tags: string[]
  specGroupNames: string[]
}>({
  productName: null,
  description: null,
  category: null,
  keyword: null,
  tags: [],
  specGroupNames: [],
})

let nextSpecId = Date.now()
function applyAi(payload: AiApplyPayload): void {
  switch (payload.kind) {
    case 'productName': {
      if (adopted.value.productName === payload.value) {
        adopted.value.productName = null
        return
      }
      form.value.name = payload.value
      adopted.value.productName = payload.value
      break
    }
    case 'description': {
      if (adopted.value.description === payload.value) {
        adopted.value.description = null
        return
      }
      form.value.description = payload.value
      adopted.value.description = payload.value
      break
    }
    case 'category': {
      if (adopted.value.category === payload.value) {
        adopted.value.category = null
        return
      }
      // 若分類不在現有選項裡，先補進來方便 Select 能顯示
      if (!PRODUCT_CATEGORIES.includes(payload.value)) PRODUCT_CATEGORIES.push(payload.value)
      form.value.category = payload.value
      adopted.value.category = payload.value
      break
    }
    case 'keyword': {
      if (adopted.value.keyword === payload.value) {
        adopted.value.keyword = null
        return
      }
      form.value.keyword = payload.value
      adopted.value.keyword = payload.value
      break
    }
    case 'tag': {
      const t = payload.value
      if (adopted.value.tags.includes(t)) {
        adopted.value.tags = adopted.value.tags.filter((x) => x !== t)
        form.value.tags = form.value.tags.filter((x) => x !== t)
        return
      }
      if (!PRODUCT_TAGS.includes(t)) PRODUCT_TAGS.push(t)
      adopted.value.tags = [...adopted.value.tags, t]
      if (!form.value.tags.includes(t)) form.value.tags = [...form.value.tags, t]
      break
    }
    case 'spec': {
      const { groupName, options } = payload.value
      const existingIdx = form.value.specs.findIndex((g) => g.name === groupName)
      if (adopted.value.specGroupNames.includes(groupName)) {
        // 撤銷：移除這個 spec group + 它對應的 variants
        adopted.value.specGroupNames = adopted.value.specGroupNames.filter((n) => n !== groupName)
        if (existingIdx !== -1) {
          form.value.specs = form.value.specs.filter((g) => g.name !== groupName)
        }
        return
      }
      // 新增 / 替換
      const newGroup: SpecGroup = {
        id: ++nextSpecId,
        name: groupName,
        options: options.map((opt) => ({ id: ++nextSpecId, name: opt })),
      }
      if (existingIdx !== -1) {
        form.value.specs = form.value.specs.map((g, i) => (i === existingIdx ? newGroup : g))
      } else if (form.value.specs.length < 2) {
        form.value.specs = [...form.value.specs, newGroup]
      } else {
        // 已達 2 層上限 → 取代最後一層
        form.value.specs = [...form.value.specs.slice(0, 1), newGroup]
      }
      adopted.value.specGroupNames = [...adopted.value.specGroupNames, groupName]
      break
    }
  }
}

function backToList(): void {
  router.push({ name: RouteName.ProductList })
}

function onCancel(): void {
  // 嵌入 dialog 時：把離開決策交回父層（dialog 統一用自家 confirm），不走 router
  if (props.embedded) {
    emit('cancel')
    return
  }
  confirm.require({
    header: '取消編輯',
    message: '尚未儲存的變更會遺失，確定要離開？',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '離開',
    rejectLabel: '繼續編輯',
    acceptClass: 'p-button-danger',
    accept: () => backToList(),
  })
}

function onSave(): void {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: '請輸入商品名稱', life: 1500 })
    return
  }
  // 新增模式：依 form 建立 ManagedProduct，push 進 managedProducts 並同步到收單 catalog
  if (isCreateMode.value) {
    const newId = Date.now()
    const variantSpecs = form.value.variants.length > 0
      ? form.value.variants.map((v, i) => {
          // 用 spec group 的 index（gi）去 optionIds 取對應 option；先前用 variant index `i` 是 bug，
          // 會讓非首個 variant 都拿不到 option name，fallback 成「規格 N」
          const names = form.value.specs.map((g, gi) => g.options.find((o) => o.id === v.optionIds[gi])?.name ?? '')
          return {
            id: v.id,
            name: names.filter(Boolean).join(' / ') || `規格 ${i + 1}`,
            stock: v.stock,
            price: v.salePrice,
            cost: v.cost,
          }
        })
      : [{ id: newId + 1, name: '單一規格', stock: form.value.noSpecVariant.stock, price: form.value.noSpecVariant.salePrice, cost: form.value.noSpecVariant.cost }]
    const newProduct: ManagedProduct = {
      id: newId,
      name: form.value.name.trim(),
      category: form.value.category,
      status: 'on_shelf',
      kind: 'normal',
      totalSold: 0,
      keyword: form.value.keyword.trim(),
      tags: [...form.value.tags],
      enableCoupon: form.value.enableCoupon,
      weight: form.value.weight,
      description: form.value.description,
      remark: form.value.remark,
      images: form.value.images.map((img) => ({ ...img })),
      specs: variantSpecs,
      specGroupNames: form.value.specs.map((g) => g.name),
    }
    addManagedProduct(newProduct)
    toast.add({ severity: 'success', summary: '已建立商品', detail: form.value.name.trim(), life: 2000 })
    if (props.embedded) {
      emit('saved', newProduct)
      return
    }
    backToList()
    return
  }
  const p = original.value
  if (!p) return
  // 寫回 mock：保留原本 id / status / kind / totalSold；
  // SpecTable 的 SpecGroup/Variant 結構簡化投影回 flat specs 讓商品列表畫面繼續正常運作：
  // - 有規格 → 每個 variant 變成一筆 spec（取第一層 option 的名稱當顯示名 + salePrice + stock）
  // - 沒規格 → 單一規格佔位（保持商品列表畫面結構一致）
  p.name = form.value.name.trim()
  p.category = form.value.category
  p.keyword = form.value.keyword.trim()
  p.tags = [...form.value.tags]
  p.enableCoupon = form.value.enableCoupon
  p.weight = form.value.weight
  p.description = form.value.description
  p.remark = form.value.remark
  p.images = form.value.images.map((img) => ({ ...img }))
  if (form.value.variants.length > 0) {
    p.specs = form.value.variants.map((v, i) => {
      // 用 spec group 的 index gi 去 optionIds 取 option name；先前用 variant index `i` 是 bug
      const names = form.value.specs.map((g, gi) => g.options.find((o) => o.id === v.optionIds[gi])?.name ?? '')
      return {
        id: v.id,
        name: names.filter(Boolean).join(' / ') || `規格 ${i + 1}`,
        stock: v.stock,
        price: v.salePrice,
        cost: v.cost,
      }
    })
    p.specGroupNames = form.value.specs.map((g) => g.name)
  } else {
    p.specs = [{ id: Date.now(), name: '單一規格', stock: 0, price: 0, cost: 0 }]
    p.specGroupNames = undefined
  }
  // 編輯完成 → 同步收單那邊的 productCatalog 對應條目
  syncManagedProduct(p.id)
  toast.add({ severity: 'success', summary: '已儲存商品變更', detail: p.name, life: 2000 })
  if (props.embedded) {
    emit('saved', p)
    return
  }
  backToList()
}

// 給 dialog 外層觸發用：dialog footer 的「建立 / 取消」按鈕透過 ref 呼叫
defineExpose({ onSave, onCancel })
</script>

<template>
  <!-- 全頁的「卡片區隔」改成「間隔線區隔」（Design.md 6.5）：
       - standalone：外層自己當大 Card（白底 + border + 圓角 + 內距），裡面區塊用 border-t 分隔
       - embedded：Dialog 已是大容器，裡面區塊也用 border-t 分隔，不再加 Card 外觀
       兩種模式共用 .embedded-form scoped CSS 把內層 <Card> 拍平 -->
  <div
    class="flex flex-col gap-4"
    :class="embedded ? '' : 'flex-1 min-h-0'"
  >
    <!-- 頁首：返回 + 標題 + 右側麵包屑（dialog 嵌入時隱藏，header 由 Dialog 自己處理） -->
    <div v-if="!embedded" class="flex items-center gap-3">
      <Button
        v-tooltip.bottom="'返回商品列表'"
        icon="pi pi-arrow-left"
        severity="secondary"
        rounded
        text
        @click="backToList"
      />
      <h2 class="cursor-default text-2xl font-bold text-neutral-700 dark:text-neutral-100">{{ pageTitle }}</h2>

      <div class="ml-auto flex items-center gap-2 text-sm">
        <button
          class="text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]"
          @click="backToList"
        >商品管理</button>
        <i class="pi pi-chevron-right text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
        <span class="text-[var(--p-primary-color)] cursor-default">{{ pageTitle }}</span>
      </div>
    </div>

    <!-- 內容包裝：standalone 模式自身當 Card-like 容器（白底 + 圓角，無外框避免下方按鈕上方多出邊框線）
         內部區塊用 divide-y 間隔線分隔 -->
    <div
      class="flex flex-col px-6 divide-y divide-[var(--p-content-border-color)]"
      :class="[
        embedded ? '!px-0' : 'flex-1 min-h-0 overflow-y-auto bg-[var(--p-content-background)] rounded-lg',
        readonly ? 'readonly-form' : '',
      ]"
    >
      <!-- 商品資料 -->
      <section class="relative py-6 first:pt-0">
        <h3 class="text-lg font-bold text-[var(--p-text-color)] mb-4">商品資料</h3>
        <!-- AI 浮動按鈕（檢視模式隱藏） -->
        <button
          v-if="!readonly"
          v-tooltip.left="'AI 建議'"
          class="absolute top-5 right-0 size-[44px] rounded-full bg-primary text-white text-[13px] font-bold flex items-center justify-center shadow-md hover:opacity-90"
          @click="aiPanelVisible = true"
        >AI</button>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">
              <span v-if="!readonly" class="text-red-600 mr-1">*</span>商品名稱
            </label>
            <InputText v-if="!readonly" v-model="form.name" placeholder="請輸入商品名稱" class="w-full" />
            <span v-else class="field-value">{{ form.name || '—' }}</span>
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">商品類別</label>
            <Select
              v-if="!readonly"
              v-model="form.category"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              placeholder="請選擇商品類別"
              class="w-full"
            />
            <span v-else class="field-value">{{ form.category || '—' }}</span>
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">直播關鍵字</label>
            <InputText v-if="!readonly" v-model="form.keyword" placeholder="可設定直播使用關鍵字加單" class="w-full" />
            <span v-else class="field-value">{{ form.keyword || '—' }}</span>
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">標籤</label>
            <MultiSelect
              v-if="!readonly"
              v-model="form.tags"
              :options="tagOptions"
              option-label="label"
              option-value="value"
              placeholder="請選擇商品標籤"
              class="w-full"
              display="chip"
            />
            <div v-else class="flex flex-wrap gap-2">
              <span
                v-for="t in form.tags"
                :key="t"
                class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--p-content-hover-background)] text-[var(--p-text-color)]"
              >{{ t }}</span>
              <span v-if="form.tags.length === 0" class="text-sm text-[var(--p-text-muted-color)]">—</span>
            </div>
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">啟用優惠券</label>
            <ToggleSwitch v-if="!readonly" v-model="form.enableCoupon" />
            <span v-else class="field-value">{{ form.enableCoupon ? '啟用' : '未啟用' }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">商品重量（公克）</label>
            <InputNumber v-if="!readonly" v-model="form.weight" :min="0" suffix=" g" class="w-full" />
            <span v-else class="field-value">{{ form.weight ?? 0 }} g</span>
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">商品介紹</label>
            <Editor v-if="!readonly" v-model="form.description" editor-style="height: 320px" />
            <!-- 純文字版：Editor 輸出為 HTML，直接 v-html 渲染 -->
            <div
              v-else-if="form.description"
              class="field-value leading-relaxed"
              v-html="form.description"
            ></div>
            <span v-else class="text-sm text-[var(--p-text-muted-color)]">—</span>
          </div>
        </div>
      </section>

      <!-- 商品圖片 -->
      <section class="py-6">
        <h3 class="text-lg font-bold text-[var(--p-text-color)] mb-4">商品圖片</h3>
        <MultiImageUploader
          v-if="!readonly"
          v-model:images="form.images"
          :max-count="8"
          :aspect-ratio="1"
        />
        <!-- 檢視模式：只顯示縮圖，不能上傳 / 刪除 -->
        <div v-else-if="form.images.length" class="flex flex-wrap gap-2">
          <div
            v-for="img in form.images"
            :key="img.id"
            class="w-[96px] h-[96px] rounded-md overflow-hidden border border-[var(--p-content-border-color)]"
          >
            <img :src="img.url" :alt="img.filename ?? ''" class="w-full h-full object-cover" />
          </div>
        </div>
        <span v-else class="text-sm text-[var(--p-text-muted-color)]">—</span>
      </section>

      <!-- 銷售設定（沒規格時） -->
      <section v-if="form.specs.length === 0" class="py-6">
        <h3 class="text-lg font-bold text-[var(--p-text-color)] mb-4">銷售設定</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">成本價</label>
            <InputNumber v-if="!readonly" v-model="form.noSpecVariant.cost" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            <span v-else class="field-value">NT$ {{ form.noSpecVariant.cost.toLocaleString() }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">原價</label>
            <InputNumber v-if="!readonly" v-model="form.noSpecVariant.originalPrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            <span v-else class="field-value">NT$ {{ form.noSpecVariant.originalPrice.toLocaleString() }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">售價</label>
            <InputNumber v-if="!readonly" v-model="form.noSpecVariant.salePrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            <span v-else class="field-value">NT$ {{ form.noSpecVariant.salePrice.toLocaleString() }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">庫存</label>
            <InputNumber v-if="!readonly" v-model="form.noSpecVariant.stock" :min="0" class="w-full" />
            <span v-else class="field-value">{{ form.noSpecVariant.stock.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="!readonly" class="py-8 flex flex-col items-center gap-4">
          <p class="text-sm text-color-secondary">此商品尚未設定規格，您可以設定商品規格（例如：顏色、尺寸）</p>
          <Button label="建立規格" icon="pi pi-plus" @click="enableSpec" />
        </div>
      </section>

      <!-- 規格設定（有規格時）：SpecTable 內部 Card 已改 section，掛 .form-section-wrap 維持與其他區塊一致的 py-6 -->
      <div v-else class="form-section-wrap py-6">
        <SpecTable
          v-model:specs="form.specs"
          v-model:variants="form.variants"
          :readonly="readonly"
          @close-spec="form.specs = []; form.variants = []"
        />
      </div>

      <!-- 多件優惠：PromoteTable 內部 Card 已改 section -->
      <div class="form-section-wrap py-6">
        <PromoteTable v-model="form.promote" :readonly="readonly" />
      </div>

      <!-- 商品詳情：商品備註 -->
      <section class="py-6">
        <h3 class="text-lg font-bold text-[var(--p-text-color)] mb-4">商品詳情</h3>
        <div class="grid grid-cols-1 gap-4 max-w-2xl">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-color">商品備註</label>
            <Textarea v-if="!readonly" v-model="form.remark" rows="5" placeholder="僅內部可見的備註，前台不顯示" class="w-full" />
            <div v-else-if="form.remark" class="field-value whitespace-pre-wrap">{{ form.remark }}</div>
            <span v-else class="text-sm text-[var(--p-text-muted-color)]">—</span>
          </div>
        </div>
      </section>
    </div>

    <!-- 底部操作列（dialog 嵌入時隱藏，footer 由 Dialog 自己處理）
         上方內容包裝已自帶 border 邊框，這列不再加 border-t -->
    <div
      v-if="!embedded"
      class="flex items-center justify-end gap-2"
    >
      <Button label="取消" severity="secondary" outlined @click="onCancel" />
      <Button :label="isCreateMode ? '建立商品' : '儲存變更'" icon="pi pi-save" @click="onSave" />
    </div>

    <!-- AI 建議面板 -->
    <AISuggestPanel
      v-model:visible="aiPanelVisible"
      :adopted-product-name="adopted.productName"
      :adopted-description="adopted.description"
      :adopted-category="adopted.category"
      :adopted-keyword="adopted.keyword"
      :adopted-tags="adopted.tags"
      :adopted-spec-group-names="adopted.specGroupNames"
      @apply="applyAi"
    />
  </div>
</template>

<style scoped>
/* SpecTable / PromoteTable 內部仍是 <Card>，在 .form-section-wrap 內把它拍平
   以對齊上下「以 divide-y 間隔線分隔」的視覺 — 之後若把那兩個子元件也改成 section
   可以拿掉這段 */
.form-section-wrap :deep(.p-card) {
  box-shadow: none;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.form-section-wrap :deep(.p-card-body),
.form-section-wrap :deep(.p-card-content) {
  padding: 0;
}

/* 檢視模式（Figma 7864-2011）：label 變小變淡、value 變粗變大 */
.readonly-form label {
  font-size: 12px;
  font-weight: 400;
  color: var(--p-text-muted-color);
}
.readonly-form .field-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 24px;
}
</style>
