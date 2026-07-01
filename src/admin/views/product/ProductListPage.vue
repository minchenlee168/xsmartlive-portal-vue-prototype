<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import type { MenuItem } from 'primevue/menuitem'
import {
  managedProducts,
  removeManagedProducts,
  totalStockOf,
  priceRangeOf,
  type ManagedProduct,
  type ProductStatus,
} from './utils/productMock'
import StockBatchAdjustDialog, { type StockAdjustmentPayload } from './components/StockBatchAdjustDialog.vue'
import ProductCreateDialog from './components/ProductCreateDialog.vue'
import ProductBundleCreateDialog from './components/ProductBundleCreateDialog.vue'

/**
 * 商品管理 → 商品列表頁。
 *
 * 結構：
 * - 頁首：標題 + 搜尋 InputGroup + 右側 3 顆動作鈕（批次刪除 / 新增組合商品 / 新增一般商品）
 * - 每筆商品是一張 Card：
 *   - Header：checkbox + 商品名 + 上架狀態 Tag + 動作 icons（檢視 / 編輯 / 刪除 / 更多 / 展開）
 *   - 摘要列（淺灰底）：分類 / 價格 / 總庫存 / 總銷量
 *   - 展開規格 table：規格名稱 / 庫存 / 價格
 */

const confirm = useConfirm()
const toast = useToast()

const keyword = ref('')
// 商品類型篩選：兩個都勾或都不勾 → 顯示全部；只勾一個 → 只顯示那一類
const filterNormal = ref(false)
const filterBundle = ref(false)
// 直接讀共用 managedProducts（reactive）；刪除走 removeManagedProducts 同步收單 catalog
const products = managedProducts
const selectedIds = ref<Set<number>>(new Set())
const expandedIds = ref<Set<number>>(new Set(managedProducts.map(p => p.id))) // 預設全展開比照 Figma

const filteredProducts = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  const onlyOneKind = filterNormal.value !== filterBundle.value
  return products.filter((p) => {
    if (onlyOneKind) {
      if (filterNormal.value && p.kind !== 'normal') return false
      if (filterBundle.value && p.kind !== 'bundle') return false
    }
    if (!k) return true
    return p.name.toLowerCase().includes(k) || p.category.toLowerCase().includes(k)
  })
})

// ── 分頁：一頁 10 筆 ─────────────────────────────
const PAGE_SIZE = 10
const pageFirst = ref(0)
const pagedProducts = computed(() =>
  filteredProducts.value.slice(pageFirst.value, pageFirst.value + PAGE_SIZE),
)
// 篩選改變時回到第 1 頁（避免空頁）
watch(filteredProducts, () => { pageFirst.value = 0 })

/** 商品狀態 → PrimeVue Tag severity（Design.md 二 語意色） */
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
function statusMeta(status: ProductStatus): { label: string; severity: TagSeverity } {
  if (status === 'on_shelf')  return { label: '上架', severity: 'info' }
  if (status === 'off_shelf') return { label: '下架', severity: 'secondary' }
  return { label: '草稿', severity: 'warn' }
}

function toggleExpand(id: number): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}
function isExpanded(id: number): boolean { return expandedIds.value.has(id) }

