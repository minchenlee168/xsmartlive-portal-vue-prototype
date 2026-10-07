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

/** 各版本可收合，預設只展開最新（第一筆） */
const expandedVersions = ref<Set<string>>(new Set(changelog.length ? [changelog[0].version] : []))
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
          :key="rel.version"
          class="flex flex-col gap-3"
          :class="i > 0 ? 'pt-6 border-t border-[var(--p-content-border-color)]' : ''"
        >
          <!-- 版次標頭（可點收合）：chevron + 版次 + 版號說明 info + 修改畫面 + 日期 -->
          <div
            class="flex items-center gap-2 flex-wrap cursor-pointer select-none"
            role="button"
            tabindex="0"
            :aria-expanded="isVersionExpanded(rel.version)"
            @click="toggleVersion(rel.version)"
            @keydown.enter.prevent="toggleVersion(rel.version)"
            @keydown.space.prevent="toggleVersion(rel.version)"
          >
            <i
              class="pi text-[var(--p-text-muted-color)]"
              :class="isVersionExpanded(rel.version) ? 'pi-chevron-down' : 'pi-chevron-right'"
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
          <template v-if="isVersionExpanded(rel.version)">
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
      <ThemeSwitcher />
      <LanguageSelector />
      <DropdownMenu
        icon="user"
        :model="items"
      />
    </div>
  </div>
</template>
