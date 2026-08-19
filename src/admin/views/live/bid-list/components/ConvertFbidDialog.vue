<script setup lang="ts">
/**
 * 標單轉移
 * — 商家把此買家標單內誤帶的 PSID 替換成正確的 Facebook ID
 * — Dialog 只顯示唯讀資訊：標單編號 / 訂購者 / 商品名稱 / PSID
 *   轉換為：可切換「名稱搜尋 / FB ID 搜尋」找到目標會員後帶入
 * — 對應舊 168money 得標清單列快捷「轉換FBID」
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import type { BidListRow } from '../composables/useBidListMock';
import {
  useManualBidSessionMock,
  type ManualBidMemberCandidate,
} from '../composables/useManualBidSessionMock';

interface Props {
  visible: boolean;
  row: BidListRow | null;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();
const { members } = useManualBidSessionMock();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 轉換為搜尋類型：名稱 / FB ID */
const searchType = ref<'name' | 'fbid'>('name');
const keyword = ref<string>('');
/** 已選定的轉移目標會員 */
const selectedMember = ref<ManualBidMemberCandidate | null>(null);

const searchPlaceholder = computed<string>(() =>
  searchType.value === 'fbid'
    ? t('bid_list.convert_fbid.placeholder.fbid')
    : t('bid_list.convert_fbid.placeholder.name'),
);

/** 候選會員（僅列出有 Facebook ID 者；轉移對象需具備 FB ID） */
const searchResults = computed<ManualBidMemberCandidate[]>(() => {
  const lower = keyword.value.trim().toLowerCase();
  if (!lower) return [];
  return members.value
    .filter((member) => Boolean(member.socialIds?.facebook))
    .filter((member) =>
      searchType.value === 'fbid'
        ? member.socialIds!.facebook!.toLowerCase().includes(lower)
        : member.name.toLowerCase().includes(lower)
          || member.socialAccount.toLowerCase().includes(lower),
    );
});

watch(
  () => props.visible,
  (value) => {
    if (value) {
      searchType.value = 'name';
      keyword.value = '';
      selectedMember.value = null;
    }
  },
);

watch(searchType, () => {
  keyword.value = '';
});

function handlePickMember(member: ManualBidMemberCandidate) {
  selectedMember.value = member;
  keyword.value = '';
}

function handleSubmit() {
  if (!selectedMember.value) return;
  showSuccess({ detail: t('bid_list.convert_fbid.toast.success') });
  localVisible.value = false;
}

function handleClose() {
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.convert_fbid.title')"
    :style="{ width: '560px' }"
    :breakpoints="{ '640px': '90vw' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 唯讀資訊：label 在上、內容在下（§7.8）；無框線，以淺色底群組（§6.5、§6.4） -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md bg-surface-50 px-4 py-3 dark:bg-surface-800">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ t('bid_list.convert_fbid.field.bid_number') }}
          </span>
          <span class="break-all text-sm text-surface-800 dark:text-surface-100">
            {{ row?.bidNumber || '—' }}
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ t('bid_list.convert_fbid.field.buyer') }}
          </span>
          <span class="text-sm text-surface-800 dark:text-surface-100">
            {{ row?.winner.name || '—' }}
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ t('bid_list.convert_fbid.field.product') }}
          </span>
          <span class="text-sm text-surface-800 dark:text-surface-100">
            {{ row?.productName || '—' }}
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ t('bid_list.convert_fbid.field.psid') }}
          </span>
          <span class="break-all text-sm text-surface-800 dark:text-surface-100">
            {{ row?.winner.psid || row?.winner.facebookId || '—' }}
          </span>
        </div>
      </div>

      <!-- 轉換為：搜尋轉移目標會員（label 上方，§7.8；不再包框） -->
      <div class="flex flex-col gap-2">
        <span
          id="convert-to-label"
          class="text-sm font-medium text-surface-700 dark:text-surface-200"
        >
          {{ t('bid_list.convert_fbid.field.convert_to') }}<span class="text-[#DC2626]">*</span>
        </span>
        <div
          class="flex items-center gap-4"
          role="radiogroup"
          aria-labelledby="convert-to-label"
        >
          <div class="flex items-center gap-2">
            <RadioButton
              v-model="searchType"
              input-id="convert-search-name"
              value="name"
            />
            <label
              for="convert-search-name"
              class="cursor-pointer text-sm text-surface-600 dark:text-surface-300"
            >
              {{ t('bid_list.convert_fbid.search.type_name') }}
            </label>
          </div>
          <div class="flex items-center gap-2">
            <RadioButton
              v-model="searchType"
              input-id="convert-search-fbid"
              value="fbid"
            />
            <label
              for="convert-search-fbid"
              class="cursor-pointer text-sm text-surface-600 dark:text-surface-300"
            >
              {{ t('bid_list.convert_fbid.search.type_fbid') }}
            </label>
          </div>
        </div>
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="keyword"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            class="w-full"
          />
        </IconField>

        <!-- 搜尋結果 -->
        <div
          v-if="keyword.trim()"
          class="flex max-h-48 flex-col divide-y divide-surface-200 overflow-y-auto rounded-md border border-surface-200 dark:divide-surface-700 dark:border-surface-700"
        >
          <button
            v-for="member in searchResults"
            :key="member.id"
            type="button"
            class="flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-50 dark:hover:bg-surface-800"
            @click="handlePickMember(member)"
          >
            <div class="min-w-0">
              <div class="truncate text-sm text-surface-800 dark:text-surface-100">
                {{ member.name }}
                <span class="text-xs text-surface-500 dark:text-surface-400">（{{ member.socialAccount }}）</span>
              </div>
              <div class="break-all text-xs text-surface-500 dark:text-surface-400">
                {{ t('bid_list.winner_profile.tooltip_prefix') }}{{ member.socialIds?.facebook }}
              </div>
            </div>
          </button>
          <div
            v-if="searchResults.length === 0"
            class="px-3 py-2 text-sm text-surface-500 dark:text-surface-400"
          >
            {{ t('bid_list.convert_fbid.search.no_match') }}
          </div>
        </div>

        <!-- 已選會員（主色 soft 高亮標示已選定的轉移對象） -->
        <div
          v-if="selectedMember"
          class="flex items-center gap-3 rounded-md border border-primary-300 bg-primary-50 px-3 py-2 dark:border-primary-700 dark:bg-primary-900/20"
        >
          <div class="min-w-0 flex-1">
            <div class="text-xs text-surface-500 dark:text-surface-400">
              {{ t('bid_list.convert_fbid.search.selected') }}
            </div>
            <div class="truncate text-sm font-medium text-surface-800 dark:text-surface-100">
              {{ selectedMember.name }}
              <span class="text-xs font-normal text-surface-500 dark:text-surface-400">（{{ selectedMember.socialAccount }}）</span>
            </div>
            <div class="break-all text-xs text-surface-500 dark:text-surface-400">
              {{ t('bid_list.winner_profile.tooltip_prefix') }}{{ selectedMember.socialIds?.facebook }}
            </div>
          </div>
          <Button
            type="button"
            severity="secondary"
            text
            size="small"
            @click="selectedMember = null"
          >
            {{ t('bid_list.convert_fbid.search.clear') }}
          </Button>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        type="button"
        severity="secondary"
        outlined
        @click="handleClose"
      >
        {{ t('bid_list.convert_fbid.button.cancel') }}
      </Button>
      <Button
        type="button"
        severity="primary"
        :disabled="!selectedMember"
        @click="handleSubmit"
      >
        {{ t('bid_list.convert_fbid.button.submit') }}
      </Button>
    </template>
  </Dialog>
</template>
