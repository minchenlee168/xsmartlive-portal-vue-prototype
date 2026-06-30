<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import PostPeriodDialog, { type PostPeriodPayload } from './PostPeriodDialog.vue'

/**
 * 貼文收單頁的「貼文清單」table。
 * 每一列代表一筆貼文（收單單位），顯示訂單統計、收單期間、狀態與快捷操作。
 *
 * 上方提供 4 個 tab 篩選：收單中 / 準備中 / 已結束 / 全部。
 * 設計 token 參考 `/Users/mindy/Downloads/0_工作/system/all_V1/design-tokens.json`
 * → tabs（active 主色底線、font 14px bold）、status-badge（直播收單區 variant）。
 */

/** 結束收單彙總 dialog 需要的最少商品欄位（沿用 EndOrderingSummaryDialog.ProductInput）。 */
export interface OrderPostProduct {
  id: number
  name?: string
  keyword?: string
  price?: number
  stock?: number
  sold?: number
  specs?: Array<{ id?: number; name?: string; stock?: number; sold?: number; price?: number }>
}

export interface OrderPost {
  id: number
  /** 貼文顯示名稱：例如「貼文2026/02/10」 */
  name: string
  /** 訂單數 */
  orderCount: number
  /** 銷售金額（NTD） */
  salesAmount: number
  /** 建立時間（顯示用字串，YYYY-MM-DD HH:mm） */
  createdAt: string
  /** 收單期間（顯示用字串，可為單一截止時間或區間） */
  orderingPeriod: string
  /** 收單期間起點（含時間）；用於開啟期間設定彈窗時帶入預設值 */
  startAt?: Date | null
  /** 收單期間終點（含時間）；用於開啟期間設定彈窗時帶入預設值 */
  endAt?: Date | null
  /** 建立人 */
  createdBy: string
  /** 收單狀態：進行中（ongoing）/ 準備中（ready）/ 已結束（ended） */
  status: 'ongoing' | 'ended' | 'ready'
  /** 該貼文內已上架商品（給結束收單彙總用） */
  products?: OrderPostProduct[]
}

type TabValue = 'ongoing' | 'ready' | 'ended' | 'all'

interface Props {
  posts: OrderPost[]
  /** 「選擇貼文」按鈕是否可用 */
  canPickPost?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  canPickPost: true,
})

const activeTab = ref<TabValue>('ready')
const keyword = ref('')
const selectedIds = ref<number[]>([])
const tabs: Array<{ value: TabValue; label: string }> = [
  { value: 'ready',   label: '準備中' },
  { value: 'ongoing', label: '收單中' },
  { value: 'ended',   label: '已結束' },
  { value: 'all',     label: '全部' },
]
/** 依關鍵字 + 狀態 tab 過濾。 */
const filteredPosts = computed<OrderPost[]>(() => {
  let list = activeTab.value === 'all'
    ? props.posts
    : props.posts.filter(p => p.status === activeTab.value)
  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(k) || p.createdBy.toLowerCase().includes(k),
    )
  }
  return list
})
function countByStatus(value: TabValue): number {
  return value === 'all'
    ? props.posts.length
    : props.posts.filter(p => p.status === value).length
}

const emit = defineEmits<{
  delete: [id: number]
  'view-winners': [id: number]
  'view-products': [id: number]
  'toggle-status': [id: number]
  'pick-post': []
  'batch-delete': [ids: number[]]
  /** 點按整列（非按鈕區）→ 進入該筆貼文的收單畫面 */
  'select-post': [id: number]
  /** 收單期間 cell 內存檔 → 父層寫回 startAt / endAt 並更新顯示字串 */
  'update-period': [payload: { id: number; startAt: Date | null; endAt: Date | null }]
}>()

const periodDialogVisible = ref(false)
const editingPost = ref<OrderPost | null>(null)

function openPeriodDialog(post: OrderPost): void {
  editingPost.value = post
  periodDialogVisible.value = true
}
function onPeriodSave(payload: PostPeriodPayload): void {
  if (!editingPost.value) return
  emit('update-period', {
    id: editingPost.value.id,
    startAt: payload.startAt,
    endAt: payload.endAt,
  })
}

function onSearch(): void {
  // 已在 computed filteredPosts 即時過濾；此處保留 hook 供日後串 API
}

