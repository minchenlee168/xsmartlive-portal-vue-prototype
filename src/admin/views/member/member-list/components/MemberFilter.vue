<script setup lang="ts">
import { BINDING_CHANNELS } from '../utils/mockMemberDisplay';
import type { BindingChannelKey, MemberMockFilter, MockMemberLevel, MockMemberStatus } from '../mock/mockMembers';

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

const levelOptions = computed<{ label: string; value: MockMemberLevel }[]>(() => [
  { label: t('member.level.normal'), value: 'normal' },
  { label: t('member.level.bronze'), value: 'bronze' },
  { label: t('member.level.silver'), value: 'silver' },
  { label: t('member.level.gold'), value: 'gold' },
]);

const statusOptions = computed<{ label: string; value: MockMemberStatus }[]>(() => [
  { label: t('member.status.normal'), value: 'normal' },
  { label: t('member.status.suspended'), value: 'suspended' },
]);

const starOptions = computed<{ label: string; value: number }[]>(() =>
  [5, 4, 3, 2, 1].map((count) => ({ label: t('member.stars.rating', { count }), value: count })),
);

const bindingOptions = computed(() =>
  BINDING_CHANNELS.map((channel) => ({ label: channel.nameKey ? t(channel.nameKey) : channel.name ?? '', value: channel.key })),
);

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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <IconField>
        <InputIcon>
          <FontAwesomeIcon :icon="['far', 'search']" />
        </InputIcon>
        <InputText
          :model-value="filter.keyword"
          class="w-full"
          :placeholder="t('member.filter.keyword_placeholder')"
          @update:model-value="(value: string | undefined) => update('keyword', value ?? '')"
          @keyup.enter="handleKeywordEnter"
        />
      </IconField>

      <Select
        :model-value="filter.level"
        :options="levelOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.level')"
        show-clear
        class="w-full"
        @update:model-value="(value: MockMemberLevel | null) => update('level', value)"
      />

      <Select
        :model-value="filter.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.status')"
        show-clear
        class="w-full"
        @update:model-value="(value: MockMemberStatus | null) => update('status', value)"
      />

      <Select
        :model-value="filter.stars"
        :options="starOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.stars')"
        show-clear
        class="w-full"
        @update:model-value="(value: number | null) => update('stars', value)"
      />

      <MultiSelect
        :model-value="filter.bindings"
        :options="bindingOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('member.filter.label.bindings')"
        :max-selected-labels="2"
        show-clear
        class="w-full"
        @update:model-value="(value: BindingChannelKey[]) => update('bindings', value)"
      />

      <DatePicker
        :model-value="filter.createdAtRange ?? undefined"
        selection-mode="range"
        date-format="yy/mm/dd"
        :placeholder="t('member.filter.label.created_at')"
        class="w-full"
        show-icon
        @update:model-value="(value: unknown) => update('createdAtRange', value as [Date, Date] | null)"
      />

      <div class="flex h-10 items-center gap-3 lg:col-span-2">
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
