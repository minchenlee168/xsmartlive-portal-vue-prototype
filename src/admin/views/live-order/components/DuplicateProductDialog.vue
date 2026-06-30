<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 快速新增商品時，若名稱與「選擇商品」目錄內既有商品重複，
 * 跳出此彈窗說明無法新增的原因與衝突商品。
 */

interface Props {
  visible?: boolean
  /** 重複（無法新增）的商品名稱 */
  names?: string[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  names: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
watch(() => props.visible, (v) => { innerVisible.value = v })

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
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
        <i class="pi pi-exclamation-triangle text-[#f97316]" style="font-size: 18px"></i>
        {{ t('live_order.dialog.duplicate_product_header') }}
      </span>
    </template>

    <div class="flex flex-col gap-3 pt-2">
      <p class="text-[14px] text-[var(--p-text-color)] leading-relaxed">
        {{ t('live_order.label.duplicate_product_reason') }}
      </p>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="(name, i) in names"
          :key="i"
          class="flex items-center gap-2 rounded-[6px] bg-[var(--p-content-hover-background)] px-3 py-2"
        >
          <i class="pi pi-box text-[var(--p-text-muted-color)]" style="font-size: 13px"></i>
          <span class="text-[14px] font-medium text-[var(--p-text-color)] truncate">{{ name }}</span>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <Button :label="t('live_order.button.got_it')" @click="close" />
      </div>
    </template>
  </Dialog>
</template>
