<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

/**
 * 配送設定 Dialog：選物流商 → 自動帶物流方式 → 可選擇取號。
 * 訂單列表表格「物流商資訊」與 OrderRowDetail 的「設定配送」按鈕共用。
 */

interface OrderLite {
  orderNo: string
  buyerName: string
  carrierStatus?: 'unconfigured' | 'configured'
  carrierName?: string
  trackingStatus?: string | null
}
interface Props {
  visible: boolean
  order: OrderLite | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  /** 使用者按確認：把物流商 / 方式 / 取號 emit 出去，讓外層寫回訂單 */
  confirm: [payload: { carrierName: string; method: string; trackingNo: string | null }]
}>()

const toast = useToast()

interface CarrierOption { label: string; value: string; method: string; trackingPrefix: string }
const carrierOptions: CarrierOption[] = [
  { label: '7-11 交貨便',   value: 'cvs711',  method: '超商取貨', trackingPrefix: 'CVS711' },
  { label: '全家常溫',      value: 'fm',      method: '超商取貨', trackingPrefix: 'FM'     },
  { label: '黑貓宅急便',    value: 'tcat',    method: '常溫宅配', trackingPrefix: 'TCAT'   },
  { label: '新竹物流',      value: 'hct',     method: '常溫宅配', trackingPrefix: 'HCT'    },
  { label: '嘉里大榮',      value: 'kerry',   method: '常溫宅配', trackingPrefix: 'KERRY'  },
]

const selectedCarrier = ref<string>('')
const trackingNoInput = ref<string>('')
const selectedCarrierOption = computed<CarrierOption | undefined>(() =>
  carrierOptions.find(c => c.value === selectedCarrier.value),
)
const selectedCarrierMethod = computed<string>(() => selectedCarrierOption.value?.method ?? '')

/** 開啟時帶入既有設定 */
watch(() => [props.visible, props.order], () => {
  if (!props.visible || !props.order) return
  selectedCarrier.value = carrierOptions.find(c => c.label === props.order?.carrierName)?.value ?? ''
  trackingNoInput.value = props.order.trackingStatus ?? ''
})

function generateTrackingNo(): void {
  const opt = selectedCarrierOption.value
  if (!opt) return
  const d = new Date()
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  const no = `${opt.trackingPrefix}-${yy}${mm}${dd}-${rand}`
  trackingNoInput.value = no
  toast.add({ severity: 'info', summary: `已產生取號：${no}`, life: 2000, closable: true })
}

function confirm(): void {
  const opt = selectedCarrierOption.value
  if (!opt) return
  emit('confirm', {
    carrierName: opt.label,
    method: opt.method,
    trackingNo: trackingNoInput.value || null,
  })
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="size-10 shrink-0 rounded-full bg-[var(--p-primary-50)] flex items-center justify-center">
          <i class="pi pi-truck text-[var(--p-primary-color)] text-lg"></i>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-base font-bold text-[var(--p-text-color)]">配送設定</span>
          <span v-if="order" class="text-xs text-[var(--p-text-muted-color)]">訂單 {{ order.orderNo }} · {{ order.buyerName }}</span>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">
          選擇已啟用物流商 <span class="text-[#DC2626]">*</span>
        </label>
        <Select
          v-model="selectedCarrier"
          :options="carrierOptions"
          option-label="label"
          option-value="value"
          placeholder="請選擇已啟用物流商..."
          class="w-full"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">採用的物流方式</label>
        <InputText
          :model-value="selectedCarrierMethod"
          placeholder="↑ 選擇物流商後自動帶入"
          class="w-full"
          disabled
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">
          物流取號 <span class="text-xs text-[var(--p-text-muted-color)]">（選填）</span>
        </label>
        <div class="flex items-stretch gap-2">
          <InputText
            v-model="trackingNoInput"
            placeholder="先選擇物流，可稍後再取號"
            class="flex-1"
            :disabled="!selectedCarrier"
          />
          <Button
            label="取號"
            icon="pi pi-hashtag"
            severity="secondary"
            variant="outlined"
            :disabled="!selectedCarrier"
            @click="generateTrackingNo"
          />
        </div>
        <span class="text-xs text-[var(--p-text-muted-color)]">可自動產生取號或手動輸入取號編碼</span>
      </div>
    </div>

    <template #footer>
      <Button label="取消" severity="secondary" variant="outlined" @click="emit('update:visible', false)" />
      <Button label="確認" :disabled="!selectedCarrier" @click="confirm" />
    </template>
  </Dialog>
</template>
