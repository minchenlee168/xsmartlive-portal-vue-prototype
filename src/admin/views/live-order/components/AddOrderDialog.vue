<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 追加訂單 dialog：從留言卡觸發，列出「收單中（status==='live'）」的商品，
 * 讓使用者替該留言者多選商品補訂單。mock-only，不串接真實下單。
 *
 * 列表排列：
 * - 沒規格的商品 → checkbox + 商品縮圖 + 名稱 + 關鍵字 + 狀態 badge + 數量
 * - 有規格的商品 → 主商品作 header（不可勾），下方列每個規格 checkbox（可勾、可選數量）
 */

interface ProductSpec {
  id: number
  name?: string
  price?: number
  stock?: number
  [key: string]: unknown
}

interface LiveProductLike {
  id: number
  name?: string
  keyword?: string
  sku?: string
  price?: number
  status?: string
  imageUrl?: string
  specs?: ProductSpec[]
  selectedSpecs?: ProductSpec[]
  [key: string]: unknown
}

export interface AddOrderItem {
  productId: number
  /** 商品有規格時帶上對應 spec id；沒規格時 undefined。 */
  specId?: number
  qty: number
}

export interface AddOrderPayload {
  items: AddOrderItem[]
}

interface Props {
  visible?: boolean
  /** 收單中的商品清單 */
  products?: LiveProductLike[]
  /** 留言者名稱，顯示於標題 */
  user?: string
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  products: () => [],
  user: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: AddOrderPayload]
}>()

const { t } = useI18n()

interface SelectedEntry { productId: number; specId?: number; qty: number }
const innerVisible = ref(props.visible)
/** key: `${productId}-${specId ?? '-'}`；維護被勾的條目 + 對應數量。 */
const selected = ref<Map<string, SelectedEntry>>(new Map())

// ── 篩選：關鍵字 + 有庫存 / 可超賣 ──────────────────
const keyword = ref('')
const onlyInStock = ref(false)
const onlyOversell = ref(false)

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      selected.value = new Map()
      keyword.value = ''
      onlyInStock.value = false
      onlyOversell.value = false
    }
  },
)

function keyOf(productId: number, specId?: number): string {
  return `${productId}-${specId ?? '-'}`
}
function isSelected(productId: number, specId?: number): boolean {
  return selected.value.has(keyOf(productId, specId))
}
function qtyOf(productId: number, specId?: number): number {
  return selected.value.get(keyOf(productId, specId))?.qty ?? 1
}

function toggle(productId: number, specId?: number): void {
  const key = keyOf(productId, specId)
  const next = new Map(selected.value)
  if (next.has(key)) next.delete(key)
  else next.set(key, { productId, specId, qty: 1 })
  selected.value = next
}

/** 主商品 checkbox 狀態：全部規格被勾才視為「主商品已勾」 */
function isAllSpecsChecked(p: LiveProductLike): boolean {
  const list = specsOf(p)
  if (list.length === 0) return false
  return list.every((s) => selected.value.has(keyOf(p.id, s.id)))
}
/** 主商品 checkbox 點下：未全勾 → 一次全勾起（保留現有數量），全勾 → 一次全取消 */
function toggleAllSpecs(p: LiveProductLike): void {
  const list = specsOf(p)
  if (list.length === 0) return
  const next = new Map(selected.value)
  if (isAllSpecsChecked(p)) {
    list.forEach((s) => next.delete(keyOf(p.id, s.id)))
  } else {
    list.forEach((s) => {
      const key = keyOf(p.id, s.id)
      if (!next.has(key)) next.set(key, { productId: p.id, specId: s.id, qty: 1 })
    })
  }
  selected.value = next
}

function setQty(productId: number, specId: number | undefined, qty: number): void {
  const key = keyOf(productId, specId)
  const entry = selected.value.get(key)
  if (!entry) return
  const next = new Map(selected.value)
  next.set(key, { ...entry, qty: Math.max(1, qty || 1) })
  selected.value = next
}
function adjustQty(productId: number, specId: number | undefined, delta: number): void {
  setQty(productId, specId, qtyOf(productId, specId) + delta)
}

/** 商品有效規格：優先 selectedSpecs（picker 帶入）→ 否則 specs。 */
function specsOf(p: LiveProductLike): ProductSpec[] {
  const list = (p.selectedSpecs && p.selectedSpecs.length > 0)
    ? p.selectedSpecs
    : (p.specs ?? [])
  return list.filter((s) => typeof s.id === 'number')
}

/** 顯示用關鍵字：優先 keyword，否則取 sku 前綴。 */
function keywordOf(p: LiveProductLike): string {
  return p.keyword || (p.sku || '').split('-')[0] || `P${p.id}`
}

/** 商品（含規格）任一處有庫存即視為「有庫存」。 */
function hasStock(p: LiveProductLike): boolean {
  if ((p.stock as number | undefined) ?? 0 > 0) return true
  const specs = specsOf(p)
  return specs.some(s => ((s.stock as number | undefined) ?? 0) > 0)
}
/** 從 product 取出 allowOversell（可能在 product 自身或 spec 上）。 */
function canOversell(p: LiveProductLike): boolean {
  return (p as { allowOversell?: boolean }).allowOversell === true
}

