<template>
  <!-- 收單操作頁（多收單來源）
       手機（< md）→ 只顯示商品；點頂部「收單來源」按鈕 → aside 改 overlay drawer 從右側滑入
       桌機（≥ md）→ 左右 split（商品 flex-1 / aside 300px or 220px） -->
  <div class="flex gap-2 flex-1 min-h-0 relative">

    <!-- 左：商品 grid -->
    <div class="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
      <!-- 左區工具列 slot：選擇商品 / 批次設定 等按鈕 -->
      <slot name="left-toolbar" />
      <!-- 頂部 slot：給 LiveOrderPage 放 QuickAddProductForm，與右側 panel 頂部對齊 -->
      <slot name="products-header" />

      <!-- 手機版「收單來源」入口 button：< md 才顯示，點下展開右側 aside drawer -->
      <Button
        class="md:hidden self-start"
        size="small"
        severity="secondary"
        variant="outlined"
        @click="mobilePanelVisible = true"
      >
        <i class="pi pi-link mr-1.5" style="font-size: 13px"></i>
        {{ t('live_order.tab.sources') }}<span v-if="sources.length > 0" class="ml-1">({{ sources.length }})</span>
      </Button>

      <!-- min-w-0 讓內部 LiveProductTable 在 flex 縮放鏈中可以縮到 0，避免表格內容寬度撐爆右側 panel -->
      <div class="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <div v-if="products.length === 0" class="flex flex-col items-center gap-2 text-[var(--p-text-muted-color)] pt-12">
          <i class="pi pi-inbox" style="font-size:40px"></i>
          <span class="text-[13px]">{{ t('live_order.empty.no_product_added_hint') }}</span>
        </div>
        <LiveProductTable
          v-else-if="useTable"
          :products="products"
          :ordering-enabled="sources.length > 0"
          :period-start-at="periodStartAt"
          @delete="(id) => emit('delete-product', id)"
          @end-ordering="(id) => emit('end-ordering-product', id)"
          @adjust-period="emit('adjust-period')"
        />
        <div v-else class="grid gap-2 grid-cols-2 md:[grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
          <LiveProductCard
            v-for="p in products"
            :key="p.id"
            :product="p"
            :ordering-enabled="sources.length > 0"
            :is-post-mode="isPostMode"
            :period-start-at="periodStartAt"
            :locked="biddingLiveId !== null && p.id !== biddingLiveId && p.status === 'live'"
            v-model:status="p.status"
            @delete="(id) => emit('delete-product', id)"
            @end-ordering="(id) => emit('end-ordering-product', id)"
            @adjust-period="emit('adjust-period')"
          />
        </div>
      </div>
    </div>

    <!-- 右側 aside：桌機 in-flow（shrink-0 + 固定寬，背景透明）；手機 overlay drawer 從右側滑入（白底） -->
    <aside
      :class="[
        'flex flex-col gap-3 min-h-0 overflow-hidden',
        // 桌機 in-flow：背景透明
        'md:relative md:shrink-0 md:translate-x-0 md:shadow-none md:p-0 md:z-auto md:w-auto md:bg-transparent',
        showComments ? 'md:w-[300px]' : 'md:w-[220px]',
        // 手機 overlay drawer：白底
        'fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[340px] p-3 shadow-2xl transition-transform duration-200 bg-[var(--p-content-background)]',
        mobilePanelVisible ? 'translate-x-0' : 'translate-x-full',
      ]"
    >
      <!-- 手機版關閉按鈕（< md 才顯示） -->
      <button
        type="button"
        class="md:hidden self-end size-[28px] rounded-full hover:bg-[var(--p-content-hover-background)] flex items-center justify-center"
        @click="mobilePanelVisible = false"
      >
        <i class="pi pi-times text-[var(--p-text-color)]" style="font-size: 14px"></i>
      </button>

      <!-- 右區工具列 slot：顯示留言 toggle + 結束收單 -->
      <slot name="right-toolbar" />

      <!-- 商品狀態統計：銷售總計（靠左）/ 收單中 / 準備中 — hover 顯示 tooltip -->
      <div class="flex items-stretch gap-2 px-3 py-[8px] rounded-[6px] border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] shrink-0">
        <div
          v-tooltip.bottom="t('live_order.tooltip.sales_total')"
          class="flex-1 min-w-[110px] flex items-center justify-start gap-1.5 text-[14px] font-bold text-[#f97316] cursor-help"
        >
          <span class="text-[11px] font-bold tracking-wide">NTD</span>
          {{ salesTotalDisplay }}
        </div>
        <span class="w-px self-stretch bg-[var(--p-content-border-color)]" />
        <div
          v-tooltip.bottom="t('live_order.status.live')"
          class="w-[56px] flex items-center justify-center gap-1.5 text-[14px] font-medium text-[var(--p-primary-color)] cursor-help"
        >
          <FontAwesomeIcon :icon="['far', 'circle-play']" class="text-[16px]" />
          {{ statusCounts.live }}
        </div>
        <span class="w-px self-stretch bg-[var(--p-content-border-color)]" />
        <div
          v-tooltip.bottom="t('live_order.status.ready')"
          class="w-[56px] flex items-center justify-center gap-1.5 text-[14px] font-medium text-[var(--p-text-muted-color)] cursor-help"
        >
          <FontAwesomeIcon :icon="['far', 'circle-pause']" class="text-[16px]" />
          {{ statusCounts.ready }}
        </div>
      </div>

      <!-- 預覽區（只在 FB 系列來源時顯示，IG / TikTok 無影片畫面隱藏；貼文收單一律不顯示） -->
      <div v-if="sources.length > 0 && hasPreview && !useTable && !isPostMode" class="relative shrink-0">
        <div class="bg-[#0f172a] rounded-[6px] overflow-hidden relative flex items-center justify-center" style="height:125px">
          <div class="bg-[var(--p-content-background)] rounded-[6px] overflow-hidden shadow-md flex flex-col" style="width:70px; height:113px">
            <div class="flex-1 bg-gradient-to-br from-[#fef3c7] via-[#fed7aa] to-[#fda4af] flex items-center justify-center">
              <i class="pi pi-image text-[#d97706]" style="font-size:16px"></i>
            </div>
            <div class="bg-[var(--p-content-background)] px-1 py-0.5 text-[6px] text-[var(--p-text-color)] leading-tight">
              {{ previewMeta.previewLabel }}
            </div>
          </div>
          <span class="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">{{ previewMeta.badge }}</span>
          <i :class="previewMeta.previewIcon" class="absolute bottom-1.5 right-1.5 text-white/60" style="font-size:14px"></i>
        </div>

        <!-- 多來源:左右切換 + 指示點 -->
        <template v-if="previewableSources.length > 1">
          <button @click="prevPreview"
            class="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center">
            <i class="pi pi-chevron-left" style="font-size:12px"></i>
          </button>
          <button @click="nextPreview"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center">
            <i class="pi pi-chevron-right" style="font-size:12px"></i>
          </button>
          <div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            <span v-for="(_, i) in previewableSources" :key="i"
              :class="['w-1.5 h-1.5 rounded-full', i === previewIndex % previewableSources.length ? 'bg-[var(--p-content-background)]' : 'bg-[var(--p-content-background)]/40']"></span>
          </div>
        </template>
      </div>

      <Tabs v-model:value="activeTab" class="flex flex-col flex-1 min-h-0 !bg-transparent">
        <TabList class="!bg-transparent">
          <Tab v-if="showComments" value="comments" class="!bg-transparent">
            <span class="flex items-center gap-1.5">
              <i class="pi pi-comments" style="font-size:14px"></i>
              <span>{{ t('live_order.tab.comments') }}</span>
            </span>
          </Tab>
          <Tab value="sources" class="!bg-transparent">
            <span class="flex items-center gap-1.5">
              <i class="pi pi-link" style="font-size:14px"></i>
              <span>{{ t('live_order.tab.sources') }}</span>
              <span v-if="sources.length > 0"
                class="bg-[var(--p-primary-color)] text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center">
                {{ sources.length }}
              </span>
            </span>
          </Tab>
        </TabList>
        <TabPanels class="flex-1 min-h-0 flex flex-col !p-0 !bg-transparent">

          <!-- 留言區 Tab：混合多平台（須有商品開始收單才顯示） -->
          <TabPanel v-if="showComments" value="comments" class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pt-3 pr-1 !bg-transparent">
            <template v-if="hasOrderingStarted">
              <LiveCommentCard v-for="c in filteredComments" :key="c.id"
                :comment="c"
                :platform-meta="getPlatformMeta(c.platform)"
                :live-products="liveProducts"
                :session-products="props.products"
                @blacklist="onBlacklist"
                @unblacklist="onUnblacklist" />
            </template>
            <div v-else class="flex flex-col items-center gap-2 text-[var(--p-text-muted-color)] pt-8">
              <i class="pi pi-comments" style="font-size:32px"></i>
              <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.empty.no_live_product_yet') }}</span>
            </div>
          </TabPanel>

          <!-- 收單來源 Tab：新增按鈕 + 來源卡列表 -->
          <TabPanel value="sources" class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pt-3 pr-1 !bg-transparent">
            <!-- 新增按鈕 -->
            <button @click="$emit('pick-source')"
              class="bg-[var(--p-content-background)] border border-dashed border-[var(--p-primary-color)] text-[var(--p-primary-color)] rounded-[8px] px-3 py-2.5 text-[14px] font-medium flex items-center justify-center gap-2 hover:bg-[var(--p-primary-50)]">
              <i class="pi pi-plus" style="font-size:14px"></i>
              {{ t('live_order.button.add_source') }}
            </button>

            <!-- 來源卡列表 -->
            <div v-if="sources.length === 0"
              class="flex flex-col items-center gap-2 text-[var(--p-text-muted-color)] pt-8">
              <i class="pi pi-inbox" style="font-size:32px"></i>
              <span class="text-[12.25px]">{{ t('live_order.empty.no_source_added') }}</span>
            </div>
            <div v-else class="flex flex-col gap-2">
              <div v-for="s in sources" :key="s.id"
                :class="['border rounded-[8px] px-3 py-2.5 flex items-center gap-3 bg-[var(--p-content-background)]',
                  sourceCardBorderClass(s.type)]">
                <div :class="['w-[36px] h-[36px] rounded-[8px] flex items-center justify-center shrink-0',
                  sourceCardBgClass(s.type)]">
                  <FontAwesomeIcon
                    :icon="getPlatformMeta(s.type).platformIcon"
                    :style="{ fontSize: '16px', color: getPlatformMeta(s.type).platformColor }"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-[14px] text-[var(--p-text-color)] truncate">{{ s.label }}</div>
                  <div class="text-[11px] text-[var(--p-text-muted-color)] mt-0.5">{{ t('live_order.label.added_at', { time: formatTime(s.addedAt) }) }}</div>
                </div>
                <button @click="$emit('remove-source', s.id)"
                  v-tooltip.top="t('live_order.tooltip.remove_source')"
                  class="text-[var(--p-text-muted-color)] hover:text-[#ef4444] shrink-0">
                  <i class="pi pi-times" style="font-size:14px"></i>
                </button>
              </div>
            </div>
          </TabPanel>

        </TabPanels>
      </Tabs>
    </aside>

    <!-- 手機 overlay drawer 開啟時的背景遮罩，點擊關閉 -->
    <div
      v-if="mobilePanelVisible"
      class="fixed inset-0 bg-black/40 z-40 md:hidden"
      @click="mobilePanelVisible = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LiveProductCard from './LiveProductCard.vue'
