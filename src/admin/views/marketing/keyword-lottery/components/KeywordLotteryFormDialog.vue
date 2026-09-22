<script setup lang="ts">
/**
 * 關鍵字抽獎「新增 / 編輯」共用 Dialog（原型版）
 * — 版面參照 UAT-11 新增彈窗，兩段：基本設定 / 獎品設定，段落間 border-t 分隔、label 在上
 * — 基本設定：抽獎來源（依直播場次時顯示「直播場次」搜尋）／活動名稱（選填自動命名）／活動日期區間（含時間）／關鍵字／星等過濾／自動抽獎（ToggleSwitch）／中獎人數
 * — 獎品設定：贈送類型（商品→商品名稱＋結帳購物車／點數→點數額度）
 * — 原型階段：儲存不打後端，emit 表單資料交由列表頁更新記憶體資料
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import {
  KeywordDrawSource,
  KeywordPrizeType,
  type KeywordLotteryRow,
} from '../types';

interface Props {
  visible: boolean;
  /** 'create' = 新增；'edit' = 編輯（帶入 row） */
  mode?: 'create' | 'edit';
  /** 編輯模式帶入的既有資料 */
  row?: KeywordLotteryRow | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  row: null,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  /** 送出組好的場次資料（新增時 id/createdAt 為空字串，交由列表頁補上） */
  submit: [row: KeywordLotteryRow];
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

const drawSource = ref<KeywordDrawSource>(KeywordDrawSource.LiveSession);
const liveSession = ref('');
const activityName = ref('');
const dateRange = ref<[Date, Date] | null>(null);
const keyword = ref('');
const starFilter = ref<StarFilterValue>('unlimited');
const autoDraw = ref(false);
const winnerCount = ref(1);
const prizeType = ref<KeywordPrizeType>(KeywordPrizeType.Product);
const productName = ref('');
const cart = ref(DEFAULT_CART);
const pointsAmount = ref(0);

const hasError = ref(false);

const isLiveSource = computed(() => drawSource.value === KeywordDrawSource.LiveSession);
const isProduct = computed(() => prizeType.value === KeywordPrizeType.Product);

// 驗證狀態（走 PrimeVue :invalid → 自動帶 aria-invalid，並用 aria-describedby 關聯錯誤訊息）
const liveSessionInvalid = computed(() => hasError.value && isLiveSource.value && !liveSession.value);
const dateRangeInvalid = computed(() => hasError.value && !dateRange.value);
const keywordInvalid = computed(() => hasError.value && !keyword.value.trim());
const winnerCountInvalid = computed(() => hasError.value && winnerCount.value < 1);
const productNameInvalid = computed(() => hasError.value && isProduct.value && !productName.value.trim());
const pointsAmountInvalid = computed(() => hasError.value && !isProduct.value && pointsAmount.value <= 0);

// 原型：可挑選的直播場次清單；編輯帶入的既有值若不在清單內也補進去，確保顯示得出來
const BASE_SESSIONS = ['週五晚間直播', '週六加碼直播', '週日午茶直播', '週三新品直播', '週四回饋直播'];
const liveSessionOptions = computed(() => {
  const set = new Set(BASE_SESSIONS);
  if (liveSession.value) set.add(liveSession.value);
  return [...set];
});

const starFilterOptions = computed(() => [
  { label: t('keyword_lottery.form_dialog.star_filter.unlimited'), value: 'unlimited' as StarFilterValue },
  ...[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n as StarFilterValue })),
]);

