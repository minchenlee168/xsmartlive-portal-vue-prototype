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
import { DEFAULT_CURRENCY, formatCurrency, type StoreCurrency } from '../currency';

const props = withDefaults(defineProps<{
  /** 要看商品項目的訂單；為 null 時不載入 */
  record: BonusSendRecord | null;
  /** 商店幣別（由發送紀錄彈窗傳入）：金額顯示符號 / 小數位跟隨 */
  currency?: StoreCurrency;
}>(), {
  currency: DEFAULT_CURRENCY,
});

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();

const detail = computed(() =>
  (props.record ? createMockOrderDetail(props.record.orderNo, props.record.pointsUsed) : null));
const carts = computed(() => detail.value?.carts ?? []);

/** 依商店幣別格式化金額（含符號 + 小數位） */
const money = (value: number) => formatCurrency(value, props.currency);
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
      <!-- 商品清單區：固定高度、內部捲動；金額明細固定於下方 -->
      <div class="flex h-96 flex-col gap-6 overflow-y-auto pr-1">
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

        <!-- 桌機：商品 DataTable（依 design.md §6.8） -->
        <DataTable
          :value="cart.items"
          striped-rows
          size="small"
          class="hidden md:block"
        >
          <Column :header="$t('bonus_points.records.items_modal.col.product')">
            <template #body="{ data }">
              <div class="flex items-center gap-3">
                <span class="size-12 shrink-0 rounded-md bg-surface-200 dark:bg-surface-700"></span>
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="font-medium break-words">{{ data.name }}</span>
                  <span class="text-xs text-surface-500 dark:text-surface-400">{{ money(data.unitPrice) }}</span>
                </div>
              </div>
            </template>
          </Column>
          <Column :header="$t('bonus_points.records.items_modal.col.quantity')">
            <template #body="{ data }">{{ data.quantity }}</template>
          </Column>
          <Column :header="$t('bonus_points.records.items_modal.col.cost')">
            <template #body="{ data }">{{ data.cost === null ? '-' : money(data.cost) }}</template>
          </Column>
          <Column :header="$t('bonus_points.records.items_modal.col.price')">
            <template #body="{ data }">{{ money(data.price) }}</template>
          </Column>
        </DataTable>

        <!-- 手機（<768px）：商品卡片 -->
        <div class="divide-y divide-[var(--p-content-border-color)] md:hidden">
          <div v-for="(item, ii) in cart.items" :key="ii" class="flex flex-col gap-2 px-1 py-3">
            <div class="flex items-center gap-3">
              <span class="size-12 shrink-0 rounded-md bg-surface-200 dark:bg-surface-700"></span>
              <div class="flex min-w-0 flex-col gap-1">
                <span class="text-sm font-medium break-words">{{ item.name }}</span>
                <span class="text-xs text-surface-500 dark:text-surface-400">{{ money(item.unitPrice) }}</span>
              </div>
            </div>
            <div class="flex flex-col gap-1 rounded-md bg-surface-50 px-2 py-2 text-sm dark:bg-surface-800/40">
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.items_modal.col.quantity') }}</span>
                <span>{{ item.quantity }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.items_modal.col.cost') }}</span>
                <span>{{ item.cost === null ? '-' : money(item.cost) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.items_modal.col.price') }}</span>
                <span>{{ money(item.price) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 購物車總金額 -->
        <p class="text-right text-sm">
          {{ $t('bonus_points.records.items_modal.cart_total') }}
          <span class="text-base font-semibold text-primary">{{ money(cart.subtotal) }}</span>
        </p>
      </section>
      </div>

      <!-- 訂單金額明細（比照商城前台結帳計算） -->
      <div class="flex flex-col gap-2 border-t border-[var(--p-content-border-color)] pt-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.product_total') }}</span>
          <span>{{ money(detail.productTotal) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.shipping_fee') }}</span>
          <span>{{ money(detail.shippingFee) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.shipping_discount') }}</span>
          <span>{{ detail.shippingDiscount > 0 ? '-' + money(detail.shippingDiscount) : money(0) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.coupon') }}</span>
          <span>{{ detail.couponDiscount === null ? '—' : '-' + money(detail.couponDiscount) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.items_modal.points') }}</span>
          <span class="text-[var(--p-red-500)]">-{{ money(detail.pointsDeduction) }}</span>
        </div>
        <div class="flex items-center justify-between border-t border-[var(--p-content-border-color)] pt-3">
          <span class="text-base font-semibold">{{ $t('bonus_points.records.items_modal.order_total') }}</span>
          <span class="text-lg font-semibold text-primary">{{ money(detail.total) }}</span>
        </div>
      </div>
    </div>
  </Dialog>
</template>
