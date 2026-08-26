<script setup lang="ts">
import { BINDING_CHANNELS } from '../utils/mockMemberDisplay';
import type {
  BindingChannelKey,
  MemberKeywordField,
  MemberMockFilter,
  MockMemberLevel,
  MockMemberStatus,
} from '../mock/mockMembers';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  /** 雙向繫結的搜尋條件 */
  modelValue: MemberMockFilter;
}

interface Emits {
  (e: 'update:modelValue', value: MemberMockFilter): void;
  (e: 'apply'): void;
  (e: 'reset'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const filter = computed({
  get: () => props.modelValue,
  set: (value: MemberMockFilter) => emit('update:modelValue', value),
});

const keywordFieldOptions = computed<{ label: string; value: MemberKeywordField }[]>(() => [
  { label: t('member.filter.keyword_field.name'), value: 'name' },
  { label: t('member.filter.keyword_field.code'), value: 'code' },
  { label: t('member.filter.keyword_field.phone'), value: 'phone' },
]);

/** 依所選欄位給輸入框對應的 placeholder。 */
const keywordPlaceholder = computed(() =>
  t(`member.filter.keyword_placeholder_by_field.${filter.value.keywordField}`),
);

const levelOptions = computed<{ label: string; value: MockMemberLevel }[]>(() => [
  { label: t('member.level.normal'), value: 'normal' },
  { label: t('member.level.bronze'), value: 'bronze' },
  { label: t('member.level.silver'), value: 'silver' },
  { label: t('member.level.gold'), value: 'gold' },
]);

/** 下拉「全部」的 sentinel；送出前轉回 null（篩選層以 null 代表不限）。 */
const ALL = 'all' as const;

const statusOptions = computed<{ label: string; value: MockMemberStatus | typeof ALL }[]>(() => [
  { label: t('member.status.all'), value: ALL },
  { label: t('member.status.normal'), value: 'normal' },
  { label: t('member.status.suspended'), value: 'suspended' },
]);

const starOptions = computed<{ label: string; value: number | typeof ALL }[]>(() => [
  { label: t('member.stars.all'), value: ALL },
  ...[5, 4, 3, 2, 1].map((count) => ({ label: t('member.stars.rating', { count }), value: count })),
]);

const bindingOptions = computed(() =>
  BINDING_CHANNELS.map((channel) => ({ label: channel.nameKey ? t(channel.nameKey) : channel.name ?? '', value: channel.key })),
);

/** 綁定管道所有選項的值集合，供面板頂端「全部」全選 checkbox 使用。 */
const allBindingValues = computed<BindingChannelKey[]>(() =>
  bindingOptions.value.map((option) => option.value),
);

/** 「全部」checkbox 的勾選狀態：所有管道皆選取時為 true。 */
const allBindingsSelected = computed(
  () =>
    allBindingValues.value.length > 0 &&
    filter.value.bindings.length === allBindingValues.value.length,
);

/** 切換「全部」：勾選時選滿所有管道，取消時清空。 */
function toggleAllBindings(checked: boolean) {
  update('bindings', checked ? [...allBindingValues.value] : []);
}

/** 取單一管道的顯示名稱（供觸發列 chip 用）。 */
function bindingLabel(key: BindingChannelKey): string {
  return bindingOptions.value.find((option) => option.value === key)?.label ?? key;
}

/** 從已選管道移除單一項（觸發列 chip 的 ✕）。 */
function removeBinding(key: BindingChannelKey) {
  update(
    'bindings',
    filter.value.bindings.filter((selected) => selected !== key),
  );
}

/** 更新單一篩選欄位（維持不可變更新，觸發 v-model）。 */
function update<K extends keyof MemberMockFilter>(key: K, value: MemberMockFilter[K]) {
  filter.value = { ...filter.value, [key]: value };
}

/** 關鍵字按 Enter 等同按「搜尋」。 */
function handleKeywordEnter() {
  emit('apply');
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-2">
      <InputGroup class="w-full sm:w-auto">
        <Select
          :model-value="filter.keywordField"
          :options="keywordFieldOptions"
          option-label="label"
          option-value="value"
          class="w-44 shrink-0"
          :aria-label="t('member.filter.keyword_field_label')"
          @update:model-value="(value: MemberKeywordField) => update('keywordField', value)"
        />
        <InputText
          :model-value="filter.keyword"
          class="w-full sm:w-64"
          :placeholder="keywordPlaceholder"
          :aria-label="keywordPlaceholder"
          @update:model-value="(value: string | undefined) => update('keyword', value ?? '')"
          @keyup.enter="handleKeywordEnter"
        />
      </InputGroup>

      <Select
        :model-value="filter.level"
        :options="levelOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.level')"
        show-clear
        @update:model-value="(value: MockMemberLevel | null) => update('level', value)"
      />

      <Select
        :model-value="filter.status ?? ALL"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.status')"
        @update:model-value="(value: MockMemberStatus | typeof ALL) => update('status', value === ALL ? null : value)"
      />

      <Select
        :model-value="filter.stars ?? ALL"
        :options="starOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.stars')"
        @update:model-value="(value: number | typeof ALL) => update('stars', value === ALL ? null : value)"
      />

      <MultiSelect
        :model-value="filter.bindings"
        :options="bindingOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.bindings')"
        :show-toggle-all="false"
        show-clear
        class="w-full sm:w-64"
        @update:model-value="(value: BindingChannelKey[]) => update('bindings', value)"
      >
        <template #value="{ value, placeholder }">
          <span
            v-if="!value || value.length === 0"
            class="text-muted-color"
          >
            {{ placeholder }}
          </span>
          <span v-else-if="allBindingsSelected">
            {{ t('member.filter.binding_all') }}
          </span>
          <span
            v-else
            class="flex min-w-0 items-center gap-1 overflow-hidden"
          >
            <span
              v-for="key in value"
              :key="key"
              class="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--p-content-hover-background)] py-0.5 pl-2 pr-1 text-sm"
            >
              {{ bindingLabel(key) }}
              <button
                type="button"
                class="flex items-center text-muted-color hover:text-color"
                :aria-label="t('member.filter.binding_remove', { name: bindingLabel(key) })"
                @mousedown.stop.prevent
                @click.stop.prevent="removeBinding(key)"
              >
                <i class="pi pi-times-circle text-xs"></i>
              </button>
            </span>
          </span>
        </template>

        <template #header>
          <div class="flex items-center gap-2 px-4 pt-3 pb-1">
            <Checkbox
              :model-value="allBindingsSelected"
              input-id="member-binding-all"
              binary
              @update:model-value="(value: boolean) => toggleAllBindings(value)"
            />
            <label
              for="member-binding-all"
              class="cursor-pointer text-sm"
            >
              {{ t('member.filter.binding_all') }}
            </label>
          </div>
        </template>
      </MultiSelect>

      <DatePicker
        :model-value="filter.createdAtRange ?? undefined"
        selection-mode="range"
        date-format="yy/mm/dd"
        :placeholder="t('member.filter.label.created_at')"
        class="w-full sm:w-64"
        show-icon
        @update:model-value="(value: unknown) => update('createdAtRange', value as [Date, Date] | null)"
      />

      <div class="flex h-10 items-center gap-3">
        <div class="flex items-center gap-2">
          <Checkbox
            :model-value="filter.blacklistOnly"
            input-id="member-blacklist-only"
            binary
            @update:model-value="(value: boolean) => update('blacklistOnly', value)"
          />
          <label
            for="member-blacklist-only"
            class="cursor-pointer text-sm"
          >{{ $t('member.filter.blacklist_only') }}</label>
        </div>

        <div class="flex gap-2">
          <Button
            :label="t('common.button.search')"
            @click="emit('apply')"
          />
          <Button
            :label="t('common.button.clear')"
            severity="secondary"
            outlined
            @click="emit('reset')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
