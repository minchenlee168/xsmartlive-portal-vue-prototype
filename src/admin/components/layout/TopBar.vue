<script setup lang="ts">
import DropdownMenu from '@/admin/components/portal-ui/DropdownMenu.vue';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useConfigStore } from '@/admin/stores/config';
import { useShopStore } from '@/admin/stores/shop';
import { useNotificationStore, type AppNotification, type NotificationCategory } from '@/admin/stores/notification';
import { RouteName } from '@/admin/router';
import Logo from '@/admin/components/layout/Logo.vue';
import LanguageSelector from '@/admin/components/layout/LanguageSelector.vue';
import ThemeSwitcher from '@/admin/components/layout/ThemeSwitcher.vue';

import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const { showSuccess } = useGlobalToast();
const configStore = useConfigStore();
const shopStore = useShopStore();
const { shops, currentShopId, currentShop } = storeToRefs(shopStore);

/* ===== 通知鈴鐺（與「通知中心」收件匣頁共用 notification store）===== */
const router = useRouter();
const notificationStore = useNotificationStore();
const bellPanel = ref<{ toggle: (e: Event) => void; hide: () => void } | null>(null);

/** 未讀通知依類別分組（下拉快覽用）。 */
const unreadGroups = computed<{ category: NotificationCategory; items: AppNotification[] }[]>(() => {
  const groups: Record<string, AppNotification[]> = {};
  notificationStore.items
    .filter((n) => !n.read)
    .forEach((n) => {
      (groups[n.categoryId] ??= []).push(n);
    });
  return Object.entries(groups).map(([id, items]) => ({
    category: notificationStore.categoryById(id),
    items,
  }));
});

function toggleBell(event: Event) {
  bellPanel.value?.toggle(event);
}

function goToNotificationCenter() {
  bellPanel.value?.hide();
  router.push({ name: RouteName.NotificationCenter });
}

// 此 prototype 是 mock-only，shopStore 已有預設假資料，不需要 fetchAvailableShops。

interface ShopMenuItem {
  shopId: number;
  label: string;
  command: () => void;
}

const shopMenuRef = ref<{ toggle: (e: Event) => void } | null>(null);

const shopMenuItems = computed<ShopMenuItem[]>(() => shops.value.map((shop) => ({
  shopId: shop.id,
  label: shop.name,
  command: () => shopStore.selectShop(shop.id),
})));

function toggleShopMenu(event: MouseEvent) {
  shopMenuRef.value?.toggle(event);
}

/** 前台檢視：另開分頁到商城前台 prototype */
const FRONT_VIEW_URL = 'https://minchenlee168.github.io/xsmartlive-mall/shop'
function handleFrontView() {
  window.open(FRONT_VIEW_URL, '_blank', 'noopener,noreferrer')
}

const items = computed(() => [
  {
    label: t('common.logout'),
    icon: 'right-from-bracket',
    onClick: handleLogout,
  },
]);

function handleLogout() {
  // mock 專案不接登入流程，按下後僅 toast 提示
  showSuccess({ detail: t('topbar.logout_mock') });
}

/** ISO 字串 → 「YYYY/MM/DD HH:mm」 */
function formatCommitTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const prototypeUpdateTime = computed(() => {
  const iso = typeof __LAST_COMMIT_TIME__ === 'string' ? __LAST_COMMIT_TIME__ : ''
  return formatCommitTime(iso)
})

/** info icon 開的 changelog Dialog 狀態與資料：解析 vite 注入的 commit 區塊（第一行 `ISO|subject`，後續為 body） */
const changelogDialogVisible = ref(false)
interface CommitEntry {
  time: string
  subject: string
  /** body 拆成多行，過濾掉空行；若是 `- xxx` / `* xxx` 開頭就去掉符號當作子條列項 */
  bullets: string[]
}
const recentCommits = computed<CommitEntry[]>(() => {
  const list = Array.isArray(__RECENT_COMMITS__) ? __RECENT_COMMITS__ : []
  return list.map((block) => {
    const lines = block.split('\n')
    const firstLine = lines[0] ?? ''
    const idx = firstLine.indexOf('|')
    const time = idx < 0 ? '' : formatCommitTime(firstLine.slice(0, idx))
    const subject = idx < 0 ? firstLine : firstLine.slice(idx + 1)
    const bullets = lines
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('Co-Authored-By:'))
      .map((l) => l.replace(/^[-*]\s*/, ''))
    return { time, subject, bullets }
  })
})
</script>

