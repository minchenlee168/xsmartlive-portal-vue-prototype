<script setup lang="ts">
/**
 * 幫客戶轉訂單 — Helper Checkout
 * — 商家幫客戶填收件人 / 地址 / 付款方式 / 運送方式 / 紅利折抵，
 *   Submit 後標單狀態 5 → 6（進入訂單管理待付款）
 * — mock-only wireframe，實際邏輯後續串 API
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';
import type { BidListRow } from '../composables/useBidListMock';

interface Props {
  visible: boolean;
  selectedCount: number;
  selectedRows: BidListRow[];
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess, showInfo } = useGlobalToast();
const { confirm } = useGlobalDialog();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 訂購者（假設所有勾選同一位；多人時給收件人 prefill 用） */
const buyer = computed(() => props.selectedRows[0]?.winner ?? null);

/** 依 facebookId 去重的訂購者數 */
const uniqueBuyerCount = computed(
  () => new Set(props.selectedRows.map((row) => row.winner.facebookId)).size,
);

/** 是否為多訂購者合單情境 */
const isMultiBuyer = computed(() => uniqueBuyerCount.value > 1);

/** 使用者指定的訂單歸屬會員（存 facebookId）；多人時必填 */
const primaryBuyerId = ref<string | null>(null);

/** 總計 = sum(小計) */
const totalAmount = computed(() =>
  props.selectedRows.reduce((sum, row) => sum + row.totalAmount, 0),
);

/** 單價：小計 / 數量（quantity=0 時 fallback 到 totalAmount 避免除零） */
function unitPrice(row: BidListRow): number {
  return row.quantity > 0 ? Math.round(row.totalAmount / row.quantity) : row.totalAmount;
}

/** mock 紅利累積 */
const bonusAvailable = 0;

const recipientArea = ref<'domestic' | 'outerIsland'>('domestic');
const recipientName = ref<string>('');
const recipientPhone = ref<string>('');
const recipientEmail = ref<string>('');
const recipientAddress = ref<string>('');
const paymentMethod = ref<string>('cash-on-delivery');
const shippingMethod = ref<string | null>(null);
const bankAccountLast5 = ref<string>('');
const selfPickupLocation = ref<string | null>(null);
const bonusUsed = ref<number>(0);
const note = ref<string>('');

/** mock 自取地點資料（接 API 後由後端提供，此為 UI 展示） */
const selfPickupLocations = [
  { id: 'loc-1', name: 'Lijing Zhongshan East Store', tel: '1', address: '1' },
  { id: 'loc-2', name: '第二個自取地點', tel: '2', address: '2' },
];

const paymentOptions = computed(() => [
  { value: 'cash-on-delivery', label: t('bid_list.helper_checkout.payment_option.cash_on_delivery') },
  { value: 'bank-transfer', label: t('bid_list.helper_checkout.payment_option.bank_transfer') },
  { value: 'credit-card', label: t('bid_list.helper_checkout.payment_option.credit_card') },
  { value: 'convenience-store', label: t('bid_list.helper_checkout.payment_option.convenience_store') },
  { value: 'self-pickup', label: t('bid_list.helper_checkout.payment_option.self_pickup') },
]);

const shippingOptions = computed(() => [
  { value: 'home-delivery', label: t('bid_list.helper_checkout.shipping_option.home_delivery') },
  { value: 'convenience-store', label: t('bid_list.helper_checkout.shipping_option.convenience_store') },
  { value: 'pickup', label: t('bid_list.helper_checkout.shipping_option.pickup') },
]);

const areaOptions = computed(() => [
  { value: 'domestic', label: t('bid_list.helper_checkout.area.domestic') },
  { value: 'outerIsland', label: t('bid_list.helper_checkout.area.outer_island') },
]);

async function handleSubmit() {
  if (isMultiBuyer.value) {
    const accepted = await confirm({
      message: t('bid_list.helper_checkout.dialog.confirm_multi_buyer', {
        count: uniqueBuyerCount.value,
      }),
    });
    if (!accepted) return;
  }
  showSuccess({
    detail: t('bid_list.helper_checkout.toast.success', { count: props.selectedCount }),
  });
  localVisible.value = false;
}

