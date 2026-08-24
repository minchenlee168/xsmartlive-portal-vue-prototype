<script setup lang="ts">
/**
 * 停用二次確認 Dialog：關閉會員等級總開關與停用單一級距共用。
 *
 * 兩處要問的是同一件事——「這些權益會停掉，還要繼續嗎」，只有標題與影響條目不同，差異全部由
 * props 帶入，本元件不知道自己在關什麼。影響條目收 i18n key（條列要有穩定的 `:key`）；
 * 標題／引言／註腳收已翻好的字串（引言帶級距名稱這類插值，交由呼叫端翻譯較單純）。
 */
const props = defineProps<{
  /** 對話框標題 */
  header: string;
  /** 引言：問使用者確不確定 */
  lead: string;
  /** 停用後的影響條目（i18n key），逐條列出讓使用者按下確定前看得到會失去什麼 */
  effectKeys: readonly string[];
  /** 註腳：補充停用後還能怎麼救 */
  footnote: string;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const emit = defineEmits<{
  /** 使用者按下確定；先於關窗發出，呼叫端在 handler 內仍讀得到待確認目標 */
  confirm: [];
  /** 沒按確定就關窗（取消鈕 / ESC / 遮罩點擊）；呼叫端據此把被撥動的控制項退回實際狀態 */
  cancel: [];
}>();

/** 本次開窗是否按過確定；`hide` 對兩種關窗都會發，靠它分辨走的是哪一條。 */
let isConfirmed = false;

function handleConfirm() {
  isConfirmed = true;
  emit('confirm');
  visible.value = false;
}

function handleHide() {
  if (!isConfirmed) emit('cancel');

  isConfirmed = false;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="props.header"
    :style="{ width: '32rem', maxWidth: '95vw' }"
    @hide="handleHide"
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm">
        {{ props.lead }}
      </p>
      <Message
        severity="warn"
        size="small"
        :closable="false"
      >
        <ul class="list-disc space-y-1 pl-4">
          <li
            v-for="effectKey in props.effectKeys"
            :key="effectKey"
          >
            {{ $t(effectKey) }}
          </li>
        </ul>
      </Message>
      <p class="text-sm text-muted-color">
        {{ props.footnote }}
      </p>
    </div>

    <template #footer>
      <!-- 破壞性動作確認框：預設焦點放取消鈕（design.md §10 Do's） -->
      <Button
        :label="$t('common.button.cancel')"
        severity="secondary"
        outlined
        autofocus
        @click="visible = false"
      />
      <Button
        :label="$t('common.button.confirm')"
        severity="danger"
        @click="handleConfirm"
      />
    </template>
  </Dialog>
</template>
