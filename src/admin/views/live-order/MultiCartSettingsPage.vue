<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import MultiCartFormDialog, {
  type MultiCartFormPayload,
  type MultiCartInitial,
} from './components/MultiCartFormDialog.vue'

/**
 * 多購物車設定頁。
 *
 * - 卡片版本 / 列表版本 兩個檢視 tab（目前 mock 只實作卡片版本，列表版本標示「規劃中」）
 * - 預設「購物車」單獨置頂顯示（紫框高亮、預設 tag）
 * - 其他購物車以「全部 / 可結帳 / 關閉中」狀態 tab 過濾顯示
 * - 每張卡片：標題 / 建立日期 / 支援金流 chips / 支援物流 chips / 可結帳 toggle / 編輯 / 刪除
 */

const toast = useToast()
const confirm = useConfirm()

// 檢視 tab（卡片 / 列表）
type ViewMode = 'card' | 'list'
const viewMode = ref<ViewMode>('card')

// 狀態 tab
type StatusTab = 'all' | 'active' | 'closed'
const statusTab = ref<StatusTab>('all')
const statusTabs: Array<{ key: StatusTab; label: string }> = [
  { key: 'all',    label: '全部' },
  { key: 'active', label: '可結帳' },
  { key: 'closed', label: '關閉中' },
]

interface Cart {
  id: number
  name: string
  isDefault?: boolean
  /** true = 可結帳 / false = 關閉中 */
  canCheckout: boolean
  /** 建立日期（卡片版） / 建立時間（列表版用「YYYY-MM-DD HH:mm」） */
  createdAt: string
  /** 副描述（列表版顯示在名稱下方） */
  description?: string
  /** 支援金流 chip 標籤 */
  payments: string[]
  /** 支援物流 chip 標籤 */
  shippings: string[]
  /** 啟用紅利 */
  featureBonus?: boolean
  /** 允許棄標 */
  featureAbandon?: boolean
}

const carts = ref<Cart[]>([
  {
    id: 1,
    name: '購物車',
    isDefault: true,
    canCheckout: true,
    createdAt: '2026-04-01 09:00',
    payments: ['藍新金流', '藍新金流', '轉帳匯款'],
    shippings: ['宅配(7-11 (Mock)、嘉里大榮 (Mock))', '超商取貨(7-11 (Mock))'],
  },
  {
    id: 2,
    name: '快速到貨購物車',
    canCheckout: false,
    createdAt: '2026-04-25 14:32',
    payments: ['藍新金流'],
    shippings: ['宅配(7-11 (Mock)、嘉里大榮 (Mock))'],
  },
  {
    id: 3,
    name: '超商專用購物車',
    canCheckout: true,
    createdAt: '2026-04-22 10:15',
    payments: ['貨到付款', '藍新金流'],
    shippings: ['超商取貨(7-11 (Mock))'],
  },
  {
    id: 4,
    name: '離島配送',
    canCheckout: true,
    createdAt: '2026-05-14 16:07',
    description: '離島地區（澎湖、小琉球）專用',
    payments: ['藍新金流', '轉帳匯款'],
    shippings: ['宅配(嘉里大榮 (Mock))', '超商取貨(7-11 (Mock))'],
    featureBonus: true,
    featureAbandon: true,
  },
])

const defaultCart = computed(() => carts.value.find((c) => c.isDefault))
const otherCarts = computed(() => carts.value.filter((c) => !c.isDefault))

// 列表版本：分頁
const listPageFirst = ref(0)
const listRows = ref(10)
const listRowsOptions = [10, 20, 50]

const filteredCarts = computed(() => {
  if (statusTab.value === 'all') return otherCarts.value
  if (statusTab.value === 'active') return otherCarts.value.filter((c) => c.canCheckout)
  return otherCarts.value.filter((c) => !c.canCheckout)
})

// 新增 / 編輯多購物車 dialog
const formDialogVisible = ref(false)
const formDialogInitial = ref<MultiCartInitial | null>(null)

const paymentLabelMap: Record<string, string> = {
  transfer: '轉帳匯款',
  cod: '貨到付款',
  pickup: '自取',
  'newebpay-credit': '藍新金流',
  'newebpay-atm': '藍新金流',
  ipass: 'iPASS MONEY',
  linepay: 'LINE Pay',
}
const shippingLabelMap: Record<string, string> = {
  home: '宅配(7-11 (Mock)、嘉里大榮 (Mock))',
  cvs:  '超商取貨(7-11 (Mock))',
}
/** label → id：mock 用簡單 reverse map（藍新金流預設信用卡，多個 ATM 帳號 user 再勾） */
function paymentLabelToId(label: string): string {
  const reverse: Record<string, string> = {
    '轉帳匯款': 'transfer',
    '貨到付款': 'cod',
    '自取': 'pickup',
    '藍新金流': 'newebpay-credit',
    'iPASS MONEY': 'ipass',
    'LINE Pay': 'linepay',
  }
  return reverse[label] ?? label
}
function shippingLabelToId(label: string): string {
  if (label.startsWith('宅配')) return 'home'
  if (label.startsWith('超商')) return 'cvs'
  return label
}

