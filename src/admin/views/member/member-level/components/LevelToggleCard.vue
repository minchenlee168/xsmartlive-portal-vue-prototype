<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { MemberLevelSetting } from '../types';
import {
  formatRecalculateCycleLabel,
  formatStatsPeriodLabel,
  formatStatsPeriodRange,
} from '../utils/statsPeriod';
import LevelDisableConfirmDialog from './LevelDisableConfirmDialog.vue';

/** 關閉功能的四條影響文案（i18n key）；逐條列出，讓使用者按下確定前看得到會失去什麼。 */
const DISABLE_EFFECT_KEYS = [
  'member_level.disable_setting.text.effect.all_members_base',
  'member_level.disable_setting.text.effect.discount_stops',
  'member_level.disable_setting.text.effect.benefits_stop',
  'member_level.disable_setting.text.effect.issued_unaffected',
] as const;

const props = defineProps<{
  /** 目前設定；載入完成前為 null，此時總開關停用 */
  setting: MemberLevelSetting | null;
  /** 寫入進行中；期間停用總開關防連點 */
  isSaving: boolean;
  /** 總開關的重掛序號，混入 `:key`；遞增即逼開關重掛回 `setting` 的實際值 */
  resyncToken: number;
}>();

const emit = defineEmits<{
  /** 使用者確定要切換總開關（關閉方向已通過二次確認） */
  change: [value: boolean];
  /** 使用者沒按確定就關掉停用確認窗；呼叫端據此讓開關退回實際設定 */
  'cancel-disable': [];
}>();

const { t } = useI18n();

const isConfirmVisible = ref(false);

const isEnabled = computed<boolean>(() => props.setting?.isEnabled ?? false);

const statsPeriodLabel = computed<string | null>(() => formatStatsPeriodLabel(props.setting, t));

const recalculateCycleLabel = computed<string | null>(() =>
  formatRecalculateCycleLabel(props.setting, t),
);

const statsPeriodRange = computed<string | null>(() => formatStatsPeriodRange(props.setting, t));

function handleToggle(value: boolean) {
  // 開啟不會讓任何人失去權益，直接送出；關閉才要二次確認
  if (value) {
    emit('change', true);
    return;
  }

  isConfirmVisible.value = true;
}
</script>

<template>
  <div class="rounded-lg border border-surface p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="font-medium">
          {{ $t('member_level.master.title') }}
        </p>
        <p class="mt-1 text-sm text-muted-color">
          {{ $t('member_level.master.description') }}
        </p>
      </div>
      <ToggleSwitch
        :key="props.resyncToken"
        :model-value="isEnabled"
        :aria-label="$t('member_level.master.title')"
        :disabled="props.setting === null || props.isSaving"
        @update:model-value="handleToggle"
      />
    </div>

    <div
      v-if="isEnabled && props.setting"
      class="mt-4 grid gap-4 border-t border-surface pt-4 sm:grid-cols-2"
    >
      <div>
        <p class="text-xs text-muted-color">
          {{ $t('member_level.master.label.stats_period') }}
        </p>
        <p class="mt-1 text-sm">
          {{ statsPeriodLabel }}
        </p>
        <p class="mt-0.5 text-xs text-muted-color">
          {{ statsPeriodRange }}
        </p>
      </div>

      <div>
        <p class="text-xs text-muted-color">
          {{ $t('member_level.master.label.recalculate') }}
        </p>
        <p class="mt-1 text-sm">
          {{ recalculateCycleLabel }}
        </p>
        <p class="mt-0.5 text-xs text-muted-color">
          {{ $t('member_level.master.text.recalculate_note') }}
        </p>
      </div>
    </div>

    <LevelDisableConfirmDialog
      v-model:visible="isConfirmVisible"
      :header="$t('member_level.disable_setting.title')"
      :lead="$t('member_level.disable_setting.text.lead')"
      :effect-keys="DISABLE_EFFECT_KEYS"
      :footnote="$t('member_level.disable_setting.text.footnote')"
      @confirm="emit('change', false)"
      @cancel="emit('cancel-disable')"
    />
  </div>
</template>