function toggleSelect(id: number): void {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function isSelected(id: number): boolean { return selectedIds.value.has(id) }

// 全選 checkbox：以「當前頁可見商品」為操作範圍
const allSelected = computed<boolean>({
  get: () => pagedProducts.value.length > 0 && pagedProducts.value.every(p => selectedIds.value.has(p.id)),
  set: (v: boolean) => {
    const next = new Set(selectedIds.value)
    if (v) pagedProducts.value.forEach(p => next.add(p.id))
    else pagedProducts.value.forEach(p => next.delete(p.id))
    selectedIds.value = next
  },
})

function onBatchDelete(): void {
  if (selectedIds.value.size === 0) {
    toast.add({ severity: 'warn', summary: '請先勾選要刪除的商品', life: 1500 })
    return
  }
  confirm.require({
    header: '批次刪除商品',
    message: `確定刪除選取的 ${selectedIds.value.size} 筆商品嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      const ids = selectedIds.value
      removeManagedProducts(ids)
      toast.add({ severity: 'success', summary: `已刪除 ${ids.size} 筆商品`, life: 1500 })
      selectedIds.value = new Set()
    },
  })
}

// 新增 / 編輯（一般 + 組合）都用彈窗：未帶 productId = 新增、帶 id = 編輯
const productDialogVisible = ref(false)
const productDialogTargetId = ref<number | undefined>(undefined)
const productDialogReadonly = ref(false)
const bundleDialogVisible = ref(false)
const bundleDialogTargetId = ref<number | undefined>(undefined)
const bundleDialogReadonly = ref(false)

function onAddNormal(): void {
  productDialogTargetId.value = undefined
  productDialogReadonly.value = false
  productDialogVisible.value = true
}
function onAddBundle(): void {
  bundleDialogTargetId.value = undefined
  bundleDialogReadonly.value = false
  bundleDialogVisible.value = true
}
// page 內已 toast，這裡不再重複跳訊息（避免「儲存變更」一次跳兩個 message）
function onProductSaved(_p: ManagedProduct): void {}
function onBundleSaved(_p: ManagedProduct): void {}

function onView(p: ManagedProduct): void {
  // 檢視模式 = 編輯彈窗 + readonly（鎖住所有輸入、footer 只剩關閉）
  if (p.kind === 'bundle') {
    bundleDialogTargetId.value = p.id
    bundleDialogReadonly.value = true
    bundleDialogVisible.value = true
  } else {
    productDialogTargetId.value = p.id
    productDialogReadonly.value = true
    productDialogVisible.value = true
  }
}
function onEdit(p: ManagedProduct): void {
  // 一般 / 組合商品都改用彈窗編輯（取代原本的 router.push 跳頁）
  if (p.kind === 'bundle') {
    bundleDialogTargetId.value = p.id
    bundleDialogReadonly.value = false
    bundleDialogVisible.value = true
  } else {
    productDialogTargetId.value = p.id
    productDialogReadonly.value = false
    productDialogVisible.value = true
  }
}
function onDelete(p: ManagedProduct, event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: '刪除商品',
    message: `確定刪除「${p.name}」嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      removeManagedProducts([p.id])
      toast.add({ severity: 'success', summary: `已刪除「${p.name}」`, life: 1500 })
    },
  })
}

// 手機尺寸偵測（< md 768px）：用來把 檢視/編輯/刪除 收進「更多」、新增鈕合成下拉
const isMobile = ref(false)
let mediaQuery: MediaQueryList | null = null
const updateMobile = (): void => { if (mediaQuery) isMobile.value = mediaQuery.matches }
onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px)')
  updateMobile()
  mediaQuery.addEventListener('change', updateMobile)
})
onUnmounted(() => mediaQuery?.removeEventListener('change', updateMobile))

// 「更多」menu：手機版前置 檢視 / 編輯 / 刪除（icon 按鈕被隱藏）；PC 只保留 複製 / 匯出
const moreMenuRef = ref<{ toggle: (e: Event) => void } | null>(null)
const activeProduct = ref<ManagedProduct | null>(null)
const lastMoreEvent = ref<Event | null>(null)
const moreMenuItems = computed<MenuItem[]>(() => {
  const mobileItems: MenuItem[] = isMobile.value && activeProduct.value ? [
    { label: '檢視', icon: 'pi pi-eye',   command: () => activeProduct.value && onView(activeProduct.value) },
    { label: '編輯', icon: 'pi pi-pencil', command: () => activeProduct.value && onEdit(activeProduct.value) },
    { label: '刪除', icon: 'pi pi-trash',  command: () => activeProduct.value && lastMoreEvent.value && onDelete(activeProduct.value, lastMoreEvent.value) },
    { separator: true },
  ] : []
  return [
    ...mobileItems,
    { label: '複製商品', icon: 'pi pi-copy',     command: () => toast.add({ severity: 'info', summary: `複製「${activeProduct.value?.name ?? ''}」`, life: 1500 }) },
    { label: '匯出 CSV', icon: 'pi pi-download', command: () => toast.add({ severity: 'info', summary: '匯出 CSV（規劃中）', life: 1500 }) },
  ]
})
function openMore(p: ManagedProduct, event: Event): void {
  activeProduct.value = p
  lastMoreEvent.value = event
  moreMenuRef.value?.toggle(event)
}