function onAddCart(): void {
  formDialogInitial.value = null
  formDialogVisible.value = true
}
function onEditCart(c: Cart): void {
  // 把 Cart 投影成 MultiCartInitial 預填到 dialog
  formDialogInitial.value = {
    id: c.id,
    name: c.name,
    behaviors: {
      canCheckout: c.canCheckout,
      allowBonus:  !!c.featureBonus,
      allowAbandon: !!c.featureAbandon,
    },
    payments: Array.from(new Set(c.payments.map(paymentLabelToId))),
    shippings: Array.from(new Set(c.shippings.map(shippingLabelToId))),
  }
  formDialogVisible.value = true
}
function onCartFormSaved(payload: MultiCartFormPayload): void {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  if (payload.id != null) {
    // 編輯模式：找到原本的 cart 寫回
    const target = carts.value.find((c) => c.id === payload.id)
    if (!target) return
    target.name = payload.name
    target.canCheckout = payload.behaviors.canCheckout
    target.payments = payload.payments.map((id) => paymentLabelMap[id] ?? id)
    target.shippings = payload.shippings.map((id) => shippingLabelMap[id] ?? id)
    target.featureBonus = payload.behaviors.allowBonus
    target.featureAbandon = payload.behaviors.allowAbandon
    toast.add({ severity: 'success', summary: `已儲存「${payload.name}」`, life: 1800 })
    return
  }

  // 新增模式
  const newId = Math.max(0, ...carts.value.map((c) => c.id)) + 1
  carts.value.push({
    id: newId,
    name: payload.name,
    canCheckout: payload.behaviors.canCheckout,
    createdAt: ts,
    payments: payload.payments.map((id) => paymentLabelMap[id] ?? id),
    shippings: payload.shippings.map((id) => shippingLabelMap[id] ?? id),
    featureBonus: payload.behaviors.allowBonus,
    featureAbandon: payload.behaviors.allowAbandon,
  })
  toast.add({ severity: 'success', summary: `已建立「${payload.name}」`, life: 1800 })
}
function onDeleteCart(c: Cart, event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: '刪除多購物車',
    message: `確定刪除「${c.name}」嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      carts.value = carts.value.filter((x) => x.id !== c.id)
      toast.add({ severity: 'success', summary: `已刪除「${c.name}」`, life: 1500 })
    },
  })
}
</script>

<template>
  <Card
    :pt="{
      root: { class: 'w-full' },
      body: { class: 'p-0' },
      content: { class: 'p-0' },
    }"
  >
    <template #content>
      <!-- 頁首：標題 + 說明 icon -->
      <div class="px-6 pt-5 pb-3 flex items-center gap-2">
        <h1 class="text-[22px] font-bold text-[var(--p-text-color)]">多購物車設定</h1>
        <i
          v-tooltip.top="'透過多購物車設定，讓不同類型訂單走獨立的金物流組合'"
          class="pi pi-info-circle text-[var(--p-text-muted-color)] cursor-help"
          style="font-size: 15px"
        ></i>
      </div>

      <!-- 檢視 tab：卡片 / 列表（TabList 加 px-6 對齊上下內容的左右內距） -->
      <Tabs :value="viewMode" @update:value="(v) => viewMode = v as ViewMode">
        <TabList :pt="{ root: { class: 'px-6' } }">
          <Tab value="card">卡片版本</Tab>
          <Tab value="list">列表版本</Tab>
        </TabList>
      </Tabs>

      <!-- 副標 + 新增 -->
      <div class="px-6 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <p class="text-[14px] text-[var(--p-text-muted-color)]">
          建立多組多購物車設定，商品卡可選擇適合的多購物車組合
        </p>
        <Button label="新增多購物車" icon="pi pi-plus" @click="onAddCart" />
      </div>

      <!-- 卡片版本 -->
      <div v-if="viewMode === 'card'" class="px-6 pb-6 flex flex-col gap-4">
        <!-- 預設購物車 Card：紫框、紫底淡色高亮 -->
        <div
          v-if="defaultCart"
          class="rounded-lg border-2 border-[var(--p-primary-color)] bg-[var(--p-primary-50)]/30 p-4"
        >
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-[16px] font-bold text-[var(--p-text-color)]">{{ defaultCart.name }}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12.25px] font-bold leading-none bg-[var(--p-primary-50)] text-[var(--p-primary-color)]">預設</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <span class="text-[13px] text-[var(--p-text-color)]">可結帳</span>
                <ToggleSwitch v-model="defaultCart.canCheckout" />
              </div>
              <Button
                v-tooltip.top="'編輯'"
                icon="pi pi-pencil"
                severity="secondary"
                variant="text"
                rounded
                @click="onEditCart(defaultCart)"
              />
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="flex items-center gap-1.5 mb-2 text-[13px] text-[var(--p-text-muted-color)]">
                <i class="pi pi-credit-card" style="font-size: 13px"></i>
                支援金流
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tag v-for="(p, i) in defaultCart.payments" :key="i" :value="p" severity="info" />
              </div>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-2 text-[13px] text-[var(--p-text-muted-color)]">
                <i class="pi pi-truck" style="font-size: 13px"></i>
                支援物流
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tag v-for="(s, i) in defaultCart.shippings" :key="i" :value="s" severity="info" />
              </div>
            </div>
          </div>
        </div>

        <!-- 狀態 tab -->
        <div class="flex items-center gap-6 border-b border-[var(--p-content-border-color)]">
          <button
            v-for="t in statusTabs"
            :key="t.key"
            class="pb-3 text-[14px] font-medium transition-colors relative -mb-px"
            :class="statusTab === t.key
              ? 'text-[var(--p-primary-color)] border-b-2 border-[var(--p-primary-color)]'
              : 'text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]'"
            @click="statusTab = t.key"
          >{{ t.label }}</button>
        </div>

        <!-- 其他購物車卡片 -->
        <div
          v-for="c in filteredCarts"
          :key="c.id"
          class="rounded-lg border border-[var(--p-content-border-color)] p-4"
        >
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div class="flex flex-col gap-1">
              <span class="text-[16px] font-bold text-[var(--p-text-color)]">{{ c.name }}</span>
              <span class="text-[12px] text-[var(--p-text-muted-color)]">建立日期:{{ c.createdAt }}</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <span class="text-[13px] text-[var(--p-text-color)]">可結帳</span>
                <ToggleSwitch v-model="c.canCheckout" />
              </div>
              <Button
                v-tooltip.top="'編輯'"
                icon="pi pi-pencil"
                severity="secondary"
                variant="text"
                rounded
                @click="onEditCart(c)"
              />
              <Button
                v-tooltip.top="'刪除'"
                icon="pi pi-trash"
                severity="danger"
                variant="text"
                rounded
                @click="onDeleteCart(c, $event)"
              />
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="flex items-center gap-1.5 mb-2 text-[13px] text-[var(--p-text-muted-color)]">
                <i class="pi pi-credit-card" style="font-size: 13px"></i>
                支援金流
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tag v-for="(p, i) in c.payments" :key="i" :value="p" severity="info" />
              </div>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-2 text-[13px] text-[var(--p-text-muted-color)]">
                <i class="pi pi-truck" style="font-size: 13px"></i>
                支援物流
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tag v-for="(s, i) in c.shippings" :key="i" :value="s" severity="info" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredCarts.length === 0" class="py-12 text-center text-color-secondary">
          目前沒有符合條件的多購物車。
        </div>
      </div>

      <!-- 列表版本 -->
      <div v-else class="px-6 pb-6">
        <DataTable
          :value="carts"
          data-key="id"
          striped-rows
          paginator
          :rows="listRows"
          :rows-per-page-options="listRowsOptions"
          v-model:first="listPageFirst"
          current-page-report-template="共 {totalRecords} 筆"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
        >
          <Column header="建立時間" style="width: 180px">
            <template #body="{ data }">
              <span class="text-[var(--p-text-muted-color)]">{{ data.createdAt }}</span>
            </template>
          </Column>
          <Column header="名稱">
            <template #body="{ data }">
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <span class="font-bold">{{ data.name }}</span>
                  <span
                    v-if="data.isDefault"
                    class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12.25px] font-bold leading-none bg-[var(--p-primary-50)] text-[var(--p-primary-color)]"
                  >預設</span>
                </div>
                <span v-if="data.description" class="text-xs text-[var(--p-text-muted-color)]">{{ data.description }}</span>
              </div>
            </template>
          </Column>
          <Column header="支援功能" style="width: 280px">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-1.5">
                <Tag :value="`金流 ${data.payments.length}`" severity="info" />
                <Tag :value="`物流 ${data.shippings.length}`" severity="info" />
                <Tag v-if="data.featureBonus" value="紅利" severity="success" />
                <Tag v-if="data.featureAbandon" value="可棄標" severity="secondary" />
              </div>
            </template>
          </Column>
          <Column header="可結帳" style="width: 100px">
            <template #body="{ data }">
              <ToggleSwitch v-model="data.canCheckout" />
            </template>
          </Column>
          <Column header="操作" style="width: 100px" body-class="text-right" header-class="text-right">
            <template #body="{ data }">
              <div class="flex items-center justify-end gap-1" @click.stop>
                <Button
                  v-tooltip.top="'編輯'"
                  icon="pi pi-pencil"
                  severity="secondary"
                  variant="text"
                  rounded
                  @click="onEditCart(data)"
                />
                <Button
                  v-if="!data.isDefault"
                  v-tooltip.top="'刪除'"
                  icon="pi pi-trash"
                  severity="danger"
                  variant="text"
                  rounded
                  @click="onDeleteCart(data, $event)"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="py-12 text-center text-color-secondary">
              尚未建立多購物車。
            </div>
          </template>
        </DataTable>
      </div>
    </template>
  </Card>

  <MultiCartFormDialog
    v-model:visible="formDialogVisible"
    :initial="formDialogInitial"
    @saved="onCartFormSaved"
  />
</template>