function handleClose() {
  localVisible.value = false;
}

function handleImportLast() {
  showInfo({ detail: t('bid_list.helper_checkout.toast.imported') });
}

function resetForm() {
  recipientArea.value = 'domestic';
  recipientName.value = buyer.value?.name ?? '';
  recipientPhone.value = '';
  recipientEmail.value = '';
  recipientAddress.value = '';
  paymentMethod.value = 'cash-on-delivery';
  shippingMethod.value = null;
  bankAccountLast5.value = '';
  selfPickupLocation.value = null;
  bonusUsed.value = 0;
  note.value = '';
  primaryBuyerId.value = null;
}

watch(
  () => props.visible,
  (value) => {
    if (value) resetForm();
  },
);
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.helper_checkout.title')"
    :style="{ width: '50rem' }"
    :breakpoints="{ '960px': '90vw' }"
  >
    <div class="flex flex-col gap-5">
      <!-- Section 1：商品資訊（唯讀 summary，多人合單時每列各自訂購者 + radio 指定歸屬） -->
      <section class="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 rounded p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ t('bid_list.helper_checkout.section.product_info') }}
          </h3>
          <span
            v-if="isMultiBuyer"
            class="text-xs text-amber-600 dark:text-amber-400"
          >
            {{ t('bid_list.helper_checkout.hint.select_primary_buyer') }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <div class="flex flex-col divide-y divide-slate-200 dark:divide-slate-700 min-w-[560px]">
            <div
              v-for="row in selectedRows"
              :key="row.id"
              class="grid grid-cols-12 gap-3 py-3 items-start"
            >
              <div
                v-if="isMultiBuyer"
                class="col-span-1 flex items-start pt-1"
              >
                <RadioButton
                  v-model="primaryBuyerId"
                  :input-id="`primary-buyer-${row.id}`"
                  :value="row.winner.facebookId"
                />
              </div>

              <div
                class="flex flex-col min-w-0"
                :class="isMultiBuyer ? 'col-span-2' : 'col-span-3'"
              >
                <span class="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {{ row.winner.name }}
                </span>
                <span class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {{ row.winner.facebookId }}
                </span>
              </div>

              <div class="col-span-5 flex flex-col text-sm min-w-0">
                <span class="text-slate-800 dark:text-slate-100">
                  {{ row.productName }}
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    ({{ row.createTime }})
                  </span>
                </span>
                <span class="text-slate-600 dark:text-slate-300">
                  {{ row.sessionName }}
                </span>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ t(`bid_list.helper_checkout.origin.${row.bidOriginType}`) }}
                </span>
              </div>

              <div class="col-span-2 text-center text-sm text-slate-700 dark:text-slate-200 pt-1">
                {{ row.quantity }}
              </div>

              <div class="col-span-2 flex flex-col text-xs text-slate-600 dark:text-slate-300 text-right">
                <span>
                  {{ t('bid_list.helper_checkout.summary.unit_price') }}：{{ unitPrice(row) }}
                </span>
                <span>
                  {{ t('bid_list.helper_checkout.column.subtotal') }}：{{ row.totalAmount }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end items-baseline gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('bid_list.helper_checkout.summary.total') }}
          </span>
          <span class="text-lg font-semibold text-primary-600 dark:text-primary-400">
            ${{ totalAmount }}
          </span>
        </div>
      </section>

      <!-- Section 2：運送與付款 -->
      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.helper_checkout.section.shipping_payment') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <!-- 物流方式 + 自取地點 radio（付款方式 = self-pickup 時追加） -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.shipping_method') }}
            </label>
            <Select
              v-model="shippingMethod"
              :options="shippingOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('bid_list.helper_checkout.placeholder.shipping_method')"
              class="w-full"
            />
            <div
              v-if="paymentMethod === 'self-pickup'"
              class="flex flex-col gap-2 pl-1"
            >
              <div
                v-for="loc in selfPickupLocations"
                :key="loc.id"
                class="flex items-center gap-2"
              >
                <RadioButton
                  v-model="selfPickupLocation"
                  :input-id="`pickup-${loc.id}`"
                  :value="loc.id"
                />
                <label
                  :for="`pickup-${loc.id}`"
                  class="text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {{ t('bid_list.helper_checkout.field.self_pickup_location') }}：{{ loc.name }} [TEL：{{ loc.tel }}　地點：{{ loc.address }}]
                </label>
              </div>
            </div>
          </div>

          <!-- 付款方式 + 銀行帳號末五碼（付款方式 = bank-transfer 時追加） -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.payment_method') }}
            </label>
            <Select
              v-model="paymentMethod"
              :options="paymentOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
            <div
              v-if="paymentMethod === 'bank-transfer'"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.helper_checkout.field.bank_account_last5') }}
                <span class="text-slate-400">
                  {{ t('bid_list.helper_checkout.hint.bank_account_last5') }}
                </span>
              </label>
              <InputText
                v-model="bankAccountLast5"
                :placeholder="t('bid_list.helper_checkout.placeholder.bank_account_last5')"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3：收件人資訊 -->
      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.helper_checkout.section.recipient') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.recipient_area') }}
            </label>
            <div class="flex items-center gap-4">
              <div
                v-for="opt in areaOptions"
                :key="opt.value"
                class="flex items-center gap-2"
              >
                <RadioButton
                  v-model="recipientArea"
                  :input-id="`area-${opt.value}`"
                  :value="opt.value"
                />
                <label
                  :for="`area-${opt.value}`"
                  class="text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {{ opt.label }}
                </label>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.recipient_name') }}
            </label>
            <InputText
              v-model="recipientName"
              :placeholder="t('bid_list.helper_checkout.placeholder.recipient_name')"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.recipient_phone') }}
            </label>
            <InputText
              v-model="recipientPhone"
              :placeholder="t('bid_list.helper_checkout.placeholder.recipient_phone')"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.recipient_email') }}
            </label>
            <InputText
              v-model="recipientEmail"
              :placeholder="t('bid_list.helper_checkout.placeholder.recipient_email')"
            />
          </div>

          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.recipient_address') }}
            </label>
            <Textarea
              v-model="recipientAddress"
              rows="2"
              :placeholder="t('bid_list.helper_checkout.placeholder.recipient_address')"
            />
          </div>
        </div>
      </section>

      <!-- Section 4：紅利與備註 -->
      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ t('bid_list.helper_checkout.section.bonus_note') }}
        </h3>
        <div class="flex flex-col gap-3">
          <!-- 紅利累積 / 使用紅利 同一列 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.helper_checkout.field.bonus_available') }}
              </label>
              <div class="text-sm text-slate-700 dark:text-slate-200">
                {{ bonusAvailable }} {{ t('bid_list.helper_checkout.summary.unit_point') }}
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.helper_checkout.field.bonus_used') }}
              </label>
              <InputNumber
                v-model="bonusUsed"
                :min="0"
                :max="bonusAvailable"
                show-buttons
                :suffix="` ${t('bid_list.helper_checkout.summary.unit_point')}`"
                class="w-full"
              />
            </div>
          </div>
          <!-- 訂單備註：置於紅利兩欄下方、整列寬 -->
          <div class="flex flex-col gap-1">
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.helper_checkout.field.note') }}
            </label>
            <Textarea
              v-model="note"
              rows="3"
              :placeholder="t('bid_list.helper_checkout.placeholder.note')"
              class="w-full"
            />
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <Button
          type="button"
          severity="secondary"
          outlined
          @click="handleImportLast"
        >
          {{ t('bid_list.helper_checkout.button.import_last') }}
        </Button>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            severity="secondary"
            outlined
            @click="handleClose"
          >
            {{ t('bid_list.helper_checkout.button.back') }}
          </Button>
          <Button
            type="button"
            severity="primary"
            :disabled="selectedCount === 0 || (isMultiBuyer && !primaryBuyerId)"
            @click="handleSubmit"
          >
            {{ t('bid_list.helper_checkout.button.submit') }}
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>
