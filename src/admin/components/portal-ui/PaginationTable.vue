<script setup lang="ts">
import type { DataTablePageEvent, DataTableSortEvent } from 'primevue/datatable';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import LoaderSpinner from './LoaderSpinner.vue';
import Empty from './Empty.vue';

interface ColumnItem {
  field: string;
  header: string;
  sortable?: boolean;
  slot?: string;
  /** 是否凍結此欄（向後相容：未指定則不凍結）。 */
  frozen?: boolean;
  /** 凍結欄對齊側（搭配 frozen 使用）。 */
  alignFrozen?: 'left' | 'right';
}

interface PaginationTableProps {
  columns: ColumnItem[];
  loading?: boolean;
  reorderable?: boolean;
  showSelectionColumn?: boolean;
  rows?: number;
  rowsPerPageOptions?: number[];
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalNumber: number;
  };
}

const props = withDefaults(defineProps<PaginationTableProps>(), {
  showSelectionColumn: false,
  reorderable: false,
  loading: false,
  rows: 10,
  rowsPerPageOptions: () => [5, 10, 50, 100],
  pagination: undefined,
});

const emit = defineEmits<{
  (e: 'sort', payload: DataTableSortEvent): void;
  (e: 'page', payload: DataTablePageEvent): void;
  (e: 'row-reorder', payload: unknown[]): void;
}>();

const { t } = useI18n();

const data = defineModel<unknown[]>('data', { default: () => [] });
const selection = defineModel<unknown[]>('selection', { default: () => [] });

const defaultPagination = computed(() => ({
  currentPage: 1,
  pageSize: props.rows,
  totalPages: 1,
  totalNumber: data.value.length,
}));
const isLazy = computed(() => !!props.pagination);
const resolvedPagination = computed(() => props.pagination ?? defaultPagination.value);
const firstRowIndex = computed(
  () => (resolvedPagination.value.currentPage - 1) * resolvedPagination.value.pageSize,
);

const sortField = ref();
const sortOrder = ref();

function onSort(event: DataTableSortEvent) {
  sortField.value = event.sortField;
  sortOrder.value = event.sortOrder;

  emit('sort', event);
}

function onPage(event: DataTablePageEvent) {
  sortField.value = event.sortField;
  sortOrder.value = event.sortOrder;

  emit('page', event);
}

function onRowReorder(event: { value: unknown[] | undefined }) {
  if (!event.value) return;

  data.value = event.value;
  emit('row-reorder', event.value);
}
</script>

<template>
  <DataTable
    v-model:value="data"
    v-model:selection="selection"
    :loading="props.loading"
    :data-key="'id'"
    :lazy="isLazy"
    :rows="resolvedPagination.pageSize"
    :rows-per-page-options="props.rowsPerPageOptions"
    :total-records="resolvedPagination.totalNumber"
    :first="firstRowIndex"
    :sort-field="sortField"
    :sort-order="sortOrder"
    striped-rows
    paginator
    scrollable
    scroll-height="600px"
    @sort="onSort"
    @page="onPage"
    @row-reorder="onRowReorder"
  >
    <Column
      v-if="props.reorderable"
      row-reorder
      header-style="width: 3rem"
    />

    <Column
      v-if="showSelectionColumn"
      selection-mode="multiple"
      header-style="width: 3rem"
    />

    <Column
      v-for="col in props.columns"
      :key="col.field"
      :field="col.field"
      :header="col.header"
      :sortable="col.sortable"
      :frozen="col.frozen"
      :align-frozen="col.alignFrozen"
    >
      <template #body="{ data: rowData }">
        <Skeleton v-if="props.loading" />

        <template v-else>
          <slot
            v-if="col.slot"
            :name="col.slot"
            :data="rowData"
          />
          <template v-else>
            {{ rowData[col.field] }}
          </template>
        </template>
      </template>
    </Column>

    <template #loadingicon>
      <LoaderSpinner :size="36" />
    </template>

    <template #empty>
      <Empty />
    </template>

    <template #paginatorstart>
      <br class="hidden">
    </template>

    <template #paginatorend>
      <span class="ml-3 text-sm whitespace-nowrap">
        {{ t('common.pagination.total_records', { count: resolvedPagination.totalNumber }) }}
      </span>
    </template>
  </DataTable>
</template>
