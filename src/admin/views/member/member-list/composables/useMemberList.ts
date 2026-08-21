import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * 表格欄位定義（對齊設計 mockup 14 欄）。
 *
 * `slot` 對應 PaginationTable 的具名 slot 渲染；純文字欄在資料層預先格式化（`spendLabel` /
 * `lastOrderLabel`），只有需要 Tag、圖示群或條件式變色的欄位才開 slot。
 *
 * ⚠️ 會員編號 / 綁定資訊 / 星等 / 累積消費 / 標單數 / 棄標數 / 棄標率 / 最後購買日等欄位
 * 後端尚未提供，目前以 mock 假資料呈現（見 `../mock/mockMembers.ts`）。
 */
const baseColumns = [
  { field: 'id', headerKey: 'member.table.column.id', sortable: true },
  { field: 'no', headerKey: 'member.table.column.no', nowrap: true },
  { field: 'name', headerKey: 'member.table.column.name', nowrap: true },
  { field: 'mobileMasked', headerKey: 'member.table.column.mobile', nowrap: true },
  { field: 'bindings', headerKey: 'member.table.column.bindings', slot: 'bindings' },
  { field: 'level', headerKey: 'member.table.column.level', slot: 'level', nowrap: true },
  { field: 'stars', headerKey: 'member.table.column.stars', slot: 'stars', nowrap: true },
  { field: 'spendLabel', headerKey: 'member.table.column.spend', sortable: true, sortField: 'spend', nowrap: true },
  { field: 'bids', headerKey: 'member.table.column.bids', sortable: true, nowrap: true },
  { field: 'abandonedBids', headerKey: 'member.table.column.abandoned_bids', sortable: true, nowrap: true },
  { field: 'abandonRate', headerKey: 'member.table.column.abandon_rate', slot: 'abandonRate', sortable: true, sortField: 'abandonRateValue', nowrap: true },
  { field: 'lastOrderLabel', headerKey: 'member.table.column.last_order', sortable: true, sortField: 'lastOrderAt', nowrap: true },
  { field: 'status', headerKey: 'member.table.column.status', slot: 'status', nowrap: true },
  { field: 'actions', headerKey: 'member.table.column.actions', slot: 'actions', frozen: true, alignFrozen: 'right' },
] as const;

/**
 * 提供 i18n 化的表格欄位定義。
 */
export function useMemberList() {
  const { t } = useI18n();

  const columns = computed(() =>
    baseColumns.map((col) => ({ ...col, header: col.headerKey ? t(col.headerKey) : '' })),
  );

  return { columns };
}
