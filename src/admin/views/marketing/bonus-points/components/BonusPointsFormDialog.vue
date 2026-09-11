<script setup lang="ts">
/**
 * 紅利點數活動「新增 / 編輯 / 檢視」共用 Dialog（原型版）
 * — mode 決定 header、footer 主鈕文字、是否唯讀（view 時全欄位 disabled、footer 只留關閉）
 * — 四段落：基本資料 / 回饋設定 / 活動期間與名額 / 活動說明，段落間以 Section 標題 + 上分隔線區隔
 * — 回饋方式（比例 / 固定）以 RadioButton 切換，連動顯示對應欄位；兩種佈局共用同一組 grid 欄寬避免跳版
 * — 原型階段：不打後端，emit 表單資料交由列表頁寫入本地資料
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FormField from '@/admin/components/ui/FormField.vue';
import { BonusRewardType, type BonusPointsRow } from '../types';

interface Props {
  visible: boolean;
  /** 'create' = 新增；'edit' = 編輯；'view' = 唯讀檢視；'copy' = 以既有活動為範本新增 */
  mode?: 'create' | 'edit' | 'view' | 'copy';
  /** 編輯 / 檢視 / 複製模式帶入的既有資料 */
  row?: BonusPointsRow | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  row: null,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [row: BonusPointsRow];
}>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const isEdit = computed(() => props.mode === 'edit');
const isView = computed(() => props.mode === 'view');
const isCopy = computed(() => props.mode === 'copy');

const dialogHeader = computed(() => {
  if (isView.value) return t('bonus_points.form_dialog.header.view');
  if (isEdit.value) return t('bonus_points.form_dialog.header.edit');
  if (isCopy.value) return t('bonus_points.form_dialog.header.copy');
  return t('bonus_points.form_dialog.header.create');
});

// ---- 表單狀態 ----
const name = ref('');
const enabled = ref(true);
const rewardType = ref<BonusRewardType>(BonusRewardType.Percentage);
/** 回饋值：比例制為百分比，固定制為點數 */
const rewardValue = ref<number | null>(null);
const pointsCap = ref<number | null>(null);
const minSpend = ref<number | null>(0);
const claimLimit = ref<number | null>(null);
const period = ref<[Date, Date] | null>(null);
const description = ref('');

const hasError = ref(false);

const isPercentage = computed(() => rewardType.value === BonusRewardType.Percentage);

const rewardValueLabel = computed(() =>
  isPercentage.value
    ? t('bonus_points.form_dialog.field.reward_value_percentage')
    : t('bonus_points.form_dialog.field.reward_value_fixed'),
);

// ---- 驗證 ----
const nameInvalid = computed(() => hasError.value && !name.value.trim());
const rewardValueInvalid = computed(
  () => hasError.value && (rewardValue.value === null || rewardValue.value <= 0),
);
const periodInvalid = computed(() => hasError.value && !period.value);

