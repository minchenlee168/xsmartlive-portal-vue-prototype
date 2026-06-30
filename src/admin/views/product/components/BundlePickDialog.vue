<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { productCatalog, type CatalogProduct } from '@/admin/views/live-order/utils/productCatalog'

/**
 * 指定組合商品 dialog：
 *
 * 兼顧單一規格商品（直接以商品為單位勾選）與多規格商品（可展開逐一勾選每個規格）。
 * 篩選：分類 Select / 名稱 SKU 搜尋 / 僅顯示上架；表格分頁。
 * 已存在於組合的條目（existingKeys）整列 disabled 並標「已加入」。
 */

export interface PickedItem {
  /** 唯一識別：單一商品 = `p-{productId}`；某規格 = `s-{productId}-{specId}` */
  key: string
  productId: number
  /** 多規格商品才會帶 */
  specId?: number
  name: string
  stock: number
  price: number
}

interface PickerSpec {
  id: number
  name: string
  stock: number
  price: number
  cost: number
}

/** 部分商品塞 mock 規格；沒在這 map 裡的商品視為單一規格 */
const pickerSpecsMap: Record<number, PickerSpec[]> = {
  1: [
    { id: 101, name: '透明', stock: 40, price: 490, cost: 295 },
    { id: 102, name: '黑色', stock: 30, price: 520, cost: 320 },
    { id: 103, name: '深藍', stock: 15, price: 550, cost: 340 },
  ],
  7: [
    { id: 701, name: '黑色 / 青軸', stock: 5, price: 3500, cost: 2100 },
    { id: 702, name: '白色 / 紅軸', stock: 3, price: 3980, cost: 2400 },
  ],
  11: [
    { id: 1101, name: 'S / 白', stock: 20, price: 490, cost: 180 },
    { id: 1102, name: 'M / 白', stock: 25, price: 490, cost: 180 },
    { id: 1103, name: 'L / 白', stock: 15, price: 490, cost: 180 },
    { id: 1104, name: 'XL / 黑', stock: 6, price: 530, cost: 210 },
  ],
}

/** 沒在 specsMap 的商品 → 成本以售價六成估（與收單那邊 picker 一致） */
function costOf(p: CatalogProduct): number {
  return Math.round(p.price * 0.6)
}

/** 一組數字壓成顯示字串：相同 → 單值；不同 → 「min ~ max」 */
function rangeStr(values: number[]): string {
  if (values.length === 0) return '0'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? min.toLocaleString() : `${min.toLocaleString()} ~ ${max.toLocaleString()}`
}
function specCostRange(p: CatalogProduct): string {
  const specs = pickerSpecsMap[p.id]
  return rangeStr(specs?.length ? specs.map((s) => s.cost) : [costOf(p)])
}
function specPriceRange(p: CatalogProduct): string {
  const specs = pickerSpecsMap[p.id]
  return rangeStr(specs?.length ? specs.map((s) => s.price) : [p.price])
}
function specStockRange(p: CatalogProduct): string {
  const specs = pickerSpecsMap[p.id]
  return rangeStr(specs?.length ? specs.map((s) => s.stock) : [p.stock])
}
function minSpecStock(p: CatalogProduct): number {
  const specs = pickerSpecsMap[p.id]
  return specs?.length ? Math.min(...specs.map((s) => s.stock)) : p.stock
}

interface Props {
  visible?: boolean
  /** 已加入組合的 key 集合（單一商品 `p-id` / 規格 `s-pid-sid`）；對應 row disable */
  existingKeys?: string[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  existingKeys: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [items: PickedItem[]]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
const keyword = ref('')
const category = ref<string | null>(null)
const searchField = ref<'name' | 'sku'>('name')
const onlyAvailable = ref(false)
const pageFirst = ref(0)
const pageSize = 10

/** 跨展開 / 分頁累積的選取 key（單一商品 / 規格） */
const selectedKeys = ref<Set<string>>(new Set())
/** 展開的 productId set */
const expandedIds = ref<Set<number>>(new Set())

const existingKeySet = computed(() => new Set(props.existingKeys))

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      keyword.value = ''
      category.value = null
      searchField.value = 'name'
      onlyAvailable.value = false
      pageFirst.value = 0
      selectedKeys.value = new Set()
      expandedIds.value = new Set()
    }
  },
)

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function specsOf(p: CatalogProduct): PickerSpec[] {
  return pickerSpecsMap[p.id] ?? []
}
function hasSpecs(p: CatalogProduct): boolean {
  return specsOf(p).length > 0
}

function productKey(productId: number): string { return `p-${productId}` }
function specKey(productId: number, specId: number): string { return `s-${productId}-${specId}` }

function isExistingProduct(p: CatalogProduct): boolean {
  return existingKeySet.value.has(productKey(p.id))
}
function isExistingSpec(p: CatalogProduct, spec: PickerSpec): boolean {
  return existingKeySet.value.has(specKey(p.id, spec.id))
}