import LiveProductTable from './LiveProductTable.vue'
import LiveCommentCard from './LiveCommentCard.vue'

interface LiveSource {
  id: number | string
  type: string
  label: string
  addedAt?: Date | string | number
  postId?: number | string | null
  groupId?: number | string | null
  [key: string]: unknown
}

interface LiveProduct {
  id: number
  status?: string
  keyword?: string
  sku?: string
  [key: string]: unknown
}

interface LiveComment {
  id: number
  user: string
  text: string
  platform: string
  tagType?: string
  pinned?: boolean
  stars?: number
  time: string
}

interface PlatformMeta {
  /** FontAwesomeIcon 接受的 [prefix, name] 陣列；renderer 直接綁到 :icon。 */
  platformIcon: [string, string]
  platformColor: string
}

interface PreviewMeta {
  previewIcon: string
  previewLabel: string
  badge: string
}

interface Props {
  sources?: LiveSource[]
  products?: LiveProduct[]
  showComments?: boolean
  /** 貼文收單模式：把商品卡 grid 換成 table。 */
  useTable?: boolean
  /** 貼文收單頁：選擇貼文沒有影片畫面，整塊預覽區隱藏。 */
  isPostMode?: boolean
  /** 當前正在收單的競價商品 id；非該商品的其他卡片會被鎖住。 */
  biddingLiveId?: number | null
  /** 該貼文收單期間起點，傳到 LiveProductCard / Table 做 startAt 檢查 */
  periodStartAt?: Date | null
}
const props = withDefaults(defineProps<Props>(), {
  sources: () => [],
  products: () => [],
  showComments: true,
  useTable: false,
  isPostMode: false,
  biddingLiveId: null,
  periodStartAt: null,
})

