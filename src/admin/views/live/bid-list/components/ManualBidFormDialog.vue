<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useManualBidSessionMock } from '../composables/useManualBidSessionMock';
import type {
  ManualBidMemberCandidate,
  ManualBidPickedMember,
} from '../composables/useManualBidSessionMock';
import ManualBidProductPickerDialog from './ManualBidProductPickerDialog.vue';

interface PreselectedProduct {
  name: string;
  image: string;
  unitPrice: number;
}

interface Props {
  visible: boolean;
  /** 待下標會員清單（從得標清單勾選累積） */
  pendingWinners?: ManualBidPickedMember[];
  /** 從列內快捷帶入的預設商品；可被使用者以「換一個商品」按鈕清除 */
  preselectedProduct?: PreselectedProduct | null;
  /** dialog 標題；未傳則 fallback 到 manual_form.title */
  title?: string;
}

/** 表單送出後帶到 parent 的資料；parent 據此在得標清單新增列 */
export interface ManualBidSubmitPayload {
  sessionName: string;
  productName: string;
  productImage: string;
  unitPrice: number;
  cartType: 'multi' | 'preorder';
  multiCartName: string | null;
  bidOriginType: 'facebookPage' | 'preorder' | 'multiCart' | 'community';
  platform: 'facebook' | 'instagram' | 'tiktok' | 'livebuy';
  note: string;
  winners: Array<{
    memberKey: string;
    name: string;
    avatar: string;
    quantity: number;
  }>;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'submit', payload: ManualBidSubmitPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const { members } = useManualBidSessionMock();

const orderSource = ref<'live' | 'fanPost' | 'communityPost' | 'mall'>('live');
const bidSource = ref<'facebook' | 'instagram' | 'tiktok' | 'livebuy'>('facebook');
const sessionId = ref<string>('mock-session');
const cartType = ref<'multi' | 'preorder'>('multi');
/** 選定的既有多購物車名稱（null = 未選）；與編輯資料一致，另可用 multiCartNewName 輸入新名稱 */
const multiCartName = ref<string | null>(null);
const multiCartNewName = ref<string>('');
const unitPrice = ref<number | null>(null);
const note = ref<string>('');

/** 訂購人搜尋類型：名稱搜尋／ID 搜尋（會員 ID、FB、TikTok、IG、LiveBuy ID） */
const orderSearchType = ref<'name' | 'id'>('name');
const orderSearchKeyword = ref<string>('');
const orderSearchExecuted = ref<boolean>(false);

/** 匯入範例檔路徑（放在 apps/backend/public/samples/） */
const importSampleUrl = '/samples/manual_bid_import_sample.xlsx';

/** 批次得標人清單（有 pendingWinners 時使用） */
interface BatchWinnerRow {
  memberKey: string;
  name: string;
  avatar: string;
  memberCode: string;
  quantity: number;
}
const batchWinners = ref<BatchWinnerRow[]>([]);
const batchQuantity = ref<number>(1);

/** 目前選定的商品摘要（來自 preselectedProduct 或使用者後續操作） */
const pickedProduct = ref<PreselectedProduct | null>(null);
const isProductPickerOpen = ref<boolean>(false);

const hasBuyers = computed<boolean>(() => batchWinners.value.length > 0);

const orderSourceOptions = computed(() => [
  { value: 'live', label: t('bid_list.manual_form.order_source.live') },
  { value: 'fanPost', label: t('bid_list.manual_form.order_source.fan_post') },
  { value: 'communityPost', label: t('bid_list.manual_form.order_source.community_post') },
  { value: 'mall', label: t('bid_list.manual_form.order_source.mall') },
]);
const bidSourceOptions = computed(() => [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'livebuy', label: 'LiveBuy' },
]);
const sessionOptions = computed(() => [
  { value: 'mock-session', label: '我是直播場次-2025-12-24' },
]);
const cartTypeOptions = computed(() => [
  { value: 'multi', label: t('bid_list.cart_type.multi') },
  { value: 'preorder', label: t('bid_list.cart_type.preorder') },
]);
/** mock 既有多購物車名稱選項（字串清單，與編輯資料一致） */
const multiCartNameOptions = computed<string[]>(() => ['商城多購物車測試', '水果', '零食組', '社團 A']);

