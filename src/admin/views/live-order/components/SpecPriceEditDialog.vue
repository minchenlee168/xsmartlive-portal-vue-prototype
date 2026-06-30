<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SpecRow {
  id?: number
  name?: string
  sku?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface Props {
  visible?: boolean
  productName?: string
  specs?: SpecRow[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  productName: '',
  specs: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 套用：回傳「規格 id → 新價格」的 map，由父層更新 product.selectedSpecs 內各規格的 price。 */
  apply: [priceMap: Record<number, number>]
}>()

const { t } = useI18n()

interface RowDraft {
  id: number
  name: string
  price: number
}
const rows = ref<RowDraft[]>([])

watch(
  () => [props.visible, props.specs] as const,
  ([visible, specs]) => {
    if (!visible) return
    rows.value = (specs as SpecRow[])
      .filter((s) => typeof s.id === 'number')
      .map((s) => ({
        id: s.id as number,
        name: s.name ?? '',
        price: Number(s.price ?? 0),
      }))
  },
  { immediate: true },
)

function onSave(): void {
  const priceMap: Record<number, number> = {}
  rows.value.forEach((r) => {
    priceMap[r.id] = Number(r.price) || 0
  })
  emit('apply', priceMap)
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :draggable="false"
    :style="{ width: 'min(420px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex flex-col gap-1">
        <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
          {{ t('live_order.dialog.spec_price_edit_header') }}
        </span>
        <span v-if="productName" class="text-[13px] text-[var(--p-text-muted-color)]">
          {{ productName }}
        </span>
      </div>
    </template>

    <div class="flex flex-col gap-2">
      <div class="grid grid-cols-[1fr_140px] gap-3 px-3 py-2 text-[12px] text-[var(--p-text-muted-color)]">
        <span>{{ t('live_order.table.column.spec') }}</span>
        <span>{{ t('live_order.table.column.price') }}</span>
      </div>
      <div
        v-for="row in rows"
        :key="row.id"
        class="grid grid-cols-[1fr_140px] gap-3 px-3 py-2 border-t border-[var(--p-content-border-color)] items-center"
      >
        <span class="text-[14px] text-[var(--p-text-color)] truncate">{{ row.name }}</span>
        <InputNumber
          v-model="row.price"
          :min="0"
          :show-buttons="false"
          input-class="w-full"
        />
      </div>
      <div v-if="rows.length === 0" class="text-center py-6 text-[var(--p-text-muted-color)]">
        {{ t('live_order.empty.no_spec') }}
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          outlined
          @click="emit('update:visible', false)"
        />
        <Button
          :label="t('live_order.button.save')"
          :disabled="rows.length === 0"
          @click="onSave"
        />
      </div>
    </template>
  </Dialog>
</template>