/** 解析 mock 的 'YYYY-MM-DD HH:mm:ss' → Date */
function parseDate(value: string): Date | null {
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → 'YYYY-MM-DD HH:mm:ss'（時分秒以起訖端點補齊） */
function formatDateTime(d: Date, time: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${time}`;
}

function resetForm() {
  hasError.value = false;
  const r = props.row;
  if (r && (isEdit.value || isView.value || isCopy.value)) {
    // 複製：以來源活動為範本，名稱補「（複製）」後綴，其餘沿用；送出時列表頁會補新 id、領取數歸零
    name.value = isCopy.value ? `${r.name}${t('bonus_points.form_dialog.copy_suffix')}` : r.name;
    enabled.value = r.enabled;
    rewardType.value = r.rewardType;
    rewardValue.value = r.rewardValue;
    pointsCap.value = r.pointsCap;
    minSpend.value = r.minSpend;
    claimLimit.value = r.claimLimit;
    const start = parseDate(r.startAt);
    const end = parseDate(r.endAt);
    period.value = start && end ? [start, end] : null;
    description.value = r.description;
  } else {
    name.value = '';
    enabled.value = true;
    rewardType.value = BonusRewardType.Percentage;
    rewardValue.value = null;
    pointsCap.value = null;
    minSpend.value = 0;
    claimLimit.value = null;
    period.value = null;
    description.value = '';
  }
}

watch(() => props.visible, (v) => {
  if (v) resetForm();
});

function handleCancel() {
  localVisible.value = false;
}

function handleSave() {
  const invalid = !name.value.trim()
    || rewardValue.value === null
    || rewardValue.value <= 0
    || !period.value;
  if (invalid) {
    hasError.value = true;
    return;
  }

  const [start, end] = period.value ?? [];
  const payload: BonusPointsRow = {
    id: props.row?.id ?? '',
    name: name.value.trim(),
    rewardType: rewardType.value,
    rewardValue: rewardValue.value ?? 0,
    pointsCap: isPercentage.value ? pointsCap.value : null,
    minSpend: minSpend.value ?? 0,
    claimLimit: claimLimit.value,
    // 編輯沿用既有領取數；新增 / 複製一律歸零（複製出的是全新活動）
    claimedCount: isEdit.value ? (props.row?.claimedCount ?? 0) : 0,
    startAt: start ? formatDateTime(start, '08:00:00') : '',
    endAt: end ? formatDateTime(end, '23:59:59') : '',
    enabled: enabled.value,
    description: description.value.trim(),
  };

  emit('submit', payload);
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :draggable="false"
    :header="dialogHeader"
    :style="{ width: 'min(680px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-6">
      <!-- ===== 基本資料 ===== -->
      <section class="flex flex-col gap-4">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ $t('bonus_points.form_dialog.section.basic') }}
        </h3>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            :label="$t('bonus_points.form_dialog.field.name')"
            :required="!isView"
            class-name="max-w-none"
          >
            <InputText
              v-model="name"
              fluid
              :maxlength="60"
              :disabled="isView"
              :invalid="nameInvalid"
              :placeholder="$t('bonus_points.form_dialog.placeholder.name')"
            />
            <Message
              v-if="nameInvalid"
              size="small"
              severity="error"
              variant="simple"
            >
              {{ $t('bonus_points.form_dialog.validation.name') }}
            </Message>
          </FormField>

          <FormField
            :label="$t('bonus_points.form_dialog.field.status')"
            class-name="max-w-none"
          >
            <div class="flex h-[44px] items-center gap-2">
              <ToggleSwitch
                v-model="enabled"
                :disabled="isView"
                :aria-label="$t('bonus_points.form_dialog.field.status')"
              />
              <span class="text-sm text-[var(--p-text-color)]">
                {{ enabled
                  ? $t('bonus_points.form_dialog.status.enabled')
                  : $t('bonus_points.form_dialog.status.disabled') }}
              </span>
            </div>
          </FormField>
        </div>
      </section>

      <!-- ===== 回饋設定 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ $t('bonus_points.form_dialog.section.reward') }}
        </h3>

        <!-- 回饋方式 -->
        <FormField
          :label="$t('bonus_points.form_dialog.field.reward_type')"
          :required="!isView"
          class-name="max-w-none"
        >
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="rewardType"
                :value="BonusRewardType.Percentage"
                input-id="bonus-reward-percentage"
                :disabled="isView"
              />
              <label for="bonus-reward-percentage" class="text-sm text-[var(--p-text-color)]" :class="{ 'cursor-pointer': !isView }">
                {{ $t('bonus_points.reward_type.percentage') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="rewardType"
                :value="BonusRewardType.Fixed"
                input-id="bonus-reward-fixed"
                :disabled="isView"
              />
              <label for="bonus-reward-fixed" class="text-sm text-[var(--p-text-color)]" :class="{ 'cursor-pointer': !isView }">
                {{ $t('bonus_points.reward_type.fixed') }}
              </label>
            </div>
          </div>
        </FormField>

        <!-- 回饋值（+ 上限點數，比例制才顯示）／消費門檻：共用同一組 grid 欄寬避免切換跳版 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            :label="rewardValueLabel"
            :required="!isView"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="rewardValue"
              fluid
              :min="0"
              :max="isPercentage ? 100 : 9999999"
              :max-fraction-digits="isPercentage ? 2 : 0"
              :suffix="isPercentage ? ' %' : undefined"
              :disabled="isView"
              :invalid="rewardValueInvalid"
            />
            <Message
              v-if="rewardValueInvalid"
              size="small"
              severity="error"
              variant="simple"
            >
              {{ $t('bonus_points.form_dialog.validation.reward_value') }}
            </Message>
          </FormField>

          <FormField
            v-if="isPercentage"
            :label="`${$t('bonus_points.form_dialog.field.points_cap')}${$t('bonus_points.form_dialog.optional_suffix')}`"
            :hint="$t('bonus_points.form_dialog.hint.points_cap')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="pointsCap"
              fluid
              :min="0"
              :max="9999999"
              :max-fraction-digits="0"
              :suffix="` ${$t('bonus_points.form_dialog.unit.points')}`"
              :disabled="isView"
              :placeholder="$t('bonus_points.value.unlimited')"
            />
          </FormField>
          <!-- 固定制無上限欄位，留空 div 佔位維持右欄不塌陷 -->
          <div v-else class="hidden sm:block"></div>

          <FormField
            :label="$t('bonus_points.form_dialog.field.min_spend')"
            :hint="$t('bonus_points.form_dialog.hint.min_spend')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="minSpend"
              fluid
              :min="0"
              :max="9999999"
              :max-fraction-digits="0"
              prefix="NT$ "
              :disabled="isView"
            />
          </FormField>
        </div>
      </section>

      <!-- ===== 活動期間與名額 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ $t('bonus_points.form_dialog.section.schedule') }}
        </h3>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            :label="$t('bonus_points.form_dialog.field.period')"
            :required="!isView"
            class-name="max-w-none"
          >
            <DatePicker
              v-model="period"
              selection-mode="range"
              date-format="yy/mm/dd"
              show-icon
              fluid
              :manual-input="false"
              :disabled="isView"
              :invalid="periodInvalid"
              :placeholder="$t('bonus_points.form_dialog.placeholder.period')"
            />
            <Message
              v-if="periodInvalid"
              size="small"
              severity="error"
              variant="simple"
            >
              {{ $t('bonus_points.form_dialog.validation.period') }}
            </Message>
          </FormField>

          <FormField
            :label="`${$t('bonus_points.form_dialog.field.claim_limit')}${$t('bonus_points.form_dialog.optional_suffix')}`"
            :hint="$t('bonus_points.form_dialog.hint.claim_limit')"
            class-name="max-w-none"
          >
            <InputNumber
              v-model="claimLimit"
              fluid
              :min="0"
              :max="9999999"
              :max-fraction-digits="0"
              :suffix="` ${$t('bonus_points.form_dialog.unit.people')}`"
              :disabled="isView"
              :placeholder="$t('bonus_points.form_dialog.placeholder.claim_limit')"
            />
          </FormField>
        </div>
      </section>

      <!-- ===== 活動說明 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ $t('bonus_points.form_dialog.section.note') }}
        </h3>

        <FormField
          :label="`${$t('bonus_points.form_dialog.field.description')}${$t('bonus_points.form_dialog.optional_suffix')}`"
          :hint="$t('bonus_points.form_dialog.hint.description')"
          class-name="max-w-none"
        >
          <Textarea
            v-model="description"
            fluid
            auto-resize
            rows="3"
            :maxlength="200"
            :disabled="isView"
            :placeholder="$t('bonus_points.form_dialog.placeholder.description')"
          />
        </FormField>
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          v-if="isView"
          type="button"
          severity="secondary"
          outlined
          :label="$t('bonus_points.form_dialog.button.close')"
          @click="handleCancel"
        />
        <template v-else>
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="$t('bonus_points.form_dialog.button.cancel')"
            @click="handleCancel"
          />
          <Button
            type="button"
            :label="isEdit
              ? $t('bonus_points.form_dialog.button.save')
              : $t('bonus_points.form_dialog.button.create')"
            @click="handleSave"
          />
        </template>
      </div>
    </template>
  </Dialog>
</template>
