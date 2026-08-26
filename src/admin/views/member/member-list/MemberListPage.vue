<script setup lang="ts">
import MemberDetailDialog from './components/MemberDetailDialog.vue';
import MemberFilter from './components/MemberFilter.vue';
import MemberMessageDialog from './components/MemberMessageDialog.vue';
import MemberOrdersDialog from './components/MemberOrdersDialog.vue';
import MemberPointsDialog from './components/MemberPointsDialog.vue';
import MemberStarSettingsDialog from './components/MemberStarSettingsDialog.vue';
import { exportMembersCsv } from './utils/exportMembersCsv';
import { useHorizontalScrollHint } from './composables/useHorizontalScrollHint';
import { useMemberList } from './composables/useMemberList';
import { mockMembers, type MemberMockFilter, type MockMemberRow } from './mock/mockMembers';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  BINDING_CHANNELS,
  BINDING_UNBOUND_CLASS,
  boundChannelsOf,
  formatLastOrderDate,
  formatSpend,
  getAbandonRate,
  MEMBER_LEVEL_SEVERITY,
  MEMBER_STATUS_SEVERITY,
} from './utils/mockMemberDisplay';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import PageTitle from '@/admin/components/portal-ui/PageTitle.vue';
import PaginationTable from '@/admin/components/portal-ui/PaginationTable.vue';

