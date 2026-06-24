<script setup lang="ts">
import { computed, ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { MenuItem } from 'primevue/menuitem'
import BundlePickDialog, { type PickedItem } from './BundlePickDialog.vue'

/**
 * 組合商品內容 Card：列出組合內含的子商品（id / 名稱 / 庫存）+ 備註。
 *
 * 內含：
 * - 紅色警語：設定商品組合時請確認庫存
 * - 指定商品 / 批次刪除 按鈕
 * - 表格：checkbox / 商品名稱 / 庫存 / 操作（檢視 / 編輯 / 刪除 / 更多）
 * - 備註 textarea
 */

export interface BundleItem {
  /** picker key：單一商品 `p-{productId}`、規格 `s-{productId}-{specId}` */
  key: string
  productId: number
  specId?: number
  name: string
  stock: number
  /** 每組組合包含這個子商品的數量；預設 1 */
  quantity: number
  /** 客人單次購買的上限件數；null = 不限制 */
  maxPerPurchase: number | null
}

interface Props {
  items: BundleItem[]
  remark: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:items': [value: BundleItem[]]
  'update:remark': [value: string]
}>()

const toast = useToast()
const confirm = useConfirm()

const items = computed<BundleItem[]>({
  get: () => props.items,
  set: (v) => emit('update:items', v),
})
const remarkModel = computed<string>({
  get: () => props.remark,
  set: (v) => emit('update:remark', v),
})

const selectedKeys = ref<Set<string>>(new Set())
function isSelected(key: string): boolean { return selectedKeys.value.has(key) }
function toggleSelect(key: string): void {
  const next = new Set(selectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedKeys.value = next
}
const allSelected = computed(() => items.value.length > 0 && items.value.every((i) => selectedKeys.value.has(i.key)))
function toggleAll(): void {
  if (allSelected.value) selectedKeys.value = new Set()
  else selectedKeys.value = new Set(items.value.map((i) => i.key))
}

const pickDialogVisible = ref(false)
function onPickProducts(): void {
  pickDialogVisible.value = true
}
function onPickConfirm(picked: PickedItem[]): void {
  const existing = new Set(items.value.map((i) => i.key))
  const toAdd: BundleItem[] = picked
    .filter((p) => !existing.has(p.key))
    .map((p) => ({
      key: p.key,
      productId: p.productId,
      specId: p.specId,
      name: p.name,
      stock: p.stock,
      quantity: 1,
      maxPerPurchase: null,
    }))
  if (toAdd.length === 0) return
  items.value = [...items.value, ...toAdd]
  toast.add({
    severity: 'success',
    summary: `已加入 ${toAdd.length} 件商品`,
    life: 1800,
  })
}

function onBatchDelete(): void {
  if (selectedKeys.value.size === 0) {
    toast.add({ severity: 'warn', summary: '請先勾選要刪除的商品', life: 1500 })
    return
  }
  confirm.require({
    header: '批次刪除商品',
    message: `確定刪除選取的 ${selectedKeys.value.size} 筆商品嗎？`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      items.value = items.value.filter((i) => !selectedKeys.value.has(i.key))
      selectedKeys.value = new Set()
    },
  })
}

function onRowDelete(item: BundleItem, event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: '刪除商品',
    message: `確定移除「${item.name}」？`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      items.value = items.value.filter((i) => i.key !== item.key)
      selectedKeys.value.delete(item.key)
    },
  })
}

function onView(item: BundleItem): void {
  toast.add({ severity: 'info', summary: `檢視「${item.name}」`, life: 1500 })
}
function onEdit(item: BundleItem): void {
  toast.add({ severity: 'info', summary: `編輯「${item.name}」（規劃中）`, life: 1500 })
}

const moreMenuRef = ref<{ toggle: (e: Event) => void } | null>(null)
const activeItem = ref<BundleItem | null>(null)
const moreMenuItems: MenuItem[] = [
  { label: '複製', icon: 'pi pi-copy', command: () => toast.add({ severity: 'info', summary: `複製「${activeItem.value?.name ?? ''}」`, life: 1500 }) },
  { label: '匯出', icon: 'pi pi-download', command: () => toast.add({ severity: 'info', summary: '匯出（規劃中）', life: 1500 }) },
]
function openMore(item: BundleItem, event: Event): void {
  activeItem.value = item
  moreMenuRef.value?.toggle(event)
}
</script>

