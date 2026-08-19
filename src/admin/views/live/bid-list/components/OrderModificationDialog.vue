<script setup lang="ts">
/**
 * 批次轉預購標單視窗
 * — 由頁面「批次作業 → 轉預購標單」批次模式帶入已勾選的未完成標單
 * — 可再取消勾選；按 Submit 顯示成功 toast、關窗，父頁接手退出批次模式
 * — mock-only wireframe，實際邏輯後續串 API
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import type { BidListRow } from '../composables/useBidListMock';

interface Props {
  visible: boolean;
  /** 由父頁批次模式帶入的候選標單列 */
  candidateRows: BidListRow[];
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'submit'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 目前勾選的候選標單 id */
const selectedBidIds = ref<Set<string>>(new Set());

const selectedCount = computed(() => selectedBidIds.value.size);

function isSelected(id: string): boolean {
  return selectedBidIds.value.has(id);
}

function toggle(id: string, value: boolean) {
  const next = new Set(selectedBidIds.value);
  if (value) next.add(id);
  else next.delete(id);
  selectedBidIds.value = next;
}

const selectAllOnList = computed<boolean>({
  get: () =>
    props.candidateRows.length > 0 &&
    props.candidateRows.every((row) => selectedBidIds.value.has(row.id)),
  set: (value: boolean) => {
    selectedBidIds.value = value
      ? new Set(props.candidateRows.map((row) => row.id))
      : new Set();
  },
});

function handleSubmit() {
  if (selectedCount.value === 0) return;
  showSuccess({
    detail: t('bid_list.order_modification.toast.success', { count: selectedCount.value }),
  });
  emit('submit');
}

function handleClose() {
  localVisible.value = false;
}

/** 開啟視窗時預設全部勾選（既然由批次模式帶入，預設全選較符合預期） */
watch(
  () => props.visible,
  (value) => {
    if (value) {
      selectedBidIds.value = new Set(props.candidateRows.map((row) => row.id));
    }
  },
);
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.order_modification.title')"
    :style="{ width: '640px' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 候選標單清單 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.order_modification.field.candidates', { count: candidateRows.length }) }}
        </label>
        <div class="border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">
              <tr>
                <th class="px-2 py-2 w-8">
                  <Checkbox
                    v-model="selectAllOnList"
                    :binary="true"
                    :disabled="candidateRows.length === 0"
                  />
                </th>
                <th class="px-2 py-2 text-left">{{ t('bid_list.order_modification.column.create_time') }}</th>
                <th class="px-2 py-2 text-left">{{ t('bid_list.order_modification.column.buyer') }}</th>
                <th class="px-2 py-2 text-left">{{ t('bid_list.order_modification.column.bid_number') }}</th>
                <th class="px-2 py-2 text-right">{{ t('bid_list.order_modification.column.quantity') }}</th>
                <th class="px-2 py-2 text-right">{{ t('bid_list.order_modification.column.subtotal') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in candidateRows"
                :key="row.id"
                class="border-t border-slate-100 dark:border-slate-800"
              >
                <td class="px-2 py-2">
                  <Checkbox
                    :model-value="isSelected(row.id)"
                    :binary="true"
                    @update:model-value="(value: boolean) => toggle(row.id, value)"
                  />
                </td>
                <td class="px-2 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {{ row.createTime }}
                </td>
                <td class="px-2 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {{ row.winner.name || row.winner.facebookId }}
                </td>
                <td class="px-2 py-2 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                  {{ row.bidNumber }}
                </td>
                <td class="px-2 py-2 text-right text-slate-700 dark:text-slate-200">
                  {{ row.quantity }}
                </td>
                <td class="px-2 py-2 text-right text-slate-700 dark:text-slate-200">
                  {{ row.totalAmount }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="text-xs text-slate-500 dark:text-slate-400">
        {{ t('bid_list.order_modification.footer.selected_count', { count: selectedCount }) }}
      </div>
    </div>

    <template #footer>
      <Button
        type="button"
        severity="secondary"
        text
        @click="handleClose"
      >
        {{ t('bid_list.order_modification.button.cancel') }}
      </Button>
      <Button
        type="button"
        severity="primary"
        :disabled="selectedCount === 0"
        @click="handleSubmit"
      >
        {{ t('bid_list.order_modification.button.submit') }}
      </Button>
    </template>
  </Dialog>
</template>
