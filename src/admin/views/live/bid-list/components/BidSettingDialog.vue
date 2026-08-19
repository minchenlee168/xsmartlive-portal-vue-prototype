<script setup lang="ts">
/**
 * 標單設定 Dialog
 * — 得標清單「自動棄標」相關設定（mockup 版）
 * — 設定值存於元件內 ref，重開 dialog 保留本 session 值（不重置）
 * — 主開關關閉時，下方所有欄位 disabled 反灰
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

interface Props {
  visible: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 自動棄標主開關；關閉時下方所有欄位 disabled */
const autoDiscardEnabled = ref<boolean>(false);

/** 棄標時機 — 得標後超過 N 單位未完成即自動棄標 */
const autoDiscardValue = ref<number>(3);
/** 棄標時機單位：hour／day */
const autoDiscardUnit = ref<'hour' | 'day'>('day');

/** 適用範圍（排除項）— 預設排除預購標單 */
const excludePreorder = ref<boolean>(true);
const excludeManualBid = ref<boolean>(false);

/** 保護條件：金額門檻開關 + 金額 */
const amountThresholdEnabled = ref<boolean>(false);
const amountThreshold = ref<number>(5000);

/** 自動催單：得標後超過 N 小時發送催單通知 */
const autoNotifyEnabled = ref<boolean>(false);
const autoNotifyHours = ref<number>(2);

/** 棄標前緩衝：到期前自動催單（X 小時；FB 互動訊息 24 小時限制，上限 23） */
const preDiscardNotifyEnabled = ref<boolean>(false);
const preDiscardNotifyHours = ref<number>(6);

/** 棄標後動作：累計棄標紀錄 */
const blacklistThresholdEnabled = ref<boolean>(false);
const blacklistThresholdCount = ref<number>(3);

/**
 * 建立指定時分的 Date（供 DatePicker timeOnly 綁定；只取時分、日期部分不使用）。
 *
 * @param hours 時（0-23）
 * @param minutes 分（0-59）
 * @returns 對應時分的 Date
 */
function makeTime(hours: number, minutes: number): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** 自動催單卡：靜音時間（永遠啟用，避免夜間發送通知擾人；主開關關閉時反灰） */
const autoNotifyMuteStart = ref<Date>(makeTime(22, 0));
const autoNotifyMuteEnd = ref<Date>(makeTime(8, 0));

/** 自動棄標卡：靜音時間（永遠啟用，避免夜間發送通知擾人；主開關關閉時反灰） */
const preDiscardMuteStart = ref<Date>(makeTime(22, 0));
const preDiscardMuteEnd = ref<Date>(makeTime(8, 0));

const unitOptions = computed(() => [
  { value: 'hour', label: t('bid_list.bid_setting.form.unit.hour') },
  { value: 'day', label: t('bid_list.bid_setting.form.unit.day') },
]);

/** 是否 disabled（主開關關閉時全部 disabled 反灰） */
const isFieldDisabled = computed(() => !autoDiscardEnabled.value);

/** 棄標時機換算為小時 */
const autoDiscardTotalHours = computed(() =>
  autoDiscardUnit.value === 'day' ? autoDiscardValue.value * 24 : autoDiscardValue.value,
);

/** 棄標時機超過 1 天 23 小時（47 小時）時，最後通知超出 FB 互動訊息 24 小時可發送範圍，棄標前自動催單停用 */
const isPreDiscardNotifyLocked = computed(() => autoDiscardTotalHours.value > 47);

function handleSave() {
  showSuccess({ detail: t('bid_list.bid_setting.toast.saved') });
  localVisible.value = false;
}

