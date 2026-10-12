<script setup lang="ts">
import { PaginationTable } from '@/admin/components/portal-ui'
import { useConfirm } from 'primevue/useconfirm'
import { useGlobalToast } from '@/admin/composables/useGlobalToast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FreeShippingFormDialog from './components/FreeShippingFormDialog.vue'
import { mockFreeShippingList } from './mockData'
import {
  FREE_TYPE_LABEL_KEY,
  FreeShippingFreeType,
  FreeShippingLifecycle,
  FreeShippingTargetType,
  TARGET_TYPE_LABEL_KEY,
  type FreeShippingLifecycleValue,
  type FreeShippingRow,
} from './types'

const { t } = useI18n()
const confirm = useConfirm()
const { showSuccess } = useGlobalToast()

type LifecycleFilter = 'all' | FreeShippingLifecycleValue
type StatusFilter = 'all' | 'published' | 'unpublished'

const rows = ref<FreeShippingRow[]>([...mockFreeShippingList])

const keyword = ref('')
const appliedKeyword = ref('')
const statusTab = ref<LifecycleFilter>('all')
const freeTypeFilter = ref<number | 'all'>('all')
const statusFilter = ref<StatusFilter>('all')

const batchMode = ref(false)
const selected = ref<FreeShippingRow[]>([])

const isFormDialogVisible = ref(false)
const formMode = ref<'create' | 'edit' | 'view'>('create')
const editingRow = ref<FreeShippingRow | null>(null)

const statusTabs = computed(() => [
  { value: 'all' as LifecycleFilter, label: t('free_shipping.status_tab.all') },
  { value: FreeShippingLifecycle.Ongoing, label: t('free_shipping.status_tab.ongoing') },
  { value: FreeShippingLifecycle.Upcoming, label: t('free_shipping.status_tab.upcoming') },
  { value: FreeShippingLifecycle.Ended, label: t('free_shipping.status_tab.ended') },
])

const freeTypeFilterOptions = computed(() => [
  { value: 'all' as number | 'all', label: t('free_shipping.status_tab.all') },
  ...Object.values(FreeShippingFreeType).map((value) => ({ value: value as number | 'all', label: t(FREE_TYPE_LABEL_KEY[value]) })),
])
const statusFilterOptions = computed(() => [
  { value: 'all' as StatusFilter, label: t('free_shipping.status_tab.all') },
  { value: 'published' as StatusFilter, label: t('free_shipping.status.published') },
  { value: 'unpublished' as StatusFilter, label: t('free_shipping.status.unpublished') },
])

const columns = computed(() => [
  { field: 'name', header: t('free_shipping.table.name'), nowrap: true },
  { field: 'free_type', header: t('free_shipping.table.free_type'), slot: 'free_type', nowrap: true },
  { field: 'target', header: t('free_shipping.table.target'), slot: 'target', nowrap: true },
  { field: 'threshold', header: t('free_shipping.table.threshold'), slot: 'threshold', nowrap: true },
  { field: 'purchaseCount', header: t('free_shipping.table.purchase_count'), nowrap: true },
  { field: 'start_at', header: t('free_shipping.table.start_at'), slot: 'start_at', nowrap: true },
  { field: 'end_at', header: t('free_shipping.table.end_at'), slot: 'end_at', nowrap: true },
  { field: 'status', header: t('free_shipping.table.status'), slot: 'status', nowrap: true },
  { field: 'actions', header: t('free_shipping.table.actions'), slot: 'actions', nowrap: true, frozen: true, alignFrozen: 'right' as const },
])

function parseTime(value: string): number {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
function getLifecycle(row: FreeShippingRow): FreeShippingLifecycleValue {
  const now = Date.now()
  if (now < parseTime(row.startAt)) {
    return FreeShippingLifecycle.Upcoming
  }
  if (now > parseTime(row.endAt)) {
    return FreeShippingLifecycle.Ended
  }
  return FreeShippingLifecycle.Ongoing
}

const filteredList = computed<FreeShippingRow[]>(() => {
  const kw = appliedKeyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (kw && !row.name.toLowerCase().includes(kw)) {
      return false
    }
    if (statusTab.value !== 'all' && getLifecycle(row) !== statusTab.value) {
      return false
    }
    if (freeTypeFilter.value !== 'all' && row.freeType !== freeTypeFilter.value) {
      return false
    }
    if (statusFilter.value === 'published' && !row.enabled) {
      return false
    }
    if (statusFilter.value === 'unpublished' && row.enabled) {
      return false
    }
    return true
  })
})

