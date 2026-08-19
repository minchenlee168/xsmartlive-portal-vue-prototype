<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  visible: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const SAMPLE_THUMB = 'https://placehold.co/48x48/8b5cf6/ffffff/png?text=IMG';

interface SalesRow {
  createdAt: string;
  thumbnail: string;
  productName: string;
  sessionName: string;
  initStock: number;
  bidCount: number;
  bidQuantity: number;
  discardCount: number;
  subtotalQty: number;
  subtotalAmount: number;
  initStockSubtotal: number;
  remainingStock: number;
  discardRate: number;
  cost: number;
  profit: number;
}

const rows: SalesRow[] = [
  {
    createdAt: '2026-05-12 14:12:51',
    thumbnail: SAMPLE_THUMB,
    productName: 'QWER (場次：0512)',
    sessionName: '0512',
    initStock: 500,
    bidCount: 3,
    bidQuantity: 3,
    discardCount: 0,
    subtotalQty: 3,
    subtotalAmount: 1500,
    initStockSubtotal: 1994,
    remainingStock: 1994,
    discardRate: 0,
    cost: 0,
    profit: 0,
  },
  {
    createdAt: '2026-05-12 14:12:51',
    thumbnail: SAMPLE_THUMB,
    productName: 'QWER（衣服尺寸:M/顏色:紅/size:L）',
    sessionName: '0512',
    initStock: 500,
    bidCount: 1,
    bidQuantity: 1,
    discardCount: 0,
    subtotalQty: 1,
    subtotalAmount: 500,
    initStockSubtotal: 500,
    remainingStock: 497,
    discardRate: 0,
    cost: 0,
    profit: 0,
  },
  {
    createdAt: '2026-05-12 14:12:51',
    thumbnail: SAMPLE_THUMB,
    productName: 'QWER（衣服尺寸:M/顏色:黑/size:S）',
    sessionName: '0512',
    initStock: 500,
    bidCount: 1,
    bidQuantity: 1,
    discardCount: 0,
    subtotalQty: 1,
    subtotalAmount: 500,
    initStockSubtotal: 500,
    remainingStock: 497,
    discardRate: 0,
    cost: 0,
    profit: 0,
  },
];

const totalSalesAmount = computed(() => rows.reduce((sum, row) => sum + row.subtotalAmount, 0));
const totalCostAmount = computed(() => rows.reduce((sum, row) => sum + row.cost, 0));
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.product_sales.title')"
    :style="{ width: '82rem' }"
  >
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3 text-sm">
        <label>{{ t('bid_list.product_sales.filter.date_range') }}</label>
        <DatePicker
          selection-mode="range"
          date-format="yy/mm/dd"
          :placeholder="t('bid_list.product_sales.filter.date_range_placeholder')"
          show-icon
        />
        <Button
          severity="primary"
          size="small"
        >
          {{ t('bid_list.product_sales.filter.go') }}
        </Button>
        <div class="ml-auto flex gap-4 text-sm">
          <span>
            {{ t('bid_list.product_sales.summary.sales_total', { amount: totalSalesAmount }) }}
          </span>
          <span>
            {{ t('bid_list.product_sales.summary.cost_total', { amount: totalCostAmount }) }}
          </span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <th class="px-2 py-2 text-left">{{ t('bid_list.product_sales.column.created_at') }}</th>
              <th class="px-2 py-2 text-left">{{ t('bid_list.product_sales.column.photo') }}</th>
              <th class="px-2 py-2 text-left">{{ t('bid_list.product_sales.column.product') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.init_stock') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.bid_summary') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.discard') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.subtotal_qty') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.subtotal_amount') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.init_subtotal') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.remaining_stock') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.discard_rate') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.cost') }}</th>
              <th class="px-2 py-2 text-right">{{ t('bid_list.product_sales.column.profit') }}</th>
              <th class="px-2 py-2 text-left w-16">{{ t('bid_list.product_sales.column.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in rows"
              :key="index"
              class="border-t border-slate-100 dark:border-slate-800"
            >
              <td class="px-2 py-2 whitespace-nowrap">{{ row.createdAt }}</td>
              <td class="px-2 py-2">
                <img
                  :src="row.thumbnail"
                  alt=""
                  class="w-12 h-12 rounded object-cover"
                />
              </td>
              <td class="px-2 py-2">{{ row.productName }}</td>
              <td class="px-2 py-2 text-right">{{ row.initStock }}</td>
              <td class="px-2 py-2 text-right">
                {{ t('bid_list.product_sales.cell.bid_count', { count: row.bidCount }) }}<br />
                {{ t('bid_list.product_sales.cell.bid_quantity', { quantity: row.bidQuantity }) }}
              </td>
              <td class="px-2 py-2 text-right">{{ row.discardCount }}</td>
              <td class="px-2 py-2 text-right">{{ row.subtotalQty }}</td>
              <td class="px-2 py-2 text-right">{{ row.subtotalAmount }}</td>
              <td class="px-2 py-2 text-right">{{ row.initStockSubtotal }}</td>
              <td class="px-2 py-2 text-right">{{ row.remainingStock }}</td>
              <td class="px-2 py-2 text-right">{{ row.discardRate }}%</td>
              <td class="px-2 py-2 text-right">{{ row.cost }}</td>
              <td class="px-2 py-2 text-right">{{ row.profit }}</td>
              <td class="px-2 py-2">
                <Button
                  size="small"
                  severity="info"
                  outlined
                >
                  {{ t('bid_list.product_sales.button.edit') }}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.product_sales.button.close') }}
      </Button>
    </template>
  </Dialog>
</template>
