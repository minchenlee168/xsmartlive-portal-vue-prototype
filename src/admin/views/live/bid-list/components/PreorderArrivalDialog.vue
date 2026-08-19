<script setup lang="ts">
/**
 * 預購到貨確認對話框（對照舊 168money saleOrderList「預購確認視窗」#preBidModal）
 * — 單筆／批次共用同一個 Dialog，透過 mode 區分呼叫來源
 * — 附加資訊為選填；勾選 checkbox 表示要把附加資訊追加到原場次名稱後方
 * — 送出時執行 168money 三段驗證：
 *   1. 勾選但欄位空 → 錯誤 toast
 *   2. 未勾選但欄位有值 → 錯誤 toast
 *   3. 未勾選且欄位空 → 二次確認「標單將不會附加任何資訊」
 *   4. 勾選且欄位有值 → 直接送出
 */
import { computed, nextTick, ref, useTemplateRef, watch, type ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';

interface Props {
  visible: boolean;
}

interface ConfirmPayload {
  extraInfo: string;
  appendToSessionName: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'confirm', payload: ConfirmPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { confirm } = useGlobalDialog();
const { showError } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 附加資訊 */
const extraInfo = ref<string>('');
/** 勾選才會把附加資訊追加至場次名稱 */
const appendToSessionName = ref<boolean>(false);
/** checkbox ref，用於未勾選 + 有輸入時 focus */
const checkboxRef = useTemplateRef<ComponentPublicInstance>('checkboxRef');

/** dialog 開啟時清空表單 */
watch(
  () => props.visible,
  (value) => {
    if (value) {
      extraInfo.value = '';
      appendToSessionName.value = false;
    }
  },
);

async function handleConfirmClick() {
  const trimmed = extraInfo.value.trim();

  if (appendToSessionName.value) {
    if (trimmed === '') {
      showError({ detail: t('bid_list.preorder_arrival_dialog.error_extra_info_empty') });
      return;
    }
  } else {
    if (trimmed !== '') {
      showError({ detail: t('bid_list.preorder_arrival_dialog.error_check_required') });
      await nextTick();
      const rootEl = checkboxRef.value?.$el as HTMLElement | undefined;
      rootEl?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }

    const accepted = await confirm({
      message: t('bid_list.preorder_arrival_dialog.confirm_no_extra_info'),
    });
    if (!accepted) return;
  }

  emit('confirm', {
    extraInfo: trimmed,
    appendToSessionName: appendToSessionName.value,
  });
  localVisible.value = false;
}

function handleCancel() {
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.preorder_arrival_dialog.title')"
    :style="{ width: '32rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label
          for="preorder-arrival-extra-info"
          class="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {{ t('bid_list.preorder_arrival_dialog.extra_info_label') }}
        </label>
        <InputText
          id="preorder-arrival-extra-info"
          v-model="extraInfo"
          :placeholder="t('bid_list.preorder_arrival_dialog.extra_info_placeholder')"
          class="w-full"
        />
      </div>

      <div class="flex items-start gap-2">
        <Checkbox
          ref="checkboxRef"
          v-model="appendToSessionName"
          input-id="preorder-arrival-append"
          binary
        />
        <label
          for="preorder-arrival-append"
          class="text-sm text-slate-700 dark:text-slate-200 leading-5 cursor-pointer"
        >
          {{ t('bid_list.preorder_arrival_dialog.append_to_session_name') }}
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          @click="handleCancel"
        >
          {{ t('bid_list.preorder_arrival_dialog.cancel') }}
        </Button>
        <Button
          type="button"
          severity="primary"
          @click="handleConfirmClick"
        >
          {{ t('bid_list.preorder_arrival_dialog.confirm') }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
