<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 通知中心 — 帳號級通知收件匣（唯讀）。
 *
 * 參照規劃原型（會員管理/通知中心.html）：
 * - 依通知類型以 Tabs 分類（全部 + 各類別含計數）＋「只看未讀」篩選
 * - 收件匣表格：通知類型 / 通知（標題＋內文預覽）/ 時間 / 狀態 / 操作
 * - 未讀＝主色圓點＋粗體；已讀＝灰底一般字；置頂固定最上（新到舊）
 * - 點整列開通知詳情（開啟即標為已讀）；每列可手動切換已讀／未讀
 * - 通知為單向接收、唯讀，不在此回覆
 */

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
interface Category { id: string; name: string; severity: TagSeverity }
const CATEGORIES: Category[] = [
  { id: 'system',      name: '系統公告',     severity: 'info' },
  { id: 'maintenance', name: '維護通知',     severity: 'info' },
  { id: 'notice',      name: '系統通知',     severity: 'success' },
  { id: 'order',       name: '訂單營運異常', severity: 'danger' },
  { id: 'customer',    name: '客戶動態',     severity: 'secondary' },
]
function categoryOf(id: string): Category {
  return CATEGORIES.find(c => c.id === id) ?? { id, name: '—', severity: 'secondary' }
}

interface NotifyAction { label: string }
interface Notification {
  id: number
  cat: string
  title: string
  body: string
  read: boolean
  time: string
  pinned?: boolean
  stores?: string[]
  action?: NotifyAction
}
const notifications = ref<Notification[]>([
  { id: 3, cat: 'maintenance', title: '系統維護公告：7/20 02:00–04:00', read: true, time: '2026/07/14 10:00', pinned: true,
    body: '為提供更穩定的服務，系統將於 2026/07/20 02:00–04:00 進行例行維護，期間後台將暫停服務，造成不便敬請見諒。' },
  { id: 4, cat: 'notice', title: '商家資格審核通過', read: true, time: '2026/07/12 14:26',
    body: '恭喜！您的商家資格審核已通過，帳號功能已全數開通，歡迎開始使用直播管家的完整功能。' },
  { id: 5, cat: 'notice', title: '合約將於 2026/08/31 到期', read: false, time: '2026/07/11 08:00',
    body: '您的服務合約將於 2026/08/31 到期。為避免服務中斷，請於到期前完成續約手續。', action: { label: '前往續約' } },
  { id: 6, cat: 'order', title: '訂單 #20260715-008 付款異常', read: false, time: '2026/07/15 21:03',
    body: '訂單 #20260715-008 的付款發生異常（授權失敗），目前訂單狀態為「待處理」，請確認後聯繫買家或取消訂單。', action: { label: '查看訂單' } },
  { id: 7, cat: 'system', title: '新功能上線：AI 商品文案建議', read: true, time: '2026/07/09 11:20',
    body: '「AI 商品文案建議」功能正式上線，於商品編輯頁點擊「AI 建議」即可自動產生商品標題與賣點文案。' },
  { id: 8, cat: 'system', title: '付款服務條款更新公告', read: true, time: '2026/07/06 09:00',
    body: '金流服務條款將於 2026/08/01 起更新，主要調整撥款週期與手續費計算方式，詳情請參閱條款全文。', action: { label: '查看條款全文' } },
  { id: 9, cat: 'customer', title: '新訂單 #20260716-014 已成立', read: false, time: '2026/07/16 10:05',
    body: '客戶「陳美如」剛完成一筆訂單 #20260716-014，金額 NT$ 2,480。此為單向提醒，如需回覆客戶請至既有的「客服中心」。', action: { label: '查看訂單' } },
  { id: 10, cat: 'customer', title: '商品收到新評價（4★）', read: true, time: '2026/07/15 19:30',
    body: '商品「無線藍牙耳機」收到一則新評價（4 星）：「音質不錯，出貨也快。」', action: { label: '查看評價' } },
])

// ── 篩選 / 分類 ──
const activeCat = ref<string>('all')
const unreadOnly = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
function catCount(id: string): number {
  return notifications.value.filter(n => n.cat === id).length
}

/** 置頂優先（新到舊），其餘按時間新到舊 */
const filtered = computed<Notification[]>(() => {
  let rows = notifications.value.filter(n => activeCat.value === 'all' || n.cat === activeCat.value)
  if (unreadOnly.value) rows = rows.filter(n => !n.read)
  return [...rows].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.time.localeCompare(a.time)
  })
})

