<script setup lang="ts">
/**
 * 得標禮抽獎「新增 / 編輯」共用 Dialog（原型版）
 * — 新增 / 編輯共用同一彈窗，差別在 header 標題、footer 主鈕文字與是否帶入既有資料
 * — 三段落：基本資料 / 獎項設定 / 抽獎設定，段落間以 Section 標題 + 上分隔線區隔（不包 Card）
 * — 原型階段：儲存不打後端，而是 emit 表單資料交由列表頁寫入 localStorage（lotteryStore）
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { LotteryStatus, PrizeType, type BidGiftLotteryRow } from '../types';

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

/** 產生系統預設場次名稱：CODEX_LOTTERY_SESSION_YYYYMMDD_HHMMSS */
function generateSessionName(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `CODEX_LOTTERY_SESSION_${stamp}`;
}

// ---- 表單狀態 ----
/** 星等過濾 sentinel：'unlimited' = 不限（PrimeVue Select 不把 null 當有效選取值，故用字串 sentinel 才顯示得出「不限」） */
type StarFilterValue = number | 'unlimited';

const sessionName = ref('');
const searchDate = ref<[Date, Date] | null>(null);
const starFilter = ref<StarFilterValue>('unlimited');
const prizeType = ref<PrizeType>(PrizeType.Product);
const prizeContent = ref('');
/** 金額須滿足：0 = 不限 */
const requiredAmount = ref(0);
const autoDraw = ref(false);
const winnerCount = ref(1);

const hasError = ref(false);

const starFilterOptions = computed(() => [
  { label: t('bid_gift_lottery.form_dialog.star_filter.unlimited'), value: 'unlimited' as StarFilterValue },
  ...[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n as StarFilterValue })),
]);

/** 獎項內容 placeholder 依獎項類型連動 */
const prizeContentPlaceholder = computed(() => (
  prizeType.value === PrizeType.Points
    ? t('bid_gift_lottery.form_dialog.placeholder.prize_content_points')
    : t('bid_gift_lottery.form_dialog.placeholder.prize_content_product')
));