const emit = defineEmits<{
  'pick-source': []
  'remove-source': [id: number | string]
  'delete-product': [id: number]
  'end-ordering-product': [id: number]
  /** LiveProductCard / Table emit 的「調整時間」，繼續往上 bubble 給 LiveOrderPage 開 PostPeriodDialog */
  'adjust-period': []
}>()

const { t } = useI18n()

// 預設停在「收單來源」tab；剛挑完來源、希望使用者直接看到加入結果。
const activeTab = ref('sources')
/** 手機尺寸下 aside drawer 是否開啟（< md 用，桌機不會看到） */
const mobilePanelVisible = ref(false)

// 顯示留言關閉時，自動切到「收單來源」tab
watch(() => props.showComments, (show) => {
  if (!show) activeTab.value = 'sources'
})

// 新增收單來源後，停留在「收單來源」tab，方便確認加入狀態
watch(() => props.sources.length, (newLen, oldLen) => {
  if (newLen > oldLen) activeTab.value = 'sources'
})

// 是否有商品已開始收單（status === 'live'）— 留言區顯示條件
const hasLiveProduct = computed(() => props.products.some(p => p.status === 'live'))
/**
 * 「收單已啟動」判定：
 * - 任一商品 status === 'live' → 進行中
 * - 任一商品 sold > 0 → 曾經收過單（結束收單後 status 回 'ready' 但 sold 留著）
 * 全部商品都還在 'ready' 且 sold = 0 才顯示等待空狀態。
 */
