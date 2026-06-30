<script setup lang="ts">
import DropdownMenu from '@/admin/components/portal-ui/DropdownMenu.vue';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useConfigStore } from '@/admin/stores/config';
import { useShopStore } from '@/admin/stores/shop';
import Logo from '@/admin/components/layout/Logo.vue';
import LanguageSelector from '@/admin/components/layout/LanguageSelector.vue';
import ThemeSwitcher from '@/admin/components/layout/ThemeSwitcher.vue';

import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { showSuccess } = useGlobalToast();
const configStore = useConfigStore();
const shopStore = useShopStore();
const { shops, currentShopId, currentShop } = storeToRefs(shopStore);

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

/** 把 vite.config 注入的 ISO 字串轉成「YYYY/MM/DD HH:mm」顯示 */
const prototypeUpdateTime = computed(() => {
  const iso = typeof __LAST_COMMIT_TIME__ === 'string' ? __LAST_COMMIT_TIME__ : ''
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

      <!-- prototype 更新時間提示：手機隱藏，避免擠壓主要 buttons -->
      <span
        v-if="prototypeUpdateTime"
        class="hidden lg:inline text-[11px] text-[#ef4444] font-medium whitespace-nowrap"
      >
        此為 prototype 展示，更新時間：{{ prototypeUpdateTime }}
      </span>
    </div>

    <!-- 右區 3 顆 icon 永遠顯示，shrink-0 避免被左區擠掉 -->
    <div class="inline-flex items-center h-10 gap-2 sm:gap-4 shrink-0">
      <div
        id="topbar-right-slot"
        class="inline-flex gap-4"
      />
      <ThemeSwitcher />
      <LanguageSelector />
      <DropdownMenu
        icon="user"
        :model="items"
      />
    </div>
  </div>
</template>
