<script setup lang="ts">
/**
 * 編輯等級 Dialog：修改單一級距的名稱、消費門檻、購物折扣與兩項會員權益。
 *
 * 本元件不落庫——會員等級設定是全量寫入（`levels` 必須剛好 4 筆），送出由頁面層集齊四個級距後
 * 一次寫回，這裡只把編輯結果以 `save` 交回。**關窗權在頁面層**：寫入成功才收掉 `visible`，
 * 失敗時窗照開、使用者剛填的內容留在原地。
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FormField from '@/admin/components/ui/FormField.vue';
import {
  MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING,
  MEMBER_LEVEL_UPGRADE_POINTS_TIMING,
  type MemberLevel,
  type MemberLevelBirthdayGiftTiming,
  type MemberLevelUpgradePointsTiming,
} from '../types';
import { formatDiscount } from '../utils/formatDiscount';
import { formatThousands } from '../utils/formatMoney';
import {
  buildEditedLevel,
  DISCOUNT_PERCENT_MAX,
  DISCOUNT_RATE_MAX,
  DISCOUNT_RATE_MIN,
  EXPIRE_DAYS_MAX,
  EXPIRE_DAYS_MIN,
  formatFieldError,
  GIFT_POINTS_MAX,
  GIFT_POINTS_MIN,
  resolveThresholdBounds,
  toDiscountPercent,
  validateLevelEditForm,
  type LevelEditFormErrors,
  type LevelEditFormValues,
} from '../utils/levelEditForm';

/** 等級名稱長度上限。 */
const NAME_MAX_LENGTH = 32;

/** 折扣試算採用的商品單價，僅供畫面示意 */
const DISCOUNT_PREVIEW_PRICE = 1000;

