<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { RouteName } from '@/admin/router'
import { PRODUCT_CATEGORIES, PRODUCT_TAGS } from './utils/productMock'
import PromoteTable, { type PromoteData } from './components/PromoteTable.vue'
import MultiImageUploader, { type UploaderItem } from './components/MultiImageUploader.vue'
import BundleContentsCard, { type BundleItem } from './components/BundleContentsCard.vue'
import AISuggestPanel, { type AiApplyPayload } from './components/AISuggestPanel.vue'

/**
 * 新增組合商品頁面（mirror 編輯商品頁版型，但：
 * - 商品名稱 / 商品介紹 → 組合商品名稱 / 組合商品介紹
 * - 規格設定 / 銷售設定 → 組合商品內容 Card（含子商品表 + 備註）
 * - 商品詳情 Card 移除（備註已併入組合商品內容）
 *
 * 走 mock：onSave 只跳 toast，不真的 push 到 productMock。
 */

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

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
  promote: PromoteData
}

const form = ref<FormState>({
  name: '',
  category: '',
  keyword: '',
  tags: [],
  enableCoupon: false,
  weight: 0,
  description: '',
  images: [],
  bundleItems: [
    { key: 'p-1001', productId: 1001, name: '新款 秋冬慵懶軟糯毛衣 吊帶連衣裙套裝(外套)', stock: 60, quantity: 1, maxPerPurchase: null },
    { key: 'p-1002', productId: 1002, name: '秋冬加絨加厚雷絲拼接假兩件 連衣裙 遮胖顯瘦長裙', stock: 9, quantity: 1, maxPerPurchase: 3 },
    { key: 'p-1003', productId: 1003, name: '秋冬加厚寬鬆 連衣裙加絨長款連帽衣', stock: 5, quantity: 2, maxPerPurchase: null },
  ],
  bundleRemark: '',
  promote: { startAt: null, endAt: null, tiers: [] },
})

const categoryOptions = PRODUCT_CATEGORIES.map((c) => ({ label: c, value: c }))
const tagOptions = PRODUCT_TAGS.map((c) => ({ label: c, value: c }))

function backToList(): void {
  router.push({ name: RouteName.ProductList })
}

function onCancel(): void {
  confirm.require({
    header: '取消新增',
    message: '尚未儲存的內容會遺失，確定離開？',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '離開',
    rejectLabel: '繼續編輯',
    acceptClass: 'p-button-danger',
    accept: () => backToList(),
  })
}

function onSave(): void {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: '請輸入組合商品名稱', life: 1500 })
    return
  }
  // prototype: 不真的寫入 managedProducts，跳 toast + 回列表
  toast.add({ severity: 'success', summary: '已建立組合商品', detail: form.value.name, life: 2000 })
  backToList()
}

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
  <div class="flex flex-col gap-4 flex-1 min-h-0">
    <!-- 頁首 -->
    <div class="flex items-center gap-3">
      <Button
        v-tooltip.bottom="'返回商品列表'"
        icon="pi pi-arrow-left"
        severity="secondary"
        rounded
        text
        @click="backToList"
      />
      <h2 class="cursor-default text-2xl font-bold text-neutral-700 dark:text-neutral-100">新增組合商品</h2>

      <div class="ml-auto flex items-center gap-2 text-sm">
        <button
          class="text-color-secondary hover:text-color"
          @click="backToList"
        >商品管理</button>
        <i class="pi pi-chevron-right text-color-secondary" style="font-size: 10px"></i>
        <span class="text-primary cursor-default">新增組合商品</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      <!-- 商品資料 -->
      <Card class="relative">
        <template #title>商品資料</template>
        <template #content>
          <button
            v-tooltip.left="'AI 建議'"
            class="absolute top-5 right-5 size-[44px] rounded-full bg-primary text-white text-[13px] font-bold flex items-center justify-center shadow-md hover:opacity-90"
            @click="aiPanelVisible = true"
          >AI</button>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">
                <span class="text-red-600 mr-1">*</span>組合商品名稱
              </label>
              <InputText v-model="form.name" placeholder="請輸入組合商品名稱" class="w-full" />
            </div>

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

            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">直播關鍵字</label>
              <InputText v-model="form.keyword" placeholder="可設定直播使用關鍵字加單" class="w-full" />
            </div>

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

            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">啟用優惠券</label>
              <ToggleSwitch v-model="form.enableCoupon" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">商品重量（公克）</label>
              <InputNumber v-model="form.weight" :min="0" suffix=" g" class="w-full" />
            </div>

            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-sm font-bold text-color">組合商品介紹</label>
              <Editor v-model="form.description" editor-style="height: 320px" />
            </div>
          </div>
        </template>
      </Card>

      <!-- 商品圖片 -->
      <Card>
        <template #title>商品圖片</template>
        <template #content>
          <MultiImageUploader v-model:images="form.images" :max-count="8" :aspect-ratio="1" />
        </template>
      </Card>

      <!-- 組合商品內容 -->
      <BundleContentsCard
        v-model:items="form.bundleItems"
        v-model:remark="form.bundleRemark"
      />

      <!-- 多件優惠 -->
      <PromoteTable v-model="form.promote" />
    </div>

    <!-- 底部 sticky 操作列 -->
    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[var(--p-content-border-color)] bg-[var(--p-content-background)]">
      <Button label="取消" severity="secondary" outlined @click="onCancel" />
      <Button label="建立組合商品" icon="pi pi-save" @click="onSave" />
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