/** 點按列 → emit select-post；若點到 checkbox / 按鈕 / 連結 / 輸入框，視為操作元件本身，不觸發列選取 */
function onRowClick(e: { originalEvent: Event; data: unknown }): void {
  const target = (e.originalEvent.target as HTMLElement | null)
  if (!target) return
  if (target.closest('button, a, input, .p-checkbox, .p-checkbox-input')) return
  emit('select-post', (e.data as OrderPost).id)
}
function onBatchDelete(): void {
  if (selectedIds.value.length === 0) return
  confirm.require({
    header: '批次刪除貼文',
    message: `確定刪除選取的 ${selectedIds.value.length} 筆貼文嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      emit('batch-delete', [...selectedIds.value])
      selectedIds.value = []
    },
  })
}
function onCopyLink(post: OrderPost): void {
  toast.add({ severity: 'success', summary: `已複製「${post.name}」連結`, life: 1500 })
}

const confirm = useConfirm()
const toast = useToast()

interface MenuApi {
  toggle: (event: Event) => void
}
const moreMenuRef = ref<MenuApi | null>(null)
const activePost = ref<OrderPost | null>(null)

const moreMenuItems: MenuItem[] = [
  {
    label: '編輯貼文',
    icon: 'pi pi-pencil',
    command: () => {
      toast.add({ severity: 'info', summary: `編輯「${activePost.value?.name ?? ''}」`, life: 1500 })
    },
  },
  {
    label: '複製連結',
    icon: 'pi pi-link',
    command: () => {
      toast.add({ severity: 'success', summary: '已複製貼文連結', life: 1500 })
    },
  },
  {
    label: '匯出 CSV',
    icon: 'pi pi-download',
    command: () => {
      toast.add({ severity: 'info', summary: `匯出「${activePost.value?.name ?? ''}」訂單`, life: 1500 })
    },
  },
]

function openMore(post: OrderPost, event: Event): void {
  activePost.value = post
  moreMenuRef.value?.toggle(event)
}

function onDelete(post: OrderPost, event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: '刪除貼文',
    message: `確定刪除「${post.name}」嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => emit('delete', post.id),
  })
}

/**
 * 狀態 badge 樣式，對齊 design-tokens.json → status-badge.variants.直播收單區：
 * - 收單中：紅底紅字 + animate-pulse 紅點
 * - 準備中：灰底灰字 + pi-history icon
 * - 已結束：灰底灰字
 */
function statusMeta(status: OrderPost['status']): { label: string; bg: string; color: string; dot?: boolean; icon?: string } {
  const map = {
    ongoing: { label: '收單中', bg: '#fee2e2', color: '#dc2626', dot: true },
    ready:   { label: '準備中', bg: '#f1f5f9', color: '#64748b', icon: 'pi pi-history' },
    ended:   { label: '已結束', bg: '#f1f5f9', color: '#64748b' },
  } as const
  return map[status]
}
</script>