const hasOrderingStarted = computed(() => props.products.some(p =>
  p.status === 'live'
  || ((p as { sold?: number }).sold ?? 0) > 0,
))

// 收單中的商品 — 供留言卡「追加訂單」挑選
const liveProducts = computed(() => props.products.filter(p => p.status === 'live'))

// ── 商品狀態統計（從 toolbar 搬進來，放在右側 panel 頂部）────
const statusCounts = computed(() => ({
  live: props.products.filter(p => p.status === 'live').length,
  ready: props.products.filter(p => p.status === 'ready' || !p.status).length,
}))
const salesTotalDisplay = computed(() => {
  const n = props.products.reduce((sum, p) => {
    if ((p as { isGift?: boolean }).isGift) return sum
    const price = ((p as { price?: number }).price) ?? 0
    const sold = ((p as { sold?: number }).sold) ?? 0
    return sum + price * sold
  }, 0)
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString()
})

// ── 來源預覽(多來源時左右切換) ─────────────────
const previewIndex = ref(0)

const previewMetaMap = computed<Record<string, PreviewMeta>>(() => ({
  fb:    { previewIcon: 'fa-brands fa-facebook',   previewLabel: t('live_order.label.fb_post'),       badge: t('live_order.label.fb_badge') },
  ig:    { previewIcon: 'fa-brands fa-instagram',  previewLabel: t('live_order.label.ig_post'),       badge: t('live_order.label.ig_badge') },
  group: { previewIcon: 'fa-brands fa-facebook',   previewLabel: t('live_order.label.fb_group'),      badge: t('live_order.label.group_badge') },
  live:  { previewIcon: 'pi pi-video',             previewLabel: t('live_order.label.live_streaming'), badge: t('live_order.label.live_badge') },
}))
const previewMeta = computed<PreviewMeta>(() => {
  const s = previewMetaSource.value
  return (s && previewMetaMap.value[s.type]) || { previewIcon: 'pi pi-question-circle', previewLabel: t('live_order.label.unknown'), badge: t('live_order.label.unknown_short') }
})

