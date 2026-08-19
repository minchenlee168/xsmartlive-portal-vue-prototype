<script setup lang="ts">
/**
 * 儲存常用篩選 — 名稱輸入 Dialog
 * — 空名稱不可儲存；每次開啟時帶入預設名稱（已選條件以「-」連接），輸入框 ✕ 可一鍵清空
 * — 下方列出既有常用篩選，點選帶入名稱；同名儲存即覆蓋
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BidListSavedFilter } from '../composables/useBidListFilter';

interface Props {
  visible: boolean;
  savedFilters: BidListSavedFilter[];
  /** 開啟時帶入的預設名稱（由已選下拉選項文字以「-」連接） */
  defaultName: string;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'save', name: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const name = ref<string>('');

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) name.value = props.defaultName;
  },
);

/** 名稱與既有常用篩選相同時，儲存視為覆蓋 */
const isOverwrite = computed(() =>
  props.savedFilters.some((savedFilter) => savedFilter.name === name.value.trim()),
);

/** 常用篩選數量上限 10 個；已滿時僅能覆蓋既有篩選 */
const isAtLimit = computed(() => props.savedFilters.length >= 10 && !isOverwrite.value);

const canSave = computed(() => name.value.trim().length > 0 && !isAtLimit.value);

function handleSave() {
  if (!canSave.value) return;
  emit('save', name.value.trim());
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.saved_filter.dialog.title')"
    :style="{ width: '360px', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-2">
      <label
        for="bid-list-saved-filter-name"
        class="text-sm text-slate-700 dark:text-slate-200"
      >
        {{ t('bid_list.saved_filter.dialog.field.name') }}
      </label>
      <div class="relative">
        <InputText
          id="bid-list-saved-filter-name"
          v-model="name"
          :placeholder="t('bid_list.saved_filter.dialog.placeholder.name')"
          :maxlength="20"
          autofocus
          class="w-full pr-9"
          @keyup.enter="handleSave"
        />
        <button
          v-if="name.length > 0"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          :aria-label="t('bid_list.saved_filter.dialog.button.clear_name')"
          @click="name = ''"
        >
          <FontAwesomeIcon :icon="['fas', 'xmark']" />
        </button>
      </div>
      <span
        v-if="isAtLimit"
        class="text-xs text-amber-600 dark:text-amber-400"
      >
        {{ t('bid_list.saved_filter.dialog.hint.limit') }}
      </span>

      <template v-if="savedFilters.length > 0">
        <span class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ t('bid_list.saved_filter.dialog.label.existing') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="savedFilter in savedFilters"
            :key="savedFilter.id"
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="
              savedFilter.name === name.trim()
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
            "
            @click="name = savedFilter.name"
          >
            {{ savedFilter.name }}
          </button>
        </div>
        <span
          v-if="isOverwrite"
          class="text-xs text-amber-600 dark:text-amber-400"
        >
          {{ t('bid_list.saved_filter.dialog.hint.overwrite') }}
        </span>
      </template>

      <span class="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {{ t('bid_list.saved_filter.dialog.hint.scope') }}
      </span>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          text
          @click="localVisible = false"
        >
          {{ t('bid_list.saved_filter.dialog.button.cancel') }}
        </Button>
        <Button
          type="button"
          :disabled="!canSave"
          @click="handleSave"
        >
          {{
            isOverwrite
              ? t('bid_list.saved_filter.dialog.button.overwrite')
              : t('bid_list.saved_filter.dialog.button.save')
          }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
