<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { RouteName } from '@/admin/router'
import {
  managedProducts,
  PRODUCT_CATEGORIES,
  PRODUCT_TAGS,
  addManagedProduct,
  syncManagedProduct,
  totalStockOf,
  type ManagedBundleItem,
  type ManagedProduct,
} from './utils/productMock'
import PromoteTable, { type PromoteData } from './components/PromoteTable.vue'
import MultiImageUploader, { type UploaderItem } from './components/MultiImageUploader.vue'
import BundleContentsCard, { type BundleItem, type BundleMode } from './components/BundleContentsCard.vue'
import AISuggestPanel, { type AiApplyPayload } from './components/AISuggestPanel.vue'

/**
 * 新增 / 編輯組合商品頁面（與 ProductUpdatePage 同樣 dual-mode：route.name 判 create / update）：
 * - 商品名稱 / 商品介紹 → 組合商品名稱 / 組合商品介紹
 * - 規格設定 / 銷售設定 → 組合商品內容 Card（子商品表 + 備註）；
 *   表內每列「商品名稱」= 子商品的商品名稱（由 productId 反查 managedProducts）
 * - 商品詳情 Card 移除（備註已併入組合商品內容）
 */

/**
 * Props：支援兩種使用模式
 * - 一般 route page（embedded=false）
 * - dialog 嵌入（embedded=true）：藏頁首返回 / 麵包屑 + sticky footer，由父元件
 *   （ProductBundleCreateDialog）統一管 Dialog header / footer
 */
const props = withDefaults(defineProps<{
  embedded?: boolean
  /** dialog 嵌入模式時，預填子商品（如從 picker 已勾選項目轉換而來） */
  initialBundleItems?: BundleItem[]
  /** dialog 嵌入模式時，若帶 id 視為「編輯」該組合商品；不帶 = 新增 */
  initialProductId?: number
  /** 純檢視模式：所有 input 鎖住、AI / 儲存 button 由父層隱藏 */
  readonly?: boolean
}>(), {
  embedded: false,
  initialBundleItems: () => [],
  initialProductId: undefined,
  readonly: false,
})
const emit = defineEmits<{
  saved: [product: ManagedProduct]
  cancel: []
  /** 嵌入模式:同步 canSave 給父層 Dialog 的 footer 儲存按鈕使用 */
  'can-save-change': [value: boolean]
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

/** 嵌入帶 initialProductId = 編輯；嵌入無 id = 新增；route 模式照 route.name 判斷 */
const isUpdateMode = computed(() => {
  if (props.embedded) return !!props.initialProductId
  return route.name === RouteName.ProductBundleUpdate
})
const productId = computed(() =>
  props.embedded ? (props.initialProductId ?? NaN) : Number(route.params.id),
)
const original = computed<ManagedProduct | undefined>(() =>
  managedProducts.find((p) => p.id === productId.value),
)
const pageTitle = computed(() => isUpdateMode.value ? '編輯組合商品' : '新增組合商品')

interface FormState {
  name: string
  category: string
  keyword: string
  tags: string[]
  enableCoupon: boolean
  weight: number
  description: string
  images: UploaderItem[]
  bundleItems: BundleItem[]
  bundleRemark: string
  /** 組合類型：固定（套組）/ 任選（mix-and-match） */
  bundleMode: BundleMode
  /** 任選模式：買家總共可選件數 */
  bundleTotalPick: number
  promote: PromoteData
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
    images: [],
    bundleItems: [],
    bundleRemark: '',
    bundleMode: 'fixed',
    bundleTotalPick: 1,
    promote: { startAt: null, endAt: null, tiers: [] },
  }
}

/**
 * 把 MP.bundleItems 投影成 BundleContentsCard 用的 BundleItem：
 * - 反查 managedProducts / productCatalog 拿到「商品名稱」與庫存
 * - key 比照 BundleContentsCard 慣例：單一商品 `p-{productId}`、規格 `s-{productId}-{specId}`
 */
function adaptBundleItems(p: ManagedProduct): BundleItem[] {
  return (p.bundleItems ?? []).map((it) => {
    const child = managedProducts.find((m) => m.id === it.productId)
    const spec = it.specId && child
      ? child.specs.find((s) => s.id === it.specId)
      : undefined
    const name = spec
      ? `${child?.name ?? ''} - ${spec.name}`
      : (child?.name ?? `商品 #${it.productId}`)
    const stock = spec
      ? spec.stock
      : (child ? totalStockOf(child) : 0)
    const key = it.specId
      ? `s-${it.productId}-${it.specId}`
      : `p-${it.productId}`
    return {
      key,
      productId: it.productId,
      specId:    it.specId,
      name,
      stock,
      quantity: it.qty,
      maxPerPurchase: it.maxPerPurchase ?? null,
    }
  })
}

