<script setup lang="ts">
/**
 * 得標禮抽獎「新增 / 編輯」共用 Dialog（原型版）
 * — 版面參照 UAT-11 新增彈窗，與關鍵字抽獎彈窗一致；兩段：基本設定 / 獎品設定
 * — 基本設定：抽獎來源(radio)／直播場次(依直播場次時顯示)／活動名稱(選填自動命名)／活動日期區間(含時間)／得標門檻金額／星等過濾／自動抽獎(ToggleSwitch)／指定中獎人數
 * — 獎品設定：贈送類型(radio)（商品→商品名稱＋結帳購物車／點數→點數額度）
 * — 原型階段：儲存不打後端，emit 表單資料交由列表頁寫入 localStorage（lotteryStore）
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { DrawSource, PrizeType, type BidGiftLotteryRow } from '../types';

interface Props {
  visible: boolean;
  /** 'create' = 新增；'edit' = 編輯（帶入 row） */
  mode?: 'create' | 'edit';
  /** 編輯模式帶入的既有資料 */
  row?: BidGiftLotteryRow | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  row: null,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  /** 送出組好的場次資料（新增時 id/createdAt 為空字串，交由列表頁補上） */
  submit: [row: BidGiftLotteryRow];
}>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const isEdit = computed(() => props.mode === 'edit');

// 原型：可選擇的多購物車清單（商店設定的購物車，贈送類型=商品時適用）
const CART_OPTIONS = ['預設購物車', '主購物車', '冰品專區', '冰品專區 / 生活雜貨'];
const DEFAULT_CART = CART_OPTIONS[0];

// ---- 表單狀態 ----
/** 星等過濾 sentinel：'unlimited' = 不限（PrimeVue Select 不把 null 當有效選取值，故用字串 sentinel） */
type StarFilterValue = number | 'unlimited';

const drawSource = ref<DrawSource>(DrawSource.LiveSession);
const liveSession = ref('');
const activityName = ref('');
const dateRange = ref<[Date, Date] | null>(null);
/** 得標門檻金額：0 = 不限 */
const requiredAmount = ref(0);
const starFilter = ref<StarFilterValue>('unlimited');
const autoDraw = ref(false);
const winnerCount = ref(1);
const prizeType = ref<PrizeType>(PrizeType.Product);
const productName = ref('');
const cart = ref(DEFAULT_CART);
const pointsAmount = ref(0);

const hasError = ref(false);

const isLiveSource = computed(() => drawSource.value === DrawSource.LiveSession);
const isProduct = computed(() => prizeType.value === PrizeType.Product);

// 驗證狀態（走 PrimeVue :invalid → 自動帶 aria-invalid，並用 aria-describedby 關聯錯誤訊息）
const liveSessionInvalid = computed(() => hasError.value && isLiveSource.value && !liveSession.value);
const dateRangeInvalid = computed(() => hasError.value && !dateRange.value);
const winnerCountInvalid = computed(() => hasError.value && winnerCount.value < 1);
const productNameInvalid = computed(() => hasError.value && isProduct.value && !productName.value.trim());
const pointsAmountInvalid = computed(() => hasError.value && !isProduct.value && pointsAmount.value <= 0);

// 原型：可挑選的直播場次清單；編輯帶入的既有值若不在清單內也補進去
const BASE_SESSIONS = ['週五晚間直播', '週六加碼直播', '週日午茶直播', '週三新品直播', '週四回饋直播'];
const liveSessionOptions = computed(() => {
  const set = new Set(BASE_SESSIONS);
  if (liveSession.value) set.add(liveSession.value);
  return [...set];
});

const starFilterOptions = computed(() => [
  { label: t('bid_gift_lottery.form_dialog.star_filter.unlimited'), value: 'unlimited' as StarFilterValue },
  ...[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n as StarFilterValue })),
]);

// 切換抽獎來源：非「依直播場次」時清掉已選場次
watch(drawSource, (v) => {
  if (v !== DrawSource.LiveSession) liveSession.value = '';
});