/**
 * 預覽區只在「有實際影片畫面」的來源類型才顯示；
 * 目前只有 Facebook 系列（fb 貼文 / live 直播 / fb 社團）會給影片或可預覽畫面，
 * IG / TikTok 等純圖文/留言來源不顯示。
 *
 * 顯示規則：
 * - 收單來源只有 IG / TikTok → 整個預覽 block 隱藏
 * - 若有任何 FB 系列來源 → 顯示，預覽自動鎖定在 FB 系列來源（非 FB 的略過）
 */
const PREVIEWABLE_TYPES = new Set(['fb', 'live', 'group'])

/** 過濾出可預覽（FB 系列）的來源；空陣列代表整個預覽要隱藏 */
const previewableSources = computed(() =>
  props.sources.filter((s) => PREVIEWABLE_TYPES.has(s.type)),
)

const hasPreview = computed<boolean>(() => previewableSources.value.length > 0)

/** 預覽 meta 改讀 previewableSources，跳過 IG / TikTok 來源 */
const previewMetaSource = computed(() => {
  const list = previewableSources.value
  if (list.length === 0) return undefined
  return list[previewIndex.value % list.length]
})

function prevPreview(): void {
  const n = previewableSources.value.length
  if (n === 0) return
  previewIndex.value = (previewIndex.value - 1 + n) % n
}
function nextPreview(): void {
  const n = previewableSources.value.length
  if (n === 0) return
  previewIndex.value = (previewIndex.value + 1) % n
}

// 可預覽來源數變動時 clamp index（避免移除 FB 來源後 index 越界）
watch(() => previewableSources.value.length, (n) => {
  if (previewIndex.value >= n) previewIndex.value = Math.max(0, n - 1)
})

