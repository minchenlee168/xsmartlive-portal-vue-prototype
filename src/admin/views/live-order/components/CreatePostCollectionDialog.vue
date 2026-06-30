<script setup lang="ts">
/**
 * 新增貼文收單對話框：在 overview 上按「+ 新增貼文收單」時開啟。
 * 收：貼文收單名稱（必填）+ 收單時間起訖（必填，需含起與迄兩個時間點）。
 * 送出後父層在 postCollections unshift 一筆新檔並自動進入該檔。
 */
import { ref, computed, watch } from 'vue'

interface Props {
  visible?: boolean
  /** 'post' = 貼文收單；'community' = 社團收單，影響標題與 placeholder */
  kind?: 'post' | 'community'
}
const props = withDefaults(defineProps<Props>(), { visible: false, kind: 'post' })
const collectionNoun = computed(() => props.kind === 'community' ? '社團' : '貼文')

export interface CreatePostCollectionPayload {
  name: string
  startAt: Date | null
  endAt: Date | null
}
const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [payload: CreatePostCollectionPayload]
}>()

const innerVisible = ref(props.visible)
const name = ref('')
/**
 * 區間 DatePicker：[起, 迄]；
 * PrimeVue DatePicker 的 range + show-time 模式遇到 [null, null] 會在內部 viewDate 直接讀 null.getFullYear() 噴錯，
 * 因此未選任何時間時設成 null（DatePicker 視為「未選擇」）。
 */
const dateRange = ref<Array<Date> | null>(null)
const hasError = ref(false)

watch(() => props.visible, (v) => {
  innerVisible.value = v
  if (v) {
    name.value = ''
    dateRange.value = null
    hasError.value = false
  }
})

function close(): void { innerVisible.value = false; emit('update:visible', false) }

const isNameMissing = computed(() => !name.value.trim())
/** 收單時間起訖必填：需同時有起與迄兩個 Date */
const isPeriodMissing = computed(() => !(dateRange.value?.[0] && dateRange.value?.[1]))

function onCreate(): void {
  if (isNameMissing.value || isPeriodMissing.value) {
    hasError.value = true
    return
  }
  emit('create', {
    name: name.value.trim(),
    startAt: dateRange.value?.[0] ?? null,
    endAt: dateRange.value?.[1] ?? null,
  })
  close()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(460px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 18px' },
      content: { style: 'padding: 0 18px 18px' },
      footer:  { style: 'padding: 0 18px 18px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17px">新增{{ collectionNoun }}收單</span>
    </template>

    <div class="flex flex-col gap-4 pt-1">
      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          <span class="text-[#dc2626] mr-1">*</span>{{ collectionNoun }}收單名稱
        </label>
        <InputText
          v-model="name"
          placeholder="例：6/17 母嬰補貨團"
          class="w-full"
          :invalid="hasError && isNameMissing"
          @keyup.enter="onCreate"
        />
        <span v-if="hasError && isNameMissing" class="text-[12px] text-[#dc2626]">請輸入貼文收單名稱</span>
      </div>

      <!-- 收單時間起訖（區間選擇，必填） -->
      <div class="flex flex-col gap-2">
        <label class="text-[14px] font-medium text-[var(--p-text-color)]">
          <span class="text-[#dc2626] mr-1">*</span>收單時間起訖
        </label>
        <DatePicker
          v-model="dateRange"
          selection-mode="range"
          show-time
          hour-format="24"
          date-format="yy/mm/dd"
          placeholder="YYYY/MM/DD HH:mm - YYYY/MM/DD HH:mm"
          class="w-full"
          :invalid="hasError && isPeriodMissing"
        />
        <span v-if="hasError && isPeriodMissing" class="text-[12px] text-[#dc2626]">請選擇收單期間的起與迄時間</span>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="close" />
        <Button label="建立" @click="onCreate" />
      </div>
    </template>
  </Dialog>
</template>