const totalItems = computed<number>(() =>
  batchWinners.value.reduce((sum, row) => sum + row.quantity, 0),
);

const totalAmount = computed<number>(() => {
  return (unitPrice.value ?? 0) * totalItems.value;
});

/** 已加入的訂購人 memberCode 集合，用於搜尋結果排除 */
const addedMemberCodes = computed<Set<string>>(() =>
  new Set(batchWinners.value.map((w) => w.memberCode)),
);

const orderSearchPlaceholder = computed<string>(() =>
  orderSearchType.value === 'id'
    ? t('bid_list.manual_form.order_search.placeholder_id')
    : t('bid_list.manual_form.order_search.placeholder_name'),
);

/** 會員可供「ID 搜尋」比對的所有 ID（會員 ID + 各平台 ID） */
function collectMemberIds(member: ManualBidMemberCandidate): string[] {
  return [
    member.memberCode,
    member.socialIds?.facebook,
    member.socialIds?.tiktok,
    member.socialIds?.instagram,
    member.socialIds?.livebuy,
  ].filter((id): id is string => Boolean(id));
}

/** ID 搜尋結果列的 ID 摘要（如「FB：xxx · LiveBuy：xxx」） */
function formatSocialIds(member: ManualBidMemberCandidate): string {
  const parts: string[] = [];
  if (member.socialIds?.facebook) parts.push(`FB：${member.socialIds.facebook}`);
  if (member.socialIds?.tiktok) parts.push(`TikTok：${member.socialIds.tiktok}`);
  if (member.socialIds?.instagram) parts.push(`IG：${member.socialIds.instagram}`);
  if (member.socialIds?.livebuy) parts.push(`LiveBuy：${member.socialIds.livebuy}`);
  return parts.join(' · ');
}

const orderSearchResults = computed<ManualBidMemberCandidate[]>(() => {
  if (!orderSearchExecuted.value) return [];
  const keyword = orderSearchKeyword.value.trim();
  if (!keyword) return [];
  const lower = keyword.toLowerCase();
  return members.value.filter((member) => {
    if (orderSearchType.value === 'id') {
      return collectMemberIds(member).some((id) => id.toLowerCase().includes(lower));
    }
    return (
      member.name.toLowerCase().includes(lower) ||
      member.socialAccount.toLowerCase().includes(lower)
    );
  });
});

function handleCreate() {
  const bidOriginTypeMap: Record<typeof orderSource.value, ManualBidSubmitPayload['bidOriginType']> = {
    live: 'facebookPage',
    fanPost: 'facebookPage',
    communityPost: 'community',
    mall: 'multiCart',
  };
  const currentSessionLabel = sessionOptions.value.find((option) => option.value === sessionId.value)?.label ?? '';
  // 多購物車名稱：優先取新輸入名稱，其次取選定的既有名稱（與編輯資料一致）
  const currentMultiCartLabel = cartType.value === 'multi'
    ? multiCartNewName.value.trim() || multiCartName.value
    : null;
  emit('submit', {
    sessionName: currentSessionLabel,
    productName: pickedProduct.value?.name ?? '',
    productImage: pickedProduct.value?.image ?? '',
    unitPrice: unitPrice.value ?? 0,
    cartType: cartType.value,
    multiCartName: currentMultiCartLabel,
    bidOriginType: bidOriginTypeMap[orderSource.value],
    platform: bidSource.value,
    note: note.value,
    winners: batchWinners.value.map((row) => ({
      memberKey: row.memberKey,
      name: row.name,
      avatar: row.avatar,
      quantity: row.quantity,
    })),
  });
  showSuccess({
    detail: t('bid_list.manual_form.batch.created_toast', { count: batchWinners.value.length }),
  });
  localVisible.value = false;
}

function handleSelectProduct() {
  isProductPickerOpen.value = true;
}

function handleChangeProduct() {
  isProductPickerOpen.value = true;
}

