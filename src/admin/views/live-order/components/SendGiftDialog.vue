<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 送禮物 dialog：直播主臨時要送東西給觀眾時使用。
 * 送出後由父層把訊息插進留言區（pinned + official tag），不是真的「下單」流程。
 */

export interface SendGiftPayload {
  /** 禮物名稱（必填） */
  name: string
  /** 想對觀眾說的話（選填） */
  message: string
}

interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: SendGiftPayload]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
const name = ref('')
const message = ref('')

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      name.value = ''
      message.value = ''
    }
  },
)

const canSubmit = computed(() => name.value.trim().length > 0)

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function onSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', { name: name.value.trim(), message: message.value.trim() })
  close()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(440px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)] flex items-center gap-2" style="font-size: 17.5px">
        <i class="pi pi-gift text-[var(--p-primary-color)]" style="font-size: 18px"></i>
        {{ t('live_order.dialog.send_gift_header') }}
      </span>
    </template>

    <div class="flex flex-col gap-4 pt-2">
      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          {{ t('live_order.form.field.gift_name') }}
        </label>
        <InputText
          v-model="name"
          :placeholder="t('live_order.form.placeholder.gift_name')"
          class="w-full"
          @keyup.enter="onSubmit"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          {{ t('live_order.form.field.gift_message') }}
        </label>
        <Textarea
          v-model="message"
          :placeholder="t('live_order.form.placeholder.gift_message')"
          rows="3"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          variant="outlined"
          @click="close"
        />
        <Button
          :label="t('live_order.button.send_gift')"
          icon="pi pi-send"
          :disabled="!canSubmit"
          @click="onSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>
