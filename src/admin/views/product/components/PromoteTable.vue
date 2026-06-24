<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/**
 * 多件優惠 table（對齊 portal-vue PromoteTable）。
 *
 * 上方：優惠開始 / 結束時間 DatePicker + 新增階梯按鈕。
 * 下方：階梯表，每列 = 最低件數 / 最高件數 / 折扣金額 / 刪除按鈕。
 *
 * 驗證提示（純視覺；prototype 不做硬 block）：
 * - tier.min ≤ 前一階 tier.max → invalid
 * - tier.max ≤ tier.min → invalid
 * - discount = 0 → invalid
 * - endAt < startAt → DatePicker 標 invalid
 */

export interface PromoteTier {
  /** 最低件數 */
  min: number
  /** 最高件數 */
  max: number
  /** 折扣金額 */
  discount: number
}

export interface PromoteData {
  startAt: Date | null
  endAt: Date | null
  tiers: PromoteTier[]
}

interface Props {
  modelValue: PromoteData
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), { readonly: false })
const emit = defineEmits<{
  'update:modelValue': [value: PromoteData]
}>()

const promote = computed<PromoteData>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

/** 之前那階的最大值，新階預設要大於它 */
function previousTierMax(index: number): number {
  if (index === 0) return 0
  return promote.value.tiers[index - 1]?.max ?? 0
}

function addTier(): void {
  const last = promote.value.tiers[promote.value.tiers.length - 1]
  const nextMin = last ? last.max + 1 : 1
  promote.value.tiers.push({ min: nextMin, max: nextMin, discount: 0 })
}

function removeTier(index: number): void {
  promote.value.tiers.splice(index, 1)
}

const endAtMinDate = computed(() => promote.value.startAt ?? undefined)
const isPeriodInvalid = computed(() =>
  !!(promote.value.startAt && promote.value.endAt && promote.value.endAt < promote.value.startAt),
)
</script>

<template>
  <Card>
    <template #title>多件優惠</template>
    <template #content>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-color">優惠開始</label>
          <DatePicker
            v-model="promote.startAt"
            :disabled="readonly"
            show-time
            hour-format="24"
            date-format="yy-mm-dd"
            fluid
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-color">優惠結束</label>
          <DatePicker
            v-model="promote.endAt"
            :disabled="readonly"
            :min-date="endAtMinDate"
            :invalid="isPeriodInvalid"
            show-time
            hour-format="24"
            date-format="yy-mm-dd"
            fluid
          />
        </div>
        <div v-if="!readonly" class="mt-auto">
          <Button label="新增區間" icon="pi pi-plus" @click="addTier" />
        </div>
      </div>

      <table class="table-fixed border-collapse w-full">
        <thead>
          <tr>
            <th class="border border-surface p-2 text-left text-sm font-medium">最低件數</th>
            <th class="border border-surface p-2 text-left text-sm font-medium">最高件數</th>
            <th class="border border-surface p-2 text-left text-sm font-medium">折扣金額</th>
            <th v-if="!readonly" class="border border-surface p-2 text-left text-sm font-medium w-32">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(tier, i) in promote.tiers" :key="i">
            <td class="border border-surface p-2">
              <InputNumber
                v-model="tier.min"
                :min="previousTierMax(i) + 1"
                :invalid="tier.min <= previousTierMax(i)"
                :disabled="readonly"
                class="w-full"
              />
            </td>
            <td class="border border-surface p-2">
              <InputNumber
                v-model="tier.max"
                :min="1"
                :invalid="tier.max <= tier.min || tier.max <= previousTierMax(i)"
                :disabled="readonly"
                class="w-full"
              />
            </td>
            <td class="border border-surface p-2">
              <InputNumber
                v-model="tier.discount"
                mode="currency"
                currency="TWD"
                locale="zh-TW"
                :min="0"
                :invalid="tier.discount === 0"
                :disabled="readonly"
                class="w-full"
              />
            </td>
            <td v-if="!readonly" class="border border-surface p-2">
              <button
                v-tooltip.top="'刪除區間'"
                type="button"
                tabindex="-1"
                class="size-[32px] flex items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                @click="removeTier(i)"
              >
                <FontAwesomeIcon :icon="['far', 'trash']" class="text-[14px]" />
              </button>
            </td>
          </tr>
          <tr v-if="!promote.tiers.length">
            <td colspan="4" class="border border-surface p-4 text-center text-sm text-color-secondary">
              尚未設定多件優惠，按右上「新增區間」加入。
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </Card>
</template>
