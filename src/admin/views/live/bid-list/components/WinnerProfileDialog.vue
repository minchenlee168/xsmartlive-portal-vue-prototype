<script setup lang="ts">
/**
 * 得標人資料 Dialog
 * — 顯示大頭照 + 得標社群 + 各平台 ID（Facebook ID / PSID / LINE 綁定狀態）
 *   ＋系統平台會員資料（會員 ID / 會員姓名，mock）
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import type { BidListRow, BidListWinner } from '../composables/useBidListMock';

interface Props {
  visible: boolean;
  winner: BidListWinner | null;
  /** 得標社群平台；未傳入時不顯示該列 */
  platform?: BidListRow['platform'] | null;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showInfo, showError } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 頭像載入失敗時 fallback 到 user icon */
const avatarError = ref<boolean>(false);
watch(
  () => props.winner?.avatar,
  () => {
    avatarError.value = false;
  },
);

const platformLabelMap: Record<NonNullable<Props['platform']>, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  livebuy: 'LiveBuy',
  line: 'LINE',
};
const platformLabel = computed(() => (props.platform ? platformLabelMap[props.platform] : null));

/** 複製 Facebook ID 到剪貼簿，並以 toast 回饋結果。 */
async function copyFacebookId(): Promise<void> {
  if (!props.winner?.facebookId) return;
  try {
    await navigator.clipboard.writeText(props.winner.facebookId);
    showInfo({ detail: t('bid_list.toast.copied_platform_id', { platform: platformLabelMap.facebook }) });
  }
  catch {
    showError({ detail: t('bid_list.toast.copy_failed') });
  }
}

/** mock 系統平台會員資料：會員 ID 以社群 ID 尾碼組出，姓名暫同社群姓名 */
const memberId = computed(() =>
  props.winner ? `M${props.winner.facebookId.slice(-6).padStart(6, '0')}` : '—',
);
const memberName = computed(() => props.winner?.name ?? '—');
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.winner_profile.title')"
    :style="{ width: '24rem' }"
    :breakpoints="{ '640px': '90vw' }"
  >
    <div
      v-if="winner"
      class="flex flex-col items-center gap-4"
    >
      <div class="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
        <img
          v-if="winner.avatar && !avatarError"
          :src="winner.avatar"
          :alt="winner.name"
          class="w-full h-full object-cover"
          @error="avatarError = true"
        />
        <FontAwesomeIcon
          v-else
          :icon="['fas', 'user']"
          class="text-slate-400 dark:text-slate-500 text-4xl"
        />
      </div>

      <div class="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {{ winner.name }}
      </div>

      <div class="w-full flex flex-col gap-2 text-sm">
        <!-- 系統平台會員資料（會員 ID / 會員姓名）排在得標社群上方 -->
        <div class="flex justify-between items-baseline gap-2 py-2 border-b border-slate-100 dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.member_id') }}
          </span>
          <span class="text-slate-800 dark:text-slate-100 break-all text-right tabular-nums">
            {{ memberId }}
          </span>
        </div>
        <div class="flex justify-between items-baseline gap-2 py-2 border-b border-slate-100 dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.member_name') }}
          </span>
          <span class="text-slate-800 dark:text-slate-100 text-right">
            {{ memberName }}
          </span>
        </div>
        <div
          v-if="platformLabel"
          class="flex justify-between items-baseline gap-2 py-2 border-b border-slate-100 dark:border-slate-800"
        >
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.platform') }}
          </span>
          <span class="text-slate-800 dark:text-slate-100 text-right">
            {{ platformLabel }}
          </span>
        </div>
        <div class="flex justify-between items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.facebook_id') }}
          </span>
          <span class="flex items-center gap-1 min-w-0">
            <span class="text-slate-800 dark:text-slate-100 break-all text-right">
              {{ winner.facebookId }}
            </span>
            <Button
              v-tooltip.top="t('bid_list.table.action.copy_platform_id', { platform: platformLabelMap.facebook })"
              :aria-label="t('bid_list.table.action.copy_platform_id', { platform: platformLabelMap.facebook })"
              type="button"
              size="small"
              text
              severity="secondary"
              class="shrink-0"
              @click="copyFacebookId"
            >
              <i class="pi pi-copy" />
            </Button>
          </span>
        </div>
        <div
          v-if="winner.psid"
          class="flex justify-between items-baseline gap-2 py-2 border-b border-slate-100 dark:border-slate-800"
        >
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.psid') }}
          </span>
          <span class="text-slate-800 dark:text-slate-100 break-all text-right">
            {{ winner.psid }}
          </span>
        </div>
        <div class="flex justify-between items-center gap-2 py-2">
          <span class="text-slate-500 dark:text-slate-400">
            {{ t('bid_list.winner_profile.field.line_binding') }}
          </span>
          <Tag
            v-if="winner.hasLine"
            severity="success"
            :value="t('bid_list.winner_profile.line_bound')"
          />
          <Tag
            v-else
            severity="secondary"
            :value="t('bid_list.winner_profile.line_unbound')"
          />
        </div>
      </div>
    </div>

  </Dialog>
</template>
