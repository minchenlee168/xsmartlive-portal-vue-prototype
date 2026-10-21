<script setup lang="ts">
import DropdownMenu from '@/admin/components/portal-ui/DropdownMenu.vue';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useConfigStore } from '@/admin/stores/config';
import { useShopStore } from '@/admin/stores/shop';
import Logo from '@/admin/components/layout/Logo.vue';
import LanguageSelector from '@/admin/components/layout/LanguageSelector.vue';
import ThemeSwitcher from '@/admin/components/layout/ThemeSwitcher.vue';
import { CHANGELOG, type ChangelogRelease } from '@/admin/constants/changelog';

import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { RouteName } from '@/admin/router';

const { t } = useI18n();
const { showSuccess } = useGlobalToast();
const configStore = useConfigStore();
const shopStore = useShopStore();
const { shops, currentShopId, currentShop } = storeToRefs(shopStore);
const route = useRoute();
const router = useRouter();

// 進入商家管理（對齊正式專案：按鈕放 TopBar 左側）；已在商家管理模式則切回主選單。
const isMerchantManagementMode = computed(() => {
  const name = String(route.name ?? '');
  return name === 'merchant-management' || name.startsWith('merchant-management.');
});
async function handleClickMerchantManagement() {
  if (isMerchantManagementMode.value) {
    await router.push({ name: RouteName.LiveOrder });
    return;
  }
  await router.push({ name: RouteName.StoreManagement });
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

/** ISO 字串 → 「YYYY-MM-DD HH:mm」 */
function formatCommitTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const prototypeUpdateTime = computed(() => {
  const iso = typeof __LAST_COMMIT_TIME__ === 'string' ? __LAST_COMMIT_TIME__ : ''
  return formatCommitTime(iso)
})

/** info icon 開的「更新內容」Dialog：讀人工維護的 CHANGELOG（版次 / 修改畫面 / 白話條列） */
const changelogDialogVisible = ref(false)
const changelog = CHANGELOG

/** 版次旁 info icon 點開的「版號說明」Popover（語意化版本 主版號.次版號.修訂號） */
const versionInfoPopover = ref<{ toggle: (e: Event) => void } | null>(null)
function toggleVersionInfo(event: Event): void {
  versionInfoPopover.value?.toggle(event)
}

/** 標題旁下拉：依「功能畫面（模組）」篩選版本；預設「全部」 */
const ALL_MODULES = '全部'
const moduleOptions = computed<string[]>(() => [ALL_MODULES, ...Array.from(new Set(changelog.map((r) => r.module)))])
const selectedModule = ref<string>(ALL_MODULES)
const filteredChangelog = computed(() =>
  selectedModule.value === ALL_MODULES ? changelog : changelog.filter((r) => r.module === selectedModule.value),
)

/** 收合狀態的唯一 key：各模組版次獨立編號（如不同模組都有 v1.0.0），單用版次字串會撞 key、一起收合，故以「模組＋版次」組成 */
const releaseKey = (rel: ChangelogRelease): string => `${rel.module}__${rel.version}`
/** 各版本可收合，預設只展開最新（第一筆） */
const expandedVersions = ref<Set<string>>(new Set(changelog.length ? [releaseKey(changelog[0])] : []))
function isVersionExpanded(version: string): boolean {
  return expandedVersions.value.has(version)
}
function toggleVersion(version: string): void {
  const next = new Set(expandedVersions.value)
  if (next.has(version)) next.delete(version)
  else next.add(version)
  expandedVersions.value = next
}

/** 複製該版更新內容（版次／模組／日期＋分組條列）為純文字 */
function copyRelease(rel: ChangelogRelease): void {
  const lines: string[] = [`${rel.version} · ${rel.module} · ${rel.date}`, '']
  rel.groups.forEach((g) => {
    lines.push(`【${g.title}】`)
    g.items.forEach((it) => lines.push(`- ${it}`))
    lines.push('')
  })
  navigator.clipboard?.writeText(lines.join('\n').trim())
  showSuccess({ detail: '已複製更新內容' })
}
</script>

<template>
  <!-- 對齊正式專案：header 走 bg-surface token、px-4 py-2.5、無底框（靠底色與內容區分層）。
       左區允許縮收（min-w-0 + flex-1）讓右區 3 顆 icon 永遠顯示 -->
  <div class="flex items-center justify-between shrink-0 w-full bg-surface-0 dark:bg-surface-900 px-4 py-2.5 gap-2">
    <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
      <!-- 對齊正式專案：Logo 僅圖，商店名稱改放 Logo 旁大字可點切換 -->
      <RouterLink
        to="/"
        class="flex items-center shrink-0"
      >
        <Logo :width="40" />
      </RouterLink>

      <!-- 商店名稱：大字 text-xl、可點開選單切換商店（去掉「目前在：」前綴，對齊正式專案 TopBarBrand） -->
      <Button
        v-if="shops.length > 0"
        text
        severity="secondary"
        class="min-w-0 shrink px-2"
        :aria-label="t('topbar.switchable_shops')"
        @click="toggleShopMenu"
      >
        <span class="font-medium text-xl truncate max-w-[140px] sm:max-w-60">{{ currentShop?.name ?? '-' }}</span>
        <FontAwesomeIcon
          :icon="['far', 'chevron-down']"
          class="text-xs shrink-0 ml-1"
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

      <!-- 側邊欄開關 + 進入商家管理 併成一組靠左（對齊正式專案左側 pill group） -->
      <div class="flex items-center gap-1 shrink-0">
        <Button
          rounded
          size="small"
          severity="secondary"
          class="transition-all duration-200"
          :class="{
            'rotate-180': !configStore.isSidebarExpanded
          }"
          @click="configStore.toggleSidebar"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['far', 'chevron-left']" />
          </template>
        </Button>
        <Button
          rounded
          size="small"
          severity="secondary"
          variant="text"
          v-tooltip.bottom="isMerchantManagementMode ? t('layout.button.back_to_main') : t('nav.merchant_management.merchant_management')"
          @click="handleClickMerchantManagement"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['far', isMerchantManagementMode ? 'shop' : 'city']" />
          </template>
        </Button>
      </div>
      <div id="topbar-left-slot" />

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

    <!-- 更新內容 Dialog：人工維護的更新日誌（版次 + 修改畫面 + 白話條列） -->
    <Dialog
      v-model:visible="changelogDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(600px, calc(100vw - 32px))' }"
    >
      <template #header>
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-lg font-bold text-[var(--p-text-color)]">更新內容</span>
          <!-- 依功能畫面（模組）篩選版本 -->
          <Select
            v-model="selectedModule"
            :options="moduleOptions"
            size="small"
            class="!w-[150px]"
          />
        </div>
      </template>
      <div v-if="filteredChangelog.length === 0" class="text-sm text-[var(--p-text-muted-color)] py-4 text-center">
        尚無更新紀錄
      </div>
      <div v-else class="flex flex-col gap-6 max-h-[70vh] overflow-y-auto pr-1">
        <section
          v-for="(rel, i) in filteredChangelog"
          :key="releaseKey(rel)"
          class="flex flex-col gap-3"
          :class="i > 0 ? 'pt-6 border-t border-[var(--p-content-border-color)]' : ''"
        >
          <!-- 版次標頭（可點收合）：chevron + 版次 + 版號說明 info + 修改畫面 + 日期 -->
          <div
            class="flex items-center gap-2 flex-wrap cursor-pointer select-none"
            role="button"
            tabindex="0"
            :aria-expanded="isVersionExpanded(releaseKey(rel))"
            @click="toggleVersion(releaseKey(rel))"
            @keydown.enter.prevent="toggleVersion(releaseKey(rel))"
            @keydown.space.prevent="toggleVersion(releaseKey(rel))"
          >
            <i
              class="pi text-[var(--p-text-muted-color)]"
              :class="isVersionExpanded(releaseKey(rel)) ? 'pi-chevron-down' : 'pi-chevron-right'"
              style="font-size: 12px"
            ></i>
            <span class="text-base font-bold text-[var(--p-primary-color)]">{{ rel.version }}</span>
            <button
              type="button"
              class="inline-flex items-center justify-center text-[var(--p-text-muted-color)] hover:text-[var(--p-primary-color)] cursor-pointer bg-transparent border-0 p-0"
              aria-label="版號說明"
              @click.stop="toggleVersionInfo"
            >
              <i class="pi pi-info-circle" style="font-size: 13px"></i>
            </button>
            <button
              type="button"
              v-tooltip.top="'複製更新內容'"
              class="inline-flex items-center justify-center text-[var(--p-text-muted-color)] hover:text-[var(--p-primary-color)] cursor-pointer bg-transparent border-0 p-0"
              aria-label="複製更新內容"
              @click.stop="copyRelease(rel)"
            >
              <i class="pi pi-copy" style="font-size: 13px"></i>
            </button>
            <Tag :value="rel.module" />
            <span class="text-xs text-[var(--p-text-muted-color)] ml-auto">{{ rel.date }}</span>
          </div>
          <!-- 分組白話條列（收合時隱藏） -->
          <template v-if="isVersionExpanded(releaseKey(rel))">
            <div v-for="g in rel.groups" :key="g.title" class="flex flex-col gap-2">
              <span class="text-sm font-bold text-[var(--p-text-color)]">{{ g.title }}</span>
              <ul class="list-disc pl-5 flex flex-col gap-2">
                <li
                  v-for="(item, ii) in g.items"
                  :key="ii"
                  class="text-[13px] text-[var(--p-text-color)] leading-relaxed"
                >{{ item }}</li>
              </ul>
            </div>
          </template>
        </section>
      </div>

      <!-- 版號說明 Popover（點版次旁 info 開啟）：語意化版本 主版號.次版號.修訂號 -->
      <Popover ref="versionInfoPopover">
        <div class="flex flex-col gap-2 max-w-[280px]">
          <span class="text-sm font-bold text-[var(--p-text-color)]">版號說明</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">格式：主版號.次版號.修訂號</span>
          <ul class="flex flex-col gap-1 text-[13px] text-[var(--p-text-color)] leading-relaxed">
            <li><span class="font-bold">主版號</span>：重大／不相容的大改版</li>
            <li><span class="font-bold">次版號</span>：新增功能（舊功能照常可用）</li>
            <li><span class="font-bold">修訂號</span>：修 bug／小調整</li>
          </ul>
          <span class="text-xs text-[var(--p-text-muted-color)] leading-relaxed">
            左邊數字進位時右邊歸零，例：1.4.3 →（新功能）→ 1.5.0
          </span>
        </div>
      </Popover>
    </Dialog>

    <!-- 右區 3 顆 icon 永遠顯示，shrink-0 避免被左區擠掉 -->
    <div class="inline-flex items-center h-10 gap-2 sm:gap-4 shrink-0">
      <div
        id="topbar-right-slot"
        class="inline-flex gap-4"
      />
      <!-- 進入商城前台：對齊正式專案放右區（主題/語系左側），icon-only + tooltip -->
      <Button
        rounded
        severity="contrast"
        variant="text"
        v-tooltip.bottom="t('topbar.front_view')"
        @click="handleFrontView"
      >
        <template #icon>
          <FontAwesomeIcon :icon="['far', 'store']" />
        </template>
      </Button>
      <ThemeSwitcher />
      <LanguageSelector />
      <DropdownMenu
        icon="user"
        :model="items"
      />
    </div>
  </div>
</template>
