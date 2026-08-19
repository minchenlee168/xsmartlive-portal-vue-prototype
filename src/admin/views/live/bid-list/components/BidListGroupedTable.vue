<script setup lang="ts">
/**
 * 得標清單「以同一標方式顯示」表格
 * — 對照舊系統 saleOrderList showStatus=5「以同得標場次方式顯示」
 * — 一列 = 一組（場次 × 商品）；標單數量 = 群組聚合的得標筆數
 * — 兩顆列動作：批次編輯、批次更新
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BidListBundleItem } from '../composables/useBidListMock';
import { stripSpecPrefix } from '../utils/spec';

export type BidListGroupedAction = 'batchEdit' | 'batchUpdate';

/**
 * 群組列（場次 × 商品聚合後的一列）
 */
export interface BidListGroupedRow {
  /** 群組 key，格式：{sessionName}::{productName} */
  key: string;
  /** 該群組第一筆得標的建立時間 */
  createTime: string;
  /** 場次名稱 */
  sessionName: string;
  /** 商品名稱 */
  productName: string;
  /** 商品圖（若群組內任一筆有圖就用第一筆有的） */
  productImage: string;
  /** 群組共用規格備註 */
  specNote: string;
  /** 組合商品的子商品列表；有值代表此列為組合商品，規格欄改列子商品內容 */
  bundleItems?: BidListBundleItem[];
  /** 標單數量 */
  bidCount: number;
}

interface Props {
  rows: BidListGroupedRow[];
}

interface Emits {
  (event: 'row-action', action: BidListGroupedAction, row: BidListGroupedRow): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

/** 規格欄：去掉 specNote 的「規格:」前綴，回傳純規格值（無則空字串） */
function specValue(row: BidListGroupedRow): string {
  return stripSpecPrefix(row.specNote);
}

/** 組合商品規格欄預設最多顯示的子商品數，其餘收進「更多」 */
const BUNDLE_PREVIEW_COUNT = 3;

/** 已展開「更多」子商品的組合商品群組 key */
const expandedBundleKeys = ref<Set<string>>(new Set());

function isBundleExpanded(rowKey: string): boolean {
  return expandedBundleKeys.value.has(rowKey);
}

function toggleBundle(rowKey: string) {
  const next = new Set(expandedBundleKeys.value);
  if (next.has(rowKey)) {
    next.delete(rowKey);
  } else {
    next.add(rowKey);
  }
  expandedBundleKeys.value = next;
}

/** 規格欄目前要顯示的子商品（未展開時僅前 BUNDLE_PREVIEW_COUNT 件） */
function visibleBundleItems(row: BidListGroupedRow): BidListBundleItem[] {
  const items = row.bundleItems ?? [];
  return isBundleExpanded(row.key) ? items : items.slice(0, BUNDLE_PREVIEW_COUNT);
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[900px] text-sm border-collapse">
      <thead>
        <tr class="border-b border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-100">
          <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">
            {{ t('bid_list.grouped.column.created_at') }}
          </th>
          <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">
            {{ t('bid_list.grouped.column.session') }}
          </th>
          <th class="px-4 py-3 text-left font-semibold">
            {{ t('bid_list.grouped.column.product') }}
          </th>
          <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">
            {{ t('bid_list.grouped.column.bid_count') }}
          </th>
          <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">
            {{ t('bid_list.grouped.column.spec') }}
          </th>
          <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">
            {{ t('bid_list.grouped.column.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="rows.length === 0"
          class="border-b border-surface-200 dark:border-surface-700"
        >
          <td
            colspan="6"
            class="px-4 py-12 text-center text-surface-500 dark:text-surface-400"
          >
            {{ t('bid_list.empty.no_data') }}
          </td>
        </tr>

        <tr
          v-for="row in rows"
          :key="row.key"
          class="border-b border-surface-200 dark:border-surface-700 align-middle even:bg-surface-50 dark:even:bg-surface-800/50"
        >
          <!-- 建立時間 -->
          <td class="px-4 py-3 whitespace-nowrap text-surface-700 dark:text-surface-200">
            {{ row.createTime.slice(0, 16) }}
          </td>

          <!-- 場次名稱 -->
          <td class="px-4 py-3 whitespace-nowrap text-surface-700 dark:text-surface-200">
            {{ row.sessionName }}
          </td>

          <!-- 商品名稱（無圖顯示紅字） -->
          <td class="px-4 py-3 min-w-[220px]">
            <div class="flex items-center gap-2">
              <span
                v-if="!row.productImage"
                class="text-xs text-rose-500 dark:text-rose-400 whitespace-nowrap"
              >
                {{ t('bid_list.table.cell.no_product_image') }}
              </span>
              <span class="text-surface-800 dark:text-surface-100">
                {{ row.productName || '—' }}
              </span>
            </div>
          </td>

          <!-- 標單數量 -->
          <td class="px-4 py-3 whitespace-nowrap text-right font-medium text-primary-600 dark:text-primary-400">
            {{ t('bid_list.grouped.cell.bid_count', { count: row.bidCount }) }}
          </td>

          <!-- 規格（組合商品→列子商品內容，超過 3 件以「更多」展開；單一商品→規格值） -->
          <td class="px-4 py-3 text-xs text-surface-600 dark:text-surface-300 min-w-[140px] align-top">
            <div
              v-if="row.bundleItems?.length"
              class="flex flex-col gap-1"
            >
              <ul class="flex flex-col gap-1">
                <li
                  v-for="(item, index) in visibleBundleItems(row)"
                  :key="index"
                  class="whitespace-nowrap"
                >
                  {{ item.spec ? `${item.name} / ${item.spec}` : item.name }} ×{{ item.qty }}
                </li>
              </ul>
              <button
                v-if="row.bundleItems.length > BUNDLE_PREVIEW_COUNT"
                type="button"
                class="self-start text-xs text-primary-600 hover:underline dark:text-primary-400"
                @click="toggleBundle(row.key)"
              >
                {{
                  isBundleExpanded(row.key)
                    ? t('bid_list.table.cell.spec_bundle_collapse')
                    : t('bid_list.table.cell.spec_bundle_more', {
                        count: row.bundleItems.length - BUNDLE_PREVIEW_COUNT,
                      })
                }}
              </button>
            </div>
            <span v-else>{{ specValue(row) || '—' }}</span>
          </td>

          <!-- 批次編輯 + 批次更新 -->
          <td class="px-4 py-3 whitespace-nowrap">
            <div class="flex flex-col gap-1">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                @click="emit('row-action', 'batchEdit', row)"
              >
                {{ t('bid_list.grouped.action.batch_edit') }}
              </Button>
              <Button
                type="button"
                size="small"
                severity="info"
                @click="emit('row-action', 'batchUpdate', row)"
              >
                {{ t('bid_list.grouped.action.batch_update') }}
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