function handleCancel() {
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.bid_setting.title')"
    :style="{ width: '640px', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-5">
      <!-- 自動催單卡（獨立功能，不受自動棄標主開關影響） -->
      <div class="flex flex-col gap-2">
        <!-- 標題灰底塊（比照自動棄標主開關，switch 靠右） -->
        <div class="flex items-start justify-between gap-4 rounded bg-slate-50 px-4 py-3 dark:bg-slate-800">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {{ t('bid_list.bid_setting.form.section.auto_notify') }}
            </span>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.bid_setting.form.hint.auto_notify') }}
            </span>
          </div>
          <ToggleSwitch v-model="autoNotifyEnabled" />
        </div>
        <div class="flex flex-wrap items-center gap-2 pl-1">
          <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.bid_setting.form.hint.auto_notify_prefix') }}
          </span>
          <div class="flex shrink-0 items-center gap-2">
            <InputNumber
              v-model="autoNotifyHours"
              :disabled="!autoNotifyEnabled"
              :min="1"
              :max="23"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '3.5rem', textAlign: 'center' }"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'minus']" />
              </template>
            </InputNumber>
            <span class="text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.auto_notify_suffix') }}
            </span>
          </div>
        </div>
        <span class="pl-1 text-xs text-slate-400 dark:text-slate-500">
          {{ t('bid_list.bid_setting.form.hint.auto_notify_conflict') }}
        </span>

        <!-- 靜音時間（永遠啟用，避免夜間擾人；主開關關閉時反灰） -->
        <div
          class="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-700"
          :class="{ 'opacity-50 pointer-events-none': !autoNotifyEnabled }"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ t('bid_list.bid_setting.form.section.mute_time') }}
              </span>
              <button
                type="button"
                v-tooltip.top="t('bid_list.bid_setting.form.hint.mute_time_tooltip')"
                class="text-slate-400 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors cursor-pointer"
                :aria-label="t('bid_list.bid_setting.form.hint.mute_time_tooltip')"
              >
                <FontAwesomeIcon :icon="['fas', 'circle-question']" />
              </button>
            </div>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.bid_setting.form.hint.mute_time_hint') }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 pl-1">
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.field.mute_time_start') }}
            </span>
            <DatePicker
              v-model="autoNotifyMuteStart"
              time-only
              hour-format="24"
              :disabled="!autoNotifyEnabled"
              fluid
              class="w-28"
            />
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.field.mute_time_separator') }}
            </span>
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.field.mute_time_end') }}
            </span>
            <DatePicker
              v-model="autoNotifyMuteEnd"
              time-only
              hour-format="24"
              :disabled="!autoNotifyEnabled"
              fluid
              class="w-28"
            />
          </div>
        </div>
      </div>

      <!-- 分隔線：自動催單 / 自動棄標 -->
      <div class="border-t border-slate-200 dark:border-slate-700" />

      <!-- 自動棄標卡 -->
      <div class="flex flex-col gap-5">
      <!-- 主開關（標題灰底塊，switch 靠右） -->
      <div
        class="flex items-start justify-between gap-4 rounded bg-slate-50 px-4 py-3 dark:bg-slate-800"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ t('bid_list.bid_setting.form.section.main_switch') }}
          </span>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('bid_list.bid_setting.form.hint.main_switch') }}
          </span>
        </div>
        <ToggleSwitch v-model="autoDiscardEnabled" />
      </div>

      <!-- 棄標時機 -->
      <div
        class="flex flex-col gap-3"
        :class="{ 'opacity-50 pointer-events-none': isFieldDisabled }"
      >
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.bid_setting.form.section.timing') }}
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm text-slate-700 dark:text-slate-200">
            {{ t('bid_list.bid_setting.form.field.auto_discard_after') }}
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.after_win_prefix') }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <InputNumber
                v-model="autoDiscardValue"
                :disabled="isFieldDisabled"
                :min="1"
                :max="999"
                show-buttons
                button-layout="horizontal"
                :input-style="{ width: '3.5rem', textAlign: 'center' }"
              >
                <template #incrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                </template>
                <template #decrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'minus']" />
                </template>
              </InputNumber>
              <Select
                v-model="autoDiscardUnit"
                :options="unitOptions"
                option-label="label"
                option-value="value"
                :disabled="isFieldDisabled"
                class="w-24"
              />
            </div>
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.after_win_suffix') }}
            </span>
          </div>
        </div>

      </div>

      <!-- 棄標前緩衝（受棄標時機 47 小時互鎖） -->
      <div class="flex flex-col gap-2">
        <div
          class="flex flex-col gap-2"
          :class="{ 'opacity-50 pointer-events-none': isFieldDisabled || isPreDiscardNotifyLocked }"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ t('bid_list.bid_setting.form.section.pre_discard_notify') }}
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.bid_setting.form.hint.pre_discard_notify') }}
              </span>
            </div>
            <ToggleSwitch
              v-model="preDiscardNotifyEnabled"
              :disabled="isFieldDisabled || isPreDiscardNotifyLocked"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 pl-1">
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.pre_discard_prefix') }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <InputNumber
                v-model="preDiscardNotifyHours"
                :disabled="isFieldDisabled || isPreDiscardNotifyLocked || !preDiscardNotifyEnabled"
                :min="1"
                :max="23"
                show-buttons
                button-layout="horizontal"
                :input-style="{ width: '3.5rem', textAlign: 'center' }"
              >
                <template #incrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                </template>
                <template #decrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'minus']" />
                </template>
              </InputNumber>
              <span class="text-sm text-slate-600 dark:text-slate-300">
                {{ t('bid_list.bid_setting.form.hint.pre_discard_suffix') }}
              </span>
            </div>
          </div>
        </div>
        <span
          v-if="!isFieldDisabled && isPreDiscardNotifyLocked"
          class="pl-1 text-xs text-amber-600 dark:text-amber-400"
        >
          {{ t('bid_list.bid_setting.form.hint.pre_discard_locked') }}
        </span>
      </div>

      <!-- 適用範圍（排除項） -->
      <div
        class="flex flex-col gap-2"
        :class="{ 'opacity-50 pointer-events-none': isFieldDisabled }"
      >
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.bid_setting.form.section.scope') }}
        </div>
        <span class="text-xs text-slate-500 dark:text-slate-400">
          {{ t('bid_list.bid_setting.form.hint.scope') }}
        </span>
        <div class="flex flex-col gap-2 pl-1">
          <div class="flex items-center gap-2">
            <Checkbox
              v-model="excludePreorder"
              input-id="bid-setting-exclude-preorder"
              :disabled="isFieldDisabled"
              binary
            />
            <label
              for="bid-setting-exclude-preorder"
              class="text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {{ t('bid_list.bid_setting.form.field.exclude_preorder') }}
            </label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox
              v-model="excludeManualBid"
              input-id="bid-setting-exclude-manual-bid"
              :disabled="isFieldDisabled"
              binary
            />
            <label
              for="bid-setting-exclude-manual-bid"
              class="text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {{ t('bid_list.bid_setting.form.field.exclude_manual_bid') }}
            </label>
          </div>
        </div>
      </div>

      <!-- 保護條件 -->
      <div
        class="flex flex-col gap-2"
        :class="{ 'opacity-50 pointer-events-none': isFieldDisabled }"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {{ t('bid_list.bid_setting.form.section.amount_threshold') }}
            </span>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.bid_setting.form.hint.amount_threshold') }}
            </span>
          </div>
          <ToggleSwitch
            v-model="amountThresholdEnabled"
            :disabled="isFieldDisabled"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2 pl-1">
          <label class="shrink-0 text-sm text-slate-700 dark:text-slate-200">
            {{ t('bid_list.bid_setting.form.field.amount_threshold') }}
          </label>
          <div class="flex shrink-0 items-center gap-2">
            <InputNumber
              v-model="amountThreshold"
              :disabled="isFieldDisabled || !amountThresholdEnabled"
              :min="0"
              :max="9999999"
              :step="100"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '5rem', textAlign: 'center' }"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'minus']" />
              </template>
            </InputNumber>
            <span class="text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.currency_yuan') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 棄標後動作 -->
      <div
        class="flex flex-col gap-3"
        :class="{ 'opacity-50 pointer-events-none': isFieldDisabled }"
      >
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.bid_setting.form.section.post_discard') }}
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-sm text-slate-700 dark:text-slate-200">
                {{ t('bid_list.bid_setting.form.field.blacklist_threshold') }}
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.bid_setting.form.hint.blacklist_threshold') }}
              </span>
            </div>
            <ToggleSwitch
              v-model="blacklistThresholdEnabled"
              :disabled="isFieldDisabled"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 pl-1">
            <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.bid_setting.form.hint.blacklist_prefix') }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <InputNumber
                v-model="blacklistThresholdCount"
                :disabled="isFieldDisabled || !blacklistThresholdEnabled"
                :min="1"
                :max="99"
                show-buttons
                button-layout="horizontal"
                :input-style="{ width: '3.5rem', textAlign: 'center' }"
              >
                <template #incrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                </template>
                <template #decrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'minus']" />
                </template>
              </InputNumber>
              <span class="text-sm text-slate-600 dark:text-slate-300">
                {{ t('bid_list.bid_setting.form.hint.blacklist_suffix') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 靜音時間（永遠啟用，避免夜間擾人；主開關關閉時反灰） -->
      <div
        class="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-700"
        :class="{ 'opacity-50 pointer-events-none': isFieldDisabled }"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {{ t('bid_list.bid_setting.form.section.mute_time') }}
            </span>
            <button
              type="button"
              v-tooltip.top="t('bid_list.bid_setting.form.hint.mute_time_tooltip')"
              class="text-slate-400 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors cursor-pointer"
              :aria-label="t('bid_list.bid_setting.form.hint.mute_time_tooltip')"
            >
              <FontAwesomeIcon :icon="['fas', 'circle-question']" />
            </button>
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('bid_list.bid_setting.form.hint.mute_time_hint') }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2 pl-1">
          <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.bid_setting.form.field.mute_time_start') }}
          </span>
          <DatePicker
            v-model="preDiscardMuteStart"
            time-only
            hour-format="24"
            :disabled="isFieldDisabled"
            fluid
            class="w-28"
          />
          <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.bid_setting.form.field.mute_time_separator') }}
          </span>
          <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.bid_setting.form.field.mute_time_end') }}
          </span>
          <DatePicker
            v-model="preDiscardMuteEnd"
            time-only
            hour-format="24"
            :disabled="isFieldDisabled"
            fluid
            class="w-28"
          />
        </div>
      </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          text
          @click="handleCancel"
        >
          {{ t('bid_list.bid_setting.button.cancel') }}
        </Button>
        <Button
          type="button"
          severity="primary"
          @click="handleSave"
        >
          {{ t('bid_list.bid_setting.button.save') }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