onMounted(() => {
  // dialog 嵌入 + 新增模式（無 initialProductId）→ 可預填子商品，不載入既有 MP
  if (props.embedded && !isUpdateMode.value) {
    if (props.initialBundleItems.length > 0) {
      form.value.bundleItems = props.initialBundleItems.map((it) => ({ ...it }))
    }
    return
  }
  if (!isUpdateMode.value) return
  const p = original.value
  if (!p || p.kind !== 'bundle') {
    toast.add({ severity: 'warn', summary: '找不到組合商品', life: 1800 })
    if (props.embedded) emit('cancel')
    else router.replace({ name: RouteName.ProductList })
    return
  }
  form.value = {
    name: p.name,
    category: p.category,
    keyword: p.keyword ?? '',
    tags: [...(p.tags ?? [])],
    enableCoupon: p.enableCoupon ?? false,
    weight: p.weight ?? 0,
    description: p.description ?? '',
    images: (p.images ?? []).map((img) => ({ ...img })),
    bundleItems: adaptBundleItems(p),
    bundleRemark: p.remark ?? '',
    bundleMode: p.bundleMode ?? 'fixed',
    bundleTotalPick: p.bundleTotalPick ?? 1,
    promote: { startAt: null, endAt: null, tiers: [] },
  }
})

const categoryOptions = PRODUCT_CATEGORIES.map((c) => ({ label: c, value: c }))
const tagOptions = PRODUCT_TAGS.map((c) => ({ label: c, value: c }))

function backToList(): void {
  router.push({ name: RouteName.ProductList })
}

function onCancel(): void {
  if (props.embedded) {
    emit('cancel')
    return
  }
  confirm.require({
    header: isUpdateMode.value ? '取消編輯' : '取消新增',
    message: '尚未儲存的內容會遺失，確定離開？',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '離開',
    rejectLabel: '繼續編輯',
    acceptClass: 'p-button-danger',
    accept: () => backToList(),
  })
}

/** 組合商品至少要 2 個子商品才合理（< 2 就不算「組合」）。給 dialog footer disable 用 */
const canSave = computed(() =>
  form.value.name.trim() !== '' && form.value.bundleItems.length >= 2,
)
// 嵌入 Dialog 時透過 emit 主動同步 canSave,避免透過 template ref 讀 ComputedRef.value 追不到變化
watch(canSave, (v) => emit('can-save-change', v), { immediate: true })

function onSave(): void {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: '請輸入組合商品名稱', life: 1500 })
    return
  }
  if (form.value.bundleItems.length < 2) {
    toast.add({ severity: 'warn', summary: '組合商品至少需要 2 個子商品', life: 1800 })
    return
  }
  const bundleItems: ManagedBundleItem[] = form.value.bundleItems.map((it) => ({
    productId: it.productId,
    specId:    it.specId,
    qty:       it.quantity,
    maxPerPurchase: it.maxPerPurchase,
  }))
  // 組合商品：庫存以 min(子商品 stock) 預估
  const bundleStock = form.value.bundleItems.length
    ? Math.min(...form.value.bundleItems.map((it) => it.stock))
    : 0

  if (isUpdateMode.value) {
    const p = original.value
    if (!p) return
    p.name = form.value.name.trim()
    p.category = form.value.category
    p.keyword = form.value.keyword.trim()
    p.tags = [...form.value.tags]
    p.enableCoupon = form.value.enableCoupon
    p.weight = form.value.weight
    p.description = form.value.description
    p.remark = form.value.bundleRemark
    p.images = form.value.images.map((img) => ({ ...img }))
    p.bundleItems = bundleItems
    p.bundleStock = bundleStock
    p.bundleMode = form.value.bundleMode
    p.bundleTotalPick = form.value.bundleMode === 'pick' ? form.value.bundleTotalPick : undefined
    // 保留既有 bundlePrice；如未設過則沿用 0
    p.bundlePrice = p.bundlePrice ?? 0
    p.specs = [{ id: p.specs[0]?.id ?? Date.now(), name: '單一規格', stock: bundleStock, price: p.bundlePrice ?? 0 }]
    syncManagedProduct(p.id)
    toast.add({ severity: 'success', summary: '已儲存組合商品變更', detail: p.name, life: 2000 })
    if (props.embedded) {
      emit('saved', p)
      return
    }
    backToList()
    return
  }

  const newId = Date.now()
  const newProduct: ManagedProduct = {
    id: newId,
    name: form.value.name.trim(),
    category: form.value.category,
    status: 'on_shelf',
    kind: 'bundle',
    totalSold: 0,
    keyword: form.value.keyword.trim(),
    tags: [...form.value.tags],
    enableCoupon: form.value.enableCoupon,
    weight: form.value.weight,
    description: form.value.description,
    remark: form.value.bundleRemark,
    images: form.value.images.map((img) => ({ ...img })),
    specs: [{ id: newId + 1, name: '單一規格', stock: bundleStock, price: 0 }],
    bundleItems,
    bundlePrice: 0,
    bundleStock,
    bundleMode: form.value.bundleMode,
    bundleTotalPick: form.value.bundleMode === 'pick' ? form.value.bundleTotalPick : undefined,
  }
  addManagedProduct(newProduct)
  toast.add({ severity: 'success', summary: '已建立組合商品', detail: form.value.name, life: 2000 })
  if (props.embedded) {
    emit('saved', newProduct)
    return
  }
  backToList()
}