function handleProductPickerConfirm(product: PreselectedProduct) {
  pickedProduct.value = { ...product };
  unitPrice.value = product.unitPrice;
}

function handleRemoveWinner(index: number) {
  batchWinners.value.splice(index, 1);
}

function handleClearWinners() {
  batchWinners.value = [];
}

function handleOrderSearch() {
  orderSearchExecuted.value = true;
}

function handleAddCandidate(member: ManualBidMemberCandidate) {
  if (addedMemberCodes.value.has(member.memberCode)) {
    showSuccess({
      detail: t('bid_list.manual_form.order_search.duplicated_toast', { name: member.name }),
    });
    return;
  }
  batchWinners.value.push({
    memberKey: member.memberCode,
    name: member.name,
    avatar: member.avatar,
    memberCode: member.memberCode,
    quantity: Math.max(1, batchQuantity.value),
  });
  showSuccess({
    detail: t('bid_list.manual_form.order_search.added_toast', { name: member.name }),
  });
}

function handleApplyBatchQuantity() {
  const qty = Math.max(1, batchQuantity.value);
  for (const row of batchWinners.value) {
    row.quantity = qty;
  }
}

/** dialog 開啟時，把 pendingWinners / preselectedProduct 帶進 form state */
watch(
  () => [props.visible, props.pendingWinners, props.preselectedProduct] as const,
  ([isVisible, winners, product]) => {
    if (!isVisible) {
      // 關閉時重置搜尋狀態，下次開啟乾淨
      orderSearchKeyword.value = '';
      orderSearchExecuted.value = false;
      orderSearchType.value = 'name';
      return;
    }
    batchWinners.value = (winners ?? []).map((picked) => ({
      memberKey: picked.member.memberCode,
      name: picked.member.name,
      avatar: picked.member.avatar,
      memberCode: picked.member.memberCode,
      quantity: picked.quantity,
    }));
    if (product) {
      pickedProduct.value = { ...product };
      unitPrice.value = product.unitPrice;
    } else {
      pickedProduct.value = null;
    }
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="props.title ?? t('bid_list.manual_form.title')"
    :style="{ width: '50rem' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 訂單來源 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.order_source') }}
        </label>
        <div class="flex flex-wrap gap-4">
          <label
            v-for="option in orderSourceOptions"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm cursor-pointer"
          >
            <RadioButton
              v-model="orderSource"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- 標單來源 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.bid_source') }}
        </label>
        <div class="flex flex-wrap gap-4">
          <label
            v-for="option in bidSourceOptions"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm cursor-pointer"
          >
            <RadioButton
              v-model="bidSource"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- 選擇直播場次 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.session') }}
        </label>
        <Select
          v-model="sessionId"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <!-- 購物車類型 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.cart_type.label') }}
        </label>
        <div class="flex flex-wrap gap-4">
          <label
            v-for="option in cartTypeOptions"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm cursor-pointer"
          >
            <RadioButton
              v-model="cartType"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- 購物車名稱（與編輯資料一致：選既有 多購物車 或 輸入新名稱） -->
      <div
        v-if="cartType === 'multi'"
        class="flex flex-col gap-1"
      >
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.multi_cart_name') }}
        </label>
        <div class="flex items-center gap-3">
          <Select
            v-model="multiCartName"
            :options="multiCartNameOptions"
            show-clear
            :placeholder="t('bid_list.edit_bid.placeholder.multi_cart_select')"
            class="flex-1"
          />
          <span class="text-sm text-slate-400 dark:text-slate-500">
            {{ t('bid_list.edit_bid.text.or') }}
          </span>
          <InputText
            v-model="multiCartNewName"
            :placeholder="t('bid_list.edit_bid.placeholder.multi_cart_new_name')"
            class="flex-1"
          />
        </div>
      </div>

      <!-- 訂購人：搜尋加入 + 已加入清單 -->
      <div class="flex flex-col gap-3">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.buyer') }}
        </label>

        <!-- 搜尋 UI -->
        <div class="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div class="flex items-center gap-4 flex-wrap">
            <span class="text-sm text-slate-600 dark:text-slate-300">
              {{ t('bid_list.manual_form.order_search.type_label') }}
            </span>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <RadioButton
                v-model="orderSearchType"
                value="name"
              />
              <span>{{ t('bid_list.manual_form.order_search.type_name') }}</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
              <RadioButton
                v-model="orderSearchType"
                value="id"
              />
              <span>{{ t('bid_list.manual_form.order_search.type_id') }}</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <InputText
              v-model="orderSearchKeyword"
              :placeholder="orderSearchPlaceholder"
              class="flex-1"
              @keyup.enter="handleOrderSearch"
            />
            <Button
              severity="primary"
              @click="handleOrderSearch"
            >
              {{ t('bid_list.manual_form.order_search.search') }}
            </Button>
            <Button severity="primary" outlined>
              <FontAwesomeIcon :icon="['fas', 'file-import']" />
              <span class="ml-1">{{ t('bid_list.manual_form.button.import') }}</span>
            </Button>
            <a
              :href="importSampleUrl"
              class="text-xs text-primary-500 hover:underline whitespace-nowrap"
              download
            >
              {{ t('bid_list.manual_form.button.download_sample') }}
            </a>
          </div>

          <!-- 搜尋結果 -->
          <div
            v-if="!orderSearchExecuted"
            class="text-xs text-slate-500 italic"
          >
            {{ t('bid_list.manual_form.order_search.result_empty_hint') }}
          </div>
          <div
            v-else-if="orderSearchResults.length === 0"
            class="text-xs text-slate-500 italic"
          >
            {{ t('bid_list.manual_form.order_search.result_no_match') }}
          </div>
          <div
            v-else
            class="flex flex-col gap-1"
          >
            <div class="text-xs text-slate-500">
              {{ t('bid_list.manual_form.order_search.result_title', { count: orderSearchResults.length }) }}
            </div>
            <div class="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
              <div
                v-for="member in orderSearchResults"
                :key="member.id"
                class="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <img
                  :src="member.avatar"
                  alt=""
                  class="w-8 h-8 rounded-full object-cover"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">{{ member.name }}</div>
                  <div class="text-xs text-slate-500">
                    {{ member.memberCode }}
                    <span
                      v-if="member.socialAccount !== '-'"
                      class="ml-2"
                    >· {{ member.socialAccount }}</span>
                  </div>
                  <div
                    v-if="orderSearchType === 'id' && formatSocialIds(member)"
                    class="text-xs text-slate-400"
                  >
                    {{ formatSocialIds(member) }}
                  </div>
                </div>
                <span
                  v-if="addedMemberCodes.has(member.memberCode)"
                  class="text-xs text-slate-400"
                >
                  {{ t('bid_list.manual_form.order_search.already_added') }}
                </span>
                <Button
                  v-else
                  size="small"
                  severity="primary"
                  outlined
                  @click="handleAddCandidate(member)"
                >
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                  <span class="ml-1">{{ t('bid_list.manual_form.order_search.add') }}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- 已加入的訂購人清單 -->
        <div
          v-if="batchWinners.length > 0"
          class="flex flex-col gap-2"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-sm text-slate-600 dark:text-slate-300 flex-1">
              {{ t('bid_list.manual_form.batch.winners_label') }}
              <span class="ml-2 text-xs text-slate-400">
                （{{ t('bid_list.manual_form.batch.total_summary', {
                  count: batchWinners.length,
                  items: totalItems,
                  amount: totalAmount,
                }) }}）
              </span>
            </label>
            <div class="flex items-center gap-1">
              <label class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {{ t('bid_list.manual_bid.session_records.member.batch_quantity_label') }}
              </label>
              <InputNumber
                v-model="batchQuantity"
                :min="1"
                show-buttons
                button-layout="horizontal"
                :input-style="{ width: '3rem', textAlign: 'center' }"
              >
                <template #incrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                </template>
                <template #decrementbuttonicon>
                  <FontAwesomeIcon :icon="['fas', 'minus']" />
                </template>
              </InputNumber>
              <Button
                size="small"
                severity="secondary"
                outlined
                @click="handleApplyBatchQuantity"
              >
                {{ t('bid_list.manual_bid.session_records.member.batch_apply') }}
              </Button>
              <Button
                size="small"
                severity="secondary"
                text
                @click="handleClearWinners"
              >
                {{ t('bid_list.manual_bid.session_records.member.clear_selection') }}
              </Button>
            </div>
          </div>
          <div class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0">
                <tr class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_form.batch.column_member') }}</th>
                  <th class="px-3 py-2 text-center w-28">{{ t('bid_list.manual_form.batch.column_quantity') }}</th>
                  <th class="px-3 py-2 text-right w-24">{{ t('bid_list.manual_form.batch.column_subtotal') }}</th>
                  <th class="px-3 py-2 text-left w-20">{{ t('bid_list.manual_form.batch.column_actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in batchWinners"
                  :key="row.memberKey"
                  class="border-t border-slate-100 dark:border-slate-800"
                >
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <img
                        :src="row.avatar"
                        alt=""
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div class="flex flex-col">
                        <span class="text-sm font-medium">{{ row.name }}</span>
                        <span class="text-xs text-slate-400">{{ row.memberCode }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <InputNumber
                      v-model="row.quantity"
                      :min="1"
                      show-buttons
                      button-layout="horizontal"
                      :input-style="{ width: '3rem', textAlign: 'center' }"
                    >
                      <template #incrementbuttonicon>
                        <FontAwesomeIcon :icon="['fas', 'plus']" />
                      </template>
                      <template #decrementbuttonicon>
                        <FontAwesomeIcon :icon="['fas', 'minus']" />
                      </template>
                    </InputNumber>
                  </td>
                  <td class="px-3 py-2 text-right">
                    ${{ (unitPrice ?? 0) * row.quantity }}
                  </td>
                  <td class="px-3 py-2">
                    <Button
                      size="small"
                      severity="danger"
                      text
                      @click="handleRemoveWinner(index)"
                    >
                      {{ t('bid_list.manual_form.batch.remove') }}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Divider />

      <!-- 選擇商品 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.product') }}
        </label>
        <div
          v-if="pickedProduct"
          class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
        >
          <img
            :src="pickedProduct.image"
            alt=""
            class="w-14 h-14 rounded object-cover"
          />
          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-sm font-medium truncate">{{ pickedProduct.name }}</span>
            <span class="text-xs text-slate-500">
              {{ t('bid_list.manual_form.label.unit_price') }}：${{ pickedProduct.unitPrice }}
            </span>
          </div>
          <Button
            size="small"
            severity="secondary"
            outlined
            @click="handleChangeProduct"
          >
            {{ t('bid_list.manual_form.button.change_product') }}
          </Button>
        </div>
        <div v-else>
          <Button
            severity="primary"
            @click="handleSelectProduct"
          >
            {{ t('bid_list.manual_form.button.select_product') }}
          </Button>
        </div>
      </div>

      <!-- 單價（一律顯示；件數由每位訂購人各自設定） -->
      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.unit_price') }}
        </label>
        <InputNumber
          v-model="unitPrice"
          :min="0"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.total') }}
        </label>
        <div class="text-lg font-semibold text-primary-500">
          ${{ totalAmount }}
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.manual_form.label.note') }}
        </label>
        <Textarea
          v-model="note"
          :placeholder="t('bid_list.manual_form.placeholder.note')"
          rows="3"
        />
      </div>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.manual_form.button.cancel') }}
      </Button>
      <Button
        severity="primary"
        :disabled="!hasBuyers"
        @click="handleCreate"
      >
        {{ hasBuyers
          ? t('bid_list.manual_form.button.create_batch', { count: batchWinners.length })
          : t('bid_list.manual_form.button.create') }}
      </Button>
    </template>

    <ManualBidProductPickerDialog
      v-model:visible="isProductPickerOpen"
      :current-product-name="pickedProduct?.name"
      @confirm="handleProductPickerConfirm"
    />
  </Dialog>
</template>