/** 收件匣時間省略年份（近期通知為主） */
function shortTime(t: string): string {
  return t.replace(/^\d{4}\//, '')
}

// ── 詳情 Dialog ──
const detailVisible = ref(false)
const detailNotif = ref<Notification | null>(null)
function openNotif(n: Notification): void {
  n.read = true
  detailNotif.value = n
  detailVisible.value = true
}
function toggleRead(n: Notification): void {
  n.read = !n.read
}

</script>

<template>
  <div class="flex flex-col gap-4">
    <Card
      :pt="{
        root: { class: 'w-full overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <!-- 頁首：標題 + 說明（放在卡片內、頁籤上方） -->
        <div class="flex flex-col gap-1 px-6 pt-5 pb-2">
          <h1 class="text-2xl font-bold text-[var(--p-text-color)]">通知中心</h1>
          <p class="text-xs text-[var(--p-text-muted-color)]">平台與系統發送給您的通知；點整列可查看完整內容。</p>
        </div>

        <!-- 分類 Tabs ＋ 只看未讀：桌面同列（6.6 模式二）；手機各自獨立一排。TabList px-6（7.1 底線內縮不貼卡片邊） -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 md:pr-6">
          <Tabs :value="activeCat" class="w-full md:flex-1 min-w-0" @update:value="(v) => activeCat = String(v)">
            <TabList :pt="{ root: { class: 'px-6' } }">
              <Tab value="all">
                <span class="inline-flex items-center gap-2">全部 <span class="notif-cnt">{{ notifications.length }}</span></span>
              </Tab>
              <Tab v-for="c in CATEGORIES" :key="c.id" :value="c.id">
                <span class="inline-flex items-center gap-2">{{ c.name }} <span class="notif-cnt">{{ catCount(c.id) }}</span></span>
              </Tab>
            </TabList>
          </Tabs>
          <label class="flex items-center gap-2 text-sm cursor-pointer shrink-0 px-6 pb-2 md:px-0 md:pb-0">
            <Checkbox v-model="unreadOnly" binary input-id="only-unread" />
            <span>只看未讀</span>
          </label>
        </div>

        <!-- 收件匣表格（桌面；卡片內 px-6 左右內距 + 上下內距，與頁籤列對齊） -->
        <div class="hidden md:block px-6 py-4">
        <DataTable
          :value="filtered"
          data-key="id"
          striped-rows
          paginator
          :rows="10"
          current-page-report-template="每頁 {rows} 筆 · 共 {totalRecords} 筆"
          paginator-template="PrevPageLink PageLinks NextPageLink CurrentPageReport"
          class="notif-table"
          @row-click="(e) => openNotif(e.data as Notification)"
        >
          <template #empty>
            <div class="py-12 text-center text-[var(--p-text-muted-color)]">目前沒有通知</div>
          </template>

          <Column header="通知類型" style="width: 150px">
            <template #body="{ data }">
              <Tag :value="categoryOf(data.cat).name" :severity="categoryOf(data.cat).severity" />
            </template>
          </Column>

          <Column header="通知">
            <template #body="{ data }">
              <div class="flex flex-col gap-1 cursor-pointer">
                <div class="flex items-center gap-2 text-[var(--p-text-color)]" :class="data.read ? 'font-normal' : 'font-semibold'">
                  <span v-if="!data.read" class="inline-block size-2 rounded-full shrink-0 bg-blue-600 dark:bg-blue-400" aria-label="未讀"></span>
                  <i v-if="data.pinned" class="pi pi-thumbtack text-[var(--p-primary-color)]" style="font-size: 12px" v-tooltip.top="'置頂'" aria-label="置頂"></i>
                  <Tag v-if="data.stores" value="適用門市" severity="info" />
                  <span>{{ data.title }}</span>
                </div>
                <div class="text-xs text-[var(--p-text-muted-color)] truncate max-w-[520px]">{{ data.body }}</div>
              </div>
            </template>
          </Column>

          <Column header="時間" style="width: 120px">
            <template #body="{ data }">
              <span class="text-[var(--p-text-color)]">{{ shortTime(data.time) }}</span>
            </template>
          </Column>

          <Column header="狀態" style="width: 90px">
            <template #body="{ data }">
              <span v-if="data.read" class="text-xs text-[var(--p-text-muted-color)]">已讀</span>
              <span v-else class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <span class="inline-block size-2 rounded-full" style="background: currentColor"></span>未讀
              </span>
            </template>
          </Column>

          <Column header="操作" style="width: 90px">
            <template #body="{ data }">
              <Button
                v-tooltip.top="data.read ? '標示為未讀' : '標示為已讀'"
                :aria-label="data.read ? '標示為未讀' : '標示為已讀'"
                :icon="data.read ? 'pi pi-undo' : 'pi pi-check'"
                severity="secondary"
                variant="text"
                rounded
                size="small"
                @click="(e: MouseEvent) => { e.stopPropagation(); toggleRead(data) }"
              />
            </template>
          </Column>
        </DataTable>
        </div>

        <!-- 收件匣列表（手機：堆疊卡片，避免多欄表格橫向溢出） -->
        <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="n in filtered"
            :key="n.id"
            class="px-4 py-3 flex flex-col gap-2 cursor-pointer"
            @click="openNotif(n)"
          >
            <div class="flex items-center justify-between gap-2">
              <Tag :value="categoryOf(n.cat).name" :severity="categoryOf(n.cat).severity" />
              <span class="text-xs text-[var(--p-text-muted-color)] shrink-0">{{ shortTime(n.time) }}</span>
            </div>
            <div class="flex items-center gap-2 text-[var(--p-text-color)]" :class="n.read ? 'font-normal' : 'font-semibold'">
              <span v-if="!n.read" class="inline-block size-2 rounded-full shrink-0 bg-blue-600 dark:bg-blue-400"></span>
              <i v-if="n.pinned" class="pi pi-thumbtack text-[var(--p-primary-color)]" style="font-size: 12px" aria-label="置頂"></i>
              <span class="text-sm">{{ n.title }}</span>
            </div>
            <p class="text-xs text-[var(--p-text-muted-color)] m-0 line-clamp-2">{{ n.body }}</p>
            <div class="flex items-center justify-between">
              <span v-if="n.read" class="text-xs text-[var(--p-text-muted-color)]">已讀</span>
              <span v-else class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <span class="inline-block size-2 rounded-full" style="background: currentColor"></span>未讀
              </span>
              <Button
                v-tooltip.top="n.read ? '標示為未讀' : '標示為已讀'"
                :aria-label="n.read ? '標示為未讀' : '標示為已讀'"
                :icon="n.read ? 'pi pi-undo' : 'pi pi-check'"
                severity="secondary"
                variant="text"
                rounded
                size="small"
                @click="(e: MouseEvent) => { e.stopPropagation(); toggleRead(n) }"
              />
            </div>
          </div>
          <div v-if="!filtered.length" class="py-12 text-center text-[var(--p-text-muted-color)]">目前沒有通知</div>
        </div>
      </template>
    </Card>

    <!-- 通知詳情 Dialog -->
    <Dialog
      v-model:visible="detailVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    >
      <template #header>
        <div v-if="detailNotif" class="flex flex-col gap-2">
          <Tag :value="categoryOf(detailNotif.cat).name" :severity="categoryOf(detailNotif.cat).severity" />
          <span class="text-lg font-bold text-[var(--p-text-color)]">{{ detailNotif.title }}</span>
        </div>
      </template>
      <div v-if="detailNotif" class="flex flex-col gap-3">
        <p class="text-xs text-[var(--p-text-muted-color)] m-0">{{ detailNotif.time }}</p>
        <p class="text-sm leading-relaxed text-[var(--p-text-color)] m-0">{{ detailNotif.body }}</p>
        <div v-if="detailNotif.stores" class="text-sm flex items-center gap-2">
          <Tag value="適用門市" severity="info" />
          <span class="text-[var(--p-text-muted-color)]">{{ detailNotif.stores.join('、') }}</span>
        </div>
        <div v-if="detailNotif.action" class="pt-1">
          <Button :label="`${detailNotif.action.label} →`" severity="primary" variant="outlined" size="small" />
        </div>
      </div>
      <template #footer>
        <Button label="關閉" severity="secondary" variant="outlined" @click="detailVisible = false" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* 整列可點；未讀列左側加主色標記（與圓點/粗體/狀態欄一起多重編碼，不單靠顏色） */
.notif-table :deep(.p-datatable-tbody > tr) { cursor: pointer; }
/* 分類 Tab 計數 badge（字級走階梯 text-xs） */
.notif-cnt {
  min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px;
  font-size: 12px; font-weight: 600; line-height: 18px; text-align: center;
  background: var(--p-content-hover-background); color: var(--p-text-muted-color);
}
</style>
