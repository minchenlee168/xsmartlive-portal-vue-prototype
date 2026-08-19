<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  ManualBidMemberCandidate,
  ManualBidMemberSource,
  ManualBidPickedMember,
  ManualBidProduct,
} from '../composables/useManualBidSessionMock';

interface Props {
  members: ManualBidMemberCandidate[];
  sessionId: string;
  product: ManualBidProduct;
  /** 額外預帶會員：不在原候選池、固定顯示於列表最上方（不受 filter 影響、搜尋仍過濾） */
  extraMembers?: ManualBidMemberCandidate[];
  /** 預帶會員的 id（會自動勾選） */
  defaultSelectedIds?: string[];
}

interface Emits {
  (event: 'submit', payload: ManualBidPickedMember[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

type FilterKey = 'allPool' | ManualBidMemberSource;

const activeFilter = ref<FilterKey>('allPool');
const searchKeyword = ref<string>('');

const extraMemberIds = computed<Set<string>>(() =>
  new Set(props.extraMembers?.map((m) => m.id) ?? []),
);

/** memberId → quantity；跨 filter/搜尋保留 */
const selection = ref<Map<string, number>>(new Map());
const batchQuantity = ref<number>(1);
const ignoreStock = ref<boolean>(false);

const filterOptions = computed<Array<{ label: string; value: FilterKey }>>(() => [
  { value: 'allPool', label: t('bid_list.manual_bid.session_records.member.source.all_pool') },
  { value: 'smartMatch', label: t('bid_list.manual_bid.session_records.member.source.smart_match') },
  { value: 'commentUnpaired', label: t('bid_list.manual_bid.session_records.member.source.comment_unpaired') },
  { value: 'sessionBuyer', label: t('bid_list.manual_bid.session_records.member.source.session_buyer') },
  { value: 'productBuyer', label: t('bid_list.manual_bid.session_records.member.source.product_buyer') },
  { value: 'recent', label: t('bid_list.manual_bid.session_records.member.source.recent') },
  { value: 'all', label: t('bid_list.manual_bid.session_records.member.source.all') },
]);

const platformIconMap: Record<ManualBidMemberCandidate['platform'], string[]> = {
  facebook: ['fab', 'facebook'],
  instagram: ['fab', 'instagram'],
  tiktok: ['fab', 'tiktok'],
  line: ['fab', 'line'],
};

function matchKeyword(member: ManualBidMemberCandidate, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = [
    member.memberCode,
    member.name,
    member.socialAccount,
    member.phoneLast4,
    member.email,
  ].join(' ').toLowerCase();
  return haystack.includes(keyword);
}

/** 預帶會員在當前搜尋下的可見清單（不受 filter select 影響） */
const extraDisplay = computed<ManualBidMemberCandidate[]>(() => {
  if (!props.extraMembers?.length) return [];
  const keyword = searchKeyword.value.trim().toLowerCase();
  return props.extraMembers.filter((m) => matchKeyword(m, keyword));
});

/** 候選池會員（已排除預帶會員；受 filter + 搜尋影響） */
const filteredMembers = computed<ManualBidMemberCandidate[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();

  return props.members.filter((member) => {
    if (extraMemberIds.value.has(member.id)) return false;

    if (activeFilter.value !== 'all' && member.sessionId !== props.sessionId) {
      return false;
    }

    if (activeFilter.value !== 'allPool' && activeFilter.value !== 'all') {
      if (!member.sources.includes(activeFilter.value)) {
        return false;
      }
      const productBound: FilterKey[] = ['smartMatch', 'commentUnpaired', 'productBuyer'];
      if (productBound.includes(activeFilter.value) && member.productId && member.productId !== props.product.id) {
        return false;
      }
    }

    return matchKeyword(member, keyword);
  });
});

/** 當前顯示（預帶 + 候選池）是否全被選取 */
const isAllShownSelected = computed<boolean>(() => {
  const combined = [...extraDisplay.value, ...filteredMembers.value];
  if (!combined.length) return false;
  return combined.every((m) => selection.value.has(m.id));
});

const totalSelected = computed<number>(() => selection.value.size);
const totalItems = computed<number>(() => {
  let sum = 0;
  for (const qty of selection.value.values()) {
    sum += qty;
  }
  return sum;
});

const isStockEnforced = computed<boolean>(() => {
  return !props.product.isPreorder && !props.product.allowOversell;
});

const isOverStock = computed<boolean>(() => {
  return isStockEnforced.value && totalItems.value > props.product.stock;
});

const canSubmit = computed<boolean>(() => {
  if (totalSelected.value === 0) return false;
  if (isOverStock.value && !ignoreStock.value) return false;
  return true;
});

function isPicked(id: string): boolean {
  return selection.value.has(id);
}

function getQuantity(id: string): number {
  return selection.value.get(id) ?? 1;
}

function togglePick(id: string, checked: boolean) {
  if (checked) {
    if (!selection.value.has(id)) {
      selection.value.set(id, Math.max(1, batchQuantity.value));
    }
  } else {
    selection.value.delete(id);
  }
}

function updateQuantity(id: string, value: number | null) {
  const qty = Math.max(1, value ?? 1);
  if (selection.value.has(id)) {
    selection.value.set(id, qty);
  }
}

function toggleAllShown(checked: boolean) {
  const combined = [...extraDisplay.value, ...filteredMembers.value];
  if (checked) {
    for (const member of combined) {
      if (!selection.value.has(member.id)) {
        selection.value.set(member.id, Math.max(1, batchQuantity.value));
      }
    }
  } else {
    for (const member of combined) {
      selection.value.delete(member.id);
    }
  }
}

function applyBatchQuantity() {
  const qty = Math.max(1, batchQuantity.value);
  for (const id of selection.value.keys()) {
    selection.value.set(id, qty);
  }
}

function clearAllSelection() {
  selection.value.clear();
  ignoreStock.value = false;
}

function handleSubmit() {
  if (!canSubmit.value) return;
  const memberMap = new Map<string, ManualBidMemberCandidate>();
  for (const m of props.members) memberMap.set(m.id, m);
  for (const m of props.extraMembers ?? []) memberMap.set(m.id, m);
  const payload: ManualBidPickedMember[] = [];
  for (const [id, quantity] of selection.value) {
    const member = memberMap.get(id);
    if (member) {
      payload.push({ member, quantity });
    }
  }
  emit('submit', payload);
}

// 商品換了要重置庫存警示（選取要保留，讓用戶決定）
watch(() => props.product.id, () => {
  ignoreStock.value = false;
});

// 首次載入時把 defaultSelectedIds 帶進 selection
onMounted(() => {
  if (!props.defaultSelectedIds?.length) return;
  for (const id of props.defaultSelectedIds) {
    if (!selection.value.has(id)) {
      selection.value.set(id, 1);
    }
  }
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 篩選列 -->
    <div class="flex flex-col md:flex-row gap-2 md:items-center">
      <div class="flex items-center gap-2">
        <label class="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {{ t('bid_list.manual_bid.session_records.member.filter_label') }}
        </label>
        <Select
          v-model="activeFilter"
          :options="filterOptions"
          option-label="label"
          option-value="value"
          class="min-w-[200px]"
        />
      </div>
      <InputText
        v-model="searchKeyword"
        :placeholder="t('bid_list.manual_bid.session_records.member.search_placeholder')"
        class="flex-1"
      />
    </div>

    <!-- 全選列 -->
    <div
      v-if="filteredMembers.length || extraDisplay.length"
      class="flex items-center gap-2 px-2 text-sm text-slate-600 dark:text-slate-300"
    >
      <Checkbox
        :model-value="isAllShownSelected"
        binary
        @update:model-value="toggleAllShown"
      />
      <span>{{ t('bid_list.manual_bid.session_records.member.select_all_current') }}</span>
    </div>

    <!-- 會員列表 -->
    <div
      v-if="!filteredMembers.length && !extraDisplay.length"
      class="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
    >
      {{ t('bid_list.manual_bid.session_records.empty_member') }}
    </div>
    <div
      v-else
      class="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1"
    >
      <template
        v-for="member in [...extraDisplay, ...filteredMembers]"
        :key="member.id"
      >
        <div
          class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
          :class="[
            isPicked(member.id)
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-950'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
          ]"
        >
          <Checkbox
            :model-value="isPicked(member.id)"
            binary
            @update:model-value="(value: boolean) => togglePick(member.id, value)"
          />
          <div class="relative flex-shrink-0">
            <img
              :src="member.avatar"
              alt=""
              class="w-12 h-12 rounded-full object-cover"
            />
            <FontAwesomeIcon
              :icon="platformIconMap[member.platform]"
              class="absolute -bottom-1 -right-1 text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-full p-0.5 w-4 h-4"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ member.name }}
              </span>
              <span
                v-if="member.isVip"
                class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              >
                {{ t('bid_list.manual_bid.session_records.member.vip') }}
              </span>
              <span
                v-if="extraMemberIds.has(member.id)"
                class="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
              >
                {{ t('bid_list.manual_bid.records_note.from_records') }}
              </span>
              <span class="text-xs text-slate-400">{{ member.memberCode }}</span>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ member.socialAccount }}
              <span class="mx-1">·</span>
              {{ t('bid_list.manual_bid.session_records.member.field.phone_last4') }} {{ member.phoneLast4 }}
              <span class="mx-1">·</span>
              {{ member.email }}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
              {{ member.contextNote }}
            </div>
          </div>
          <div
            v-if="isPicked(member.id)"
            class="flex items-center gap-2"
          >
            <label class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('bid_list.manual_bid.session_records.member.quantity_each') }}
            </label>
            <InputNumber
              :model-value="getQuantity(member.id)"
              :min="1"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '3rem', textAlign: 'center' }"
              @update:model-value="(value: number | null) => updateQuantity(member.id, value)"
            >
              <template #incrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </template>
              <template #decrementbuttonicon>
                <FontAwesomeIcon :icon="['fas', 'minus']" />
              </template>
            </InputNumber>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部 sticky bar：批次設定 + 庫存 + 送出 -->
    <div class="sticky bottom-0 -mx-4 md:-mx-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 md:px-6 py-3 flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-3">
        <div class="text-sm text-slate-700 dark:text-slate-200">
          {{ t('bid_list.manual_bid.session_records.member.selected_summary',
            { count: totalSelected, items: totalItems }) }}
        </div>
        <Button
          v-if="totalSelected > 0"
          size="small"
          severity="secondary"
          text
          @click="clearAllSelection"
        >
          {{ t('bid_list.manual_bid.session_records.member.clear_selection') }}
        </Button>
        <div class="flex items-center gap-1 ml-auto">
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
            :disabled="totalSelected === 0"
            @click="applyBatchQuantity"
          >
            {{ t('bid_list.manual_bid.session_records.member.batch_apply') }}
          </Button>
        </div>
      </div>

      <!-- 庫存資訊 -->
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span
          v-if="product.isPreorder"
          class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        >
          {{ t('bid_list.manual_bid.session_records.member.stock_preorder') }}
        </span>
        <span
          v-else-if="product.allowOversell"
          class="px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
        >
          {{ t('bid_list.manual_bid.session_records.member.stock_oversell') }}
        </span>
        <span
          v-else
          class="text-slate-600 dark:text-slate-300"
          :class="isOverStock ? 'text-red-600 dark:text-red-400 font-medium' : ''"
        >
          {{ t('bid_list.manual_bid.session_records.member.stock_info', { stock: product.stock }) }}
        </span>
      </div>

      <!-- 庫存不足警示 -->
      <div
        v-if="isOverStock"
        class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
      >
        <FontAwesomeIcon :icon="['fas', 'triangle-exclamation']" />
        <span>{{ t('bid_list.manual_bid.session_records.member.stock_over_warning') }}</span>
      </div>
      <div
        v-if="isOverStock"
        class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
      >
        <Checkbox
          v-model="ignoreStock"
          binary
        />
        <span>{{ t('bid_list.manual_bid.session_records.member.ignore_stock') }}</span>
      </div>

      <div class="flex justify-end">
        <Button
          severity="primary"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ t('bid_list.manual_bid.session_records.member.submit_batch', { count: totalSelected }) }}
        </Button>
      </div>
    </div>
  </div>
</template>