/** 解析 mock 的 'YYYY-MM-DD HH:mm:ss' 字串為 Date（僅供編輯帶入日期精度） */
function parseDate(value: string): Date | null {
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 依模式重置 / 帶入表單 */
function resetForm() {
  hasError.value = false;
  if (isEdit.value && props.row) {
    const r = props.row;
    sessionName.value = r.sessionName;
    const start = parseDate(r.searchStartAt);
    const end = parseDate(r.searchEndAt);
    searchDate.value = start && end ? [start, end] : null;
    starFilter.value = r.starFilter ?? 'unlimited';
    prizeType.value = r.prizeType;
    prizeContent.value = r.prizeContent;
    requiredAmount.value = r.requiredAmount ?? 0;
    autoDraw.value = false;
    winnerCount.value = r.winnerCount;
  } else {
    sessionName.value = generateSessionName();
    searchDate.value = null;
    starFilter.value = 'unlimited';
    prizeType.value = PrizeType.Product;
    prizeContent.value = '';
    requiredAmount.value = 0;
    autoDraw.value = false;
    winnerCount.value = 1;
  }
}

watch(() => props.visible, (v) => {
  if (v) resetForm();
});

function handleRegenerate() {
  sessionName.value = generateSessionName();
}

function handleCancel() {
  localVisible.value = false;
}

/** 將 Date 格式化為 'YYYY-MM-DD HH:mm:ss'（搜尋日期為純日期，時分秒用起訖端點補齊） */
function formatDateTime(d: Date, time: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${time}`;
}

function handleSave() {
  const invalid = !sessionName.value.trim()
    || !searchDate.value
    || !prizeContent.value.trim()
    || winnerCount.value < 1;
  if (invalid) {
    hasError.value = true;
    return;
  }

  const [start, end] = searchDate.value ?? [];
  const payload: BidGiftLotteryRow = {
    // 新增時 id / createdAt 留空，交由列表頁補上；編輯時沿用既有值
    id: props.row?.id ?? '',
    createdAt: props.row?.createdAt ?? '',
    sessionName: sessionName.value.trim(),
    searchStartAt: start ? formatDateTime(start, '00:00:00') : '',
    searchEndAt: end ? formatDateTime(end, '23:59:59') : '',
    prizeType: prizeType.value,
    prizeContent: prizeContent.value.trim(),
    // 表單 0＝不限，對齊 row 的 null＝不限
    requiredAmount: requiredAmount.value === 0 ? null : requiredAmount.value,
    starFilter: starFilter.value === 'unlimited' ? null : starFilter.value,
    winnerCount: winnerCount.value,
    status: props.row?.status ?? LotteryStatus.InProgress,
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
      <!-- ===== 基本資料 ===== -->
      <section class="flex flex-col gap-4">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('bid_gift_lottery.form_dialog.section.basic') }}
        </h3>

        <!-- 場次名稱 + 重新產生 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-session-name" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.session_name') }}<span class="text-[#dc2626]">*</span>
          </label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <InputText
              id="lottery-session-name"
              v-model="sessionName"
              :placeholder="t('bid_gift_lottery.form_dialog.placeholder.session_name')"
              class="w-full sm:flex-1"
              :class="{ 'p-invalid': hasError && !sessionName.trim() }"
            />
            <Button
              type="button"
              severity="secondary"
              outlined
              class="shrink-0"
              :label="t('bid_gift_lottery.form_dialog.button.regenerate')"
              @click="handleRegenerate"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['fas', 'arrows-rotate']" class="mr-2" />
              </template>
            </Button>
          </div>
          <span
            v-if="hasError && !sessionName.trim()"
            class="text-xs text-[#dc2626]"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.session_name') }}
          </span>
          <span class="text-xs text-[var(--p-text-muted-color)]">
            {{ t('bid_gift_lottery.form_dialog.hint.session_name') }}
          </span>
        </div>

        <!-- 搜尋日期（單一 range DatePicker） -->
        <div class="flex flex-col gap-2">
          <label for="lottery-search-date" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.search_date') }}<span class="text-[#dc2626]">*</span>
          </label>
          <DatePicker
            v-model="searchDate"
            input-id="lottery-search-date"
            selection-mode="range"
            date-format="yy/mm/dd"
            show-icon
            :manual-input="false"
            :placeholder="t('bid_gift_lottery.form_dialog.placeholder.search_date')"
            class="w-full"
            :class="{ 'p-invalid': hasError && !searchDate }"
          />
          <span
            v-if="hasError && !searchDate"
            class="text-xs text-[#dc2626]"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.search_date') }}
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
      </section>

      <!-- ===== 獎項設定 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('bid_gift_lottery.form_dialog.section.prize') }}
        </h3>

        <!-- 獎項類型 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.prize_type') }}<span class="text-[#dc2626]">*</span>
          </label>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
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

        <!-- 獎項內容 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-prize-content" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.prize_content') }}<span class="text-[#dc2626]">*</span>
          </label>
          <InputText
            id="lottery-prize-content"
            v-model="prizeContent"
            :placeholder="prizeContentPlaceholder"
            class="w-full"
            :class="{ 'p-invalid': hasError && !prizeContent.trim() }"
          />
          <span
            v-if="hasError && !prizeContent.trim()"
            class="text-xs text-[#dc2626]"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.prize_content') }}
          </span>
        </div>

        <!-- 金額須滿足 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-required-amount" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.required_amount') }}
          </label>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="requiredAmount"
              input-id="lottery-required-amount"
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
            <span class="text-sm text-[var(--p-text-color)]">
              {{ t('bid_gift_lottery.form_dialog.unit.yuan') }}
            </span>
          </div>
          <span class="text-xs text-[var(--p-text-muted-color)]">
            {{ t('bid_gift_lottery.form_dialog.hint.required_amount') }}
          </span>
        </div>
      </section>

      <!-- ===== 抽獎設定 ===== -->
      <section class="flex flex-col gap-4 border-t border-surface-200 pt-6 dark:border-surface-700">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('bid_gift_lottery.form_dialog.section.draw') }}
        </h3>

        <!-- 自動抽獎 -->
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="autoDraw"
            input-id="auto-draw"
            binary
          />
          <label for="auto-draw" class="cursor-pointer text-sm text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.auto_draw') }}
          </label>
          <span class="text-xs text-[var(--p-text-muted-color)]">
            {{ t('bid_gift_lottery.form_dialog.hint.auto_draw') }}
          </span>
        </div>

        <!-- 指定中獎人數 -->
        <div class="flex flex-col gap-2">
          <label for="lottery-winner-count" class="text-sm font-medium text-[var(--p-text-color)]">
            {{ t('bid_gift_lottery.form_dialog.field.winner_count') }}<span class="text-[#dc2626]">*</span>
          </label>
          <div class="flex">
            <InputNumber
              v-model="winnerCount"
              input-id="lottery-winner-count"
              :min="1"
              :max="9999"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '4rem', textAlign: 'center' }"
              :class="{ 'p-invalid': hasError && winnerCount < 1 }"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'minus']" />
              </template>
            </InputNumber>
          </div>
          <span
            v-if="hasError && winnerCount < 1"
            class="text-xs text-[#dc2626]"
          >
            {{ t('bid_gift_lottery.form_dialog.validation.winner_count') }}
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