/** 套用「關鍵字 + 有庫存 + 可超賣」三個條件過濾。 */
const filteredProducts = computed<LiveProductLike[]>(() => {
  let list = props.products
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    list = list.filter(p =>
      (p.name ?? '').toLowerCase().includes(k)
      || keywordOf(p).toLowerCase().includes(k)
      || (p.sku ?? '').toLowerCase().includes(k),
    )
  }
  if (onlyInStock.value) list = list.filter(hasStock)
  if (onlyOversell.value) list = list.filter(canOversell)
  return list
})

const selectedCount = computed(() => selected.value.size)
const canSubmit = computed(() => selectedCount.value > 0)

interface StatusBadge {
  label: string
  cls: string
}
function statusBadge(p: LiveProductLike): StatusBadge | null {
  switch (p.status) {
    case 'live':  return { label: t('live_order.label.live'),  cls: 'bg-[#fee2e2] text-[#dc2626]' }
    case 'ready': return { label: t('live_order.label.ready'), cls: 'bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)]' }
    case 'done':  return { label: t('live_order.label.done'),  cls: 'bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)]' }
    default:      return null
  }
}

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function onSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', { items: Array.from(selected.value.values()) })
  close()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)] flex items-center gap-2" style="font-size: 17.5px">
        <i class="pi pi-plus-circle text-[var(--p-primary-color)]" style="font-size: 18px"></i>
        {{ t('live_order.dialog.add_order_header') }}
        <span v-if="user" class="text-[14px] font-normal text-[var(--p-text-muted-color)]">— {{ user }}</span>
      </span>
    </template>

    <div class="flex flex-col gap-3 pt-2">
      <label class="text-[14px] font-medium text-[var(--p-text-color)]">
        {{ t('live_order.label.pick_live_product') }}
      </label>

      <!-- 關鍵字搜尋 + 庫存/超賣篩選 -->
      <div class="flex items-center gap-3 flex-wrap">
        <InputText v-model="keyword" placeholder="搜尋名稱 / 關鍵字 / SKU" class="!w-[260px]" />
        <label class="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--p-text-color)]">
          <Checkbox v-model="onlyInStock" binary input-id="filter-in-stock" />
          有庫存
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--p-text-color)]">
          <Checkbox v-model="onlyOversell" binary input-id="filter-oversell" />
          可超賣
        </label>
      </div>

      <div v-if="filteredProducts.length === 0" class="py-6 text-center text-[14px] text-[var(--p-text-muted-color)]">
        {{ products.length === 0 ? t('live_order.empty.no_live_product') : '沒有符合條件的商品' }}
      </div>

      <div v-else class="flex flex-col max-h-[360px] overflow-y-auto pr-1 divide-y divide-[var(--p-content-border-color)]">
        <template v-for="p in filteredProducts" :key="p.id">
          <!-- 有規格 → 商品標題（可點按整批勾選 / 取消所有規格）+ 每個規格獨立可勾選列 -->
          <template v-if="specsOf(p).length > 0">
            <button
              type="button"
              class="flex items-center gap-3 px-2 pt-2.5 pb-1 w-full text-left hover:bg-[var(--p-content-hover-background)]"
              @click="toggleAllSpecs(p)"
            >
              <!-- 主商品 checkbox：全勾為已勾，全空為未勾（不顯示 indeterminate，避免狀態混淆） -->
              <span
                class="shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center"
                :class="isAllSpecsChecked(p)
                  ? 'bg-[var(--p-primary-color)] border-[var(--p-primary-color)]'
                  : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)]'"
              >
                <i v-if="isAllSpecsChecked(p)" class="pi pi-check text-white" style="font-size: 11px"></i>
              </span>
              <!-- 縮圖 -->
              <img
                v-if="p.imageUrl"
                :src="p.imageUrl"
                alt=""
                class="shrink-0 w-[36px] h-[36px] rounded-[6px] object-cover border border-[var(--p-content-border-color)]"
              />
              <div
                v-else
                class="shrink-0 w-[36px] h-[36px] rounded-[6px] border border-dashed border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] flex items-center justify-center"
              >
                <i class="pi pi-image text-[var(--p-text-muted-color)]" style="font-size: 14px"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-[14px] text-[var(--p-text-color)] truncate">{{ p.name }}</div>
                <div class="text-[12px] text-[var(--p-text-muted-color)] truncate">
                  {{ t('live_order.label.keyword_with_value', { value: keywordOf(p) }) }}
                </div>
              </div>
              <span
                v-if="statusBadge(p)"
                class="shrink-0 text-[12.25px] font-bold px-[7px] py-[3.5px] rounded-[12px] leading-none"
                :class="statusBadge(p)!.cls"
              >
                {{ statusBadge(p)!.label }}
              </span>
            </button>

            <button
              v-for="spec in specsOf(p)"
              :key="`${p.id}-${spec.id}`"
              type="button"
              class="flex items-center gap-3 pl-12 pr-2 py-2 text-left hover:bg-[var(--p-content-hover-background)]"
              @click="toggle(p.id, spec.id)"
            >
              <!-- Checkbox -->
              <span
                class="shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center"
                :class="isSelected(p.id, spec.id)
                  ? 'bg-[var(--p-primary-color)] border-[var(--p-primary-color)]'
                  : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)]'"
              >
                <i v-if="isSelected(p.id, spec.id)" class="pi pi-check text-white" style="font-size: 11px"></i>
              </span>
              <span class="text-[14px] text-[var(--p-text-color)] flex-1 min-w-0 truncate">{{ spec.name }}</span>
              <span v-if="typeof spec.price === 'number'" class="text-[12px] text-[var(--p-text-muted-color)] shrink-0">
                ${{ spec.price.toLocaleString() }}
              </span>
              <!-- 數量 stepper -->
              <div v-if="isSelected(p.id, spec.id)" class="flex items-center shrink-0" @click.stop>
                <button
                  type="button"
                  class="w-[24px] h-[26px] border border-[var(--p-content-border-color)] border-r-0 rounded-l-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
                  @click="adjustQty(p.id, spec.id, -1)"
                >
                  <i class="pi pi-minus text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
                </button>
                <input
                  :value="qtyOf(p.id, spec.id)"
                  type="number"
                  min="1"
                  class="w-[44px] h-[26px] border border-[var(--p-content-border-color)] text-center text-[14px] text-[var(--p-text-color)] outline-none focus:border-[var(--p-primary-color)]"
                  @input="(e) => setQty(p.id, spec.id, Number((e.target as HTMLInputElement).value))"
                />
                <button
                  type="button"
                  class="w-[24px] h-[26px] border border-[var(--p-content-border-color)] border-l-0 rounded-r-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
                  @click="adjustQty(p.id, spec.id, 1)"
                >
                  <i class="pi pi-plus text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
                </button>
              </div>
            </button>
          </template>

          <!-- 沒規格 → 整顆商品 checkbox + 數量 -->
          <button
            v-else
            type="button"
            class="flex items-center gap-3 px-2 py-2.5 text-left hover:bg-[var(--p-content-hover-background)]"
            @click="toggle(p.id)"
          >
            <span
              class="shrink-0 w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center"
              :class="isSelected(p.id)
                ? 'bg-[var(--p-primary-color)] border-[var(--p-primary-color)]'
                : 'border-[var(--p-content-border-color)] bg-[var(--p-content-background)]'"
            >
              <i v-if="isSelected(p.id)" class="pi pi-check text-white" style="font-size: 11px"></i>
            </span>
            <img
              v-if="p.imageUrl"
              :src="p.imageUrl"
              alt=""
              class="shrink-0 w-[36px] h-[36px] rounded-[6px] object-cover border border-[var(--p-content-border-color)]"
            />
            <div
              v-else
              class="shrink-0 w-[36px] h-[36px] rounded-[6px] border border-dashed border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] flex items-center justify-center"
            >
              <i class="pi pi-image text-[var(--p-text-muted-color)]" style="font-size: 14px"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-[14px] text-[var(--p-text-color)] truncate">{{ p.name }}</div>
              <div class="text-[12px] text-[var(--p-text-muted-color)] truncate">
                {{ t('live_order.label.keyword_with_value', { value: keywordOf(p) }) }}
              </div>
            </div>
            <div v-if="isSelected(p.id)" class="flex items-center shrink-0" @click.stop>
              <button
                type="button"
                class="w-[24px] h-[26px] border border-[var(--p-content-border-color)] border-r-0 rounded-l-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
                @click="adjustQty(p.id, undefined, -1)"
              >
                <i class="pi pi-minus text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
              </button>
              <input
                :value="qtyOf(p.id)"
                type="number"
                min="1"
                class="w-[44px] h-[26px] border border-[var(--p-content-border-color)] text-center text-[14px] text-[var(--p-text-color)] outline-none focus:border-[var(--p-primary-color)]"
                @input="(e) => setQty(p.id, undefined, Number((e.target as HTMLInputElement).value))"
              />
              <button
                type="button"
                class="w-[24px] h-[26px] border border-[var(--p-content-border-color)] border-l-0 rounded-r-[6px] flex items-center justify-center hover:bg-[var(--p-content-hover-background)]"
                @click="adjustQty(p.id, undefined, 1)"
              >
                <i class="pi pi-plus text-[var(--p-text-muted-color)]" style="font-size: 10px"></i>
              </button>
            </div>
            <span
              v-if="statusBadge(p)"
              class="shrink-0 text-[12.25px] font-bold px-[7px] py-[3.5px] rounded-[12px] leading-none"
              :class="statusBadge(p)!.cls"
            >
              {{ statusBadge(p)!.label }}
            </span>
          </button>
        </template>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          variant="outlined"
          @click="close"
        />
        <Button
          :label="t('live_order.button.submit_order_count', { count: selectedCount })"
          icon="pi pi-check"
          :disabled="!canSubmit"
          @click="onSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>