// 手機版「+ 新增 ▾」下拉 menu：新增一般商品 / 新增組合商品
const addMenuRef = ref<{ toggle: (e: Event) => void } | null>(null)
const addMenuItems: MenuItem[] = [
  { label: '新增一般商品', icon: 'pi pi-plus',      command: () => onAddNormal() },
  { label: '新增組合商品', icon: 'pi pi-th-large',  command: () => onAddBundle() },
]
function openAddMenu(event: Event): void { addMenuRef.value?.toggle(event) }

/**
 * 組合商品展開時要顯示的子商品列：依 MP.bundleItems 反查 managedProducts，
 * 拿到子商品的「商品名稱」、庫存與單價（有 specId → 走規格層；否則走總庫存 + 規格最小價）。
 */
interface BundleRow { id: number | string; name: string; stock: number; price: number }
/** 展開區共用 row：組合商品走 bundleRowsOf；一般商品直接吃 specs（shape 相同：id / name / stock / price） */
function expandedRowsOf(p: ManagedProduct): BundleRow[] {
  return p.kind === 'bundle' ? bundleRowsOf(p) : p.specs as BundleRow[]
}
function bundleRowsOf(p: ManagedProduct): BundleRow[] {
  if (p.kind !== 'bundle') return []
  return (p.bundleItems ?? []).map((it) => {
    const child = managedProducts.find((m) => m.id === it.productId)
    const spec = it.specId && child
      ? child.specs.find((s) => s.id === it.specId)
      : undefined
    const name = spec
      ? `${child?.name ?? `商品 #${it.productId}`} - ${spec.name}`
      : (child?.name ?? `商品 #${it.productId}`)
    const stock = spec ? spec.stock : (child ? totalStockOf(child) : 0)
    const price = spec
      ? spec.price
      : (child && child.specs.length ? Math.min(...child.specs.map((s) => s.price)) : 0)
    return { id: spec?.id ?? it.productId, name, stock, price }
  })
}