const props = defineProps<{
  /** 要編輯的級距；為 null 時不渲染內容也不可儲存 */
  level: MemberLevel | null;
  /** 目前的完整四個級距，供門檻遞增檢查取相鄰級距的界線 */
  levels: MemberLevel[];
  /** 落庫進行中；期間停用儲存鈕防連點 */
  isSaving: boolean;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const emit = defineEmits<{
  /** 請求落庫這一級的編輯結果；呼叫端負責全量送出，成功才把 `visible` 收掉 */
  save: [level: MemberLevel];
}>();

const { t } = useI18n();

const name = ref('');
/** 消費門檻；未輸入為 null（InputNumber 清空即 null），base 級距固定 0 */
const threshold = ref<number | null>(null);
/** 購物折扣倍率 0.01~1；交回前才換算成百分比整數 */
const discountRate = ref<number | null>(DISCOUNT_RATE_MAX);
const birthdayGiftEnabled = ref(true);
const birthdayGiftPoints = ref<number | null>(null);
const birthdayGiftExpireDays = ref<number | null>(null);
const birthdayGiftTiming = ref<MemberLevelBirthdayGiftTiming>(
  MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH,
);
const upgradePointsEnabled = ref(true);
const upgradePoints = ref<number | null>(null);
const upgradePointsExpireDays = ref<number | null>(null);
const upgradePointsTiming = ref<MemberLevelUpgradePointsTiming>(
  MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE,
);

const isBase = computed(() => props.level?.isBase === true);

const birthdayGiftTimingOptions = computed(() => [
  {
    label: t('member_level.edit_dialog.option.birthday_timing.birth_month'),
    value: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH,
  },
  {
    label: t('member_level.edit_dialog.option.birthday_timing.birth_day'),
    value: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_DAY,
  },
]);

const upgradePointsTimingOptions = computed(() => [
  {
    label: t('member_level.edit_dialog.option.upgrade_timing.on_upgrade'),
    value: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE,
  },
  {
    label: t('member_level.edit_dialog.option.upgrade_timing.next_month'),
    value: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.NEXT_MONTH,
  },
]);

/** 折扣試算文案；倍率未填或超出值域時為空字串（不顯示） */
const discountPreview = computed(() => {
  const rate = discountRate.value;
  if (rate === null || rate < DISCOUNT_RATE_MIN || rate > DISCOUNT_RATE_MAX) return '';

  const price = formatThousands(DISCOUNT_PREVIEW_PRICE);
  const percent = toDiscountPercent(rate);
  if (percent >= DISCOUNT_PERCENT_MAX) {
    return t('member_level.edit_dialog.text.no_discount_preview', { price });
  }

  const paid = Math.round((DISCOUNT_PREVIEW_PRICE * percent) / 100);

  return t('member_level.edit_dialog.text.discount_preview', {
    discount: formatDiscount(percent, t),
    price,
    paid: formatThousands(paid),
    saved: formatThousands(DISCOUNT_PREVIEW_PRICE - paid),
  });
});

const formValues = computed<LevelEditFormValues>(() => ({
  name: name.value,
  threshold: threshold.value,
  discountRate: discountRate.value,
  birthdayGiftEnabled: birthdayGiftEnabled.value,
  birthdayGiftPoints: birthdayGiftPoints.value,
  birthdayGiftExpireDays: birthdayGiftExpireDays.value,
  birthdayGiftTiming: birthdayGiftTiming.value,
  upgradePointsEnabled: upgradePointsEnabled.value,
  upgradePoints: upgradePoints.value,
  upgradePointsExpireDays: upgradePointsExpireDays.value,
  upgradePointsTiming: upgradePointsTiming.value,
}));

/** 逐欄的值域錯誤；擋送與指路都在前端做完（全量置換，一欄不合整份都存不進去）。 */
const errors = computed<LevelEditFormErrors>(() =>
  props.level === null
    ? {}
    : validateLevelEditForm(formValues.value, {
        isBase: isBase.value,
        thresholdBounds: resolveThresholdBounds(props.levels, props.level.sortOrder),
      }),
);

const nameError = computed(() => formatFieldError(errors.value.name, t));
const thresholdError = computed(() => formatFieldError(errors.value.threshold, t));
const discountRateError = computed(() => formatFieldError(errors.value.discountRate, t));
const birthdayGiftPointsError = computed(() =>
  formatFieldError(errors.value.birthdayGiftPoints, t),
);
const birthdayGiftExpireDaysError = computed(() =>
  formatFieldError(errors.value.birthdayGiftExpireDays, t),
);
const upgradePointsError = computed(() => formatFieldError(errors.value.upgradePoints, t));
const upgradePointsExpireDaysError = computed(() =>
  formatFieldError(errors.value.upgradePointsExpireDays, t),
);

const thresholdHint = computed(() =>
  isBase.value
    ? t('member_level.edit_dialog.description.base_threshold')
    : t('member_level.edit_dialog.description.threshold'),
);

const isSaveDisabled = computed(
  () => props.level === null || props.isSaving || Object.keys(errors.value).length > 0,
);

/** 以級距內容回填表單；`level` 為 null 時回到空白預設。 */
function fillForm(level: MemberLevel | null) {
  name.value = level?.name ?? '';
  threshold.value = level === null ? null : level.threshold;
  discountRate.value =
    level === null ? DISCOUNT_RATE_MAX : Number((level.discountPercent / 100).toFixed(2));
  birthdayGiftEnabled.value = level?.birthdayGiftEnabled ?? true;
  birthdayGiftPoints.value = level?.birthdayGiftPoints ?? null;
  birthdayGiftExpireDays.value = level?.birthdayGiftExpireDays ?? null;
  birthdayGiftTiming.value =
    level?.birthdayGiftTiming ?? MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH;
  upgradePointsEnabled.value = level?.upgradePointsEnabled ?? true;
  upgradePoints.value = level?.upgradePoints ?? null;
  upgradePointsExpireDays.value = level?.upgradePointsExpireDays ?? null;
  upgradePointsTiming.value =
    level?.upgradePointsTiming ?? MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE;
}

// 開窗與換級距都要重填：同一個 Dialog 實例會被四個級距輪流使用，殘值會被誤存成別的級距內容
watch(
  [visible, () => props.level],
  ([isOpen]) => {
    if (!isOpen) return;

    fillForm(props.level);
  },
  { immediate: true },
);

// 只交出編輯結果，不自行關窗：落庫失敗時窗留著，使用者剛填的內容才不會連同對話框一起消失
function handleSave() {
  const source = props.level;
  if (source === null || isSaveDisabled.value) return;

  emit('save', buildEditedLevel(source, formValues.value));
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="
      level
        ? t('member_level.edit_dialog.title', { name: level.name })
        : t('member_level.edit_dialog.title_fallback')
    "
    :style="{ width: '38rem', maxWidth: '95vw' }"
  >
    <div
      v-if="level"
      class="flex flex-col gap-5"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          :label="$t('member_level.edit_dialog.label.name')"
          required
          class-name="max-w-none"
        >
          <InputText
            v-model="name"
            fluid
            :maxlength="NAME_MAX_LENGTH"
            :invalid="!!nameError"
            :placeholder="$t('member_level.edit_dialog.placeholder.format.name')"
          />
          <Message
            v-if="nameError"
            size="small"
            severity="error"
            variant="simple"
          >
            {{ nameError }}
          </Message>
        </FormField>

        <FormField
          :label="$t('member_level.edit_dialog.label.threshold')"
          required
          :hint="thresholdHint"
          class-name="max-w-none"
        >
          <InputNumber
            v-model="threshold"
            fluid
            :min="0"
            :max-fraction-digits="0"
            :disabled="isBase"
            :invalid="!!thresholdError"
            prefix="NT$ "
            :placeholder="$t('member_level.edit_dialog.placeholder.format.threshold')"
          />
          <Message
            v-if="thresholdError"
            size="small"
            severity="error"
            variant="simple"
          >
            {{ thresholdError }}
          </Message>
        </FormField>
      </div>

      <FormField
        :label="$t('member_level.edit_dialog.label.discount_rate')"
        required
        :hint="$t('member_level.edit_dialog.description.discount_rate')"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="discountRate"
          fluid
          :min="DISCOUNT_RATE_MIN"
          :max="DISCOUNT_RATE_MAX"
          :step="0.01"
          :min-fraction-digits="2"
          :max-fraction-digits="2"
          :invalid="!!discountRateError"
          :placeholder="$t('member_level.edit_dialog.placeholder.format.discount_rate')"
        />
        <span
          v-if="discountPreview"
          class="text-sm text-primary"
        >
          {{ discountPreview }}
        </span>
        <Message
          v-if="discountRateError"
          size="small"
          severity="error"
          variant="simple"
        >
          {{ discountRateError }}
        </Message>
      </FormField>

      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-color">
          {{ $t('member_level.edit_dialog.section.benefits') }}
        </h3>

        <div class="divide-y divide-[var(--p-content-border-color)]">
        <!-- 生日禮 -->
        <div
          class="flex flex-col gap-4 pb-5"
          :class="{ 'opacity-60': !birthdayGiftEnabled }"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">{{
              $t('member_level.edit_dialog.section.birthday_gift')
            }}</span>
            <ToggleSwitch
              v-model="birthdayGiftEnabled"
              :aria-label="$t('member_level.edit_dialog.section.birthday_gift')"
            />
          </div>

          <template v-if="birthdayGiftEnabled">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                :label="$t('member_level.edit_dialog.label.gift_points')"
                required
                class-name="max-w-none"
              >
                <InputNumber
                  v-model="birthdayGiftPoints"
                  fluid
                  :min="GIFT_POINTS_MIN"
                  :max="GIFT_POINTS_MAX"
                  :max-fraction-digits="0"
                  :invalid="!!birthdayGiftPointsError"
                />
                <Message
                  v-if="birthdayGiftPointsError"
                  size="small"
                  severity="error"
                  variant="simple"
                >
                  {{ birthdayGiftPointsError }}
                </Message>
              </FormField>

              <FormField
                :label="$t('member_level.edit_dialog.label.gift_timing')"
                class-name="max-w-none"
              >
                <Select
                  v-model="birthdayGiftTiming"
                  fluid
                  :options="birthdayGiftTimingOptions"
                  option-label="label"
                  option-value="value"
                />
              </FormField>

              <FormField
                :label="$t('member_level.edit_dialog.label.expire_days')"
                required
                class-name="max-w-none"
              >
                <div class="flex items-center gap-2">
                  <InputNumber
                    v-model="birthdayGiftExpireDays"
                    class="min-w-0 flex-1"
                    fluid
                    :min="EXPIRE_DAYS_MIN"
                    :max="EXPIRE_DAYS_MAX"
                    :max-fraction-digits="0"
                    :invalid="!!birthdayGiftExpireDaysError"
                    :aria-label="`${$t('member_level.edit_dialog.label.expire_days')}（${$t('member_level.edit_dialog.text.expire_days_suffix')}）`"
                  />
                  <span class="shrink-0 text-muted-color">{{
                    $t('member_level.edit_dialog.text.expire_days_suffix')
                  }}</span>
                </div>
                <Message
                  v-if="birthdayGiftExpireDaysError"
                  size="small"
                  severity="error"
                  variant="simple"
                >
                  {{ birthdayGiftExpireDaysError }}
                </Message>
              </FormField>
            </div>
            <div
              class="flex items-start gap-2 rounded-md bg-[var(--p-content-hover-background)] px-3 py-2 text-sm text-muted-color"
            >
              <i class="pi pi-info-circle mt-0.5 shrink-0"></i>
              <span>{{ $t('member_level.edit_dialog.text.birthday_gift_note') }}</span>
            </div>
          </template>
          <p
            v-else
            class="text-sm text-muted-color"
          >
            {{ $t('member_level.edit_dialog.text.benefit_off') }}
          </p>
        </div>

        <!-- 升等禮 -->
        <div
          class="flex flex-col gap-4 pt-5"
          :class="{ 'opacity-60': !upgradePointsEnabled }"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">{{
              $t('member_level.edit_dialog.section.upgrade_points')
            }}</span>
            <ToggleSwitch
              v-model="upgradePointsEnabled"
              :aria-label="$t('member_level.edit_dialog.section.upgrade_points')"
            />
          </div>

          <template v-if="upgradePointsEnabled">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                :label="$t('member_level.edit_dialog.label.gift_points')"
                required
                class-name="max-w-none"
              >
                <InputNumber
                  v-model="upgradePoints"
                  fluid
                  :min="GIFT_POINTS_MIN"
                  :max="GIFT_POINTS_MAX"
                  :max-fraction-digits="0"
                  :invalid="!!upgradePointsError"
                />
                <Message
                  v-if="upgradePointsError"
                  size="small"
                  severity="error"
                  variant="simple"
                >
                  {{ upgradePointsError }}
                </Message>
              </FormField>

              <FormField
                :label="$t('member_level.edit_dialog.label.gift_timing')"
                class-name="max-w-none"
              >
                <Select
                  v-model="upgradePointsTiming"
                  fluid
                  :options="upgradePointsTimingOptions"
                  option-label="label"
                  option-value="value"
                />
              </FormField>

              <FormField
                :label="$t('member_level.edit_dialog.label.expire_days')"
                required
                class-name="max-w-none"
              >
                <div class="flex items-center gap-2">
                  <InputNumber
                    v-model="upgradePointsExpireDays"
                    class="min-w-0 flex-1"
                    fluid
                    :min="EXPIRE_DAYS_MIN"
                    :max="EXPIRE_DAYS_MAX"
                    :max-fraction-digits="0"
                    :invalid="!!upgradePointsExpireDaysError"
                    :aria-label="`${$t('member_level.edit_dialog.label.expire_days')}（${$t('member_level.edit_dialog.text.expire_days_suffix')}）`"
                  />
                  <span class="shrink-0 text-muted-color">{{
                    $t('member_level.edit_dialog.text.expire_days_suffix')
                  }}</span>
                </div>
                <Message
                  v-if="upgradePointsExpireDaysError"
                  size="small"
                  severity="error"
                  variant="simple"
                >
                  {{ upgradePointsExpireDaysError }}
                </Message>
              </FormField>
            </div>
            <div
              class="flex items-start gap-2 rounded-md bg-[var(--p-content-hover-background)] px-3 py-2 text-sm text-muted-color"
            >
              <i class="pi pi-info-circle mt-0.5 shrink-0"></i>
              <span>{{ $t('member_level.edit_dialog.text.upgrade_points_note') }}</span>
            </div>
          </template>
          <p
            v-else
            class="text-sm text-muted-color"
          >
            {{ $t('member_level.edit_dialog.text.benefit_off') }}
          </p>
        </div>
        </div>
      </section>
    </div>

    <template #footer>
      <Button
        :label="$t('common.button.cancel')"
        severity="secondary"
        outlined
        :disabled="isSaving"
        @click="visible = false"
      />
      <Button
        :label="$t('common.button.save')"
        :loading="isSaving"
        :disabled="isSaveDisabled"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>
