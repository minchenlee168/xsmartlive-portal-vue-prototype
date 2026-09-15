<script setup lang="ts">
/**
 * 「查看商品項目」Dialog（依 Image #6，原型版唯讀）
 * — 由發送紀錄列表的「查看詳情」開啟，依購物車分組列出訂單商品
 * — 每列：商品圖(佔位) + 名稱 + 單價 / 購買數量 / 成本價 / 價格；每車小計 + 訂單總金額
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { createMockOrderDetail } from '../mockData';
import type { BonusSendRecord } from '../types';

const props = defineProps<{
  /** 要看商品項目的訂單；為 null 時不載入 */
  record: BonusSendRecord | null;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();

const detail = computed(() =>
  (props.record ? createMockOrderDetail(props.record.orderNo, props.record.pointsUsed) : null));
const carts = computed(() => detail.value?.carts ?? []);

const formatNumber = (value: number) => value.toLocaleString('en-US');
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="$t('bonus_points.records.items_modal.header')"
    :style="{ width: 'min(56rem, calc(100vw - 32px))' }"
  >
    <div v-if="detail" class="flex flex-col gap-6">
      <section
        v-for="(cart, ci) in carts"
        :key="ci"
        class="flex flex-col gap-2"
      >
        <!-- 購物車標題：賣場名稱靠左、N 件商品靠右 -->
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="font-medium">{{ cart.cartName }}</span>
          <span class="shrink-0">
            <span class="font-semibold text-primary">{{ cart.items.length }}</span>{{ $t('bonus_points.records.items_modal.item_unit') }}
          </span>
        </div>

        <!-- 商品列 -->
        <div class="divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="(item, ii) in cart.items"
            :key="ii"
            class="flex flex-wrap items-center gap-x-6 gap-y-2 py-3"
          >
            <!-- 圖 + 名稱 + 單價 -->
            <div class="flex min-w-[220px] flex-1 items-center gap-3">
              <span class="size-14 shrink-0 rounded-md bg-surface-200 dark:bg-surface-700"></span>
              <div class="flex min-w-0 flex-col gap-1">
                <span class="text-base font-medium break-words">{{ item.name }}</span>
                <span class="text-xs text-surface-500 dark:text-surface-400">NTD ${{ formatNumber(item.unitPrice) }}</span>
              </div>
            </div>

            <!-- 購買數量 -->
            <div class="flex min-w-[90px] flex-col gap-1">
              <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.col.quantity') }}</span>
              <span class="text-base">{{ item.quantity }}</span>
            </div>

            <!-- 成本價 -->
            <div class="flex min-w-[80px] flex-col gap-1">
              <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.col.cost') }}</span>
              <span class="text-base">{{ item.cost === null ? '-' : formatNumber(item.cost) }}</span>
            </div>

            <!-- 價格 -->
            <div class="flex min-w-[90px] flex-col gap-1">
              <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.col.price') }}</span>
              <span class="text-base">{{ formatNumber(item.price) }}</span>
            </div>
          </div>
        </div>

        <!-- 購物車總金額 -->
        <p class="text-right text-sm">
          {{ $t('bonus_points.records.items_modal.cart_total') }} NTD$
          <span class="text-base font-semibold text-primary">{{ formatNumber(cart.subtotal) }}</span>
        </p>
      </section>

      <!-- 訂單金額明細（比照商城前台結帳計算） -->
      <div class="flex flex-col gap-2 border-t border-[var(--p-content-border-color)] pt-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.product_total') }}</span>
          <span>${{ formatNumber(detail.productTotal) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.shipping_fee') }}</span>
          <span>${{ formatNumber(detail.shippingFee) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.shipping_discount') }}</span>
          <span>{{ detail.shippingDiscount > 0 ? '-$' + formatNumber(detail.shippingDiscount) : '$0' }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.coupon') }}</span>
          <span>{{ detail.couponDiscount === null ? '—' : '-$' + formatNumber(detail.couponDiscount) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.points') }}</span>
          <span class="text-[var(--p-red-500)]">-${{ formatNumber(detail.pointsDeduction) }}</span>
        </div>
        <div class="flex items-center justify-between border-t border-[var(--p-content-border-color)] pt-3">
          <span class="text-base font-semibold">{{ $t('bonus_points.records.items_modal.order_total') }}</span>
          <span class="text-lg font-semibold text-primary">NTD$ {{ formatNumber(detail.total) }}</span>
        </div>
      </div>
    </div>
  </Dialog>
</template>
