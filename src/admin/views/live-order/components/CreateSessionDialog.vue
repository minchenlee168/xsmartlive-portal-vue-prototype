<template>
  <Dialog
    v-model:visible="innerVisible"
    modal :draggable="false"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer:  { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="v => emit('update:visible', v)">

    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size:17.5px">{{ t('live_order.dialog.create_session_header') }}</span>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          <span class="text-[#dc2626]">{{ t('live_order.text.required') }}</span>{{ t('live_order.form.field.session_name') }}
        </label>
        <InputText v-model="name" :placeholder="t('live_order.form.placeholder.session_name_example')" class="w-full" :class="{ 'p-invalid': hasError && !name.trim() }" />
        <span v-if="hasError && !name.trim()" class="text-[12px] text-[#dc2626]">{{ t('live_order.form.validation.session_name_required') }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          <span class="text-[#dc2626]">{{ t('live_order.text.required') }}</span>{{ t('live_order.form.field.session_date') }}
        </label>
        <DatePicker v-model="date" date-format="yy/mm/dd" :placeholder="t('live_order.form.placeholder.session_date_format')" class="w-full" :class="{ 'p-invalid': hasError && !date }" />
        <span v-if="hasError && !date" class="text-[12px] text-[#dc2626]">{{ t('live_order.form.validation.session_date_required') }}</span>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-[7px]">
        <button @click="close"
          class="bg-[var(--p-content-hover-background)] border border-[var(--p-content-border-color)] px-[11.5px] py-[8px] rounded-[6px] text-[14px] font-medium text-[var(--p-text-color)] hover:bg-[var(--p-content-border-color)]">
          {{ t('live_order.button.cancel') }}
        </button>
        <button @click="onCreate"
          class="bg-[var(--p-primary-color)] border border-[var(--p-primary-color)] px-[11.5px] py-[8px] rounded-[6px] text-[14px] font-medium text-white hover:bg-[var(--p-primary-hover-color)]">
          {{ t('live_order.button.create') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  visible?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

interface CreateSessionPayload {
  name: string
  date: string
}
const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [payload: CreateSessionPayload]
}>()

const innerVisible = ref(props.visible)
const name = ref('')
const date = ref<Date | null>(null)
const hasError = ref(false)

watch(() => props.visible, v => {
  innerVisible.value = v
  if (v) { name.value = ''; date.value = null; hasError.value = false }
})

/** Close the dialog and emit visible=false. */
function close(): void { innerVisible.value = false; emit('update:visible', false) }

/** Format a Date as YYYY/MM/DD. */
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

/** Validate inputs and emit create event with normalised payload. */
function onCreate(): void {
  if (!name.value.trim() || !date.value) { hasError.value = true; return }
  emit('create', { name: name.value.trim(), date: formatDate(date.value) })
  close()
}
</script>
