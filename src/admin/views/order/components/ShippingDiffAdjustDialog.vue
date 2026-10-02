<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 差額調整 · 運費差額 Dialog。
 * 合併訂單時,各原始訂單運費加總(合併前)與合併後運費不同,產生溢收 / 短收差額;
 * 以紅利點數結算:溢收 → 補點退還會員;短收 → 扣點向會員收。
 */

interface Props {
  visible: boolean
  /** 合併前運費(各原始訂單運費加總) */
  shippingBefore: number
  /** 合併後運費(可編輯後的單一運費) */
  shippingAfter: number
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  /** 按套用:回傳結算方向 / 點數 / 事由,讓外層寫回並提示 */
  apply: [payload: { direction: 'refund' | 'charge'; points: number; reason: string }]
}>()

/** 差額 = 合併前 − 合併後;> 0 溢收(該退還會員)、< 0 短收(該向會員收) */
const diff = computed(() => props.shippingBefore - props.shippingAfter)
const isOvercharge = computed(() => diff.value > 0)
const diffLabel = computed(() => (diff.value > 0 ? '溢收' : diff.value < 0 ? '短收' : '無差額'))
const diffAmount = computed(() => Math.abs(diff.value))

/** 點數方向:溢收預設補點退還、短收預設扣點收取 */
const direction = ref<'refund' | 'charge'>('refund')
const points = ref(0)
const reason = ref('')

/** 開啟時依差額帶入預設方向與點數 */
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    direction.value = isOvercharge.value ? 'refund' : 'charge'
    points.value = diffAmount.value
    reason.value = ''
  },
)

function apply(): void {
  emit('apply', { direction: direction.value, points: points.value, reason: reason.value.trim() })
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="size-10 shrink-0 rounded-full bg-[var(--p-primary-50)] flex items-center justify-center">
          <i class="pi pi-sliders-h text-[var(--p-primary-color)] text-lg"></i>
        </div>
        <span class="text-base font-bold text-[var(--p-text-color)]">差額調整 · 運費差額</span>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- 差額摘要 -->
      <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[var(--p-content-hover-background)] text-sm">
        <span class="text-[var(--p-text-color)]">
          運費差額（合併前 ${{ shippingBefore.toLocaleString() }} − 合併後 ${{ shippingAfter.toLocaleString() }}）
        </span>
        <span class="font-bold shrink-0" :class="isOvercharge ? 'text-[var(--p-primary-color)]' : 'text-[#DC2626]'">
          {{ diffLabel }} {{ isOvercharge ? '+' : '−' }}${{ diffAmount.toLocaleString() }}
        </span>
      </div>

      <!-- 結算方式(紅利點數) -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">結算方式</label>
        <Tag severity="secondary">
          <template #default>
            <span class="flex items-center gap-1">
              <i class="pi pi-wallet text-xs"></i>
              紅利點數
            </span>
          </template>
        </Tag>
      </div>

      <!-- 點數方向 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">點數方向</label>
        <div class="grid grid-cols-2 gap-2">
          <Button
            :severity="direction === 'refund' ? 'primary' : 'secondary'"
            :variant="direction === 'refund' ? 'outlined' : 'text'"
            :class="direction === 'refund' ? '' : 'opacity-70'"
            @click="direction = 'refund'"
          >
            <i class="pi pi-plus mr-1" style="font-size: 12px"></i>
            補點（退還會員）
          </Button>
          <Button
            :severity="direction === 'charge' ? 'primary' : 'secondary'"
            :variant="direction === 'charge' ? 'outlined' : 'text'"
            :class="direction === 'charge' ? '' : 'opacity-70'"
            @click="direction = 'charge'"
          >
            <i class="pi pi-minus mr-1" style="font-size: 12px"></i>
            扣點（向會員收）
          </Button>
        </div>
      </div>

      <!-- 點數 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">點數（1 元 = 1 點）</label>
        <InputNumber v-model="points" :min="0" mode="decimal" suffix=" 點" class="w-full" fluid />
      </div>

      <!-- 事由 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">
          事由 <span class="text-xs text-[var(--p-text-muted-color)]">（選填）</span>
        </label>
        <InputText v-model="reason" placeholder="例如：運費差額退還" class="w-full" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" variant="outlined" @click="emit('update:visible', false)" />
        <Button label="套用" @click="apply" />
      </div>
    </template>
  </Dialog>
</template>
