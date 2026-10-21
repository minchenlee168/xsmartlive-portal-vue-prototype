<script setup lang="ts">
/**
 * 商品明細區塊：扁平商品表 + 訂單總計（商品總額 / 運費 / 各項折抵 / 訂單總計）。
 * 對齊正式專案 OrderItemsSection：純呈現，資料由父層（頁面 / 明細容器）以 props 餵入。
 */
import type { ProductRow } from '../orderTypes'

defineProps<{
  productRows: ProductRow[]
  subtotal: number
  shippingFee: number
  couponDiscount: number
  pointsDiscount: number
  freeShipDiscount: number
  total: number
}>()
</script>

<template>
  <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
    <span class="text-sm font-bold text-[var(--p-text-color)]">商品明細</span>
    <DataTable :value="productRows" data-key="name" class="w-full"
      :pt="{ column: { headerCell: { style: 'white-space: nowrap;' } } }">
      <Column header="商品名稱" field="name" />
      <Column header="規格" field="spec" />
      <Column header="訂單來源" field="source" />
      <Column header="單價">
        <template #body="{ data }">{{ data.price.toLocaleString() }}</template>
      </Column>
      <Column header="數量">
        <template #body="{ data }">{{ data.qty }}</template>
      </Column>
      <Column header="小計">
        <template #body="{ data }">
          <span class="font-bold">{{ data.lineTotal.toLocaleString() }}</span>
        </template>
      </Column>
    </DataTable>

    <div class="flex items-start justify-end gap-4 pt-2">
      <div class="flex flex-col gap-2 text-sm min-w-[200px]">
        <div class="flex items-center justify-between">
          <span class="text-[var(--p-text-muted-color)]">商品總額</span>
          <span class="text-[var(--p-text-color)]">${{ subtotal.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[var(--p-text-muted-color)]">運費</span>
          <span class="text-[var(--p-text-color)]">${{ shippingFee }}</span>
        </div>
        <div v-if="couponDiscount > 0" class="flex items-center justify-between">
          <span class="text-[var(--p-text-muted-color)]">優惠券折抵</span>
          <span class="text-red-600 dark:text-red-400">-${{ couponDiscount.toLocaleString() }}</span>
        </div>
        <div v-if="pointsDiscount > 0" class="flex items-center justify-between">
          <span class="text-[var(--p-text-muted-color)]">紅利折抵</span>
          <span class="text-red-600 dark:text-red-400">-${{ pointsDiscount.toLocaleString() }}</span>
        </div>
        <div v-if="freeShipDiscount > 0" class="flex items-center justify-between">
          <span class="text-[var(--p-text-muted-color)]">期間首購後免運折抵</span>
          <span class="text-red-600 dark:text-red-400">-${{ freeShipDiscount.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-[var(--p-content-border-color)]">
          <span class="font-medium text-[var(--p-text-color)]">訂單總計</span>
          <span class="text-base font-bold text-[var(--p-primary-color)]">${{ total.toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