import { computed, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

/*
 * ⚠️ 版面預覽（mock）：本頁為對齊設計 mockup 的 14 欄版面，資料來自前端假資料
 * （`./mock/mockMembers.ts`），非後端 API。篩選為客端過濾、操作按鈕僅提示未接後端。
 * 待後端補齊欄位後，應改回 API 驅動並移除 mock 相關檔案。
 */

const { t } = useI18n();
const { confirm } = useGlobalDialog();
const { showSuccess, showWarn } = useGlobalToast();

const { columns } = useMemberList();

const starSettingsVisible = ref(false);
const exportMenu = useTemplateRef<{ toggle: (event: Event) => void }>('exportMenu');

/** 開播通知訂閱人數（已綁定 LINE 且開播通知接收中；全體，不受列表篩選影響）。 */
const notifSubCount = computed(() => mockMembers.filter((m) => m.bindings.line && m.notifLiveEnabled).length);

/** 匯出下拉選項：基本 / 含完整明細。 */
const exportItems = computed(() => [
  { label: t('member.export.basic'), command: () => handleExport(false) },
  { label: t('member.export.detail'), command: () => handleExport(true) },
]);

/** 開啟匯出下拉選單。 */
function toggleExportMenu(event: Event) {
  exportMenu.value?.toggle(event);
}

/** 依目前篩選結果匯出 CSV（不受分頁限制）。 */
function handleExport(detailed: boolean) {
  const list = filteredMembers.value;
  if (list.length === 0) {
    showWarn({ detail: t('member.export.empty') });
    return;
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  exportMembersCsv(list, detailed, stamp);
}

const tableWrapper = useTemplateRef<HTMLElement>('tableWrapper');
const { canScrollLeft, canScrollRight, headerHeight, frozenRightWidth, scrollByViewport }
  = useHorizontalScrollHint(tableWrapper);

const moreMenu = useTemplateRef<{ toggle: (event: Event) => void }>('moreMenu');
const activeMoreRow = ref<MockMemberRow | null>(null);

/** 操作欄前兩顆 icon 按鈕（檢視 / 訂單紀錄）。 */
const primaryActions = computed<{ key: string; icon: IconProp; label: string; onClick: (row: MockMemberRow) => void }[]>(() => [
  { key: 'view', icon: ['far', 'eye'], label: t('common.button.view'), onClick: handleView },
  { key: 'orders', icon: ['far', 'receipt'], label: t('member.action.orders'), onClick: handleOrders },
]);

/** 「更多」選單項（紅利點數 / 加入黑名單 / 發送訊息）。加入黑名單為破壞性操作，以上鎖 icon＋紅色標示。 */
const moreMenuItems = computed(() => {
  const isBlacklisted = activeMoreRow.value?.status === 'blacklisted';
  return [
    { faIcon: ['far', 'badge-dollar'] as IconProp, label: t('member.action.points'), command: handlePoints },
    { faIcon: ['far', 'paper-plane'] as IconProp, label: t('member.action.message'), command: handleMessage },
    {
      faIcon: (isBlacklisted ? ['far', 'lock-open'] : ['far', 'lock']) as IconProp,
      label: isBlacklisted ? t('member.action.remove_blacklist') : t('member.action.ban'),
      command: handleBan,
      danger: !isBlacklisted,
    },
  ];
});

/** 開啟該列的「更多」彈出選單。 */
function openMoreMenu(event: Event, row: MockMemberRow) {
  activeMoreRow.value = row;
  moreMenu.value?.toggle(event);
}

const activeMember = ref<MockMemberRow | null>(null);
const detailVisible = ref(false);
const ordersVisible = ref(false);
const pointsVisible = ref(false);
const messageVisible = ref(false);

/** 檢視會員明細，開啟明細彈窗。 */
function handleView(row: MockMemberRow) {
  activeMember.value = row;
  detailVisible.value = true;
}

/** 訂單紀錄。 */
function handleOrders(row: MockMemberRow) {
  activeMember.value = row;
  ordersVisible.value = true;
}

/** 紅利點數（由「更多」選單開啟，對象為 activeMoreRow）。 */
function handlePoints() {
  if (!activeMoreRow.value) return;
  activeMember.value = activeMoreRow.value;
  pointsVisible.value = true;
}

/** 發送訊息（由「更多」選單開啟）。 */
function handleMessage() {
  if (!activeMoreRow.value) return;
  activeMember.value = activeMoreRow.value;
  messageVisible.value = true;
}

/** 停權 / 解除停權（stub，二次確認後僅提示，未接後端）。 */
async function handleBan() {
  const row = activeMoreRow.value;
  if (!row) return;
  const accepted = await confirm({
    message: row.status === 'blacklisted'
      ? t('member.action.unban_confirm', { name: row.name })
      : t('member.action.ban_confirm', { name: row.name }),
  });
  if (!accepted) return;
  showSuccess({ detail: t('member.action.stub') });
}

const filter = ref<MemberMockFilter>(createEmptyFilter());
/** 已套用的搜尋條件（按「搜尋」才由 filter 複製過來，對齊按鈕套用模型）。 */
const appliedFilter = ref<MemberMockFilter>(createEmptyFilter());

function createEmptyFilter(): MemberMockFilter {
  return {
    keywordField: 'name',
    keyword: '',
    level: null,
    status: null,
    stars: null,
    bindings: [],
    createdAtRange: null,
    blacklistOnly: false,
  };
}

/** 當日 00:00 的 epoch（帳號建立日期區間下界）。 */
function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
/** 當日 23:59:59.999 的 epoch（帳號建立日期區間上界）。 */
function dayEnd(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

/** 依已套用條件做客端過濾（對齊 mockup 搜尋區各條件；綁定管道為多選、需全部符合）。 */
const filteredMembers = computed<MockMemberRow[]>(() => {
  const { keywordField, keyword, level, status, stars, bindings, createdAtRange, blacklistOnly } =
    appliedFilter.value;
  const kw = keyword.trim().toLowerCase();
  const [from, to] = createdAtRange ?? [];

  return mockMembers.filter((member) => {
    if (kw) {
      const haystack =
        keywordField === 'code'
          ? member.no
          : keywordField === 'phone'
            ? member.phoneFull ?? ''
            : member.name;
      if (!haystack.toLowerCase().includes(kw)) return false;
    }
    if (level !== null && member.level !== level) return false;
    if (status !== null && member.status !== status) return false;
    if (stars !== null && member.stars !== stars) return false;
    if (blacklistOnly && member.status !== 'blacklisted') return false;
    if (bindings.length > 0 && !bindings.every((key) => member.bindings[key])) return false;
    if (from && to) {
      const created = new Date(member.createdAt).getTime();
      if (created < dayStart(from) || created > dayEnd(to)) return false;
    }
    return true;
  });
});

/** 表格列：附上預格式化的純文字欄與棄標率顯示物件。 */
const rows = computed(() =>
  filteredMembers.value.map((member) => ({
    ...member,
    spendLabel: formatSpend(member.spend),
    lastOrderLabel: formatLastOrderDate(member.lastOrderAt),
    abandonRate: getAbandonRate(member.bids, member.abandonedBids),
    abandonRateValue: member.bids > 0 ? member.abandonedBids / member.bids : 0,
  })),
);

/**
 * 手機卡片列表分頁（桌面 PaginationTable 內建分頁，手機版另立同步狀態，避免一次渲染整份結果）。
 * `first` 為當前頁第一筆的索引；每頁 10 筆，比照桌面預設。
 */
const MOBILE_PAGE_SIZE = 10;
const mobileFirst = ref(0);
const mobileRows = computed(() => rows.value.slice(mobileFirst.value, mobileFirst.value + MOBILE_PAGE_SIZE));

function handleApplyFilter() {
  appliedFilter.value = { ...filter.value };
  mobileFirst.value = 0;
}

function handleResetFilter() {
  filter.value = createEmptyFilter();
  appliedFilter.value = createEmptyFilter();
  mobileFirst.value = 0;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <template #content>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <PageTitle
            :title="$t('member.title.list')"
            :show-back="false"
          />

          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <span class="text-muted-color inline-flex items-center gap-2 text-sm">
              <FontAwesomeIcon
                :icon="['far', 'bell']"
                class="text-primary"
              />
              {{ $t('member.notif_subscription', { count: notifSubCount }) }}
            </span>

            <Button
              :label="$t('member.star_settings.title')"
              severity="secondary"
              outlined
              @click="starSettingsVisible = true"
            />

            <Button
              severity="secondary"
              outlined
              @click="toggleExportMenu"
            >
              {{ $t('member.export.label') }}
              <FontAwesomeIcon
                :icon="['far', 'chevron-down']"
                class="ml-2 text-xs"
              />
            </Button>
            <Menu
              ref="exportMenu"
              :model="exportItems"
              popup
            >
              <template #end>
                <div class="text-muted-color border-t border-surface-200 px-3 py-2 text-xs dark:border-surface-700">
                  {{ $t('member.export.note', { count: filteredMembers.length }) }}
                </div>
              </template>
            </Menu>
          </div>
        </div>

        <MemberFilter
          v-model="filter"
          @apply="handleApplyFilter"
          @reset="handleResetFilter"
        />
      </template>
    </Card>

    <Card>
      <template #content>
        <!-- 桌面：14 欄 DataTable（橫向捲動）；md 以下改用手機卡片列表 -->
        <div
          ref="tableWrapper"
          class="relative hidden md:block"
        >
      <PaginationTable
        :data="rows"
        :columns="columns"
        table-style="min-width: 100rem"
      >
      <template #bindings="{ data }">
        <div class="flex items-center gap-2">
          <span
            v-for="channel in BINDING_CHANNELS"
            :key="channel.key"
            v-tooltip.top="`${channel.nameKey ? $t(channel.nameKey) : channel.name}：${data.bindings[channel.key] ? $t('member.binding.bound') : $t('member.binding.unbound')}`"
            class="inline-flex"
          >
            <FontAwesomeIcon
              :icon="channel.icon"
              :class="data.bindings[channel.key] ? channel.boundClass : BINDING_UNBOUND_CLASS"
              :aria-label="`${channel.nameKey ? $t(channel.nameKey) : channel.name} ${data.bindings[channel.key] ? $t('member.binding.bound') : $t('member.binding.unbound')}`"
            />
          </span>
        </div>
      </template>

      <template #level="{ data }">
        <Tag
          :severity="MEMBER_LEVEL_SEVERITY[data.level as MockMemberRow['level']]"
          :value="$t(`member.level.${data.level}`)"
        />
      </template>

      <template #stars="{ data }">
        <span
          class="inline-flex items-center gap-2 tabular-nums"
          :aria-label="$t('member.stars.rating', { count: data.stars })"
        >
          {{ data.stars }}
          <FontAwesomeIcon
            :icon="['fas', 'star']"
            class="text-yellow-400 dark:text-yellow-300"
          />
        </span>
      </template>

      <template #abandonRate="{ data }">
        <span :class="data.abandonRate.toneClass">{{ data.abandonRate.label }}</span>
      </template>

      <template #status="{ data }">
        <Tag
          :severity="MEMBER_STATUS_SEVERITY[data.status as MockMemberRow['status']]"
          :value="$t(`member.status.${data.status}`)"
        />
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button
            v-for="action in primaryActions"
            :key="action.key"
            v-tooltip.top="action.label"
            :aria-label="action.label"
            rounded
            size="small"
            severity="secondary"
            text
            @click="action.onClick(data)"
          >
            <template #icon>
              <FontAwesomeIcon :icon="action.icon" />
            </template>
          </Button>
          <Button
            v-tooltip.top="$t('member.action.more')"
            :aria-label="$t('member.action.more')"
            rounded
            size="small"
            severity="secondary"
            text
            @click="openMoreMenu($event, data)"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'ellipsis-vertical']" />
            </template>
          </Button>
        </div>
      </template>
      </PaginationTable>

      <button
        v-show="canScrollLeft"
        type="button"
        class="scroll-hint scroll-hint-left"
        :style="{ top: `${headerHeight / 2}px` }"
        :aria-label="$t('member.table.scroll_prev')"
        @click="scrollByViewport(-1)"
      >
        <FontAwesomeIcon :icon="['far', 'chevron-left']" />
      </button>
      <button
        v-show="canScrollRight"
        type="button"
        class="scroll-hint scroll-hint-right"
        :style="{ top: `${headerHeight / 2}px`, right: `${frozenRightWidth}px` }"
        :aria-label="$t('member.table.scroll_next')"
        @click="scrollByViewport(1)"
      >
        <FontAwesomeIcon :icon="['far', 'chevron-right']" />
      </button>
        </div>

        <!--
          手機：堆疊卡片列表（比照通知中心手機版）。整列可點＝檢視明細（同桌面 eye）；
          右下保留「訂單紀錄 / 更多」，綁定只顯示已綁定管道。卡片已在外層 Card 內，用 divide-y 分隔（不再巢狀 Card）。
        -->
        <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="row in mobileRows"
            :key="row.no"
            class="flex cursor-pointer flex-col gap-2 px-1 py-3"
            role="button"
            tabindex="0"
            :aria-label="$t('member.card.view_detail', { name: row.name })"
            @click="handleView(row)"
            @keydown.enter="handleView(row)"
            @keydown.space.prevent="handleView(row)"
          >
            <!-- 第一層：姓名 + 會員編號（左）／狀態 Tag（右） -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-baseline gap-2">
                <span class="text-color truncate text-sm font-semibold">{{ row.name }}</span>
                <span class="text-muted-color shrink-0 text-xs tabular-nums">{{ row.no }}</span>
              </div>
              <Tag
                class="shrink-0"
                :severity="MEMBER_STATUS_SEVERITY[row.status as MockMemberRow['status']]"
                :value="$t(`member.status.${row.status}`)"
              />
            </div>

            <!-- 第二層：等級 + 星等 + 隱碼手機 -->
            <div class="flex flex-wrap items-center gap-2">
              <Tag
                :severity="MEMBER_LEVEL_SEVERITY[row.level as MockMemberRow['level']]"
                :value="$t(`member.level.${row.level}`)"
              />
              <span
                class="text-color inline-flex items-center gap-2 text-xs tabular-nums"
                :aria-label="$t('member.stars.rating', { count: row.stars })"
              >
                {{ row.stars }}
                <FontAwesomeIcon
                  :icon="['fas', 'star']"
                  class="text-yellow-400 dark:text-yellow-300"
                />
              </span>
              <span class="text-muted-color text-xs tabular-nums">{{ row.mobileMasked }}</span>
            </div>

            <!-- 第三層（僅已綁定管道）：無綁定則整行省略 -->
            <div
              v-if="boundChannelsOf(row.bindings).length"
              class="flex items-center gap-2"
            >
              <FontAwesomeIcon
                v-for="channel in boundChannelsOf(row.bindings)"
                :key="channel.key"
                :icon="channel.icon"
                :class="channel.boundClass"
                :aria-label="`${channel.nameKey ? $t(channel.nameKey) : channel.name} ${$t('member.binding.bound')}`"
              />
            </div>

            <!-- 第四層：次要指標 2×2 grid（標籤 12px muted、數值 14px 做出層級；min-w-0 + truncate 防窄螢幕溢出） -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-color shrink-0">{{ $t('member.table.column.spend') }}</span>
                <span class="text-color truncate text-sm tabular-nums">{{ row.spendLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-color shrink-0">{{ $t('member.table.column.last_order') }}</span>
                <span class="text-color truncate text-sm tabular-nums">{{ row.lastOrderLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-color shrink-0">{{ $t('member.card.bids_abandoned') }}</span>
                <span class="text-color truncate text-sm tabular-nums">{{ row.bids }} / {{ row.abandonedBids }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-color shrink-0">{{ $t('member.table.column.abandon_rate') }}</span>
                <span
                  class="truncate text-sm tabular-nums"
                  :class="row.abandonRate.toneClass || 'text-color'"
                >{{ row.abandonRate.label }}</span>
              </div>
            </div>

            <!-- 第五層：操作（訂單紀錄 / 更多）；stopPropagation 避免觸發整列檢視 -->
            <div class="flex items-center justify-end gap-2">
              <Button
                v-tooltip.top="$t('member.action.orders')"
                :aria-label="$t('member.action.orders')"
                rounded
                size="small"
                severity="secondary"
                text
                @click="(e: MouseEvent) => { e.stopPropagation(); handleOrders(row) }"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'receipt']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('member.action.more')"
                :aria-label="$t('member.action.more')"
                rounded
                size="small"
                severity="secondary"
                text
                @click="(e: MouseEvent) => { e.stopPropagation(); openMoreMenu(e, row) }"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'ellipsis-vertical']" />
                </template>
              </Button>
            </div>
          </div>

          <div
            v-if="!rows.length"
            class="text-muted-color py-12 text-center"
          >
            {{ $t('member.card.empty') }}
          </div>

          <!-- 手機分頁：僅在超過一頁時顯示（對齊 ProductListPage 慣例：透明底、頁碼＋共 N 筆） -->
          <Paginator
            v-if="rows.length > MOBILE_PAGE_SIZE"
            v-model:first="mobileFirst"
            :rows="MOBILE_PAGE_SIZE"
            :total-records="rows.length"
            template="PrevPageLink PageLinks NextPageLink CurrentPageReport"
            current-page-report-template="{first} - {last} / 共 {totalRecords} 筆"
            class="!bg-transparent !px-0 !py-2"
          />
        </div>
      </template>
    </Card>

    <Menu
      ref="moreMenu"
      :model="moreMenuItems"
      popup
    >
      <template #item="{ item, props }">
        <a
          v-bind="props.action"
          class="flex items-center gap-2"
          :class="{ 'text-red-600 dark:text-red-400': item.danger }"
        >
          <FontAwesomeIcon
            :icon="item.faIcon"
            class="w-4"
          />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </Menu>

    <MemberDetailDialog
      v-model:visible="detailVisible"
      :member="activeMember"
    />

    <MemberOrdersDialog
      v-model:visible="ordersVisible"
      :member="activeMember"
    />

    <MemberPointsDialog
      v-model:visible="pointsVisible"
      :member="activeMember"
    />

    <MemberMessageDialog
      v-model:visible="messageVisible"
      :member="activeMember"
    />

    <MemberStarSettingsDialog v-model:visible="starSettingsVisible" />
  </div>
</template>

<style scoped>
/*
 * §7.5 橫向捲動可發現性：圓形箭頭按鈕，垂直對齊表頭列、貼齊凍結欄內側（比照訂單管理範式）。
 * 顏色走 --p-* token（深色安全）；陰影用半透明黑，不受主題影響。
 */
.scroll-hint {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 9999px;
  background: var(--p-content-background);
  color: var(--p-text-muted-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  transform: translateY(-50%);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.scroll-hint:hover {
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
}
.scroll-hint-left {
  left: 0.25rem;
}
.scroll-hint-right {
  right: 0.25rem;
}
</style>