<template>
  <!-- 手機（< 640px）內 padding 縮小 px-3、桌機 px-6；左區允許縮收（min-w-0 + flex-1）讓右區 3 顆 icon 永遠顯示 -->
  <div class="flex items-center justify-between shrink-0 w-full h-20 px-3 sm:px-6 border-b border-gray-200 dark:border-gray-700 gap-2">
    <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
      <RouterLink
        to="/"
        class="flex items-center gap-4 shrink-0"
      >
        <Logo :width="40" />

        <p
          class="hidden font-medium text-xl"
          :class="{
            'sm:block': configStore.isSidebarExpanded
          }"
        >
          {{ $t('system.app_name') }}
        </p>
      </RouterLink>

      <Button
        rounded
        size="small"
        severity="secondary"
        class="transition-all duration-200 shrink-0"
        :class="{
          'rotate-180': !configStore.isSidebarExpanded
        }"
        @click="configStore.toggleSidebar"
      >
        <template #icon>
          <FontAwesomeIcon :icon="['far', 'chevron-left']" />
        </template>
      </Button>
      <div id="topbar-left-slot" />

      <Button
        v-if="shops.length > 0"
        text
        size="small"
        severity="secondary"
        class="h-9 min-w-0 shrink"
        @click="toggleShopMenu"
      >
        <!-- 手機隱藏「目前在：」prefix，只留商家名 + chevron 節省寬度 -->
        <span class="hidden sm:inline text-sm text-color-secondary">{{ t('topbar.current_at') }}</span>
        <span class="text-primary font-medium text-sm mx-1 truncate max-w-[120px] sm:max-w-none">{{ currentShop?.name ?? '-' }}</span>
        <FontAwesomeIcon
          :icon="['far', 'chevron-down']"
          class="text-xs shrink-0"
        />
      </Button>

      <Menu
        ref="shopMenuRef"
        :model="shopMenuItems"
        popup
      >
        <template #start>
          <div class="px-3 py-2 text-xs text-color-secondary border-b border-surface">
            {{ t('topbar.switchable_shops') }}
          </div>
        </template>
        <template #item="{ item, props }">
          <a
            v-bind="props.action"
            class="flex items-center px-3 py-2 text-sm cursor-pointer"
            :class="(item as ShopMenuItem).shopId === currentShopId ? 'text-primary font-medium' : ''"
          >
            {{ item.label }}
          </a>
        </template>
      </Menu>

      <!-- 前台檢視：手機只顯示眼睛 icon（無 label），桌機才有文字 -->
      <Button
        size="small"
        severity="secondary"
        variant="outlined"
        class="h-9 shrink-0"
        v-tooltip.bottom="t('topbar.front_view')"
        @click="handleFrontView"
      >
        <FontAwesomeIcon :icon="['far', 'eye']" />
        <span class="hidden sm:inline ml-2">{{ t('topbar.front_view') }}</span>
      </Button>

      <!-- prototype 更新時間提示：手機隱藏，避免擠壓主要 buttons；右側 info icon 點開 changelog Dialog -->
      <span
        v-if="prototypeUpdateTime"
        class="hidden lg:inline-flex items-center gap-1 text-xs text-[#ef4444] font-medium whitespace-nowrap"
      >
        此為 prototype 展示，更新時間：{{ prototypeUpdateTime }}
        <button
          type="button"
          v-tooltip.bottom="'查看更新內容'"
          class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full hover:bg-[#fee2e2]"
          @click="changelogDialogVisible = true"
        >
          <i class="pi pi-info-circle" style="font-size: 13px"></i>
        </button>
      </span>
    </div>

    <!-- Changelog Dialog：顯示最近 10 筆 commit 的時間 + subject -->
    <Dialog
      v-model:visible="changelogDialogVisible"
      modal
      :draggable="false"
      header="更新內容"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    >
      <div v-if="recentCommits.length === 0" class="text-sm text-[var(--p-text-muted-color)] py-4 text-center">
        尚無 commit 紀錄
      </div>
      <ul v-else class="divide-y divide-[var(--p-content-border-color)]">
        <li v-for="(c, i) in recentCommits" :key="i" class="py-3 flex flex-col gap-2">
          <span class="text-xs text-[var(--p-text-muted-color)] font-mono">{{ c.time }}</span>
          <span class="text-sm font-medium text-[var(--p-text-color)] leading-snug">{{ c.subject }}</span>
          <!-- commit body 拆出來的條列子項；沒有 body 就不顯示 -->
          <ul v-if="c.bullets.length" class="list-disc pl-5 flex flex-col gap-1">
            <li v-for="(b, bi) in c.bullets" :key="bi" class="text-[13px] text-[var(--p-text-color)] leading-snug">{{ b }}</li>
          </ul>
        </li>
      </ul>
    </Dialog>

    <!-- 右區 3 顆 icon 永遠顯示，shrink-0 避免被左區擠掉 -->
    <div class="inline-flex items-center h-10 gap-2 sm:gap-4 shrink-0">
      <div
        id="topbar-right-slot"
        class="inline-flex gap-4"
      />

      <!-- 通知鈴鐺：未讀 badge + 下拉快覽（資料源為 notification store，與收件匣頁同步） -->
      <div class="shrink-0">
        <OverlayBadge
          v-if="notificationStore.unreadCount > 0"
          :value="notificationStore.unreadCount"
          severity="danger"
        >
          <Button
            rounded
            size="small"
            severity="secondary"
            text
            :aria-label="t('notification.center.bell.title')"
            @click="toggleBell"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'bell']" />
            </template>
          </Button>
        </OverlayBadge>
        <Button
          v-else
          rounded
          size="small"
          severity="secondary"
          text
          :aria-label="t('notification.center.bell.title')"
          @click="toggleBell"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['far', 'bell']" />
          </template>
        </Button>

        <Popover ref="bellPanel">
          <div class="w-[360px] max-w-[calc(100vw-32px)]">
            <div class="flex items-center gap-2 pb-2 border-b border-surface">
              <span class="font-bold">{{ t('notification.center.bell.title') }}</span>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ t('notification.center.bell.count', { count: notificationStore.unreadCount }) }}
              </span>
              <button
                v-if="notificationStore.unreadCount > 0"
                type="button"
                class="ml-auto text-sm text-surface-500 dark:text-surface-400 hover:text-primary"
                @click="notificationStore.markAllRead()"
              >
                {{ t('notification.center.bell.mark_all_read') }}
              </button>
            </div>

            <div class="max-h-[400px] overflow-y-auto py-2">
              <div
                v-if="notificationStore.unreadCount === 0"
                class="py-8 text-center text-sm text-surface-500 dark:text-surface-400"
              >
                {{ t('notification.center.bell.empty') }}
              </div>
              <template
                v-for="group in unreadGroups"
                :key="group.category.id"
              >
                <div class="px-1 pt-2 pb-1 text-xs text-surface-500 dark:text-surface-400">
                  {{ group.category.name }}
                </div>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="mb-1 flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                  @click="goToNotificationCenter"
                >
                  <Tag
                    :value="group.category.name"
                    :severity="group.category.severity"
                    class="mt-1 shrink-0"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-surface-700 dark:text-surface-100">
                      {{ item.title }}
                    </span>
                    <span class="mt-1 block text-xs text-surface-400 dark:text-surface-500">
                      {{ item.time }}
                    </span>
                  </span>
                </button>
              </template>
            </div>

            <div class="pt-2 border-t border-surface text-center">
              <Button
                text
                size="small"
                :label="t('notification.center.bell.view_all')"
                @click="goToNotificationCenter"
              />
            </div>
          </div>
        </Popover>
      </div>

      <ThemeSwitcher />
      <LanguageSelector />
      <DropdownMenu
        icon="user"
        :model="items"
      />
    </div>
  </div>
</template>
