<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { RouteName } from '@/admin/router'
import {
  managedProducts,
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

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const productId = computed(() => Number(route.params.id))
const original = computed<ManagedProduct | undefined>(() =>
  managedProducts.find((p) => p.id === productId.value),
)

/** 路由名稱 = product.create，或 id 缺/找不到對應商品 → 視為新增模式 */
const isCreateMode = computed(() => route.name === RouteName.ProductCreate || !route.params.id)
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
  return {
    specs: [{ id: groupId, name: '規格', options }],
    variants,
  }
}

onMounted(() => {
  // 新增模式：不載入既有資料，form 維持 emptyForm()
  if (isCreateMode.value) return
  const p = original.value
  if (!p) {
    toast.add({ severity: 'warn', summary: '找不到商品', life: 1800 })
    router.replace({ name: RouteName.ProductList })
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
  // 新增模式：prototype 不真的 push 到 mock，只跳 toast 後回列表
  if (isCreateMode.value) {
    toast.add({ severity: 'success', summary: '已建立商品', detail: form.value.name.trim(), life: 2000 })
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
      const names = form.value.specs.map((g) => g.options.find((o) => o.id === v.optionIds[i])?.name ?? '')
      return {
        id: v.id,
        name: names.filter(Boolean).join(' / ') || `規格 ${i + 1}`,
        stock: v.stock,
        price: v.salePrice,
      }
    })
  } else {
    p.specs = [{ id: Date.now(), name: '單一規格', stock: 0, price: 0 }]
  }
  toast.add({ severity: 'success', summary: '已儲存商品變更', detail: p.name, life: 2000 })
  backToList()
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1 min-h-0">
    <!-- 頁首：返回 + 標題 + 右側麵包屑 -->
    <div class="flex items-center gap-3">
      <Button
        v-tooltip.bottom="'返回商品列表'"
        icon="pi pi-arrow-left"
        severity="secondary"
        rounded
        text
        @click="backToList"
      />
      <h2 class="cursor-default text-2xl font-bold text-neutral-700 dark:text-neutral-100">{{ pageTitle }}</h2>

      <div class="ml-auto flex items-center gap-2 text-[14px]">
        <button
          class="text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]"
          @click="backToList"
        >商品管理</button>
        <i class="pi pi-chevron-right text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
        <span class="text-[var(--p-primary-color)] cursor-default">{{ pageTitle }}</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      <!-- 商品資料：對齊 portal-vue ProductForm 的「基本資料區塊」layout：
           Card #title + 2-column grid (max-w-2xl)、商品重量單欄、其他欄位 col-span-2 全寬 -->
      <Card class="relative">
        <template #title>商品資料</template>
        <template #content>
          <!-- AI 浮動按鈕：點下展開右側 AISuggestPanel -->
          <button
            v-tooltip.left="'AI 建議'"
            class="absolute top-5 right-5 size-[44px] rounded-full bg-primary text-white text-[13px] font-bold flex items-center justify-center shadow-md hover:opacity-90"
            @click="aiPanelVisible = true"
          >AI</button>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <!-- 商品名稱 -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">
                <span class="text-red-600 mr-1">*</span>商品名稱
              </label>
              <InputText v-model="form.name" placeholder="請輸入商品名稱" class="w-full" />
            </div>

            <!-- 商品類別 -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">商品類別</label>
              <Select
                v-model="form.category"
                :options="categoryOptions"
                option-label="label"
                option-value="value"
                placeholder="請選擇商品類別"
                class="w-full"
              />
            </div>

            <!-- 直播關鍵字 -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">直播關鍵字</label>
              <InputText v-model="form.keyword" placeholder="可設定直播使用關鍵字加單" class="w-full" />
            </div>

            <!-- 商品標籤 -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">標籤</label>
              <MultiSelect
                v-model="form.tags"
                :options="tagOptions"
                option-label="label"
                option-value="value"
                placeholder="請選擇商品標籤"
                class="w-full"
                display="chip"
              />
            </div>

            <!-- 啟用優惠券 -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">啟用優惠券</label>
              <ToggleSwitch v-model="form.enableCoupon" />
            </div>

            <!-- 商品重量（單欄） -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">商品重量（公克）</label>
              <InputNumber v-model="form.weight" :min="0" suffix=" g" class="w-full" />
            </div>

            <!-- 商品介紹（Quill） -->
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">商品介紹</label>
              <Editor v-model="form.description" editor-style="height: 320px" />
            </div>
          </div>
        </template>
      </Card>

      <!-- 商品圖片：多圖上傳（MultiImageUploader） -->
      <Card>
        <template #title>商品圖片</template>
        <template #content>
          <MultiImageUploader
            v-model:images="form.images"
            :max-count="8"
            :aspect-ratio="1"
          />
        </template>
      </Card>

      <!-- 銷售設定（沒規格時）：4 個價格 / 庫存欄位 + 建立規格按鈕 -->
      <Card v-if="form.specs.length === 0">
        <template #title>銷售設定</template>
        <template #content>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">成本價</label>
              <InputNumber v-model="form.noSpecVariant.cost" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">原價</label>
              <InputNumber v-model="form.noSpecVariant.originalPrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">售價</label>
              <InputNumber v-model="form.noSpecVariant.salePrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">庫存</label>
              <InputNumber v-model="form.noSpecVariant.stock" :min="0" class="w-full" />
            </div>
          </div>
          <div class="py-8 flex flex-col items-center gap-4">
            <p class="text-sm text-color-secondary">此商品尚未設定規格，您可以設定商品規格（例如：顏色、尺寸）</p>
            <Button label="建立規格" icon="pi pi-plus" @click="enableSpec" />
          </div>
        </template>
      </Card>

      <!-- 規格設定（有規格時）：SpecTable v-model -->
      <SpecTable
        v-else
        v-model:specs="form.specs"
        v-model:variants="form.variants"
        @close-spec="form.specs = []; form.variants = []"
      />

      <!-- 多件優惠：PromoteTable v-model -->
      <PromoteTable v-model="form.promote" />

      <!-- 商品詳情：對齊 portal-vue 「商品備註」 -->
      <Card>
        <template #title>商品詳情</template>
        <template #content>
          <div class="grid grid-cols-1 gap-4 max-w-2xl">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">商品備註</label>
              <Textarea v-model="form.remark" rows="5" placeholder="僅內部可見的備註，前台不顯示" class="w-full" />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- 底部 sticky 操作列 -->
    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[var(--p-content-border-color)] bg-[var(--p-content-background)]">
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