// 多平台留言 mock：模板支援
//   {kwN}           → 第 N 個商品的關鍵字（非禮物優先）
//   {kwN-specM}     → 第 N 個商品的第 M 個規格名稱
//   {nameN}         → 第 N 個商品名稱（向下相容用）
// 這樣不同場次商品（不同關鍵字 / 規格）都能即時換掉，且符合 orderMatch
// 「關鍵字 + (規格) + 數量」的判定規則。
interface ProductLite {
  name: string
  keyword: string
  isGift: boolean
  bidding: boolean
  flatPrice: number
  specs: string[]
}
const currentProducts = computed<ProductLite[]>(() => {
  const list = props.products.map((p) => {
    const sku = (p as { sku?: string }).sku ?? ''
    return {
      name: (p as { name?: string }).name ?? '',
      keyword: (p as { keyword?: string }).keyword ?? (sku.split('-')[0] || ''),
      isGift: !!(p as { isGift?: boolean }).isGift,
      bidding: !!(p as { bidding?: boolean }).bidding,
      flatPrice: Number((p as { flatPrice?: number }).flatPrice ?? 0),
      specs: (((p as { selectedSpecs?: Array<{ name?: string }> }).selectedSpecs
        ?? (p as { specs?: Array<{ name?: string }> }).specs ?? [])
        .map((s) => s?.name ?? '')
        .filter(Boolean)) as string[],
    }
  }).filter((x) => x.keyword)
  // 非禮物商品優先
  return [...list.filter((x) => !x.isGift), ...list.filter((x) => x.isGift)]
})

/** 找出當前場次第一個競價中且有設一刀價的商品（給 {bidhit}/{bidlow} 模板用）。 */
const firstBiddingProduct = computed(() =>
  currentProducts.value.find((x) => x.bidding && x.flatPrice > 0) ?? null,
)

const commentTemplates: LiveComment[] = [
  // 1-15 既有模板（公告 / 閒聊 / 下單 / 競價）
  { id: 1,  user: '粉絲團小編',        text: '最後1分鐘～',                  platform: 'fb',    tagType: 'official', pinned: true, time: '2025-12-17 20:48:07' },
  { id: 2,  user: 'Haji Abdul Mali…',  text: '{kw0} {kw0-spec0}+1',          platform: 'fb',    stars: 3,             time: '2025-12-17 20:48:07' },
  { id: 3,  user: '陳大悅',            text: '早安',                         platform: 'ig',    stars: 3,             time: '2025-12-17 20:48:07' },
  { id: 4,  user: '王大天',            text: '{kw1} {kw1-spec1}+1',          platform: 'live',  stars: 3,             time: '2025-12-17 20:48:07' },
  { id: 5,  user: 'Jade Liu',          text: '{kw0} {kw0-spec1}+2',          platform: 'ig',    tagType: 'blacklist', time: '2025-12-17 20:48:07' },
  { id: 6,  user: '張曉明',            text: '{kw2}+1',                      platform: 'group', tagType: 'vip',       time: '2025-12-17 20:48:07' },
  { id: 7,  user: '林小美',            text: '{kw1} {kw1-spec0}+3',          platform: 'fb',    stars: 2,             time: '2025-12-17 20:49:12' },
  { id: 8,  user: '蔡先生',            text: '我要一件 {kw0} {kw0-spec0}+1', platform: 'live',  stars: 4,             time: '2025-12-17 20:49:30' },
  { id: 9,  user: '黃媽媽',            text: '{kw1} {kw1-spec1}+2',          platform: 'fb',    stars: 5,             time: '2025-12-17 20:49:45' },
  { id: 10, user: '阿志',              text: '{kw2}+2',                      platform: 'live',  stars: 3,             time: '2025-12-17 20:50:01' },
  { id: 11, user: '小美',              text: '{kw0} {kw0-spec1}+1',          platform: 'ig',    stars: 4,             time: '2025-12-17 20:50:15' },
  { id: 12, user: '阿明',              text: '+1 {kw1} {kw1-spec0}',         platform: 'group', stars: 3,             time: '2025-12-17 20:50:32' },
  { id: 13, user: '小芳',              text: '{kw2}+3 謝謝',                 platform: 'fb',    stars: 4,             time: '2025-12-17 20:50:48' },
  // 競價模板：達一刀價 → 綠勾；未達 → 只是出價，不亮綠勾
  { id: 14, user: '競價快手',          text: '{bidhit}',                     platform: 'fb',    stars: 5,             time: '2025-12-17 20:51:02' },
  { id: 15, user: '小李',              text: '{bidlow}',                     platform: 'live',  stars: 3,             time: '2025-12-17 20:51:18' },

  // 16-30：補滿到 30 張卡（一半成功得標 / 一半閒聊或非下單留言）
  { id: 16, user: '陳太太',            text: '{kw0} {kw0-spec0}+2',          platform: 'fb',    stars: 4,             time: '2025-12-17 20:51:35' },
  { id: 17, user: '小白',              text: '主播好棒！',                   platform: 'fb',    stars: 3,             time: '2025-12-17 20:51:40' },
  { id: 18, user: '雅婷',              text: '{kw1} {kw1-spec1}+1',          platform: 'ig',    stars: 4,             time: '2025-12-17 20:51:52' },
  { id: 19, user: '陳爸爸',            text: '請問還有貨嗎？',               platform: 'live',  stars: 3,             time: '2025-12-17 20:52:00' },
  { id: 20, user: 'Anna Wang',         text: '{kw2}+1 謝謝',                 platform: 'fb',    stars: 5,             time: '2025-12-17 20:52:15' },
  { id: 21, user: '黃先生',            text: '價格不錯！',                   platform: 'group', stars: 3,             time: '2025-12-17 20:52:28' },
  { id: 22, user: '阿銘',              text: '{kw0} {kw0-spec1}+3',          platform: 'live',  stars: 4,             time: '2025-12-17 20:52:40' },
  { id: 23, user: '小宇',              text: '剛來，有重點嗎？',             platform: 'fb',    stars: 3,             time: '2025-12-17 20:52:55' },
  { id: 24, user: '林媽',              text: '{kw1} {kw1-spec0}+2',          platform: 'ig',    stars: 4,             time: '2025-12-17 20:53:10' },
  { id: 25, user: '蕭先生',            text: '麻煩寄到超商',                 platform: 'live',  stars: 3,             time: '2025-12-17 20:53:22' },
  { id: 26, user: '吳小姐',            text: '{kw2}+2',                      platform: 'fb',    stars: 5,             time: '2025-12-17 20:53:38' },
  { id: 27, user: '王太太',            text: '好可愛！',                     platform: 'group', stars: 4,             time: '2025-12-17 20:53:50' },
  { id: 28, user: '老張',              text: '{kw0} {kw0-spec0}+1',          platform: 'fb',    stars: 3,             time: '2025-12-17 20:54:05' },
  { id: 29, user: '阿芬',              text: '哈囉～',                       platform: 'ig',    stars: 3,             time: '2025-12-17 20:54:18' },
  { id: 30, user: '小翔',              text: '{kw1} {kw1-spec1}+4',          platform: 'live',  stars: 5,             time: '2025-12-17 20:54:30' },
]