// 給 dialog 外層觸發用
defineExpose({ onSave, onCancel, canSave })

// ── AI 建議面板 ───────────────────────────────────
const aiPanelVisible = ref(false)
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

function applyAi(payload: AiApplyPayload): void {
  switch (payload.kind) {
    case 'productName':
      if (adopted.value.productName === payload.value) { adopted.value.productName = null; return }
      form.value.name = payload.value
      adopted.value.productName = payload.value
      break
    case 'description':
      if (adopted.value.description === payload.value) { adopted.value.description = null; return }
      form.value.description = payload.value
      adopted.value.description = payload.value
      break
    case 'category':
      if (adopted.value.category === payload.value) { adopted.value.category = null; return }
      if (!PRODUCT_CATEGORIES.includes(payload.value)) PRODUCT_CATEGORIES.push(payload.value)
      form.value.category = payload.value
      adopted.value.category = payload.value
      break
    case 'keyword':
      if (adopted.value.keyword === payload.value) { adopted.value.keyword = null; return }
      form.value.keyword = payload.value
      adopted.value.keyword = payload.value
      break
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
    case 'spec':
      // 組合商品不走 spec 流程，AI 建議的規格忽略
      break
  }
}
</script>

<template>
  <!-- 卡片區隔 → 間隔線區隔（Design.md 6.5）：
       - standalone：外層當大 Card（白底 + 邊框 + 圓角 + 內距），裡面區塊以 border-t 分隔
       - embedded：Dialog 已是大容器，裡面區塊也以 border-t 分隔 -->
  <div
    class="flex flex-col gap-4"
    :class="embedded ? '' : 'flex-1 min-h-0'"
  >
    <!-- 頁首：dialog 嵌入時隱藏，由 Dialog header 處理 -->
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
          class="text-color-secondary hover:text-color"
          @click="backToList"
        >商品管理</button>
        <i class="pi pi-chevron-right text-color-secondary" style="font-size: 10px"></i>
        <span class="text-primary cursor-default">{{ pageTitle }}</span>
      </div>
    </div>

    <!-- 內容包裝：standalone 自身當大 Card-like 容器（白底 + 圓角，無外框避免下方按鈕上方多出邊框線）
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
        <button
          v-if="!readonly"
          v-tooltip.left="'AI 建議'"
          class="absolute top-5 right-0 size-[44px] rounded-full bg-primary text-white text-[13px] font-bold flex items-center justify-center shadow-md hover:opacity-90"
          @click="aiPanelVisible = true"
        >AI</button>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-sm font-bold text-color">
              <span v-if="!readonly" class="text-red-600 mr-1">*</span>組合商品名稱
            </label>
            <InputText v-if="!readonly" v-model="form.name" placeholder="請輸入組合商品名稱" class="w-full" />
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
            <label class="text-sm font-bold text-color">組合商品介紹</label>
            <Editor v-if="!readonly" v-model="form.description" editor-style="height: 320px" />
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

      <!-- 組合商品內容（內部仍是 Card，靠 .form-section-wrap 拍平對齊） -->
      <div class="form-section-wrap py-6" :class="readonly ? 'pointer-events-none opacity-90' : ''">
        <BundleContentsCard
          v-model:items="form.bundleItems"
          v-model:remark="form.bundleRemark"
          v-model:mode="form.bundleMode"
          v-model:total-pick="form.bundleTotalPick"
          :hide-pick-products="embedded && initialBundleItems.length > 0"
        />
      </div>

      <!-- 多件優惠 -->
      <div class="form-section-wrap py-6">
        <PromoteTable v-model="form.promote" :readonly="readonly" />
      </div>
    </div>

    <!-- 底部操作列：dialog 嵌入時隱藏，由 Dialog footer 處理。
         上方內容包裝已自帶 border 邊框，這列不再加 border-t（避免重複線條） -->
    <div
      v-if="!embedded"
      class="flex items-center justify-end gap-2"
    >
      <Button label="取消" severity="secondary" outlined @click="onCancel" />
      <Button :label="isUpdateMode ? '儲存變更' : '建立組合商品'" icon="pi pi-save" @click="onSave" />
    </div>

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
/* BundleContentsCard / PromoteTable 內部仍是 <Card>，靠 .form-section-wrap 拍平
   對齊上下「以 divide-y 間隔線分隔」的視覺 */
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
