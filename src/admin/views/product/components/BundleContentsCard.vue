<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
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
  /** 固定組合用：每組包含此子商品的件數（預設 1） */
  quantity: number
  /** 任選組合用：買家單次此項可選的最多件數；null = 不限制 */
  maxPerPurchase: number | null
}

/** 組合類型：固定（套組）/ 任選（mix-and-match） */
export type BundleMode = 'fixed' | 'pick'

interface Props {
  items: BundleItem[]
  remark: string
  /** 組合類型 */
  mode?: BundleMode
  /** 任選模式：買家總共可挑選的件數 */
  totalPick?: number
  /** 隱藏「指定商品」按鈕（從 picker 已勾選商品建組合時不需要再挑選） */
  hidePickProducts?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  mode: 'fixed',
  totalPick: 1,
  hidePickProducts: false,
})
const emit = defineEmits<{
  'update:items': [value: BundleItem[]]
  'update:remark': [value: string]
  'update:mode': [value: BundleMode]
  'update:totalPick': [value: number]
}>()

const modeModel = computed<BundleMode>({
  get: () => props.mode,
  set: (v) => emit('update:mode', v),
})
const totalPickModel = computed<number>({
  get: () => props.totalPick,
  set: (v) => emit('update:totalPick', v),
})
const modeOptions = [
  { label: '固定組合', value: 'fixed' as BundleMode },
  { label: '任選組合', value: 'pick'  as BundleMode },
]

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

</script>

<template>
  <Card>
    <template #title>
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <span>組合商品內容</span>
        <div class="flex items-center gap-2">
          <Button v-if="!hidePickProducts" label="指定商品" variant="outlined" @click="onPickProducts">
            <template #icon>
              <i class="pi pi-tag" style="font-size: 14px"></i>
            </template>
          </Button>
          <Button label="批次刪除" severity="danger" variant="outlined" icon="pi pi-trash" @click="onBatchDelete" />
        </div>
      </div>
    </template>
    <template #content>
      <!-- 組合類型 toggle + 任選總數（任選模式才顯示） -->
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <span class="text-sm font-bold text-color">組合類型</span>
        <SelectButton
          v-model="modeModel"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <template v-if="modeModel === 'pick'">
          <span class="text-sm text-color-secondary ml-3">買家可任選</span>
          <InputNumber v-model="totalPickModel" :min="1" :input-style="{ width: '64px', textAlign: 'center' }" />
          <span class="text-sm text-color-secondary">件</span>
        </template>
      </div>

      <!-- 紅色警語：寬度貼齊文字，不再撐滿整張卡片 -->
      <div class="mb-3 inline-block max-w-full px-3 py-2 rounded-md border border-red-300 bg-red-50 text-sm text-red-600">
        {{ modeModel === 'fixed'
          ? '設定商品組合時，請確認庫存，避免超過可出貨量而導致無法出貨。'
          : '任選組合：買家結帳時可從清單挑選最多上述件數的商品，每項可額外設「限購上限」。' }}
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
        <!-- 固定組合：必含件數 -->
        <Column v-if="modeModel === 'fixed'" header="數量" style="width: 130px">
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
        <!-- 任選組合：此項限購上限 -->
        <Column v-else header="限購上限" style="width: 160px">
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
        <Column header="操作" style="width: 80px">
          <template #body="{ data }">
            <div class="flex items-center gap-1" @click.stop>
              <button
                v-tooltip.top="'刪除'"
                class="size-[32px] flex items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                @click="onRowDelete(data, $event)"
              >
                <i class="pi pi-trash" style="font-size: 15px"></i>
              </button>
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="py-6 text-center text-sm text-color-secondary">
            {{ hidePickProducts ? '尚未帶入任何商品' : '尚未加入任何商品，按右上「指定商品」開始挑選。' }}
          </div>
        </template>
      </DataTable>

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