<template>
  <Card>
    <template #title>
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <span>組合商品內容</span>
        <div class="flex items-center gap-2">
          <Button label="指定商品" variant="outlined" @click="onPickProducts">
            <template #icon>
              <i class="pi pi-tag" style="font-size: 14px"></i>
            </template>
          </Button>
          <Button label="批次刪除" severity="danger" variant="outlined" icon="pi pi-trash" @click="onBatchDelete" />
        </div>
      </div>
    </template>
    <template #content>
      <!-- 紅色警語：寬度貼齊文字，不再撐滿整張卡片 -->
      <div class="mb-3 inline-block max-w-full px-3 py-2 rounded-md border border-red-300 bg-red-50 text-sm text-red-600">
        設定商品組合時，請確認庫存，避免超過可出貨量而導致無法出貨。
      </div>

      <!-- 子商品表 -->
      <DataTable
        :value="items"
        data-key="key"
        class="w-full"
        :pt="{
          column: {
            headerCell: { style: 'background:transparent;font-size:14px;font-weight:600' },
            bodyCell:   { style: 'font-size:14px' },
          },
        }"
      >
        <Column header-style="width: 3rem">
          <template #header>
            <Checkbox :model-value="allSelected" binary @change="toggleAll" />
          </template>
          <template #body="{ data }">
            <Checkbox :model-value="isSelected(data.key)" binary @change="toggleSelect(data.key)" />
          </template>
        </Column>
        <Column field="name" header="商品名稱" />
        <Column field="stock" header="庫存" style="width: 100px" />
        <Column header="數量" style="width: 130px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.quantity"
              :min="1"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '60px', textAlign: 'center' }"
              :pt="{ root: { class: 'w-[120px]' } }"
            />
          </template>
        </Column>
        <Column header="限購上限" style="width: 160px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <InputNumber
                v-model="data.maxPerPurchase"
                :min="1"
                placeholder="不限"
                :input-style="{ width: '80px' }"
                :pt="{ root: { class: 'w-[100px]' } }"
              />
              <span class="text-xs text-color-secondary">件</span>
            </div>
          </template>
        </Column>
        <Column header="操作" style="width: 180px">
          <template #body="{ data }">
            <div class="flex items-center gap-1" @click.stop>
              <button
                v-tooltip.top="'檢視'"
                class="size-[32px] flex items-center justify-center rounded-md text-green-600 hover:bg-green-50"
                @click="onView(data)"
              >
                <i class="pi pi-eye" style="font-size: 15px"></i>
              </button>
              <button
                v-tooltip.top="'編輯'"
                class="size-[32px] flex items-center justify-center rounded-md text-primary hover:bg-primary-50"
                @click="onEdit(data)"
              >
                <FontAwesomeIcon :icon="['far', 'pen-to-square']" class="text-[14px]" />
              </button>
              <button
                v-tooltip.top="'刪除'"
                class="size-[32px] flex items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                @click="onRowDelete(data, $event)"
              >
                <i class="pi pi-trash" style="font-size: 15px"></i>
              </button>
              <button
                v-tooltip.top="'更多'"
                class="size-[32px] flex items-center justify-center rounded-md text-color-secondary hover:bg-surface-100"
                @click="openMore(data, $event)"
              >
                <i class="pi pi-ellipsis-v" style="font-size: 15px"></i>
              </button>
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="py-6 text-center text-sm text-color-secondary">
            尚未加入任何商品，按右上「指定商品」開始挑選。
          </div>
        </template>
      </DataTable>

      <Menu ref="moreMenuRef" :model="moreMenuItems" :popup="true" />

      <!-- 備註 -->
      <div class="mt-5 flex flex-col gap-1.5">
        <label class="text-sm font-bold text-color">備註</label>
        <Textarea v-model="remarkModel" rows="4" class="w-full" />
      </div>

      <!-- 指定商品 picker dialog -->
      <BundlePickDialog
        v-model:visible="pickDialogVisible"
        :existing-keys="items.map(i => i.key)"
        @confirm="onPickConfirm"
      />
    </template>
  </Card>
</template>