/**
 * 把 placeholder 換成商品實際值：
 * - `{kwN}` / `{kwN-specM}` / `{nameN}`：第 N 個商品的關鍵字 / 規格 / 名稱
 * - `{bidhit}`：第一個競價商品的「關鍵字 + 一刀價」（達標 → 留言卡綠勾）
 * - `{bidlow}`：第一個競價商品的「關鍵字 + 一刀價 × 0.7」（未達 → 不亮綠勾）
 *
 * 沒有對應商品時 placeholder 直接吃掉成空字串；filteredComments 會濾掉空文字。
 */
function applyTemplate(text: string, products: ProductLite[], bidProduct: ProductLite | null): string {
  if (products.length === 0) return text
  const pick = (i: number) => products[Number(i) % products.length]
  return text
    .replace(/\{kw(\d+)-spec(\d+)\}/g, (_, pi, si) => {
      const p = pick(Number(pi))
      const specs = p?.specs ?? []
      return specs.length > 0 ? (specs[Number(si) % specs.length] ?? '') : ''
    })
    .replace(/\{kw(\d+)\}/g, (_, i) => pick(Number(i))?.keyword ?? '')
    .replace(/\{name(\d+)\}/g, (_, i) => pick(Number(i))?.name ?? '')
    .replace(/\{bidhit\}/g, () => {
      if (!bidProduct) return ''
      const specStr = bidProduct.specs.length > 0 ? ` ${bidProduct.specs[0]}` : ''
      return `${bidProduct.keyword}${specStr} ${bidProduct.flatPrice}`
    })
    .replace(/\{bidlow\}/g, () => {
      if (!bidProduct) return ''
      const specStr = bidProduct.specs.length > 0 ? ` ${bidProduct.specs[0]}` : ''
      const amount = Math.max(0, Math.floor(bidProduct.flatPrice * 0.7))
      return `${bidProduct.keyword}${specStr} ${amount}`
    })
}

