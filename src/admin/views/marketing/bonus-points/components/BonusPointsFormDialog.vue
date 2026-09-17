<script setup lang="ts">
/**
 * 紅利點數「新增 / 編輯 / 檢視 / 複製」共用 Dialog（依 Figma / 設計圖）
 * — 單一「基本資訊」區塊，欄位順序：名稱 / 取得來源 / 發送人數限制 / 取得門檻 /
 *   贈送類型(+單筆贈送上限) / 描述(富文本) / 備註 / 開始至結束時間
 * — 取得門檻選「消費滿」才啟用金額；贈送類型選「百分比」才顯示說明框與單筆贈送上限
 * — footer：取消 / 儲存（檢視模式僅關閉）；原型階段不打後端，emit 表單資料交由列表頁寫入
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FormField from '@/admin/components/ui/FormField.vue';
import { BonusGiftType, BonusSource, type BonusPointsRow } from '../types';
import {
  DEFAULT_CURRENCY,
  currencyMeta,
  formatCurrency,
  type StoreCurrency,
} from '../currency';

interface Props {
  visible: boolean;
  /** 'create' = 新增；'edit' = 編輯；'view' = 唯讀檢視；'copy' = 以既有活動為範本新增 */
  mode?: 'create' | 'edit' | 'view' | 'copy';
  row?: BonusPointsRow | null;
  /** 商店幣別（由列表頁傳入）：決定金額符號與小數位，彈窗不另開幣別狀態 */
  currency?: StoreCurrency;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  row: null,
  currency: DEFAULT_CURRENCY,
});

// 幣別衍生值：符號 prefix / 最小單位小數位（台幣 0、馬幣 2）
const meta = computed(() => currencyMeta(props.currency));
/** 金額欄的四捨五入小數位：跟隨商店幣別最小單位 */
const currencyDigits = computed(() => meta.value.minorUnit);
/** 金額符號（去尾隨空白），供 addon / 說明文字用 */
const currencySymbol = computed(() => meta.value.symbol.trim());

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
const source = ref<BonusSource | null>(null);
const sendLimit = ref<number | null>(null);
const perMemberLimit = ref<number | null>(null);
/** 取得門檻模式：none = 無門檻；amount = 消費滿 */
const thresholdMode = ref<'none' | 'amount'>('none');
const minSpend = ref<number | null>(null);
const giftType = ref<BonusGiftType>(BonusGiftType.Percentage);
const giftValue = ref<number | null>(null);
const giftCap = ref<number | null>(null);
const description = ref('');
const note = ref('');
const period = ref<[Date, Date] | null>(null);

const hasError = ref(false);
// 載入既有活動（編輯 / 檢視 / 複製）期間為 true：抑制 source watch 的「預設值」邏輯，避免覆寫既有值
const isHydrating = ref(false);

const isPercentage = computed(() => giftType.value === BonusGiftType.Percentage);
/** 取得來源＝消費才有「消費門檻」與「百分比」可選；註冊只有固定點數 */
const isConsumption = computed(() => source.value === BonusSource.Consumption);
const isRegister = computed(() => source.value === BonusSource.Register);
/** 贈點欄位標題：消費是條件式規則（贈點條件），註冊是一次固定發放（贈送點數） */
const giftFieldLabel = computed(() =>
  isConsumption.value
    ? t('bonus_points.form_dialog.field.gift_type')
    : t('bonus_points.form_dialog.field.gift_points'));

// 使用者切換來源時套用預設（載入既有資料時由 isHydrating 跳過）
watch(source, (val) => {
  if (isHydrating.value) return;
  // 切到非消費來源：收斂為固定點數、清掉消費門檻（百分比 / 門檻對註冊沒有意義）
  if (val !== BonusSource.Consumption) {
    giftType.value = BonusGiftType.Cash;
    thresholdMode.value = 'none';
    minSpend.value = null;
  }
  // 註冊：每人領取次數上限預設帶 1（註冊禮通常每人限領一次）
  if (val === BonusSource.Register) {
    perMemberLimit.value = 1;
  }
});

