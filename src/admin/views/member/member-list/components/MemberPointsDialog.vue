<script setup lang="ts">
/*
 * ⚠️ mock 版面預覽：紅利點數彈窗。點數歷程為 deterministic 假算式；補 / 扣點為本地 stub，未接後端。
 */
import type { MockMemberRow } from '../mock/mockMembers';
import { formatSpend } from '../utils/mockMemberDisplay';
import { formatDateTime, genMemberPointHistory, type MockPointHistory } from '../utils/mockMemberDetail';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  member: MockMemberRow | null;
}

const props = defineProps<Props>();
const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

/** 本地點數餘額（stub，調整不接後端）。 */
const localPoints = ref(0);
const localHistory = ref<MockPointHistory[]>([]);
const adjustType = ref<'add' | 'sub'>('add');
const adjustAmount = ref<number | null>(null);
/** 點數有效天數（自發放日起算）；預設 365。 */
const adjustValidDays = ref<number | null>(365);
const adjustReason = ref('');

const typeOptions = computed(() => [
  { label: t('member.points.add'), value: 'add' as const },
  { label: t('member.points.sub'), value: 'sub' as const },
]);

// 切換會員時重置本地狀態
watch(
  () => props.member,
  (member) => {
    localPoints.value = member?.points ?? 0;
    localHistory.value = member ? genMemberPointHistory(member) : [];
    adjustType.value = 'add';
    adjustAmount.value = null;
    adjustValidDays.value = 365;
    adjustReason.value = '';
  },
  { immediate: true },
);

/** 調整後預覽點數；未輸入正整數時回 null。 */
const afterPoints = computed(() => {
  const amount = adjustAmount.value ?? 0;
  if (amount <= 0) return null;
  return adjustType.value === 'add' ? localPoints.value + amount : Math.max(0, localPoints.value - amount);
});

const headerText = computed(() =>
  props.member
    ? `${t('member.points.title')} — ${props.member.name}（${props.member.no}）`
    : t('member.points.title'),
);

/** 補 / 扣點（stub，僅更新本地餘額與歷程）。 */
function handleConfirm() {
  const amount = adjustAmount.value ?? 0;
  if (amount <= 0) return;

  const before = localPoints.value;
  localPoints.value = adjustType.value === 'add' ? before + amount : Math.max(0, before - amount);

  localHistory.value.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    typeKey: adjustType.value === 'add' ? 'manual_add' : 'manual_sub',
    amount: localPoints.value - before,
    balance: localPoints.value,
    note: adjustReason.value.trim(),
  });

  adjustAmount.value = null;
  adjustValidDays.value = 365;
  adjustReason.value = '';
  showSuccess({ detail: t('member.points.adjust_stub') });
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="headerText"
    :style="{ width: '42rem', maxWidth: '95vw' }"
    :pt="{ content: { class: 'max-h-[75vh] overflow-y-auto' } }"
  >
    <div class="bg-primary/10 text-primary mb-4 flex items-baseline gap-2 rounded-md px-4 py-3">
      {{ $t('member.points.current') }}
      <b class="text-2xl font-bold tabular-nums">{{ formatSpend(localPoints) }}</b>
      {{ $t('member.points.unit') }}
    </div>

    <span class="text-muted-color mb-2 block text-sm">{{ $t('member.points.adjust') }}</span>
    <SelectButton
      v-model="adjustType"
      :options="typeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
    />

    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <label
          for="points-amount"
          class="text-sm font-medium"
        >{{ $t('member.points.field_amount') }} <span class="text-red-500">*</span></label>
        <InputNumber
          v-model="adjustAmount"
          input-id="points-amount"
          :min="1"
          :placeholder="$t('member.points.amount_placeholder')"
          show-buttons
          button-layout="horizontal"
          fluid
        >
          <template #incrementbuttonicon>
            <i class="pi pi-plus" />
          </template>
          <template #decrementbuttonicon>
            <i class="pi pi-minus" />
          </template>
        </InputNumber>
      </div>
      <div class="flex flex-col gap-2">
        <label
          for="points-valid-days"
          class="text-sm font-medium"
        >{{ $t('member.points.field_valid_days') }} <span class="text-red-500">*</span></label>
        <InputNumber
          v-model="adjustValidDays"
          input-id="points-valid-days"
          :min="1"
          fluid
        />
        <small class="text-muted-color text-xs">{{ $t('member.points.valid_days_help') }}</small>
      </div>
    </div>

    <InputText
      v-model="adjustReason"
      class="mt-4 w-full"
      :placeholder="$t('member.points.reason_placeholder')"
    />

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p
        v-if="afterPoints !== null"
        class="text-muted-color text-sm"
      >
        {{ $t('member.points.preview', { after: formatSpend(afterPoints), before: formatSpend(localPoints) }) }}
      </p>
      <span v-else />
      <Button
        :label="$t('common.button.confirm')"
        :disabled="!adjustAmount || adjustAmount <= 0 || !adjustValidDays || adjustValidDays <= 0"
        @click="handleConfirm"
      />
    </div>

    <p class="section-title">{{ $t('member.points.history') }}</p>
    <DataTable
      :value="localHistory"
      data-key="id"
      size="small"
      striped-rows
      scrollable
      scroll-height="20rem"
    >
      <Column :header="$t('member.points.column.time')">
        <template #body="{ data }">
          <span class="text-muted-color whitespace-nowrap">{{ formatDateTime(data.date) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.points.column.type')">
        <template #body="{ data }">{{ $t(`member.points.type.${data.typeKey}`) }}</template>
      </Column>
      <Column :header="$t('member.points.column.change')">
        <template #body="{ data }">
          <span
            class="font-semibold tabular-nums"
            :class="data.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >{{ data.amount >= 0 ? '+' : '' }}{{ formatSpend(data.amount) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.points.column.balance')">
        <template #body="{ data }">
          <span class="tabular-nums">{{ formatSpend(data.balance) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.points.column.note')">
        <template #body="{ data }">
          <span :class="{ 'text-muted-color': !data.note }">{{ data.note || '-' }}</span>
        </template>
      </Column>
      <template #empty>
        <div class="text-muted-color py-12 text-center text-sm">
          {{ $t('member.points.empty') }}
        </div>
      </template>
    </DataTable>

    <template #footer>
      <Button
        :label="$t('common.button.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@reference "tailwindcss";

.section-title {
  @apply mt-5 mb-2.5 border-b pb-1.5 text-sm font-semibold;
  color: var(--p-text-muted-color);
  border-color: var(--p-content-border-color);
}
</style>