const comments = ref<LiveComment[]>(commentTemplates.map((c) => ({ ...c })))
/**
 * 留言生成規則：
 * - 模板原本綁定的 platform 忽略，改以「當前場次已加入的收單來源」做循環指派；
 *   只選一個收單來源 → 30 筆留言全屬於那個來源（卡片數一次到位 30）
 *   選多個來源 → 30 筆平均分配到各個來源
 */
watch([currentProducts, firstBiddingProduct, () => props.sources.map(s => s.type)], ([list, bid, types]) => {
  const platforms = (types as string[])
  comments.value = commentTemplates.map((c, i) => ({
    ...c,
    text: applyTemplate(c.text, list, bid),
    platform: platforms.length > 0 ? platforms[i % platforms.length] : c.platform,
  }))
}, { immediate: true, deep: true })

const filteredComments = computed(() =>
  // 來源還沒選 → 不顯示；競價模板無對應商品時 text 為空，過濾掉避免空卡
  props.sources.length > 0
    ? comments.value.filter((c) => c.text.trim().length > 0)
    : [],
)


function onBlacklist(id: number | string): void {
  const c = comments.value.find(x => x.id === id)
  if (c) c.tagType = 'blacklist'
}
function onUnblacklist(id: number | string): void {
  const c = comments.value.find(x => x.id === id)
  if (c && c.tagType === 'blacklist') c.tagType = undefined
}

const platformsMap: Record<string, PlatformMeta> = {
  fb:      { platformIcon: ['fab', 'facebook'],  platformColor: '#1877f2' },
  ig:      { platformIcon: ['fab', 'instagram'], platformColor: '#db2777' },
  tiktok:  { platformIcon: ['fab', 'tiktok'],    platformColor: '#000000' },
  livebuy: { platformIcon: ['far', 'video'],     platformColor: 'var(--p-primary-color)' },
  group:   { platformIcon: ['far', 'users'],     platformColor: '#16a34a' },
  live:    { platformIcon: ['far', 'video'],     platformColor: '#ef4444' },
}
/** Look up icon / colour metadata for a platform key; falls back to a neutral set. */
function getPlatformMeta(type: string): PlatformMeta {
  return platformsMap[type] || { platformIcon: ['far', 'circle-question'], platformColor: 'var(--p-text-muted-color)' }
}

function sourceCardBgClass(type: string): string {
  return ({
    fb:    'bg-[#dbeafe]',
    ig:    'bg-[#fce7f3]',
    group: 'bg-[#dcfce7]',
    live:  'bg-[#fee2e2]',
  } as Record<string, string>)[type] || 'bg-[var(--p-content-hover-background)]'
}
function sourceCardBorderClass(type: string): string {
  return ({
    fb:    'border-[#bfdbfe]',
    ig:    'border-[#fbcfe8]',
    group: 'border-[#bbf7d0]',
    live:  'border-[#fecaca]',
  } as Record<string, string>)[type] || 'border-[var(--p-content-border-color)]'
}

/** Render a HH:MM:SS string from a Date / timestamp / ISO input. */
function formatTime(d: Date | string | number | undefined): string {
  const date: Date = d instanceof Date ? d : new Date(d ?? Date.now())
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>