function freeTypeLabel(row: FreeShippingRow): string {
  return t(FREE_TYPE_LABEL_KEY[row.freeType])
}
function targetLabel(row: FreeShippingRow): string {
  const typeLabel = t(TARGET_TYPE_LABEL_KEY[row.targetType])
  if (row.targetType === FreeShippingTargetType.CheckoutSetting && row.targetName) {
    return t('free_shipping.text.target_with_name', { type: typeLabel, name: row.targetName })
  }
  return typeLabel
}
function thresholdText(row: FreeShippingRow): string {
  if (row.freeType === FreeShippingFreeType.MinAmount && row.minAmount !== null) {
    return `$${row.minAmount.toLocaleString()}`
  }
  if (row.freeType === FreeShippingFreeType.MinQuantity && row.minQuantity !== null) {
    return t('free_shipping.text.threshold_quantity', { count: row.minQuantity })
  }
  return t('free_shipping.text.no_threshold')
}
function formatDateTime(value: string): string {
  return value ? value.slice(0, 16) : t('free_shipping.text.empty_placeholder')
}

function onSearch() {
  appliedKeyword.value = keyword.value
}

function handleCreate() {
  formMode.value = 'create'
  editingRow.value = null
  isFormDialogVisible.value = true
}
function handleView(row: FreeShippingRow) {
  formMode.value = 'view'
  editingRow.value = row
  isFormDialogVisible.value = true
}
function handleEdit(row: FreeShippingRow) {
  formMode.value = 'edit'
  editingRow.value = row
  isFormDialogVisible.value = true
}

function handleFormSubmit(row: FreeShippingRow) {
  if (formMode.value === 'edit') {
    rows.value = rows.value.map((item) => (item.id === row.id ? row : item))
    showSuccess({ detail: t('free_shipping.toast.updated') })
    return
  }
  const nextId = String(rows.value.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1)
  rows.value = [{ ...row, id: nextId }, ...rows.value]
  showSuccess({ detail: t('free_shipping.toast.created') })
}

function handleToggleEnabled(row: FreeShippingRow, value: boolean) {
  rows.value = rows.value.map((item) => (item.id === row.id ? { ...item, enabled: value } : item))
  showSuccess({ detail: value ? t('free_shipping.toast.status_on', { name: row.name }) : t('free_shipping.toast.status_off', { name: row.name }) })
}

