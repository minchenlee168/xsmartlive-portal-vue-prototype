<script setup lang="ts">
// 「進入商家管理」按鈕已移至 TopBar（對齊正式專案），故此處不再提供 sidebar 底部入口。
import Mask from '@/admin/components/portal-ui/Mask.vue';
import { useConfigStore } from '@/admin/stores/config';
import SidebarMenu from './SidebarMenu.vue';
import Logo from './Logo.vue';

import { computed, ref } from 'vue';

const configStore = useConfigStore();

const isSidebarHovering = ref(false);
const currentRouteMenuItems = ref<string[]>([]);
const expandedMenuPath = ref<string[]>([]);

const isSidebarHoverExpanded = computed(() => configStore.isSidebarExpanded || isSidebarHovering.value);
</script>

<template>
  <Transition name="fade">
    <Mask
      v-if="configStore.isSidebarExpanded"
      class="cursor-pointer sm:hidden"
      :class="[
        configStore.isSidebarExpanded ? '' : 'opacity-0 w-0 pointer-events-none'
      ]"
      @click="configStore.toggleSidebar"
    >
      <div
        class="flex flex-col h-full bg-white cursor-auto dark:bg-surface-900"
        :class="[
          configStore.isSidebarExpanded ? 'w-64' : 'w-0'
        ]"
        @click.stop
      >
        <div class="overflow-y-auto flex-1 [&::-webkit-scrollbar-track]:bg-transparent">
          <SidebarMenu
            v-model:current-route-menu-items="currentRouteMenuItems"
            v-model:expand-menu-path="expandedMenuPath"
            :is-expanded="isSidebarHoverExpanded"
          />
        </div>

        <!-- Powered by（對齊正式專案 sidebar footer）；行動版恆為展開態 -->
        <div class="shrink-0 flex items-center justify-center py-1.5 px-4">
          <span class="inline-flex items-center gap-1 text-xs text-[var(--p-text-muted-color)]">
            Powered by
            <span class="inline-flex items-center gap-1 font-medium">
              <Logo :width="13" />{{ $t('system.app_name') }}
            </span>
          </span>
        </div>
      </div>
    </Mask>
  </Transition>

  <div
    class="hidden relative shrink-0 sm:block"
    :class="[configStore.isSidebarExpanded ? 'w-64' : 'w-14']"
    @mouseenter="isSidebarHovering = true"
    @mouseleave="isSidebarHovering = false"
  >
    <div
      class="sidebar-panel flex flex-col relative h-full bg-white dark:bg-surface-900"
      :class="[
        configStore.isSidebarExpanded
          ? 'w-64 sidebar-panel--dock'
          : (
            isSidebarHovering
              ? 'absolute left-0 top-0 w-64 shadow-2xl sidebar-panel--overlay'
              : 'w-14 sidebar-panel--dock'
          )
      ]"
    >
      <div
        class="flex-1 [&::-webkit-scrollbar-track]:bg-transparent"
        :class="[
          (configStore.isSidebarExpanded || isSidebarHovering)
            ? 'overflow-y-auto'
            : 'overflow-y-hidden'
        ]"
      >
        <SidebarMenu
          v-model:current-route-menu-items="currentRouteMenuItems"
          v-model:expand-menu-path="expandedMenuPath"
          :is-expanded="isSidebarHoverExpanded"
        />
      </div>

      <!-- Powered by（對齊正式專案 sidebar footer）：展開顯示「Powered by + logo + 名稱」，收合只顯示 logo -->
      <div
        class="shrink-0 flex items-center justify-center py-1.5"
        :class="{ 'px-4': isSidebarHoverExpanded }"
      >
        <span
          v-if="isSidebarHoverExpanded"
          class="inline-flex items-center gap-1 text-xs text-[var(--p-text-muted-color)] whitespace-nowrap"
        >
          Powered by
          <span class="inline-flex items-center gap-1 font-medium">
            <Logo :width="13" />{{ $t('system.app_name') }}
          </span>
        </span>
        <Logo
          v-else
          :width="16"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  will-change: opacity, transform;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

.sidebar-panel {
  transition-property: width, box-shadow, z-index;
  transition-duration: 200ms, 200ms, 0ms;
  transition-timing-function: ease, ease, linear;
}

.sidebar-panel--dock {
  z-index: 0;
  transition-delay: 0ms, 0ms, 200ms;
}

.sidebar-panel--overlay {
  z-index: 50;
  transition-delay: 0ms, 0ms, 0ms;
}
</style>