function isProductSelected(p: CatalogProduct): boolean {
  if (hasSpecs(p)) {
    return specsOf(p).every((s) => selectedKeys.value.has(specKey(p.id, s.id)))
  }
  return selectedKeys.value.has(productKey(p.id))
}
function isSpecSelected(p: CatalogProduct, spec: PickerSpec): boolean {
  return selectedKeys.value.has(specKey(p.id, spec.id))
}

function toggleExpand(p: CatalogProduct): void {
  const next = new Set(expandedIds.value)
  if (next.has(p.id)) next.delete(p.id)
  else next.add(p.id)
  expandedIds.value = next
}

function toggleProduct(p: CatalogProduct): void {
  if (isExistingProduct(p)) return
  const next = new Set(selectedKeys.value)
  if (hasSpecs(p)) {
    // 多規格：勾主商品 = 一次全選所有 spec；取消 = 一次全清
    const all = isProductSelected(p)
    specsOf(p).forEach((s) => {
      const k = specKey(p.id, s.id)
      if (all) next.delete(k)
      else if (!isExistingSpec(p, s)) next.add(k)
    })
  } else {
    const k = productKey(p.id)
    if (next.has(k)) next.delete(k)
    else next.add(k)
  }
  selectedKeys.value = next
}
function toggleSpec(p: CatalogProduct, spec: PickerSpec): void {
  if (isExistingSpec(p, spec)) return
  const k = specKey(p.id, spec.id)
  const next = new Set(selectedKeys.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  selectedKeys.value = next
}

const categoryOptions = computed(() => {
  const set = new Set<string>()
  productCatalog.forEach((p) => set.add(p.category))
  return [
    { label: '全部分類', value: null },
    ...Array.from(set).map((c) => ({ label: c, value: c })),
  ]
})
const searchFields = computed(() => [
  { label: t('live_order.search_field.name'), value: 'name' },
  { label: t('live_order.search_field.sku'),  value: 'sku'  },
])

const filtered = computed<CatalogProduct[]>(() =>
  productCatalog.filter((p) => {
    if (category.value && p.category !== category.value) return false
    if (onlyAvailable.value && p.status !== '上架中') return false
    const k = keyword.value.trim().toLowerCase()
    if (!k) return true
    return searchField.value === 'sku'
      ? p.sku.toLowerCase().includes(k)
      : p.name.toLowerCase().includes(k)
  }),
)
const paged = computed(() => filtered.value.slice(pageFirst.value, pageFirst.value + pageSize))

const selectedCount = computed(() => selectedKeys.value.size)

function onConfirm(): void {
  if (selectedKeys.value.size === 0) {
    close()
    return
  }
  const picked: PickedItem[] = []
  productCatalog.forEach((p) => {
    if (hasSpecs(p)) {
      specsOf(p).forEach((s) => {
        if (!selectedKeys.value.has(specKey(p.id, s.id))) return
        picked.push({
          key: specKey(p.id, s.id),
          productId: p.id,
          specId: s.id,
          name: `${p.name} - ${s.name}`,
          stock: s.stock,
          price: s.price,
        })
      })
    } else if (selectedKeys.value.has(productKey(p.id))) {
      picked.push({
        key: productKey(p.id),
        productId: p.id,
        name: p.name,
        stock: p.stock,
        price: p.price,
      })
    }
  })
  emit('confirm', picked)
  close()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(1100px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">指定組合商品</span>
    </template>

    <div class="flex flex-col gap-3 pt-2">
      <!-- Row 1：分類 + 搜尋（select + input + 紫色「搜尋」鈕） -->
      <div class="flex gap-4 items-end flex-wrap">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-color">分類</label>
          <Select
            v-model="category"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            placeholder="全部分類"
            class="!w-[220px]"
          />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-[320px]">
          <label class="text-sm font-medium text-color">搜尋</label>
          <div class="flex h-[42px]">
            <Select
              v-model="searchField"
              :options="searchFields"
              option-label="label"
              option-value="value"
              class="w-[130px]"
              style="border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: 0"
            />
            <InputText
              v-model="keyword"
              placeholder="搜尋商品名稱或編號"
              class="flex-1"
              style="border-radius: 0"
            />
          </div>
        </div>
        <Button label="搜尋" class="h-[42px] !min-w-[88px]" />
      </div>

      <!-- Row 2：已選擇 X 項商品（左）/ 只顯示可用商品（右） -->
      <div class="flex items-center justify-between">
        <span class="text-[13px] text-[var(--p-text-muted-color)]">
          已選擇 <span class="text-[var(--p-text-color)] font-semibold">{{ selectedCount }}</span> 項商品
        </span>
        <label class="flex items-center gap-2 cursor-pointer">
          <Checkbox v-model="onlyAvailable" binary />
          <span class="text-sm text-color">只顯示可用商品</span>
        </label>
      </div>

      <!-- 表格：欄寬 / padding 比照 AddProductDialog -->
      <div class="overflow-x-auto">
        <div style="min-width: 880px">
          <!-- header row：checkbox 移到最前 -->
          <div class="bg-[var(--p-content-background)] border-b border-[var(--p-content-border-color)] flex items-center px-4">
            <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px"></div>
            <div class="px-2 py-[6px] shrink-0 w-[28px]"></div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 380px">
              商品名稱
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 120px">
              成本
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 120px">
              售價
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 100px">
              庫存
            </div>
          </div>

          <template v-for="p in paged" :key="p.id">
            <!-- 主商品列 -->
            <div
              :class="[
                'flex items-center w-full px-4',
                expandedIds.has(p.id) && hasSpecs(p)
                  ? 'bg-[var(--p-content-hover-background)]'
                  : 'border-b border-[var(--p-content-border-color)]',
              ]"
            >
              <!-- checkbox 移到最前面 -->
              <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px">
                <Checkbox
                  :model-value="isProductSelected(p)"
                  binary
                  :disabled="isExistingProduct(p)"
                  @change="toggleProduct(p)"
                />
              </div>
              <div class="px-2 py-[6px] shrink-0 w-[28px]">
                <button
                  v-if="hasSpecs(p)"
                  type="button"
                  class="w-full flex items-center justify-center"
                  @click="toggleExpand(p)"
                >
                  <i
                    :class="[
                      'pi text-[14px] text-[var(--p-text-muted-color)]',
                      expandedIds.has(p.id) ? 'pi-chevron-up' : 'pi-chevron-down',
                    ]"
                  ></i>
                </button>
              </div>
              <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                <div class="w-[48px] h-[48px] rounded-[6px] bg-[var(--p-content-hover-background)] flex items-center justify-center shrink-0">
                  <i class="pi pi-image text-[18px] text-[var(--p-text-muted-color)]"></i>
                </div>
                <div class="flex flex-col gap-[2px]">
                  <span
                    class="font-medium text-[15px]"
                    :class="isExistingProduct(p) ? 'text-[var(--p-text-muted-color)]' : 'text-[var(--p-text-color)]'"
                  >{{ p.name }}</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ p.sku }}</span>
                    <span
                      v-if="hasSpecs(p)"
                      class="text-[11px] font-medium text-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-1.5 py-0.5 rounded"
                    >多規格</span>
                    <span
                      v-if="isExistingProduct(p)"
                      class="text-[11px] font-medium text-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-1.5 py-0.5 rounded"
                    >已加入</span>
                  </div>
                </div>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">{{ specCostRange(p) }}</span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">{{ specPriceRange(p) }}</span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                <span class="text-[15px]" :class="minSpecStock(p) <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">{{ specStockRange(p) }}</span>
              </div>
            </div>

            <!-- 規格子列：bg + 左 border + 灰底 -->
            <template v-if="hasSpecs(p) && expandedIds.has(p.id)">
              <div
                v-for="(spec, si) in specsOf(p)"
                :key="spec.id"
                :class="[
                  'bg-[var(--p-content-hover-background)] flex items-center px-[40px]',
                  si === specsOf(p).length - 1
                    ? 'border-b border-[var(--p-content-border-color)]'
                    : '',
                ]"
              >
                <div class="border-l border-[var(--p-content-border-color)] flex h-full items-center w-full">
                  <!-- checkbox 移到最前面（規格層） -->
                  <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px">
                    <Checkbox
                      :model-value="isSpecSelected(p, spec)"
                      binary
                      :disabled="isExistingSpec(p, spec)"
                      @change="toggleSpec(p, spec)"
                    />
                  </div>
                  <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                    <div class="w-[40px] h-[40px] rounded-[6px] bg-[var(--p-content-hover-background)] flex items-center justify-center shrink-0">
                      <i class="pi pi-image text-[14px] text-[var(--p-text-muted-color)]"></i>
                    </div>
                    <div class="flex flex-col gap-[2px]">
                      <span class="font-medium text-[14px] text-[var(--p-text-color)]">規格：{{ spec.name }}</span>
                      <span
                        v-if="isExistingSpec(p, spec)"
                        class="text-[11px] font-medium text-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-1.5 py-0.5 rounded w-fit"
                      >已加入</span>
                    </div>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                    <span class="text-[14px] text-[var(--p-text-color)]">{{ spec.cost.toLocaleString() }}</span>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                    <span class="text-[14px] text-[var(--p-text-color)]">{{ spec.price.toLocaleString() }}</span>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                    <span class="text-[14px]" :class="spec.stock <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">{{ spec.stock }}</span>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <div v-if="paged.length === 0" class="flex flex-col items-center justify-center gap-2 py-12">
            <i class="pi pi-inbox text-5xl text-[var(--p-text-muted-color)]"></i>
            <span class="text-[14px] text-[var(--p-text-muted-color)]">沒有符合條件的商品</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-color">共 {{ filtered.length }} 件商品</span>
        <Paginator
          v-model:first="pageFirst"
          :rows="pageSize"
          :total-records="filtered.length"
          class="border-0 p-0"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" variant="outlined" @click="close" />
        <Button
          label="確認"
          :disabled="selectedCount === 0"
          @click="onConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>