// ---- 檢視模式：直接呈現資訊（唯讀 KV，不用 disabled 表單元件） ----
const formatNumber = (v: number) => v.toLocaleString('en-US');
const viewSource = computed(() => (props.row ? t(`bonus_points.source.${props.row.source}`) : ''));
const viewGift = computed(() => {
  const r = props.row;
  if (!r) return '';
  if (r.giftType === BonusGiftType.Percentage) {
    const cap = r.giftCap !== null
      ? `・${t('bonus_points.value.points_cap', { value: formatNumber(r.giftCap) })}`
      : '';
    return `${t('bonus_points.gift_type.percentage')}・${t('bonus_points.value.percent', { value: r.giftValue })}${cap}`;
  }
  // 註冊：一次固定發放，只顯示點數金額（無「現金／百分比」之分，不加類型前綴）
  const amount = t('bonus_points.value.cash', { amount: formatCurrency(r.giftValue, props.currency) });
  return r.source === BonusSource.Consumption
    ? `${t('bonus_points.gift_type.cash')}・${amount}`
    : amount;
});
const viewThreshold = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.minSpend > 0
    ? t('bonus_points.value.min_spend', { amount: formatCurrency(r.minSpend, props.currency) })
    : t('bonus_points.value.no_threshold');
});
const viewSendLimit = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.sendLimit === null ? t('bonus_points.value.unlimited') : formatNumber(r.sendLimit);
});
const viewPerMemberLimit = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.perMemberLimit === null
    ? t('bonus_points.value.unlimited')
    : t('bonus_points.value.times', { value: formatNumber(r.perMemberLimit) });
});
const viewPeriod = computed(() =>
  (props.row ? `${props.row.startAt.slice(0, 10)} ~ ${props.row.endAt.slice(0, 10)}` : ''));
const viewStatus = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.enabled
    ? t('bonus_points.status_switch.enabled')
    : t('bonus_points.status_switch.disabled');
});

const sourceOptions = computed(() => [
  { label: t('bonus_points.source.register'), value: BonusSource.Register },
  { label: t('bonus_points.source.consumption'), value: BonusSource.Consumption },
]);

const giftTypeOptions = computed(() => [
  { label: t('bonus_points.gift_type.percentage'), value: BonusGiftType.Percentage },
  { label: t('bonus_points.gift_type.cash'), value: BonusGiftType.Cash },
]);

// ---- 驗證 ----
const nameInvalid = computed(() => hasError.value && !name.value.trim());
const sourceInvalid = computed(() => hasError.value && source.value === null);
const giftValueInvalid = computed(
  () => hasError.value && (giftValue.value === null || giftValue.value <= 0),
);
const minSpendInvalid = computed(
  () => hasError.value && thresholdMode.value === 'amount' && (minSpend.value === null || minSpend.value <= 0),
);
const periodInvalid = computed(() => hasError.value && !period.value);

