<script setup lang="ts">
/**
 * 收單期間設定彈窗（貼文模式專用）：編輯當下進入的貼文 startAt / endAt，
 * 由「收單期間」按鈕（批次設定右側）開啟。送出後父層寫回對應 PostCollection。
 */
import { ref, watch } from 'vue'

interface Props {
  visible?: boolean
  startAt?: Date | null
  endAt?: Date | null
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  startAt: null,
  endAt: null,
})

export interface PostPeriodPayload {
  startAt: Date | null
  endAt: Date | null
}
const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [payload: PostPeriodPayload]
}>()

/**
 * PrimeVue DatePicker 的 range + show-time 模式在 v-model 為 [null, null] 時，
 * 內部 viewDate 會直接讀 null.getFullYear() 噴錯；
 * 沒設定時改傳 null（DatePicker 視為「未選擇」），有設一邊就用同一天填補另一端，避免不合法區間。
 */
const dateRange = ref<Array<Date> | null>(null)

watch(() => props.visible, (v) => {
  if (!v) return
  const s = props.startAt ?? null
  const e = props.endAt ?? null
  if (!s && !e) {
    dateRange.value = null
  } else if (s && e) {
    dateRange.value = [s, e]
  } else {
    const only = (s ?? e) as Date
    dateRange.value = [only, only]
  }
})

function close(): void { emit('update:visible', false) }
function onSave(): void {
  emit('save', {
    startAt: dateRange.value?.[0] ?? null,
    endAt: dateRange.value?.[1] ?? null,
  })
  close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="true"
    :style="{ width: 'min(460px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 18px' },
      content: { style: 'padding: 0 18px 18px' },
      footer:  { style: 'padding: 0 18px 18px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17px">收單期間設定</span>
    </template>

    <div class="flex flex-col gap-2 pt-1">
      <label class="text-[14px] font-medium text-[var(--p-text-color)]">收單時間起訖</label>
      <DatePicker
        v-model="dateRange"
        selection-mode="range"
        show-time
        hour-format="24"
        date-format="yy/mm/dd"
        placeholder="YYYY/MM/DD HH:mm - YYYY/MM/DD HH:mm"
        class="w-full"
      />
      <p class="text-[12px] text-[var(--p-text-muted-color)]">留空 = 未設結單。設定開始時間後，系統會在時間到時自動切換為收單中。</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="close" />
        <Button label="儲存" icon="pi pi-save" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>
