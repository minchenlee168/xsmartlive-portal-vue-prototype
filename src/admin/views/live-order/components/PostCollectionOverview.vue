<script setup lang="ts">
/**
 * 貼文收單列表（總覽頁，用 PrimeVue DataTable 呈現）。
 *
 * 欄位：貼文名稱 / 收單期間 / 留言數 / 已成單 / 結單時間 / 狀態 / 操作
 * 操作含「得標清單」開 WinnerListDialog 與「進入 / 結單」。
 * 點 row（非按鈕區）= 進入該檔；
 * 篩選 Tabs：全部 / 準備中 / 收單中 / 已結束；
 * 排序：待處理最多 / 結單時間最近 / 最新留言。
 */
import { ref, computed } from 'vue'

export type PostCollectionStatus = 'ready' | 'ongoing' | 'closed_today'

export interface PostCollectionProduct {
  id: number
  name: string
  keyword: string
  price: number
  stock: number
  sold?: number
}

export interface PostCollection {
  id: number
  name: string
  /** 待處理留言（未對應到商品 / 未確認的單）— 排序用 */
  pendingCount?: number
  /** 「X 分鐘前更新」「剛剛更新」… */
  updateNote: string
  /** 已成單 */
  soldCount: number
  /** 留言總數 */
  commentCount: number
  /** 結單時間提示文字（會顯示在右上） */
  deadlineText: string
  /** 結單提示的顏色語意 */
  deadlineSeverity?: 'secondary' | 'warning' | 'danger'
  status: PostCollectionStatus
  /** 進入後要塞進收單頁的商品 mock */
  products?: PostCollectionProduct[]
  /** 距離結單時間（分鐘）— 給 deadline_asc 排序用，null 表示未設 */
  deadlineMinutes?: number | null
  /** 最後一筆留言的距今分鐘 — 給 latest_comment 排序用 */
  lastCommentMinutes?: number
  /** 收單起 / 迄（Date）— 編輯時讀寫；deadlineText / deadlineMinutes 等顯示欄位由此推導 */
  startAt?: Date | null
  endAt?: Date | null
}

interface Props {
  posts: PostCollection[]
  /** 'post' 顯示「貼文收單列表」「新增貼文收單」；'community' 顯示「社團收單列表」「新增社團收單」 */
  kind?: 'post' | 'community'
}
const props = withDefaults(defineProps<Props>(), { kind: 'post' })
const collectionNoun = computed(() => props.kind === 'community' ? '社團' : '貼文')
const emit = defineEmits<{
  select: [id: number]
  create: []
  'view-winners': [id: number]
}>()

// 排序選項
type SortKey = 'pending_desc' | 'deadline_asc' | 'latest_comment'
const sortOptions = [
  { label: '待處理最多', value: 'pending_desc' },
  { label: '結單時間最近', value: 'deadline_asc' },
  { label: '最新留言', value: 'latest_comment' },
]
const sortBy = ref<SortKey>('pending_desc')

// 篩選 tab：label 內含對應狀態的筆數
type FilterKey = 'ready' | 'ongoing' | 'closed_today' | 'all'
const readyCount = computed(() => props.posts.filter(p => p.status === 'ready').length)
const ongoingCount = computed(() => props.posts.filter(p => p.status === 'ongoing').length)
const closedTodayCount = computed(() => props.posts.filter(p => p.status === 'closed_today').length)
const filterOptions = computed(() => [
  { label: '全部',                               value: 'all' as FilterKey },
  { label: `準備中 (${readyCount.value})`,       value: 'ready' as FilterKey },
  { label: `收單中 (${ongoingCount.value})`,     value: 'ongoing' as FilterKey },
  { label: `已結束 (${closedTodayCount.value})`, value: 'closed_today' as FilterKey },
])
const activeFilter = ref<FilterKey>('all')

const filteredPosts = computed(() => {
  const list = activeFilter.value === 'all'
    ? props.posts
    : props.posts.filter(p => p.status === activeFilter.value)
  const sorted = [...list]
  if (sortBy.value === 'pending_desc') {
    sorted.sort((a, b) => (b.pendingCount ?? 0) - (a.pendingCount ?? 0))
  } else if (sortBy.value === 'deadline_asc') {
    sorted.sort((a, b) => {
      const am = a.deadlineMinutes
      const bm = b.deadlineMinutes
      if (am == null && bm == null) return 0
      if (am == null) return 1
      if (bm == null) return -1
      return am - bm
    })
  } else if (sortBy.value === 'latest_comment') {
    sorted.sort((a, b) => (a.lastCommentMinutes ?? Infinity) - (b.lastCommentMinutes ?? Infinity))
  }
  return sorted
})