/** 解析 mock 的 'YYYY-MM-DD HH:mm:ss' 字串為 Date（含時間精度） */
function parseDate(value: string): Date | null {
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 依模式重置 / 帶入表單 */
function resetForm() {
  hasError.value = false;
  if (isEdit.value && props.row) {
    const r = props.row;
    drawSource.value = r.drawSource;
    liveSession.value = r.drawSource === DrawSource.LiveSession ? r.liveSession : '';
    activityName.value = r.sessionName;
    const start = parseDate(r.searchStartAt);
    const end = parseDate(r.searchEndAt);
    dateRange.value = start && end ? [start, end] : null;
    requiredAmount.value = r.requiredAmount ?? 0;
    starFilter.value = r.starFilter ?? 'unlimited';
    autoDraw.value = r.autoDraw;
    winnerCount.value = r.winnerCount;
    prizeType.value = r.prizeType;
    productName.value = r.prizeType === PrizeType.Product ? r.prizeContent : '';
    pointsAmount.value = r.prizeType === PrizeType.Points ? (parseInt(r.prizeContent, 10) || 0) : 0;
    cart.value = r.cart || DEFAULT_CART;
  } else {
    drawSource.value = DrawSource.LiveSession;
    liveSession.value = '';
    activityName.value = '';
    // ⚠ range + show-time 模式：重置給 null 整體，不可給 [null, null]（內部 viewDate 會讀 null.getFullYear() 噴錯）
    dateRange.value = null;
    requiredAmount.value = 0;
    starFilter.value = 'unlimited';
    autoDraw.value = false;
    winnerCount.value = 1;
    prizeType.value = PrizeType.Product;
    productName.value = '';
    cart.value = DEFAULT_CART;
    pointsAmount.value = 0;
  }
}

watch(() => props.visible, (v) => {
  if (v) resetForm();
});

function handleCancel() {
  localVisible.value = false;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → 'YYYY-MM-DD HH:mm:ss'（保留所選時間，秒補 00） */
function toStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** 活動名稱留空時自動命名為「得標禮活動-YYYYMMDD HHmm」（依活動起始時間） */
function autoName(start: Date): string {
  const stamp = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`
    + ` ${pad(start.getHours())}${pad(start.getMinutes())}`;
  return `${t('bid_gift_lottery.form_dialog.auto_name_prefix')}-${stamp}`;
}

function handleSave() {
  const prizeInvalid = isProduct.value ? !productName.value.trim() : pointsAmount.value <= 0;
  const invalid = (isLiveSource.value && !liveSession.value)
    || !dateRange.value
    || prizeInvalid
    || winnerCount.value < 1;
  if (invalid) {
    hasError.value = true;
    return;
  }

  const [start, end] = dateRange.value ?? [];
  const prizeContent = isProduct.value
    ? productName.value.trim()
    : `${pointsAmount.value} ${t('bid_gift_lottery.form_dialog.unit.points')}`;

  const payload: BidGiftLotteryRow = {
    // 新增時 id / createdAt 留空，交由列表頁補上；編輯時沿用既有值
    id: props.row?.id ?? '',
    createdAt: props.row?.createdAt ?? '',
    drawSource: drawSource.value,
    liveSession: isLiveSource.value ? liveSession.value : '',
    sessionName: activityName.value.trim() || (start ? autoName(start) : ''),
    searchStartAt: start ? toStamp(start) : '',
    searchEndAt: end ? toStamp(end) : '',
    prizeType: prizeType.value,
    prizeContent,
    cart: isProduct.value ? cart.value : '',
    // 表單 0＝不限，對齊 row 的 null＝不限
    requiredAmount: requiredAmount.value === 0 ? null : requiredAmount.value,
    starFilter: starFilter.value === 'unlimited' ? null : starFilter.value,
    autoDraw: autoDraw.value,
    winnerCount: winnerCount.value,
    // 狀態改由日期推導；新增預設未抽獎，編輯沿用既有
    drawn: props.row?.drawn ?? false,
  };

  showSuccess({
    detail: isEdit.value
      ? t('bid_gift_lottery.form_dialog.toast.updated')
      : t('bid_gift_lottery.form_dialog.toast.created'),
  });
  emit('submit', payload);
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :draggable="false"
    :header="isEdit
      ? t('bid_gift_lottery.form_dialog.header.edit')
      : t('bid_gift_lottery.form_dialog.header.create')"
    :style="{ width: 'min(640px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-6">
      <!-- ===== 基本設定 ===== -->
      <section class="flex flex-col gap-4">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('bid_gift_lottery.form_dialog.section.basic') }}
        </h3>

        <!-- 抽獎來源 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.draw_source') }}
          </label>
          <div
            class="flex flex-wrap items-center gap-x-6 gap-y-2"
            role="radiogroup"
            :aria-label="t('bid_gift_lottery.form_dialog.field.draw_source')"
          >
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="drawSource"
                :value="DrawSource.LiveSession"
                input-id="draw-source-live"
              />
              <label for="draw-source-live" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('bid_gift_lottery.draw_source.live_session') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="drawSource"
                :value="DrawSource.DateRange"
                input-id="draw-source-date"
              />
              <label for="draw-source-date" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('bid_gift_lottery.draw_source.date_range') }}
              </label>
            </div>
          </div>
        </div>

        <!-- 直播場次（僅依直播場次時顯示） -->
        <div v-if="isLiveSource" class="flex flex-col gap-2">
          <label for="lottery-live-session" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.live_session') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <Select
            v-model="liveSession"
            input-id="lottery-live-session"
            :options="liveSessionOptions"
            filter
            :filter-placeholder="t('bid_gift_lottery.form_dialog.placeholder.live_session')"
            :placeholder="t('bid_gift_lottery.form_dialog.placeholder.live_session')"
            class="w-full"
            :invalid="liveSessionInvalid"
            :aria-describedby="liveSessionInvalid ? 'lottery-live-session-error' : undefined"
          />
          <span
            v-if="liveSessionInvalid"
            id="lottery-live-session-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.live_session') }}
          </span>
        </div>

        <!-- 活動名稱（選填，自動命名） -->
        <div class="flex flex-col gap-2">
          <label for="lottery-activity-name" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.activity_name') }}
            <span class="text-xs text-[var(--p-text-muted-color)]">{{ t('bid_gift_lottery.form_dialog.optional_suffix') }}</span>
          </label>
          <InputText
            id="lottery-activity-name"
            v-model="activityName"
            :placeholder="t('bid_gift_lottery.form_dialog.placeholder.activity_name')"
            fluid
          />
        </div>

        <!-- 活動日期區間（含時間） -->
        <div class="flex flex-col gap-2">
          <label for="lottery-date-range" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.date_range') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <DatePicker
            v-model="dateRange"
            input-id="lottery-date-range"
            selection-mode="range"
            show-time
            hour-format="24"
            date-format="yy/mm/dd"
            show-icon
            :manual-input="false"
            :placeholder="t('bid_gift_lottery.form_dialog.placeholder.date_range')"
            fluid
            :invalid="dateRangeInvalid"
            :aria-describedby="dateRangeInvalid ? 'lottery-date-range-error' : undefined"
          />
          <span
            v-if="dateRangeInvalid"
            id="lottery-date-range-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.date_range') }}
          </span>
        </div>

        <!-- 得標門檻金額 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-required-amount" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.required_amount') }}
          </label>
          <InputNumber
            v-model="requiredAmount"
            input-id="lottery-required-amount"
            mode="currency"
            currency="TWD"
            locale="zh-TW"
            :max-fraction-digits="0"
            :min="0"
            :max="9999999"
            fluid
            aria-describedby="lottery-required-amount-hint"
          />
          <span id="lottery-required-amount-hint" class="text-xs text-[var(--p-text-muted-color)]">
            {{ t('bid_gift_lottery.form_dialog.hint.required_amount') }}
          </span>
        </div>

        <!-- 星等過濾 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-star-filter" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.star_filter') }}
          </label>
          <Select
            v-model="starFilter"
            input-id="lottery-star-filter"
            :options="starFilterOptions"
            option-label="label"
            option-value="value"
            class="w-full sm:max-w-xs"
          />
        </div>

        <!-- 自動抽獎（ToggleSwitch：左說明、右開關） -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-1">
            <label for="lottery-auto-draw" class="text-sm font-medium text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.field.auto_draw') }}
            </label>
            <span class="text-xs text-[var(--p-text-muted-color)]">
              {{ t('bid_gift_lottery.form_dialog.hint.auto_draw') }}
            </span>
          </div>
          <ToggleSwitch
            v-model="autoDraw"
            input-id="lottery-auto-draw"
          />
        </div>

        <!-- 指定中獎人數 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-winner-count" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.winner_count') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="winnerCount"
              input-id="lottery-winner-count"
              :min="1"
              :max="9999"
              show-buttons
              button-layout="horizontal"
              fluid
              class="w-56"
              :input-style="{ textAlign: 'center' }"
              :invalid="winnerCountInvalid"
              :aria-describedby="winnerCountInvalid ? 'lottery-winner-count-error' : undefined"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['far', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['far', 'minus']" />
              </template>
            </InputNumber>
            <span class="text-sm text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.unit.winner') }}
            </span>
          </div>
          <span
            v-if="winnerCountInvalid"
            id="lottery-winner-count-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.winner_count') }}
          </span>
        </div>
      </section>

      <!-- ===== 獎品設定 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('bid_gift_lottery.form_dialog.section.prize') }}
        </h3>

        <!-- 贈送類型 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.prize_type') }}
          </label>
          <div
            class="flex flex-wrap items-center gap-x-6 gap-y-2"
            role="radiogroup"
            :aria-label="t('bid_gift_lottery.form_dialog.field.prize_type')"
          >
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="prizeType"
                :value="PrizeType.Product"
                input-id="prize-type-product"
              />
              <label for="prize-type-product" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('bid_gift_lottery.prize_type.product') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="prizeType"
                :value="PrizeType.Points"
                input-id="prize-type-points"
              />
              <label for="prize-type-points" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('bid_gift_lottery.prize_type.points') }}
              </label>
            </div>
          </div>
        </div>

        <!-- 條件欄位：商品 -->
        <template v-if="isProduct">
          <div class="flex flex-col gap-2">
            <label for="lottery-product-name" class="text-sm font-medium text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.field.product_name') }}<span class="text-red-600 dark:text-red-400">*</span>
            </label>
            <InputText
              id="lottery-product-name"
              v-model="productName"
              :placeholder="t('bid_gift_lottery.form_dialog.placeholder.product_name')"
              fluid
              :invalid="productNameInvalid"
              :aria-describedby="productNameInvalid ? 'lottery-product-name-error' : undefined"
            />
            <span
              v-if="productNameInvalid"
              id="lottery-product-name-error"
              class="text-xs text-red-600 dark:text-red-400"
            >
              {{ t('bid_gift_lottery.form_dialog.validation.prize_content') }}
            </span>
          </div>

          <div class="flex flex-col gap-2">
            <label for="lottery-cart" class="text-sm font-medium text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.field.cart') }}
            </label>
            <Select
              v-model="cart"
              input-id="lottery-cart"
              :options="CART_OPTIONS"
              :placeholder="t('bid_gift_lottery.form_dialog.placeholder.cart')"
              class="w-full sm:max-w-xs"
            />
          </div>
        </template>

        <!-- 條件欄位：點數 -->
        <div v-else class="flex flex-col gap-2">
          <label for="lottery-points" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.points_amount') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="pointsAmount"
              input-id="lottery-points"
              :min="0"
              :max="9999999"
              :step="10"
              show-buttons
              button-layout="horizontal"
              fluid
              class="w-56"
              :input-style="{ textAlign: 'center' }"
              :placeholder="t('bid_gift_lottery.form_dialog.placeholder.points_amount')"
              :invalid="pointsAmountInvalid"
              :aria-describedby="pointsAmountInvalid ? 'lottery-points-error' : undefined"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['far', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['far', 'minus']" />
              </template>
            </InputNumber>
            <span class="text-sm text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.unit.points') }}
            </span>
          </div>
          <span
            v-if="pointsAmountInvalid"
            id="lottery-points-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.prize_content') }}
          </span>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('bid_gift_lottery.form_dialog.button.cancel')"
          @click="handleCancel"
        />
        <Button
          type="button"
          :label="isEdit
            ? t('bid_gift_lottery.form_dialog.button.save')
            : t('bid_gift_lottery.form_dialog.button.create')"
          @click="handleSave"
        />
      </div>
    </template>
  </Dialog>
</template>
