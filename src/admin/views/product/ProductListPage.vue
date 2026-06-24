<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import type { MenuItem } from 'primevue/menuitem'
import { RouteName } from '@/admin/router'
import {
  managedProducts,
  totalStockOf,
  priceRangeOf,
  type ManagedProduct,
  type ProductStatus,
} from './utils/productMock'
import StockBatchAdjustDialog, { type StockAdjustmentPayload } from './components/StockBatchAdjustDialog.vue'

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
const router = useRouter()

const keyword = ref('')
const products = ref<ManagedProduct[]>(managedProducts)
const selectedIds = ref<Set<number>>(new Set())
const expandedIds = ref<Set<number>>(new Set(managedProducts.map(p => p.id))) // 預設全展開比照 Figma

const filteredProducts = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return products.value
  return products.value.filter((p) =>
    p.name.toLowerCase().includes(k) || p.category.toLowerCase().includes(k),
  )
})

function statusMeta(status: ProductStatus): { label: string; bg: string; color: string } {
  if (status === 'on_shelf') return { label: '上架', bg: '#e0d0fc', color: '#3d0f91' }
  if (status === 'off_shelf') return { label: '下架', bg: '#f1f5f9', color: '#64748b' }
  return { label: '草稿', bg: '#fef3c7', color: '#92400e' }
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
      products.value = products.value.filter((p) => !ids.has(p.id))
      toast.add({ severity: 'success', summary: `已刪除 ${ids.size} 筆商品`, life: 1500 })
      selectedIds.value = new Set()
    },
  })
}

function onAddBundle(): void {
  router.push({ name: RouteName.ProductBundleCreate })
}
function onAddNormal(): void {
  router.push({ name: RouteName.ProductCreate })
}

function onView(p: ManagedProduct): void {
  toast.add({ severity: 'info', summary: `檢視「${p.name}」`, life: 1500 })
}
function onEdit(p: ManagedProduct): void {
  router.push({ name: RouteName.ProductUpdate, params: { id: p.id } })
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
      products.value = products.value.filter((x) => x.id !== p.id)
      toast.add({ severity: 'success', summary: `已刪除「${p.name}」`, life: 1500 })
    },
  })
}

// 「更多」menu：複製 / 匯出（規劃中）
const moreMenuRef = ref<{ toggle: (e: Event) => void } | null>(null)
const activeProduct = ref<ManagedProduct | null>(null)
const moreMenuItems: MenuItem[] = [
  { label: '複製商品', icon: 'pi pi-copy', command: () => toast.add({ severity: 'info', summary: `複製「${activeProduct.value?.name ?? ''}」`, life: 1500 }) },
  { label: '匯出 CSV', icon: 'pi pi-download', command: () => toast.add({ severity: 'info', summary: '匯出 CSV（規劃中）', life: 1500 }) },
]
function openMore(p: ManagedProduct, event: Event): void {
  activeProduct.value = p
  moreMenuRef.value?.toggle(event)
}

