<template>
  <Select
    :model-value="props.selected"
    :options="props.sessions"
    data-key="id"
    :placeholder="t('live_order.label.select_session')"
    class="session-select"
    :class="[isSelectedLive ? 'is-live' : '', size === 'lg' ? 'is-lg' : 'is-sm']"
    :pt="{
      root: { class: 'rounded-md' },
      label: { class: 'flex items-center' },
    }"
    @update:model-value="(v) => emit('select', v as LiveSession)"
  >
    <!-- 觸發按鈕內顯示：日期 + 場次名 +（收單中 → 紫色脈動 + 計時） -->
    <template #value="{ value }">
      <span class="flex items-center gap-2 text-[var(--p-text-color)] whitespace-nowrap">
        <i class="pi pi-calendar text-[var(--p-primary-color)]" :style="{ fontSize: size === 'lg' ? '14px' : '12.25px' }"></i>
        <span class="font-medium">{{ value ? `${(value as LiveSession).date} ${(value as LiveSession).name}` : t('live_order.label.select_session') }}</span>
        <template v-if="isSelectedLive">
          <span class="text-[var(--p-content-border-color)]">·</span>
          <i class="pi pi-circle-fill animate-pulse text-[var(--p-primary-color)]" style="font-size:8px"></i>
          <span class="font-bold text-[var(--p-primary-color)]">{{ t('live_order.label.live_ordering') }}</span>
          <span class="font-medium tabular-nums text-[var(--p-primary-color)]">{{ liveElapsed }}</span>
        </template>
      </span>
    </template>

    <!-- 選項：場次名 + 日期；正在收單時加紫色脈動點 -->
    <template #option="{ option }">
      <div class="flex flex-col min-w-0 w-full">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-[var(--p-text-color)] truncate">{{ (option as LiveSession).name }}</span>
          <i
            v-if="(option as LiveSession).products?.some((p: LiveSessionProduct) => p.status === 'live')"
            v-tooltip.top="t('live_order.tooltip.ordering_in_progress')"
            class="pi pi-circle-fill animate-pulse text-[var(--p-primary-color)]"
            style="font-size:8px"
          />
        </div>
        <span class="text-xs text-[var(--p-text-muted-color)]">{{ (option as LiveSession).date }}</span>
      </div>
    </template>

    <template #empty>
      <div class="px-3 py-6 text-center text-xs text-[var(--p-text-muted-color)]">
        {{ t('live_order.empty.no_session') }}
      </div>
    </template>

    <!-- 下方常駐「建立場次」按鈕 -->
    <template #footer>
      <div class="border-t border-[var(--p-content-border-color)] p-2">
        <Button
          :label="t('live_order.button.create_session')"
          icon="pi pi-plus"
          text
          severity="secondary"
          class="w-full !justify-center !text-[var(--p-primary-color)]"
          @click="emit('create')"
        />
      </div>
    </template>
  </Select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface LiveSessionProduct {
  id: number
  status?: string
  keyword?: string
  sku?: string
  [key: string]: unknown
}

interface LiveSession {
  id: number
  name: string
  date: string
  products?: LiveSessionProduct[]
  sources?: unknown[]
  [key: string]: unknown
}

interface Props {
  sessions?: LiveSession[]
  selected?: LiveSession | null
  size?: string
  liveElapsed?: string
}
const props = withDefaults(defineProps<Props>(), {
  sessions: () => [],
  selected: null,
  size: 'lg',
  liveElapsed: '',
})

const isSelectedLive = computed(() =>
  !!(props.selected?.products?.some(p => p.status === 'live'))
)
const emit = defineEmits<{
  select: [session: LiveSession]
  create: []
}>()
</script>

<style scoped>
/* 收單中 → 紫色主邊框 + 較寬最小寬；未收單 → 一般灰邊。
   高度不再強拉 32px，改用 PrimeVue Aura 元件原生高度 (~42px)。 */
.session-select :deep(.p-select) {
  border-color: var(--p-content-border-color);
  min-width: 220px;
}
.session-select.is-live :deep(.p-select) {
  border-color: var(--p-primary-400);
  min-width: 300px;
}
.session-select :deep(.p-select-dropdown) {
  width: 28px;
}
.session-select.is-lg :deep(.p-select-label) {
  font-size: 14px;
}
.session-select.is-sm :deep(.p-select-label) {
  font-size: 12.25px;
}
</style>
