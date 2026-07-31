<script setup lang="ts">
import { computed } from 'vue'
import { usePrintLog, type PrintKind, type PrintRecord } from '../composables/usePrintLog'

/**
 * 列印紀錄 Dialog：出貨單 / 標籤 / 發票 三張卡，各自顯示累計次數與列印明細（次別 / 時間 / 操作者）。
 * 發票卡若已開立，額外顯示發票號碼。
 */
interface Props {
  visible: boolean
  orderNo: string
  buyerName: string
  invoiceNumber?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

const { getLog } = usePrintLog()
const log = computed(() => getLog(props.orderNo))

interface Section { key: PrintKind; title: string; icon: string; records: PrintRecord[] }
const sections = computed<Section[]>(() => [
  { key: 'sheet',   title: '出貨單', icon: 'pi pi-file',    records: log.value.sheet },
  { key: 'label',   title: '標籤',   icon: 'pi pi-tag',     records: log.value.label },
  { key: 'invoice', title: '發票',   icon: 'pi pi-receipt', records: log.value.invoice },
])
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
      <div class="flex items-center gap-2">
        <i class="pi pi-history text-[var(--p-primary-color)]" style="font-size: 16px"></i>
        <div class="flex flex-col gap-1">
          <span class="text-base font-bold text-[var(--p-text-color)]">列印紀錄</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">訂單 {{ orderNo }} · {{ buyerName }}</span>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <div
        v-for="s in sections"
        :key="s.key"
        class="rounded-lg border border-[var(--p-content-border-color)] p-4 flex flex-col gap-3"
      >
        <!-- 卡頭：icon + 標題 + 次數 badge -->
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-2 text-sm font-bold text-[var(--p-text-color)]">
            <i :class="s.icon" class="text-[var(--p-text-muted-color)]" style="font-size: 14px"></i>
            {{ s.title }}
          </span>
          <Tag
            v-if="s.records.length === 0"
            value="0 次"
            severity="secondary"
          />
          <Tag
            v-else
            :value="`累計 ${s.records.length} 次`"
            :style="{ background: 'var(--p-primary-100)', color: 'var(--p-primary-700)' }"
          />
        </div>

        <!-- 明細：尚未列印 or 列印紀錄表 -->
        <span v-if="s.records.length === 0" class="text-xs text-[var(--p-text-muted-color)]">尚未列印</span>
        <div v-else class="flex flex-col gap-1 text-sm">
          <div class="grid grid-cols-[64px_1fr_1fr] gap-2 text-xs text-[var(--p-text-muted-color)] pb-1">
            <span>次別</span>
            <span>列印時間</span>
            <span>操作者</span>
          </div>
          <div
            v-for="(r, i) in s.records"
            :key="i"
            class="grid grid-cols-[64px_1fr_1fr] gap-2 items-center"
          >
            <span class="font-medium text-[var(--p-primary-color)]">第 {{ i + 1 }} 次</span>
            <span class="text-[var(--p-text-color)]">{{ r.time }}</span>
            <span class="text-[var(--p-text-color)]">{{ r.operator }}</span>
          </div>
        </div>

        <!-- 發票卡：已開立時額外顯示發票號碼 -->
        <div
          v-if="s.key === 'invoice' && invoiceNumber"
          class="pt-2 border-t border-dashed border-[var(--p-content-border-color)] text-xs text-[var(--p-text-muted-color)]"
        >
          已開立 <span class="text-[var(--p-text-color)] font-medium">{{ invoiceNumber }}</span>
        </div>
      </div>
    </div>
  </Dialog>
</template>
