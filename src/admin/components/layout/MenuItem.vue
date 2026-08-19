<script setup lang="ts">
import type { MenuItem } from '@/admin/constants/sidebarMenu';

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

const props = withDefaults(
  defineProps<{
    item: MenuItem
    index: number
    level: number
    parentPath?: string[]
    isExpanded?: boolean
  }>(),
  {
    parentPath: () => [],
    isExpanded: true,
  },
);

const router = useRouter();
const toast = useToast();

/** 規劃中項目點擊 → 跳出「此功能規劃中」toast，不導頁。 */
function onPlanningClick(): void {
  toast.add({ severity: 'info', summary: '此功能規劃中', life: 2000 });
}

const currentRouteMenuItems = defineModel<string[]>('currentRouteMenuItems', { default: () => [] });
const expandedMenuPath = defineModel<string[]>('expandMenuPath', { default: () => [] });

const itemPath = computed(() => [...props.parentPath, String(props.index)]);

// 標示目前路由是否為此選單項目（僅頁面連結）
const isActiveMenuItem = computed(() => props.item.to ? router.currentRoute.value.name === props.item.to : false);
// 標示目前路由所在層級的選單路徑是否為此項目
const isActiveMenuPath = computed(() => currentRouteMenuItems.value[props.level] === String(props.index));
// 標示此層級選單是否展開（用於子選單）
const isExpandedMenu = computed(() => expandedMenuPath.value[props.level] === String(props.index));
// 收合模式下只保留目前路由所在展開路徑的子選單 icon，避免全部節點都渲染
const shouldRenderChildren = computed(() => Boolean(props.item.items) && (props.isExpanded || isExpandedMenu.value));

function handleToggleExpandMenu() {
  if (!props.isExpanded) {
    return;
  }

  if (isExpandedMenu.value) {
    expandedMenuPath.value = itemPath.value.slice(0, -1);
    return;
  }

  expandedMenuPath.value = [...itemPath.value];
}

function resolveChildKey(child: MenuItem, index: number): string {
  return child.to ?? child.url ?? `${child.labelKey}-${index}`;
}
</script>

<template>
  <li>
    <!-- 有子選單的小標 -->
    <div
      v-if="item.items"
      class="flex items-center justify-between h-14 p-4 cursor-pointer hover:text-primary"
      :class="{
        'bg-primary text-white hover:text-white': level === 0 && isActiveMenuPath,
        'text-primary': level !== 0 && isActiveMenuPath
      }"
      @click="handleToggleExpandMenu"
    >
      <div class="flex items-center justify-center gap-2">
        <img
          v-if="item.imgSrc"
          :src="item.imgSrc"
          class="w-5 h-5 shrink-0"
          alt=""
        >
        <FontAwesomeIcon
          v-else-if="item.icon"
          :icon="item.icon"
        />
        <Transition name="menu-label">
          <span v-show="props.isExpanded">
            {{ $t(item.labelKey) }}
          </span>
        </Transition>
      </div>

      <Transition name="menu-label">
        <FontAwesomeIcon
          v-if="props.isExpanded"
          :icon="['far', 'chevron-down']"
          class="text-sm transition-all duration-200"
          :rotation="isExpandedMenu ? 180 : undefined"
        />
      </Transition>
    </div>

    <!-- 外部連結 -->
    <a
      v-if="item.url"
      :href="item.url"
      :target="item.target"
      tabindex="0"
      rel="noopener noreferrer"
      class="flex items-center h-14 p-4 gap-2 cursor-pointer hover:text-primary"
    >
      <img
        v-if="item.imgSrc"
        :src="item.imgSrc"
        class="w-5 h-5 shrink-0"
        alt=""
      >
      <FontAwesomeIcon
        v-else-if="item.icon"
        :icon="item.icon"
      />
      <Transition name="menu-label">
        <span
          v-if="props.isExpanded"
          class="flex items-center gap-1.5"
        >
          {{ $t(item.labelKey) }}
          <span
            v-if="item.badge"
            class="text-xs leading-none font-normal opacity-70 whitespace-nowrap"
          >
            {{ item.badge }}
          </span>
        </span>
      </Transition>
    </a>

    <!-- 規劃中：純按鈕，點擊跳 toast 不導頁 -->
    <button
      v-if="item.planning && !item.items"
      type="button"
      class="flex items-center w-full h-14 p-4 gap-2 cursor-pointer hover:text-primary text-left"
      @click="onPlanningClick"
    >
      <img
        v-if="item.imgSrc"
        :src="item.imgSrc"
        class="w-5 h-5 shrink-0"
        alt=""
      >
      <FontAwesomeIcon
        v-else-if="item.icon"
        :icon="item.icon"
      />
      <Transition name="menu-label">
        <span
          v-if="props.isExpanded"
          class="flex items-center gap-1.5"
        >
          {{ $t(item.labelKey) }}
          <span
            v-if="item.badge"
            class="text-xs leading-none font-normal opacity-70 whitespace-nowrap"
          >
            {{ item.badge }}
          </span>
        </span>
      </Transition>
    </button>

    <!-- 頁面連結 -->
    <RouterLink
      v-if="item.to && !item.items && !item.planning"
      :to="{ name: item.to }"
      tabindex="0"
      class="flex items-center h-14 p-4 gap-2 cursor-pointer hover:text-primary"
      :class="{
        'text-primary': isActiveMenuItem,
        'border-r-4 border-primary': props.isExpanded && isActiveMenuItem
      }"
    >
      <img
        v-if="item.imgSrc"
        :src="item.imgSrc"
        class="w-5 h-5 shrink-0"
        alt=""
      >
      <FontAwesomeIcon
        v-else-if="item.icon"
        :icon="item.icon"
      />
      <Transition name="menu-label">
        <span
          v-if="props.isExpanded"
          class="flex items-center gap-1.5"
        >
          {{ $t(item.labelKey) }}
          <span
            v-if="item.badge"
            class="text-xs leading-none font-normal opacity-70 whitespace-nowrap"
          >
            {{ item.badge }}
          </span>
        </span>
      </Transition>
    </RouterLink>

    <!-- 子選單 -->
    <Transition
      v-if="shouldRenderChildren"
      name="menu-item"
    >
      <ul
        v-show="isExpandedMenu"
        class="transition-all duration-200"
        :class="{
          'pl-4 bg-neutral-100 dark:bg-gray-900': props.isExpanded
        }"
      >
        <MenuItem
          v-for="(child, i) in item.items"
          :key="resolveChildKey(child, i)"
          v-model:current-route-menu-items="currentRouteMenuItems"
          v-model:expand-menu-path="expandedMenuPath"
          :index="i"
          :item="child"
          :level="level + 1"
          :parent-path="itemPath"
          :is-expanded="isExpanded"
        />
      </ul>
    </Transition>
  </li>
</template>

<style scoped>
.menu-item-enter-from,
.menu-item-leave-to {
  max-height: 0;
}

.menu-item-enter-to,
.menu-item-leave-from {
  max-height: 1000px;
}

.menu-item-leave-active {
  overflow: hidden;
  transition: max-height 0.2s cubic-bezier(0, 1, 0, 1);
}

.menu-item-enter-active {
  overflow: hidden;
  transition: max-height 1s ease-in-out;
}

.menu-label-enter-from,
.menu-label-leave-to {
  opacity: 0;
}

.menu-label-enter-to,
.menu-label-leave-from {
  opacity: 1;
}

.menu-label-enter-active {
  transition: all 0.1s ease 0.2s;
}
</style>