// 切換抽獎來源：非「依直播場次」時清掉已選場次與其驗證殘留
watch(drawSource, (v) => {
  if (v !== KeywordDrawSource.LiveSession) liveSession.value = '';
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
    // 嚴格依 drawSource 決定是否帶入場次，避免髒資料
    liveSession.value = r.drawSource === KeywordDrawSource.LiveSession ? r.liveSession : '';
    activityName.value = r.sessionName;
    const start = parseDate(r.startAt);
    const end = parseDate(r.endAt);
    dateRange.value = start && end ? [start, end] : null;
    starFilter.value = r.starFilter ?? 'unlimited';
    keyword.value = r.keyword;
    autoDraw.value = r.autoDraw;
    winnerCount.value = r.winnerCount;
    prizeType.value = r.prizeType;
    productName.value = r.prizeType === KeywordPrizeType.Product ? r.prizeContent : '';
    pointsAmount.value = r.prizeType === KeywordPrizeType.Points ? (parseInt(r.prizeContent, 10) || 0) : 0;
    cart.value = r.cart || DEFAULT_CART;
  } else {
    drawSource.value = KeywordDrawSource.LiveSession;
    liveSession.value = '';
    activityName.value = '';
    // ⚠ range + show-time 模式：重置給 null 整體，不可給 [null, null]（內部 viewDate 會讀 null.getFullYear() 噴錯）
    dateRange.value = null;
    starFilter.value = 'unlimited';
    keyword.value = '';
    autoDraw.value = false;
    winnerCount.value = 1;
    prizeType.value = KeywordPrizeType.Product;
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

/** 活動名稱留空時自動命名為「抽獎活動-YYYYMMDD HHmm」（依活動起始時間） */
function autoName(start: Date): string {
  const stamp = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`
    + ` ${pad(start.getHours())}${pad(start.getMinutes())}`;
  return `${t('keyword_lottery.form_dialog.auto_name_prefix')}-${stamp}`;
}

function handleSave() {
  const prizeInvalid = isProduct.value ? !productName.value.trim() : pointsAmount.value <= 0;
  const invalid = (isLiveSource.value && !liveSession.value)
    || !dateRange.value
    || !keyword.value.trim()
    || prizeInvalid
    || winnerCount.value < 1;
  if (invalid) {
    hasError.value = true;
    return;
  }

  const [start, end] = dateRange.value ?? [];
  const prizeContent = isProduct.value
    ? productName.value.trim()
    : `${pointsAmount.value} ${t('keyword_lottery.form_dialog.unit.points')}`;

  const payload: KeywordLotteryRow = {
    // 新增時 id / createdAt 留空，交由列表頁補上；編輯時沿用既有值
    id: props.row?.id ?? '',
    createdAt: props.row?.createdAt ?? '',
    drawSource: drawSource.value,
    liveSession: isLiveSource.value ? liveSession.value : '',
    // 活動名稱留空 → 自動命名
    sessionName: activityName.value.trim() || (start ? autoName(start) : ''),
    keyword: keyword.value.trim(),
    startAt: start ? toStamp(start) : '',
    endAt: end ? toStamp(end) : '',
    starFilter: starFilter.value === 'unlimited' ? null : starFilter.value,
    prizeType: prizeType.value,
    prizeContent,
    cart: isProduct.value ? cart.value : '',
    autoDraw: autoDraw.value,
    winnerCount: winnerCount.value,
    // 狀態改由日期推導；新增預設未抽獎，編輯沿用既有
    drawn: props.row?.drawn ?? false,
  };

  showSuccess({
    detail: isEdit.value
      ? t('keyword_lottery.form_dialog.toast.updated')
      : t('keyword_lottery.form_dialog.toast.created'),
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
      ? t('keyword_lottery.form_dialog.header.edit')
      : t('keyword_lottery.form_dialog.header.create')"
    :style="{ width: 'min(640px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-6">
      <!-- ===== 基本設定 ===== -->
      <section class="flex flex-col gap-4">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('keyword_lottery.form_dialog.section.basic') }}
        </h3>

        <!-- 抽獎來源 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.draw_source') }}
          </label>
          <div
            class="flex flex-wrap items-center gap-x-6 gap-y-2"
            role="radiogroup"
            :aria-label="t('keyword_lottery.form_dialog.field.draw_source')"
          >
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="drawSource"
                :value="KeywordDrawSource.LiveSession"
                input-id="draw-source-live"
              />
              <label for="draw-source-live" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('keyword_lottery.form_dialog.draw_source.live_session') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="drawSource"
                :value="KeywordDrawSource.DateRange"
                input-id="draw-source-date"
              />
              <label for="draw-source-date" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('keyword_lottery.form_dialog.draw_source.date_range') }}
              </label>
            </div>
          </div>
        </div>

        <!-- 直播場次（僅依直播場次時顯示） -->
        <div v-if="isLiveSource" class="flex flex-col gap-2">
          <label for="lottery-live-session" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.live_session') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <Select
            v-model="liveSession"
            input-id="lottery-live-session"
            :options="liveSessionOptions"
            filter
            :filter-placeholder="t('keyword_lottery.form_dialog.placeholder.live_session')"
            :placeholder="t('keyword_lottery.form_dialog.placeholder.live_session')"
            class="w-full"
            :invalid="liveSessionInvalid"
            :aria-describedby="liveSessionInvalid ? 'lottery-live-session-error' : undefined"
          />
          <span
            v-if="liveSessionInvalid"
            id="lottery-live-session-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('keyword_lottery.form_dialog.validation.live_session') }}
          </span>
        </div>

        <!-- 活動名稱（選填，自動命名） -->
        <div class="flex flex-col gap-2">
          <label for="lottery-activity-name" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.activity_name') }}
            <span class="text-xs text-[var(--p-text-muted-color)]">{{ t('keyword_lottery.form_dialog.optional_suffix') }}</span>
          </label>
          <InputText
            id="lottery-activity-name"
            v-model="activityName"
            :placeholder="t('keyword_lottery.form_dialog.placeholder.activity_name')"
            fluid
          />
        </div>

        <!-- 活動日期區間（含時間） -->
        <div class="flex flex-col gap-2">
          <label for="lottery-date-range" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.date_range') }}<span class="text-red-600 dark:text-red-400">*</span>
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
            :placeholder="t('keyword_lottery.form_dialog.placeholder.date_range')"
            fluid
            :invalid="dateRangeInvalid"
            :aria-describedby="dateRangeInvalid ? 'lottery-date-range-error' : undefined"
          />
          <span
            v-if="dateRangeInvalid"
            id="lottery-date-range-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('keyword_lottery.form_dialog.validation.date_range') }}
          </span>
        </div>

        <!-- 關鍵字 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-keyword" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.keyword') }}<span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <InputText
            id="lottery-keyword"
            v-model="keyword"
            :placeholder="t('keyword_lottery.form_dialog.placeholder.keyword')"
            fluid
            :invalid="keywordInvalid"
            :aria-describedby="keywordInvalid ? 'lottery-keyword-error lottery-keyword-hint' : 'lottery-keyword-hint'"
          />
          <span
            v-if="keywordInvalid"
            id="lottery-keyword-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('keyword_lottery.form_dialog.validation.keyword') }}
          </span>
          <span id="lottery-keyword-hint" class="text-xs text-[var(--p-text-muted-color)]">
            {{ t('keyword_lottery.form_dialog.hint.keyword') }}
          </span>
        </div>

        <!-- 星等過濾 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-star-filter" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.star_filter') }}
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
              {{ t('keyword_lottery.form_dialog.field.auto_draw') }}
            </label>
            <span class="text-xs text-[var(--p-text-muted-color)]">
              {{ t('keyword_lottery.form_dialog.hint.auto_draw') }}
            </span>
          </div>
          <ToggleSwitch
            v-model="autoDraw"
            input-id="lottery-auto-draw"
          />
        </div>

        <!-- 中獎人數 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-winner-count" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.winner_count') }}<span class="text-red-600 dark:text-red-400">*</span>
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
              {{ t('keyword_lottery.form_dialog.unit.winner') }}
            </span>
          </div>
          <span
            v-if="winnerCountInvalid"
            id="lottery-winner-count-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('keyword_lottery.form_dialog.validation.winner_count') }}
          </span>
        </div>
      </section>

      <!-- ===== 獎品設定 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('keyword_lottery.form_dialog.section.prize') }}
        </h3>

        <!-- 贈送類型 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.prize_type') }}
          </label>
          <div
            class="flex flex-wrap items-center gap-x-6 gap-y-2"
            role="radiogroup"
            :aria-label="t('keyword_lottery.form_dialog.field.prize_type')"
          >
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="prizeType"
                :value="KeywordPrizeType.Product"
                input-id="prize-type-product"
              />
              <label for="prize-type-product" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('keyword_lottery.prize_type.product') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="prizeType"
                :value="KeywordPrizeType.Points"
                input-id="prize-type-points"
              />
              <label for="prize-type-points" class="cursor-pointer text-sm text-[var(--p-text-color)]">
                {{ t('keyword_lottery.prize_type.points') }}
              </label>
            </div>
          </div>
        </div>

        <!-- 條件欄位：商品 -->
        <template v-if="isProduct">
          <div class="flex flex-col gap-2">
            <label for="lottery-product-name" class="text-sm font-medium text-[var(--p-text-color)]">
              {{ t('keyword_lottery.form_dialog.field.product_name') }}<span class="text-red-600 dark:text-red-400">*</span>
            </label>
            <InputText
              id="lottery-product-name"
              v-model="productName"
              :placeholder="t('keyword_lottery.form_dialog.placeholder.product_name')"
              fluid
              :invalid="productNameInvalid"
              :aria-describedby="productNameInvalid ? 'lottery-product-name-error' : undefined"
            />
            <span
              v-if="productNameInvalid"
              id="lottery-product-name-error"
              class="text-xs text-red-600 dark:text-red-400"
            >
              {{ t('keyword_lottery.form_dialog.validation.prize_content') }}
            </span>
          </div>

          <div class="flex flex-col gap-2">
            <label for="lottery-cart" class="text-sm font-medium text-[var(--p-text-color)]">
              {{ t('keyword_lottery.form_dialog.field.cart') }}
            </label>
            <Select
              v-model="cart"
              input-id="lottery-cart"
              :options="CART_OPTIONS"
              :placeholder="t('keyword_lottery.form_dialog.placeholder.cart')"
              class="w-full sm:max-w-xs"
            />
          </div>
        </template>

        <!-- 條件欄位：點數 -->
        <div v-else class="flex flex-col gap-2">
          <label for="lottery-points" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('keyword_lottery.form_dialog.field.points_amount') }}<span class="text-red-600 dark:text-red-400">*</span>
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
              :placeholder="t('keyword_lottery.form_dialog.placeholder.points_amount')"
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
              {{ t('keyword_lottery.form_dialog.unit.points') }}
            </span>
          </div>
          <span
            v-if="pointsAmountInvalid"
            id="lottery-points-error"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('keyword_lottery.form_dialog.validation.prize_content') }}
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
          :label="t('keyword_lottery.form_dialog.button.cancel')"
          @click="handleCancel"
        />
        <Button
          type="button"
          :label="isEdit
            ? t('keyword_lottery.form_dialog.button.save')
            : t('keyword_lottery.form_dialog.button.create')"
          @click="handleSave"
        />
      </div>
    </template>
  </Dialog>
</template>