function parseDate(value: string): Date | null {
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function resetForm() {
  hasError.value = false;
  // 載入資料期間抑制 source watch 的預設邏輯；watch 為非同步（於本輪同步賦值後才觸發），
  // 故用 nextTick 於 watch 執行完畢後才解除，確保既有值不被「註冊預設 1」等邏輯覆寫
  isHydrating.value = true;
  void nextTick(() => { isHydrating.value = false; });
  const r = props.row;
  if (r && (isEdit.value || isView.value || isCopy.value)) {
    name.value = isCopy.value ? `${r.name}${t('bonus_points.form_dialog.copy_suffix')}` : r.name;
    source.value = r.source;
    sendLimit.value = r.sendLimit;
    perMemberLimit.value = r.perMemberLimit;
    thresholdMode.value = r.minSpend > 0 ? 'amount' : 'none';
    minSpend.value = r.minSpend > 0 ? r.minSpend : null;
    giftType.value = r.giftType;
    giftValue.value = r.giftValue;
    giftCap.value = r.giftCap;
    description.value = r.description;
    note.value = r.note;
    const start = parseDate(r.startAt);
    const end = parseDate(r.endAt);
    period.value = start && end ? [start, end] : null;
  } else {
    name.value = '';
    source.value = null;
    sendLimit.value = null;
    perMemberLimit.value = null;
    thresholdMode.value = 'none';
    minSpend.value = null;
    giftType.value = BonusGiftType.Percentage;
    giftValue.value = null;
    giftCap.value = null;
    description.value = '';
    note.value = '';
    period.value = null;
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
    || source.value === null
    || giftValue.value === null
    || giftValue.value <= 0
    || !period.value
    || (thresholdMode.value === 'amount' && (minSpend.value === null || minSpend.value <= 0));
  if (invalid) {
    hasError.value = true;
    return;
  }

  const [start, end] = period.value ?? [];
  const payload: BonusPointsRow = {
    id: props.row?.id ?? '',
    name: name.value.trim(),
    source: source.value ?? BonusSource.Register,
    sendLimit: sendLimit.value,
    perMemberLimit: perMemberLimit.value,
    minSpend: thresholdMode.value === 'amount' ? (minSpend.value ?? 0) : 0,
    giftType: giftType.value,
    giftValue: giftValue.value ?? 0,
    giftCap: isPercentage.value ? giftCap.value : null,
    // 編輯沿用既有發送數；新增 / 複製一律歸零
    sentCount: isEdit.value ? (props.row?.sentCount ?? 0) : 0,
    description: description.value,
    note: note.value.trim(),
    startAt: start ? formatDateTime(start) : '',
    endAt: end ? formatDateTime(end) : '',
    // 新增 / 複製預設啟用；編輯沿用既有狀態（狀態改由列表開關控制）
    enabled: (isEdit.value || isView.value) ? (props.row?.enabled ?? true) : true,
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
    :style="{ width: isView ? 'min(520px, calc(100vw - 32px))' : 'min(720px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-4">
      <h3 class="text-base font-semibold text-[var(--p-text-color)]">
        {{ $t('bonus_points.form_dialog.section.basic') }}
      </h3>

      <!-- 檢視模式：直接呈現資訊（唯讀） -->
      <template v-if="isView && row">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.name') }}</span>
            <span class="text-sm">{{ row.name }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.status') }}</span>
            <span class="text-sm">{{ viewStatus }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.source') }}</span>
            <span class="text-sm">{{ viewSource }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.send_limit') }}</span>
            <span class="text-sm">{{ viewSendLimit }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.per_member_limit') }}</span>
            <span class="text-sm">{{ viewPerMemberLimit }}</span>
          </div>
          <div v-if="isConsumption" class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.threshold') }}</span>
            <span class="text-sm">{{ viewThreshold }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ giftFieldLabel }}</span>
            <span class="text-sm">{{ viewGift }}</span>
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.period') }}</span>
            <span class="text-sm">{{ viewPeriod }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.description') }}</span>
          <div class="text-sm" v-html="row.description || '—'"></div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.form_dialog.field.note') }}</span>
          <span class="text-sm whitespace-pre-wrap">{{ row.note || '—' }}</span>
        </div>
      </template>

      <!-- 新增 / 編輯 / 複製：表單 -->
      <template v-else>
      <!-- 紅利點數名稱 -->
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
          :aria-label="$t('bonus_points.form_dialog.field.name')"
          :placeholder="$t('bonus_points.form_dialog.placeholder.name')"
        />
        <Message v-if="nameInvalid" size="small" severity="error" variant="simple">
          {{ $t('bonus_points.form_dialog.validation.name') }}
        </Message>
      </FormField>

      <!-- 取得來源 -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.source')"
        :required="!isView"
        class-name="max-w-none"
      >
        <Select
          v-model="source"
          fluid
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          :disabled="isView"
          :invalid="sourceInvalid"
          :aria-label="$t('bonus_points.form_dialog.field.source')"
          :placeholder="$t('bonus_points.form_dialog.placeholder.source')"
        />
        <Message v-if="sourceInvalid" size="small" severity="error" variant="simple">
          {{ $t('bonus_points.form_dialog.validation.source') }}
        </Message>
      </FormField>

      <!-- 發送人數限制 -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.send_limit')"
        :optional="true"
        :hint="$t('bonus_points.form_dialog.hint.send_limit')"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="sendLimit"
          :min="0"
          :max="9999999"
          :max-fraction-digits="0"
          :disabled="isView"
          :aria-label="$t('bonus_points.form_dialog.field.send_limit')"
          class="w-48"
          :input-style="{ width: '100%' }"
          :placeholder="$t('bonus_points.form_dialog.placeholder.send_limit')"
        />
      </FormField>

      <!-- 每人領取次數上限 -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.per_member_limit')"
        :optional="true"
        :hint="$t('bonus_points.form_dialog.hint.per_member_limit')"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="perMemberLimit"
          :min="1"
          :max="9999"
          :max-fraction-digits="0"
          :disabled="isView"
          :aria-label="$t('bonus_points.form_dialog.field.per_member_limit')"
          class="w-48"
          :input-style="{ width: '100%' }"
          :placeholder="$t('bonus_points.form_dialog.placeholder.per_member_limit')"
        />
      </FormField>

      <!-- 取得門檻（僅消費來源） -->
      <FormField
        v-if="isConsumption"
        :label="$t('bonus_points.form_dialog.field.threshold')"
        class-name="max-w-none"
      >
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="thresholdMode"
                value="none"
                input-id="bonus-threshold-none"
                :disabled="isView"
              />
              <label for="bonus-threshold-none" class="text-sm text-[var(--p-text-color)]" :class="{ 'cursor-pointer': !isView }">
                {{ $t('bonus_points.form_dialog.threshold.none') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="thresholdMode"
                value="amount"
                input-id="bonus-threshold-amount"
                :disabled="isView"
              />
              <label for="bonus-threshold-amount" class="text-sm text-[var(--p-text-color)]" :class="{ 'cursor-pointer': !isView }">
                {{ $t('bonus_points.form_dialog.threshold.amount') }}
              </label>
              <InputNumber
                v-model="minSpend"
                :min="0"
                :max="9999999"
                :max-fraction-digits="currencyDigits"
                :prefix="meta.symbol"
                :disabled="isView || thresholdMode !== 'amount'"
                :invalid="minSpendInvalid"
                :aria-label="$t('bonus_points.form_dialog.threshold.amount')"
                class="w-40"
                :input-style="{ width: '100%' }"
              />
            </div>
          </div>
          <Message v-if="minSpendInvalid" size="small" severity="error" variant="simple">
            {{ $t('bonus_points.form_dialog.validation.min_spend') }}
          </Message>
        </div>
      </FormField>

      <!-- 贈送類型 / 贈送點數（依來源動態命名） -->
      <FormField
        :label="giftFieldLabel"
        :required="!isView"
        class-name="max-w-none"
      >
        <!-- 消費來源：可選 百分比 / 現金 -->
        <InputGroup v-if="isConsumption" class="w-full sm:w-72">
          <Select
            v-model="giftType"
            :options="giftTypeOptions"
            option-label="label"
            option-value="value"
            :disabled="isView"
            :aria-label="$t('bonus_points.form_dialog.field.gift_type')"
            class="w-24 shrink-0"
          />
          <InputNumber
            v-model="giftValue"
            :min="0"
            :max="isPercentage ? 100 : 9999999"
            :max-fraction-digits="isPercentage ? 2 : currencyDigits"
            :disabled="isView"
            :invalid="giftValueInvalid"
            :aria-label="$t('bonus_points.form_dialog.field.gift_type')"
            :input-style="{ width: '100%' }"
          />
          <InputGroupAddon>
            {{ isPercentage ? '%' : currencySymbol }}
          </InputGroupAddon>
        </InputGroup>
        <!-- 註冊 / 手動來源：固定現金 -->
        <InputGroup v-else class="w-full sm:w-56">
          <InputNumber
            v-model="giftValue"
            :min="0"
            :max="9999999"
            :max-fraction-digits="currencyDigits"
            :disabled="isView"
            :invalid="giftValueInvalid"
            :aria-label="$t('bonus_points.form_dialog.field.gift_type')"
            :input-style="{ width: '100%' }"
          />
          <InputGroupAddon>
            {{ currencySymbol }}
          </InputGroupAddon>
        </InputGroup>
        <Message v-if="giftValueInvalid" size="small" severity="error" variant="simple">
          {{ $t('bonus_points.form_dialog.validation.gift_value') }}
        </Message>
        <!-- 百分比類型說明框 -->
        <Message v-if="isConsumption && isPercentage" severity="info" :closable="false" class="mt-1">
          <div class="flex flex-col gap-1 text-sm">
            <span>{{ $t('bonus_points.form_dialog.percent_note.line1') }}</span>
            <span class="text-[var(--p-text-muted-color)]">{{ $t('bonus_points.form_dialog.percent_note.line2', { symbol: currencySymbol }) }}</span>
          </div>
        </Message>
        <!-- 現金類型說明框（消費來源） -->
        <Message v-if="isConsumption && !isPercentage" severity="info" :closable="false" class="mt-1">
          <div class="flex flex-col gap-1 text-sm">
            <span>{{ $t('bonus_points.form_dialog.cash_note.line1', { symbol: currencySymbol }) }}</span>
            <span class="text-[var(--p-text-muted-color)]">{{ $t('bonus_points.form_dialog.cash_note.line2', { symbol: currencySymbol }) }}</span>
          </div>
        </Message>
        <!-- 註冊來源說明框（一次固定發放） -->
        <Message v-if="isRegister" severity="info" :closable="false" class="mt-1">
          <div class="flex flex-col gap-1 text-sm">
            <span>{{ $t('bonus_points.form_dialog.register_note.line1', { symbol: currencySymbol }) }}</span>
            <span class="text-[var(--p-text-muted-color)]">{{ $t('bonus_points.form_dialog.register_note.line2', { symbol: currencySymbol }) }}</span>
          </div>
        </Message>
      </FormField>

      <!-- 單筆贈送上限（消費 + 百分比才顯示） -->
      <FormField
        v-if="isConsumption && isPercentage"
        :label="$t('bonus_points.form_dialog.field.gift_cap')"
        :optional="true"
        :hint="$t('bonus_points.form_dialog.hint.gift_cap')"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="giftCap"
          :min="0"
          :max="9999999"
          :max-fraction-digits="currencyDigits"
          :suffix="` ${$t('bonus_points.form_dialog.unit.point')}`"
          :disabled="isView"
          :aria-label="$t('bonus_points.form_dialog.field.gift_cap')"
          class="w-56"
          :input-style="{ width: '100%' }"
          :placeholder="$t('bonus_points.value.unlimited')"
        />
      </FormField>

      <!-- 跨幣別扣點說明（收合，預設不展開；避免與上方贈點說明框同時擠出多個藍框） -->
      <Accordion class="bonus-cross-currency">
        <AccordionPanel value="cross-currency">
          <AccordionHeader>
            <span class="flex items-center gap-2">
              <FontAwesomeIcon :icon="['far', 'coins']" class="text-[var(--p-text-muted-color)]" />
              <span class="flex flex-col gap-1 text-left">
                <span class="text-sm font-medium">{{ $t('bonus_points.form_dialog.cross_currency.title') }}</span>
                <span class="text-xs font-normal text-[var(--p-text-muted-color)]">{{ $t('bonus_points.form_dialog.cross_currency.hint') }}</span>
              </span>
            </span>
          </AccordionHeader>
          <AccordionContent>
            <div class="flex flex-col gap-3 text-sm">
              <p>{{ $t('bonus_points.form_dialog.cross_currency.desc', { currency: meta.label }) }}</p>
              <Message severity="info" :closable="false" variant="simple">
                <div class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ $t('bonus_points.form_dialog.cross_currency.example_title') }}</span>
                  <span>{{ $t('bonus_points.form_dialog.cross_currency.example_line1') }}</span>
                  <span>{{ $t('bonus_points.form_dialog.cross_currency.example_line2') }}</span>
                  <span>{{ $t('bonus_points.form_dialog.cross_currency.example_line3') }}</span>
                  <span>{{ $t('bonus_points.form_dialog.cross_currency.example_line4') }}</span>
                </div>
              </Message>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>

      <!-- 描述（富文本） -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.description')"
        class-name="max-w-none"
      >
        <Editor
          v-if="!isView"
          v-model="description"
          editor-style="height: 180px"
        />
        <div
          v-else
          class="min-h-[80px] rounded-md border border-[var(--p-content-border-color)] px-3 py-2 text-sm"
          v-html="description || '—'"
        ></div>
      </FormField>

      <!-- 紅利點數備註 -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.note')"
        class-name="max-w-none"
      >
        <Textarea
          v-model="note"
          fluid
          auto-resize
          rows="3"
          :maxlength="200"
          :disabled="isView"
          :aria-label="$t('bonus_points.form_dialog.field.note')"
          :placeholder="$t('bonus_points.form_dialog.placeholder.note')"
        />
      </FormField>

      <!-- 開始至結束時間 -->
      <FormField
        :label="$t('bonus_points.form_dialog.field.period')"
        :required="!isView"
        class-name="max-w-none"
      >
        <DatePicker
          v-model="period"
          selection-mode="range"
          show-time
          hour-format="24"
          date-format="yy-mm-dd"
          show-icon
          icon-display="input"
          :manual-input="false"
          :disabled="isView"
          :invalid="periodInvalid"
          :aria-label="$t('bonus_points.form_dialog.field.period')"
          fluid
          :placeholder="$t('bonus_points.form_dialog.placeholder.period')"
        />
        <Message v-if="periodInvalid" size="small" severity="error" variant="simple">
          {{ $t('bonus_points.form_dialog.validation.period') }}
        </Message>
      </FormField>
      </template>
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
            :label="$t('bonus_points.form_dialog.button.save')"
            @click="handleSave"
          />
        </template>
      </div>
    </template>
  </Dialog>
</template>
