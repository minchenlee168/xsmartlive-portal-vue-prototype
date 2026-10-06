<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { carrierOptionGroups, CARRIER_LABEL, carrierValueOfLabel, carrierGroupOf, trackingPrefixOf, type CarrierOption } from '../orderCarriers'

/**
 * 配送設定 Dialog：選物流商 → 自動帶物流方式 → 可選擇取號。
 * 訂單列表表格「物流商資訊」與 OrderRowDetail 的「設定配送」按鈕共用。
 * 「已啟用物流商」選項與進階搜尋共用同一份(carrierOptionGroups),含宅配 / 超商配送等所有分組。
 */

interface OrderLite {
  orderNo: string
  buyerName: string
  carrierStatus?: 'unconfigured' | 'configured'
  carrierName?: string
  trackingStatus?: string | null
  /** 訂單原配送方式(常溫宅配/超商配送…);未指派物流時用來預設方式相符的物流商 */
  shippingMethod?: string
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

const selectedCarrier = ref<string>('')
const trackingNoInput = ref<string>('')
/** 採用的物流方式 = 所選物流商的配送分組(宅配 / 超商配送 / 跨境 …) */
const selectedCarrierMethod = computed<string>(() => carrierGroupOf(selectedCarrier.value))

/** 由訂單原配送方式推出應顯示的物流商分組(宅配 / 超商配送);無法判斷回空字串 */
function wantGroupFor(shippingMethod?: string): string {
  if (!shippingMethod) return ''
  if (/超商|店到店|交貨便|門市/.test(shippingMethod)) return '超商配送'
  if (shippingMethod.includes('宅配')) return '宅配'
  return ''
}

/**
 * 已啟用物流商選項:依訂單原配送方式只列相符分組(宅配單→宅配組、超商單→超商配送組)的物流商,
 * 各組內容與進階搜尋一致。已收斂到單一分組,攤平為純清單不再顯示分組標頭。
 * 無法判斷配送方式時才列全部物流商,避免擋住操作。
 */
const availableCarrierOptions = computed<CarrierOption[]>(() => {
  const want = wantGroupFor(props.order?.shippingMethod)
  const groups = want ? carrierOptionGroups.filter(g => g.group === want) : carrierOptionGroups
  return groups.flatMap(g => g.items)
})

/** 依訂單原配送方式,挑一個同分組的物流商當預設(未指派時用) */
function defaultCarrierFor(shippingMethod?: string): string {
  const wantGroup = wantGroupFor(shippingMethod)
  if (!wantGroup) return ''
  return carrierOptionGroups.find(g => g.group === wantGroup)?.items[0]?.value ?? ''
}

/** 開啟時帶入既有設定;未指派物流則依訂單原配送方式預設 */
watch(() => [props.visible, props.order], () => {
  if (!props.visible || !props.order) return
  const existing = carrierValueOfLabel(props.order.carrierName)
  selectedCarrier.value = existing || defaultCarrierFor(props.order.shippingMethod)
  trackingNoInput.value = props.order.trackingStatus ?? ''
})

function generateTrackingNo(): void {
  if (!selectedCarrier.value) return
  const d = new Date()
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  const no = `${trackingPrefixOf(selectedCarrier.value)}-${yy}${mm}${dd}-${rand}`
  trackingNoInput.value = no
  toast.add({ severity: 'info', summary: `已產生取號：${no}`, life: 2000, closable: true })
}

function confirm(): void {
  if (!selectedCarrier.value) return
  emit('confirm', {
    carrierName: CARRIER_LABEL[selectedCarrier.value] ?? '',
    method: carrierGroupOf(selectedCarrier.value),
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
          :options="availableCarrierOptions"
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