// 批量調整庫存 dialog（庫存欄旁 pencil icon 開啟）
const stockDialogVisible = ref(false)
const stockDialogProduct = ref<ManagedProduct | null>(null)
function openStockAdjust(p: ManagedProduct): void {
  stockDialogProduct.value = p
  stockDialogVisible.value = true
}
function onStockAdjustSave(payload: StockAdjustmentPayload): void {
  const target = products.value.find((p) => p.id === payload.productId)
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
    <!-- 頁首：標題 + 搜尋 + 右側動作 -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <h2 class="text-[20px] font-medium text-[var(--p-text-color)] shrink-0">商品列表</h2>
        <div class="flex items-center" style="filter: drop-shadow(0px 1px 1px rgba(18,18,23,0.05))">
          <InputGroup>
            <InputText
              v-model="keyword"
              placeholder="快速搜尋您的組合商品"
              class="!w-[320px]"
            />
            <Button label="搜尋" />
          </InputGroup>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button label="批次刪除" icon="pi pi-trash" severity="danger" variant="outlined" @click="onBatchDelete" />
        <Button label="新增組合商品" variant="outlined" @click="onAddBundle">
          <template #icon>
            <i class="pi pi-th-large" style="font-size: 14px"></i>
          </template>
        </Button>
        <Button label="新增一般商品" icon="pi pi-plus" @click="onAddNormal" />
      </div>
    </div>

    <!-- 商品卡列表 -->
    <div class="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
      <Card
        v-for="p in filteredProducts"
        :key="p.id"
        :pt="{
          root: { class: 'w-full' },
          body: { class: 'p-0' },
          content: { class: 'p-0' },
        }"
      >
        <template #content>
          <!-- Header：checkbox + 名稱 + 狀態 tag + 動作 -->
          <div class="flex items-center gap-3 px-4 py-3">
            <Checkbox :model-value="isSelected(p.id)" binary @change="toggleSelect(p.id)" />
            <span class="font-bold text-[15px] text-[var(--p-text-color)]">{{ p.name }}</span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12.25px] font-bold leading-none"
              :style="{ background: statusMeta(p.status).bg, color: statusMeta(p.status).color }"
            >{{ statusMeta(p.status).label }}</span>

            <div class="ml-auto flex items-center gap-1.5">
              <button
                v-tooltip.top="'檢視'"
                class="size-[35px] flex items-center justify-center rounded-[6px] border border-[#bbf7d0] text-[#22c55e] hover:bg-[#dcfce7]"
                @click="onView(p)"
              >
                <i class="pi pi-eye" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="'編輯'"
                class="size-[35px] flex items-center justify-center rounded-[6px] border border-[#c29ffa] text-[var(--p-primary-color)] hover:bg-[var(--p-primary-50)]"
                @click="onEdit(p)"
              >
                <FontAwesomeIcon :icon="['far', 'pen-to-square']" class="text-[14px]" />
              </button>
              <button
                v-tooltip.top="'刪除'"
                class="size-[35px] flex items-center justify-center rounded-[6px] border border-[#fecaca] text-[#ef4444] hover:bg-[#fee2e2]"
                @click="onDelete(p, $event)"
              >
                <i class="pi pi-trash" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="'更多'"
                class="size-[35px] flex items-center justify-center rounded-[6px] text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                @click="openMore(p, $event)"
              >
                <i class="pi pi-ellipsis-v" style="font-size: 14px"></i>
              </button>
              <button
                v-tooltip.top="isExpanded(p.id) ? '收合' : '展開'"
                class="size-[35px] flex items-center justify-center rounded-[6px] text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                @click="toggleExpand(p.id)"
              >
                <i :class="isExpanded(p.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size: 14px"></i>
              </button>
            </div>
          </div>

          <!-- 摘要列（淺灰底）：分類 / 價格 / 總庫存 / 總銷量；卡片左右留白 → 灰塊不貼齊邊 -->
          <div class="mx-4 mb-4 grid gap-4 px-4 py-3 bg-[#f5f5f5] rounded-[6px]" style="grid-template-columns: 1fr 1fr 1fr 1fr">
            <div class="flex flex-col gap-1">
              <span class="text-[12px] text-[var(--p-text-muted-color)]">分類</span>
              <span class="text-[14px] text-[var(--p-text-color)]">{{ p.category }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[12px] text-[var(--p-text-muted-color)]">價格</span>
              <span class="text-[14px] text-[var(--p-text-color)]">{{ priceRangeOf(p) }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[12px] text-[var(--p-text-muted-color)]">總庫存</span>
              <span class="text-[14px] text-[var(--p-text-color)]">{{ totalStockOf(p) }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[12px] text-[var(--p-text-muted-color)]">總銷量</span>
              <span class="text-[14px] text-[var(--p-text-color)]">{{ p.totalSold }}</span>
            </div>
          </div>

          <!-- 展開：規格 table -->
          <div v-if="isExpanded(p.id)" class="px-4 py-3">
            <div class="grid items-center gap-4 px-2 pb-2 border-b border-[var(--p-content-border-color)]"
                 style="grid-template-columns: 1fr 100px 100px">
              <span class="text-[13px] font-semibold text-[var(--p-text-color)]">規格名稱</span>
              <span class="text-[13px] font-semibold text-[var(--p-text-color)] text-right inline-flex items-center justify-end gap-1.5">
                庫存
                <button
                  v-tooltip.top="'批量調整庫存'"
                  class="inline-flex items-center justify-center text-[var(--p-primary-color)] hover:bg-[var(--p-primary-50)] rounded-[4px] p-1"
                  @click="openStockAdjust(p)"
                >
                  <i class="pi pi-pencil" style="font-size: 11px"></i>
                </button>
              </span>
              <span class="text-[13px] font-semibold text-[var(--p-text-color)] text-right">價格</span>
            </div>
            <div
              v-for="(s, i) in p.specs"
              :key="s.id"
              class="grid items-center gap-4 px-2 py-2.5"
              :class="i < p.specs.length - 1 ? 'border-b border-[var(--p-content-border-color)]' : ''"
              style="grid-template-columns: 1fr 100px 100px"
            >
              <span class="text-[13px] text-[var(--p-text-color)]">{{ s.name }}</span>
              <span class="text-[13px] text-[var(--p-text-color)] text-right">{{ s.stock }}</span>
              <span class="text-[13px] text-[var(--p-text-color)] text-right">${{ s.price.toLocaleString() }}</span>
            </div>
          </div>
        </template>
      </Card>

      <div v-if="filteredProducts.length === 0" class="flex flex-col items-center gap-2 py-12 text-[var(--p-text-muted-color)]">
        <i class="pi pi-inbox text-5xl"></i>
        <span class="text-[14px]">沒有符合條件的商品</span>
      </div>
    </div>

    <Menu id="product-more-menu" ref="moreMenuRef" :model="moreMenuItems" :popup="true" />

    <StockBatchAdjustDialog
      v-model:visible="stockDialogVisible"
      :product="stockDialogProduct"
      @save="onStockAdjustSave"
    />
  </div>
</template>