function handleDelete(row: FreeShippingRow) {
  confirm.require({
    header: t('free_shipping.confirm.delete_title'),
    message: t('free_shipping.confirm.delete_message', { name: row.name }),
    defaultFocus: 'reject',
    rejectProps: { label: t('free_shipping.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('free_shipping.confirm.accept'), severity: 'danger' },
    accept: () => {
      rows.value = rows.value.filter((item) => item.id !== row.id)
      showSuccess({ detail: t('free_shipping.toast.deleted') })
    },
  })
}

function enterBatchMode() {
  batchMode.value = true
  selected.value = []
}
function exitBatchMode() {
  batchMode.value = false
  selected.value = []
}
function handleBatchDelete() {
  const ids = new Set(selected.value.map((row) => row.id))
  const count = ids.size
  if (count === 0) {
    return
  }
  confirm.require({
    header: t('free_shipping.confirm.delete_title'),
    message: t('free_shipping.confirm.batch_delete_message', { count }),
    defaultFocus: 'reject',
    rejectProps: { label: t('free_shipping.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('free_shipping.confirm.accept'), severity: 'danger' },
    accept: () => {
      rows.value = rows.value.filter((item) => !ids.has(item.id))
      showSuccess({ detail: t('free_shipping.toast.batch_deleted', { count }) })
      exitBatchMode()
    },
  })
}

// 篩選變動時清掉選取
watch([statusTab, appliedKeyword, freeTypeFilter, statusFilter], () => {
  selected.value = []
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold text-surface-700 dark:text-surface-100">
        {{ $t('free_shipping.title') }}
      </h2>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-muted-color">{{ $t('free_shipping.breadcrumb.parent') }}</span>
        <FontAwesomeIcon
          :icon="['far', 'chevron-right']"
          class="text-xs text-muted-color"
        />
        <span class="text-primary">{{ $t('free_shipping.title') }}</span>
      </div>
    </div>

    <Card>
      <template #content>
        <Tabs
          :value="statusTab"
          class="mb-4"
          @update:value="(value) => statusTab = value as LifecycleFilter"
        >
          <TabList>
            <Tab
              v-for="tab in statusTabs"
              :key="String(tab.value)"
              :value="tab.value"
            >{{ tab.label }}</Tab>
          </TabList>
        </Tabs>

        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <InputText
              v-model="keyword"
              :placeholder="$t('free_shipping.form.placeholder.search')"
              class="w-56 sm:w-64"
              @keyup.enter="onSearch"
            />
            <Button
              :label="$t('free_shipping.button.search')"
              @click="onSearch"
            />
            <Select
              v-model="freeTypeFilter"
              :options="freeTypeFilterOptions"
              option-label="label"
              option-value="value"
              class="w-44"
              :placeholder="$t('free_shipping.form.placeholder.free_type')"
            />
            <Select
              v-model="statusFilter"
              :options="statusFilterOptions"
              option-label="label"
              option-value="value"
              class="w-36"
              :placeholder="$t('free_shipping.form.placeholder.status_filter')"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <template v-if="batchMode">
              <Button
                type="button"
                severity="danger"
                outlined
                :disabled="selected.length === 0"
                :label="$t('free_shipping.button.delete')"
                @click="handleBatchDelete"
              >
                <template #icon>
                  <FontAwesomeIcon
                    :icon="['far', 'trash-can']"
                    class="mr-2"
                  />
                </template>
              </Button>
              <Button
                type="button"
                severity="secondary"
                outlined
                :label="$t('free_shipping.form_dialog.button.cancel')"
                @click="exitBatchMode"
              />
            </template>
            <template v-else>
              <Button
                type="button"
                severity="danger"
                outlined
                :label="$t('free_shipping.button.batch_delete')"
                @click="enterBatchMode"
              >
                <template #icon>
                  <FontAwesomeIcon
                    :icon="['far', 'trash-can']"
                    class="mr-2"
                  />
                </template>
              </Button>
              <Button
                type="button"
                :label="$t('free_shipping.button.create')"
                @click="handleCreate"
              >
                <template #icon>
                  <FontAwesomeIcon
                    :icon="['fas', 'plus']"
                    class="mr-2"
                  />
                </template>
              </Button>
            </template>
          </div>
        </div>

        <PaginationTable
          v-model:data="filteredList"
          v-model:selection="selected"
          :columns="columns"
          :show-selection-column="batchMode"
        >
          <template #free_type="{ data }">
            {{ freeTypeLabel(data) }}
          </template>
          <template #target="{ data }">
            {{ targetLabel(data) }}
          </template>
          <template #threshold="{ data }">
            {{ thresholdText(data) }}
          </template>
          <template #start_at="{ data }">
            {{ formatDateTime(data.startAt) }}
          </template>
          <template #end_at="{ data }">
            {{ formatDateTime(data.endAt) }}
          </template>
          <template #status="{ data }">
            <ToggleSwitch
              :model-value="data.enabled"
              @update:model-value="(value) => handleToggleEnabled(data, value)"
            />
          </template>
          <template #actions="{ data }">
            <div class="flex items-center gap-1">
              <Button
                v-tooltip.top="$t('free_shipping.button.view')"
                type="button"
                rounded
                text
                size="small"
                severity="success"
                :aria-label="$t('free_shipping.button.view')"
                @click="handleView(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'eye']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('free_shipping.button.edit')"
                type="button"
                rounded
                text
                size="small"
                :aria-label="$t('free_shipping.button.edit')"
                @click="handleEdit(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'edit']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('free_shipping.button.delete')"
                type="button"
                rounded
                text
                size="small"
                severity="danger"
                :aria-label="$t('free_shipping.button.delete')"
                @click="handleDelete(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'trash']" />
                </template>
              </Button>
            </div>
          </template>
        </PaginationTable>
      </template>
    </Card>

    <FreeShippingFormDialog
      v-model:visible="isFormDialogVisible"
      :mode="formMode"
      :row="editingRow"
      @submit="handleFormSubmit"
    />
  </div>
</template>