/** 格式化收單期間：「MM/DD HH:mm - MM/DD HH:mm」；未設 = 「—」 */
function formatPeriod(p: PostCollection): string {
  const fmt = (d: Date): string => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day} ${hh}:${mm}`
  }
  const s = p.startAt ? fmt(p.startAt) : '—'
  const e = p.endAt ? fmt(p.endAt) : '—'
  if (!p.startAt && !p.endAt) return '未設'
  return `${s} ~ ${e}`
}

/** 狀態 Tag 顯示資訊 */
function statusBadge(s: PostCollectionStatus): { label: string; severity: 'success' | 'info' | 'secondary' } {
  if (s === 'ongoing') return { label: '收單中', severity: 'success' }
  if (s === 'ready')   return { label: '準備中', severity: 'info' }
  return { label: '已結束', severity: 'secondary' }
}
</script>

<template>
  <Card
    class="flex-1 min-h-0 overflow-hidden flex flex-col"
    :pt="{
      body: { class: 'p-0 flex-1 min-h-0 flex flex-col' },
      content: { class: 'p-0 flex-1 min-h-0 flex flex-col' },
    }"
  >
    <template #content>
      <div class="flex flex-col gap-3 px-4 pt-4 pb-2">
        <!-- 標題 + 新增 + 排序 -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="font-medium text-lg text-[var(--p-text-color)]">{{ collectionNoun }}收單列表</h2>
          <div class="flex items-center gap-2">
            <Button :label="`新增${collectionNoun}收單`" icon="pi pi-plus" size="small" @click="emit('create')" />
            <span class="text-[13px] text-[var(--p-text-muted-color)] ml-2">排序</span>
            <Select
              v-model="sortBy"
              :options="sortOptions"
              option-label="label"
              option-value="value"
              class="w-[160px]"
              size="small"
            />
          </div>
        </div>
      </div>

      <!-- 篩選 tabs -->
      <Tabs :value="activeFilter" @update:value="(v) => activeFilter = v as FilterKey">
        <TabList class="px-4">
          <Tab v-for="opt in filterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</Tab>
        </TabList>
      </Tabs>

      <!-- 列表 table -->
      <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <!-- 手機條列式 view：每筆 label : value 直排，筆與筆之間用線分隔 -->
        <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="post in filteredPosts"
            :key="post.id"
            class="py-3 flex flex-col gap-2 cursor-pointer"
            @click="emit('select', post.id)"
          >
            <!-- 頂部：名稱 + 狀態 Tag -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                <span class="text-sm font-medium text-[var(--p-text-color)]">{{ post.name }}</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">{{ post.updateNote }}</span>
              </div>
              <Tag
                :value="statusBadge(post.status).label"
                :severity="statusBadge(post.status).severity"
                class="shrink-0"
              />
            </div>
            <!-- 收單期間 -->
            <div class="flex items-center gap-2 text-[13px]">
              <span class="text-[var(--p-text-muted-color)] w-[68px] shrink-0">收單期間</span>
              <span class="text-[var(--p-text-color)] whitespace-nowrap">{{ formatPeriod(post) }}</span>
            </div>
            <!-- 留言數 / 已成單（同一列） -->
            <div class="flex items-center gap-4 text-[13px]">
              <div class="flex items-center gap-2">
                <span class="text-[var(--p-text-muted-color)]">留言數</span>
                <span class="text-[var(--p-text-color)]">{{ post.commentCount }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--p-text-muted-color)]">已成單</span>
                <span class="font-bold text-[#f97316]">{{ post.soldCount }}</span>
              </div>
            </div>
            <!-- 結單時間 -->
            <div class="flex items-center gap-2 text-[13px]">
              <span class="text-[var(--p-text-muted-color)] w-[68px] shrink-0">結單時間</span>
              <span
                v-if="post.status === 'closed_today'"
                class="text-[var(--p-text-muted-color)]"
              >已結單</span>
              <span
                v-else
                :style="{
                  color: post.deadlineSeverity === 'danger' ? '#ef4444'
                    : post.deadlineSeverity === 'warning' ? '#f97316'
                    : 'var(--p-text-color)'
                }"
              >
                <i v-if="post.deadlineSeverity === 'danger'" class="pi pi-clock mr-1 text-xs" />
                {{ post.deadlineText }}
              </span>
            </div>
            <!-- 操作 -->
            <div class="flex items-center gap-2 pt-1" @click.stop>
              <Button
                label="得標清單"
                icon="pi pi-list"
                severity="secondary"
                variant="text"
                size="small"
                @click="emit('view-winners', post.id)"
              />
              <Button
                label="進入"
                icon="pi pi-arrow-up-right"
                icon-pos="right"
                severity="secondary"
                outlined
                size="small"
                class="ml-auto"
                @click="emit('select', post.id)"
              />
            </div>
          </div>
          <div
            v-if="filteredPosts.length === 0"
            class="py-12 text-center text-sm text-[var(--p-text-muted-color)]"
          >
            目前沒有符合條件的貼文
          </div>
        </div>

        <!-- 桌機 DataTable view -->
        <div class="hidden md:block">
        <DataTable
          :value="filteredPosts"
          :striped-rows="true"
          data-key="id"
          class="w-full"
          :pt="{
            column: { headerCell: { style: 'white-space: nowrap;' } },
            bodyRow: { class: 'cursor-pointer' },
          }"
          @row-click="(e) => emit('select', (e.data as PostCollection).id)"
        >
          <Column field="name" :header="`${collectionNoun}收單名稱`">
            <template #body="{ data }">
              <!-- Design.md 7.5：主資訊用預設 14px / 400（不寫 text-sm / font-medium 覆蓋）；補充說明用 text-xs -->
              <div class="flex flex-col gap-1 min-w-0">
                <span class="text-[var(--p-text-color)] truncate">{{ data.name }}</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">{{ data.updateNote }}</span>
              </div>
            </template>
          </Column>
          <Column header="收單期間" style="width: 220px">
            <template #body="{ data }">
              <span class="text-[var(--p-text-color)] whitespace-nowrap">{{ formatPeriod(data) }}</span>
            </template>
          </Column>
          <Column field="commentCount" header="留言數" sortable style="width: 90px">
            <template #body="{ data }">
              <span class="text-[var(--p-text-color)]">{{ data.commentCount }}</span>
            </template>
          </Column>
          <Column field="soldCount" header="已成單" sortable style="width: 90px">
            <template #body="{ data }">
              <span class="font-bold text-[#f97316]">{{ data.soldCount }}</span>
            </template>
          </Column>
          <Column header="結單時間" style="width: 160px">
            <template #body="{ data }">
              <!-- 已結束的 collection 結單時間欄統一顯示「已結單」（不再帶 deadlineText 殘值）-->
              <span
                v-if="data.status === 'closed_today'"
                class="text-[var(--p-text-muted-color)]"
              >已結單</span>
              <span
                v-else
                :style="{
                  color: data.deadlineSeverity === 'danger' ? '#ef4444'
                    : data.deadlineSeverity === 'warning' ? '#CA8A04'
                    : 'var(--p-text-color)'
                }"
              >
                <i v-if="data.deadlineSeverity === 'danger'" class="pi pi-clock mr-1 text-xs" />
                {{ data.deadlineText }}
              </span>
            </template>
          </Column>
          <Column header="狀態" style="width: 90px">
            <template #body="{ data }">
              <Tag :value="statusBadge(data.status).label" :severity="statusBadge(data.status).severity" />
            </template>
          </Column>
          <Column header="操作" style="width: 180px">
            <template #body="{ data }">
              <div class="flex items-center gap-2" @click.stop>
                <Button
                  v-tooltip.top="'得標清單'"
                  icon="pi pi-list"
                  severity="secondary"
                  variant="text"
                  rounded
                  size="small"
                  @click="emit('view-winners', data.id)"
                />
                <Button
                  label="進入"
                  icon="pi pi-arrow-up-right"
                  icon-pos="right"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="emit('select', data.id)"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">
              目前沒有符合條件的貼文
            </div>
          </template>
        </DataTable>
        </div>
      </div>
    </template>
  </Card>
</template>