// 批量調整庫存 dialog（庫存欄旁 pencil icon 開啟）
const stockDialogVisible = ref(false)
const stockDialogProduct = ref<ManagedProduct | null>(null)
function openStockAdjust(p: ManagedProduct): void {
  stockDialogProduct.value = p
  stockDialogVisible.value = true
}
function onStockAdjustSave(payload: StockAdjustmentPayload): void {
  const target = products.find((p) => p.id === payload.productId)
  if (!target) return
  let changed = 0
  payload.adjustments.forEach((a) => {
    const spec = target.specs.find((s) => s.id === a.specId)
    if (!spec) return
    spec.stock = Math.max(0, spec.stock + a.delta)
    changed++
  })
  toast.add({
    severity: 'success',
    summary: '庫存已更新',
    detail: `${target.name}（共 ${changed} 個規格）`,
    life: 2000,
  })
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1 min-h-0">
    <!-- 頁首第一列：標題 + 搜尋（+ 手機新增）+ 商品類型篩選 + 桌機新增 -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
        <!-- 手機讓標題獨占一列，搜尋 + 新增鈕才能並排 -->
        <h2 class="text-xl font-medium text-[var(--p-text-color)] shrink-0 w-full sm:w-auto">商品列表</h2>
        <!-- 搜尋 + 手機新增鈕一定同列；items-stretch 讓兩個按鈕跟 InputGroup 同高 -->
        <div class="flex items-stretch gap-2 w-full sm:w-auto">
          <div class="flex items-center flex-1 sm:flex-initial sm:w-[380px]">
            <InputGroup>
              <InputText v-model="keyword" placeholder="快速搜尋您的商品" />
              <Button label="搜尋" />
            </InputGroup>
          </div>
          <!-- 手機新增鈕：跟搜尋同列 -->
          <div class="sm:hidden shrink-0">
            <Button @click="openAddMenu($event)">
              <i class="pi pi-plus" style="font-size: 14px"></i>
              <span>新增</span>
              <i class="pi pi-chevron-down" style="font-size: 11px"></i>
            </Button>
            <Menu ref="addMenuRef" :model="addMenuItems" :popup="true" />
          </div>
        </div>
        <!-- 商品類型篩選：一般商品 / 組合商品（兩個都勾或都不勾 = 顯示全部） -->
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox v-model="filterNormal" binary />
          <span>一般商品</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox v-model="filterBundle" binary />
          <span>組合商品</span>
        </label>
      </div>
      <!-- 桌機才出現兩顆獨立新增按鈕 -->
      <div class="hidden sm:flex items-center gap-2 shrink-0">
        <Button label="新增組合商品" variant="outlined" @click="onAddBundle">
          <template #icon>
            <i class="pi pi-th-large" style="font-size: 14px"></i>
          </template>
        </Button>
        <Button label="新增一般商品" icon="pi pi-plus" @click="onAddNormal" />
      </div>
    </div>

    <!-- 頁首第二列：全選 + 批次刪除 -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox v-model="allSelected" binary />
        <span>全選</span>
      </label>
      <Button label="批次刪除" icon="pi pi-trash" severity="danger" variant="outlined" @click="onBatchDelete" />
    </div>

    <!-- 商品卡列表 -->
    <div class="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
      <Card
        v-for="p in pagedProducts"
        :key="p.id"
        :pt="{
          root: { class: 'w-full' },
          body: { class: 'p-0' },
          content: { class: 'p-0' },
        }"
      >
        <template #content>
          <!-- Header：checkbox + 名稱 (+ 組合 tag) + 狀態 tag + 動作 -->
          <div class="flex items-center gap-3 px-4 py-3">
            <Checkbox :model-value="isSelected(p.id)" binary @change="toggleSelect(p.id)" />
            <span class="font-bold text-base text-[var(--p-text-color)]">{{ p.name }}</span>
            <Tag v-if="p.kind === 'bundle'" v-tooltip.top="'組合商品'" value="組" severity="success" />
            <Tag :value="statusMeta(p.status).label" :severity="statusMeta(p.status).severity" />

            <div class="ml-auto flex items-center gap-2">
              <!-- 桌機才顯示 檢視 / 編輯 / 刪除 icon 按鈕；手機收進「更多」menu -->
              <button
                v-tooltip.top="'檢視'"
                class="hidden md:flex size-[35px] items-center justify-center rounded-md border border-[#bbf7d0] text-[#22c55e] hover:bg-[#dcfce7]"
                @click="onView(p)"
              >
                <i class="pi pi-eye" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="'編輯'"
                class="hidden md:flex size-[35px] items-center justify-center rounded-md border border-[#c29ffa] text-[var(--p-primary-color)] hover:bg-[var(--p-primary-50)]"
                @click="onEdit(p)"
              >
                <FontAwesomeIcon :icon="['far', 'pen-to-square']" class="text-sm" />
              </button>
              <button
                v-tooltip.top="'刪除'"
                class="hidden md:flex size-[35px] items-center justify-center rounded-md border border-[#fecaca] text-[#ef4444] hover:bg-[#fee2e2]"
                @click="onDelete(p, $event)"
              >
                <i class="pi pi-trash" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="'更多'"
                class="size-[35px] flex items-center justify-center rounded-md text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                @click="openMore(p, $event)"
              >
                <i class="pi pi-ellipsis-v" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="isExpanded(p.id) ? '收合' : '展開'"
                class="size-[35px] flex items-center justify-center rounded-md text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                @click="toggleExpand(p.id)"
              >
                <i :class="isExpanded(p.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size: 14px"></i>
              </button>
            </div>
          </div>

          <!-- 摘要列（淺灰底）：分類 / 價格 / 總庫存 / 總銷量；卡片左右留白 → 灰塊不貼齊邊 -->
          <!-- 摘要 4 欄 grid：手機（< 640px）→ 2 欄；≥ sm → 4 欄 -->
          <div class="mx-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 py-3 bg-[#f5f5f5] rounded-md">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--p-text-muted-color)]">分類</span>
              <span class="text-sm text-[var(--p-text-color)]">{{ p.category }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--p-text-muted-color)]">價格</span>
              <span class="text-sm text-[var(--p-text-color)]">{{ priceRangeOf(p) }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--p-text-muted-color)]">總庫存</span>
              <span class="text-sm text-[var(--p-text-color)]">{{ totalStockOf(p) }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--p-text-muted-color)]">總銷量</span>
              <span class="text-sm text-[var(--p-text-color)]">{{ p.totalSold }}</span>
            </div>
          </div>

          <!-- 展開：一般商品 → 規格 table；組合商品 → 子商品 table（統一走 PrimeVue DataTable） -->
          <div v-if="isExpanded(p.id)" class="px-4 pb-4">
            <DataTable
              :value="expandedRowsOf(p)"
              data-key="id"
              size="small"
            >
              <Column
                field="name"
                :header="p.kind === 'bundle' ? '商品名稱' : (p.specGroupNames?.[0] || '規格名稱')"
              />
              <Column
                field="stock"
                style="width: 140px"
                :pt="{
                  headerCell: { class: 'text-right' },
                  bodyCell: { class: 'text-right' },
                }"
              >
                <template #header>
                  <span class="inline-flex items-center gap-2 w-full justify-end">
                    庫存
                    <Button
                      v-if="p.kind !== 'bundle'"
                      v-tooltip.top="'批量調整庫存'"
                      icon="pi pi-pencil"
                      severity="secondary"
                      variant="text"
                      size="small"
                      rounded
                      @click="openStockAdjust(p)"
                    />
                  </span>
                </template>
                <template #body="{ data }">
                  <div class="text-right">{{ data.stock }}</div>
                </template>
              </Column>
              <Column
                field="price"
                header="價格"
                style="width: 120px"
                :pt="{
                  headerCell: { class: 'text-right' },
                  bodyCell: { class: 'text-right' },
                }"
              >
                <template #body="{ data }">
                  <div class="text-right">${{ data.price.toLocaleString() }}</div>
                </template>
              </Column>
              <template #empty>
                <div class="text-center text-sm text-[var(--p-text-muted-color)] py-3">
                  {{ p.kind === 'bundle' ? '尚未設定子商品' : '尚未設定規格' }}
                </div>
              </template>
            </DataTable>
          </div>
        </template>
      </Card>

      <div v-if="filteredProducts.length === 0" class="flex flex-col items-center gap-2 py-12 text-[var(--p-text-muted-color)]">
        <i class="pi pi-inbox text-5xl"></i>
        <span class="text-sm">沒有符合條件的商品</span>
      </div>
    </div>

    <!-- 分頁列：一頁 10 筆，少於一頁時不顯示 -->
    <Paginator
      v-if="filteredProducts.length > PAGE_SIZE"
      v-model:first="pageFirst"
      :rows="PAGE_SIZE"
      :total-records="filteredProducts.length"
      template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
      current-page-report-template="{first} - {last} / 共 {totalRecords} 筆"
      class="!bg-transparent !p-0"
    />

    <Menu id="product-more-menu" ref="moreMenuRef" :model="moreMenuItems" :popup="true" />

    <StockBatchAdjustDialog
      v-model:visible="stockDialogVisible"
      :product="stockDialogProduct"
      @save="onStockAdjustSave"
    />

    <!-- 新增 / 編輯 / 檢視 彈窗：帶 productId = 編輯，沒帶 = 新增，readonly = 純檢視 -->
    <ProductCreateDialog
      v-model:visible="productDialogVisible"
      :product-id="productDialogTargetId"
      :readonly="productDialogReadonly"
      @saved="onProductSaved"
    />
    <ProductBundleCreateDialog
      v-model:visible="bundleDialogVisible"
      :product-id="bundleDialogTargetId"
      :readonly="bundleDialogReadonly"
      @saved="onBundleSaved"
    />
  </div>
</template>