<template>
  <!-- Card wrapper（design-tokens.json → card）：標題 + tabs + 搜尋列 + table 全部裝進同一張卡片 -->
  <Card
    :pt="{
      root: { class: 'w-full overflow-hidden' },
      body: { class: 'p-0' },
      content: { class: 'p-0' },
    }"
  >
    <template #content>
      <!-- 標題區 -->
      <div class="flex flex-col gap-1 px-4 pt-4 pb-2">
        <h2 class="text-[17.5px] font-bold text-[var(--p-text-color)]">收單紀錄列表</h2>
      </div>

      <!-- 頁籤：收單中 / 準備中 / 已結束 / 全部 — design-tokens.json → tabs -->
      <div class="px-4">
        <Tabs :value="activeTab" @update:value="(v) => activeTab = v as TabValue">
          <TabList>
            <Tab
              v-for="t in tabs"
              :key="t.value"
              :value="t.value"
            >
              <span class="flex items-center gap-1.5 text-[14px] font-bold">
                {{ t.label }}
                <span
                  class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-none"
                  :style="activeTab === t.value
                    ? 'background: var(--p-primary-color); color: var(--p-primary-contrast-color)'
                    : 'background: var(--p-content-hover-background); color: var(--p-text-muted-color)'"
                >{{ countByStatus(t.value) }}</span>
              </span>
            </Tab>
          </TabList>
        </Tabs>
      </div>

      <!-- 搜尋列 + 動作按鈕 — 對齊圖示中 list-toolbar 排版
           註：批次刪除 / 選擇貼文 只在「準備中」tab 顯示（其他狀態無法選或挑新貼文） -->
      <div class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div class="flex items-center min-w-[280px]" style="filter: drop-shadow(0px 1px 1px rgba(18,18,23,0.05))">
          <InputGroup>
            <InputText
              v-model="keyword"
              placeholder="快速搜尋貼文名稱或建立人"
              class="!w-[320px]"
              @keyup.enter="onSearch"
            />
            <Button label="搜尋" @click="onSearch" />
          </InputGroup>
        </div>
        <div v-if="activeTab === 'ready'" class="flex items-center gap-2">
          <Button
            label="批次刪除"
            icon="pi pi-trash"
            severity="danger"
            variant="outlined"
            :disabled="selectedIds.length === 0"
            @click="onBatchDelete"
          />
          <span v-tooltip.bottom="canPickPost ? '' : '請先完成必要設定'">
            <Button
              label="選擇貼文"
              icon="pi pi-plus"
              :disabled="!canPickPost"
              @click="emit('pick-post')"
            />
          </span>
        </div>
      </div>

      <!-- 手機條列式：每筆 = label：value 配對 + 底線分隔；不用橫滾。桌機隱藏 -->
      <div class="md:hidden divide-y divide-[var(--p-content-border-color)] border-t border-[var(--p-content-border-color)]">
        <button
          v-for="p in filteredPosts"
          :key="p.id"
          type="button"
          class="block w-full text-left px-4 py-4 hover:bg-[var(--p-content-hover-background)] transition-colors"
          @click="emit('select-post', p.id)"
        >
          <!-- 名稱 + 狀態 badge 一列 -->
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="font-bold text-[15px] text-[var(--p-text-color)] flex-1">{{ p.name }}</span>
            <span
              class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold leading-none"
              :style="{ background: statusMeta(p.status).bg, color: statusMeta(p.status).color }"
            >
              <span
                v-if="statusMeta(p.status).dot"
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                :style="{ background: statusMeta(p.status).color }"
              ></span>
              <i
                v-else-if="statusMeta(p.status).icon"
                :class="statusMeta(p.status).icon"
                :style="{ fontSize: '11px', color: statusMeta(p.status).color }"
              ></i>
              {{ statusMeta(p.status).label }}
            </span>
          </div>

          <!-- 欄位 label：value 配對 -->
          <div class="flex flex-col gap-1 text-[13px]">
            <div><span class="text-color-secondary">收單期間：</span><span class="text-[var(--p-text-color)]">{{ p.orderingPeriod }}</span></div>
            <div><span class="text-color-secondary">訂單數：</span><span class="text-[var(--p-text-color)] font-bold">{{ p.orderCount }}</span></div>
            <div><span class="text-color-secondary">銷售金額：</span><span class="text-[#f97316] font-bold">${{ p.salesAmount.toLocaleString() }}</span></div>
            <div><span class="text-color-secondary">建立人：</span><span class="text-[var(--p-text-color)]">{{ p.createdBy }}</span></div>
          </div>

          <!-- 操作 buttons -->
          <div class="mt-3 flex items-center gap-1.5" @click.stop>
            <Button
              v-tooltip.top="'得標清單'"
              icon="pi pi-list"
              severity="success"
              variant="outlined"
              rounded
              size="small"
              @click="emit('view-winners', p.id)"
            />
            <Button
              v-tooltip.top="'商品清單'"
              icon="pi pi-shopping-bag"
              variant="outlined"
              rounded
              size="small"
              @click="emit('view-products', p.id)"
            />
            <Button
              v-if="p.status !== 'ended'"
              :label="p.status === 'ongoing' ? '結單' : '開始收單'"
              :icon="p.status === 'ongoing' ? 'pi pi-stop-circle' : 'pi pi-play'"
              :severity="p.status === 'ongoing' ? 'danger' : 'primary'"
              size="small"
              class="ml-auto"
              @click="emit('toggle-status', p.id)"
            />
          </div>
        </button>
        <div v-if="filteredPosts.length === 0" class="py-8 text-center text-[14px] text-[var(--p-text-muted-color)]">
          目前尚無貼文，請按右上方「選擇貼文」開始。
        </div>
      </div>

      <!-- 桌機表格：手機隱藏，改用上方條列式 -->
      <div class="hidden md:block">
      <DataTable
        v-model:selection="selectedIds"
        :value="filteredPosts"
        :striped-rows="true"
        data-key="id"
        class="w-full"
        :pt="{
          column: { headerCell: { style: 'white-space: nowrap;' } },
          bodyRow: { class: 'cursor-pointer' },
        }"
        @row-click="onRowClick"
      >
        <Column selection-mode="multiple" header-style="width: 3rem" />

        <Column field="name" header="名稱" sortable>
          <template #body="{ data }">
            <span class="text-[14px] font-medium text-[var(--p-text-color)]">{{ data.name }}</span>
          </template>
        </Column>

        <Column field="orderCount" header="訂單數" sortable>
          <template #body="{ data }">
            <span class="text-[13px] font-bold text-[var(--p-text-color)]">{{ data.orderCount }}</span>
          </template>
        </Column>

        <Column field="salesAmount" header="銷售金額" sortable>
          <template #body="{ data }">
            <span class="text-[13px] font-bold text-[#f97316]">${{ data.salesAmount.toLocaleString() }}</span>
          </template>
        </Column>

        <Column field="createdAt" header="建立時間" sortable>
          <template #body="{ data }">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ data.createdAt }}</span>
          </template>
        </Column>

        <Column field="orderingPeriod" header="收單期間" sortable>
          <template #body="{ data }">
            <button
              v-tooltip.top="'點按設定收單期間'"
              class="inline-flex items-center gap-1.5 text-[13px] text-[var(--p-text-color)] px-2 py-1 -mx-2 -my-1 rounded-[6px] hover:bg-[var(--p-content-hover-background)] hover:text-[var(--p-primary-color)] transition-colors"
              @click.stop="openPeriodDialog(data)"
            >
              <i class="pi pi-calendar" style="font-size: 12px"></i>
              {{ data.orderingPeriod }}
            </button>
          </template>
        </Column>

        <Column field="createdBy" header="建立人">
          <template #body="{ data }">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ data.createdBy }}</span>
          </template>
        </Column>

        <Column field="status" header="收單狀態">
          <template #body="{ data }">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold leading-none"
              :style="{ background: statusMeta(data.status).bg, color: statusMeta(data.status).color }"
            >
              <span
                v-if="statusMeta(data.status).dot"
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                :style="{ background: statusMeta(data.status).color }"
              ></span>
              <i
                v-else-if="statusMeta(data.status).icon"
                :class="statusMeta(data.status).icon"
                :style="{ fontSize: '11px', color: statusMeta(data.status).color }"
              ></i>
              {{ statusMeta(data.status).label }}
            </span>
          </template>
        </Column>

        <!-- 操作欄：得標清單 / 商品清單 / 結束收單 or 開始收單（依 design-tokens.json → table-action-buttons） -->
        <Column header="操作">
          <template #body="{ data }">
            <div class="flex items-center gap-1" @click.stop>
              <button
                v-tooltip.top="'得標清單'"
                class="size-[32px] flex items-center justify-center rounded-[6px] text-[#16a34a] hover:bg-[#dcfce7]"
                @click="emit('view-winners', data.id)"
              >
                <i class="pi pi-list" style="font-size: 15.75px"></i>
              </button>
              <button
                v-tooltip.top="'商品清單'"
                class="size-[32px] flex items-center justify-center rounded-[6px] text-[var(--p-primary-color)] hover:bg-[#f2ebff]"
                @click="emit('view-products', data.id)"
              >
                <i class="pi pi-shopping-bag" style="font-size: 15.75px"></i>
              </button>
              <!-- 結束 / 開始收單：依狀態切顏色與 icon；已結束 → disabled -->
              <button
                v-tooltip.top="data.status === 'ongoing' ? '結束收單' : data.status === 'ready' ? '開始收單' : '已結束'"
                :disabled="data.status === 'ended'"
                :class="[
                  'size-[32px] flex items-center justify-center rounded-[6px] text-white transition-colors',
                  data.status === 'ongoing'
                    ? 'bg-[#ef4444] hover:bg-[#dc2626]'
                    : data.status === 'ready'
                      ? 'bg-[var(--p-primary-color)] hover:bg-[var(--p-primary-hover-color)]'
                      : 'bg-[var(--p-content-hover-background)] !text-[var(--p-text-muted-color)] cursor-not-allowed',
                ]"
                @click="data.status !== 'ended' && emit('toggle-status', data.id)"
              >
                <i
                  :class="data.status === 'ongoing' ? 'pi pi-stop-circle' : data.status === 'ready' ? 'pi pi-play' : 'pi pi-check'"
                  style="font-size: 15.75px"
                ></i>
              </button>
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="py-8 text-center text-[14px] text-[var(--p-text-muted-color)]">
            目前尚無貼文，請按右上方「選擇貼文」開始。
          </div>
        </template>
      </DataTable>
      </div>

      <Menu id="post-more-menu" ref="moreMenuRef" :model="moreMenuItems" :popup="true" />

      <PostPeriodDialog
        v-model:visible="periodDialogVisible"
        :start-at="editingPost?.startAt ?? null"
        :end-at="editingPost?.endAt ?? null"
        @save="onPeriodSave"
      />
    </template>
  </Card>
</template>
