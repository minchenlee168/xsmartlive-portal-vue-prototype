<script setup lang="ts">
import { PageCardLayout, PaginationTable } from '@/admin/components/portal-ui';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { LotteryStatus, PrizeType, type BidGiftLotteryRow } from './types';
import { mockLotteryList } from './mockData';

import { RouteName } from '@/admin/router';

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

type StatusFilter = 'all' | LotteryStatus;

const keyword = ref('');
const statusFilter = ref<StatusFilter>('all');

const statusOptions = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('bid_gift_lottery.status.all'), value: 'all' },
  { label: t('bid_gift_lottery.status.in_progress'), value: LotteryStatus.InProgress },
  { label: t('bid_gift_lottery.status.ended'), value: LotteryStatus.Ended },
]);

const columns = computed(() => [
  { field: 'createdAt', header: t('bid_gift_lottery.table.created_at') },
  { field: 'sessionName', header: t('bid_gift_lottery.table.session_name') },
  { field: 'searchDate', header: t('bid_gift_lottery.table.search_date'), slot: 'searchDate' },
  { field: 'prizeType', header: t('bid_gift_lottery.table.prize_type'), slot: 'prizeType' },
  { field: 'prizeContent', header: t('bid_gift_lottery.table.prize_content') },
  { field: 'requiredAmount', header: t('bid_gift_lottery.table.required_amount'), slot: 'requiredAmount' },
  { field: 'starFilter', header: t('bid_gift_lottery.table.star_filter'), slot: 'starFilter' },
  { field: 'status', header: t('bid_gift_lottery.table.status'), slot: 'status' },
  { field: 'actions', header: t('bid_gift_lottery.table.actions'), slot: 'actions' },
]);

const filteredList = computed<BidGiftLotteryRow[]>(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return mockLotteryList.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.sessionName.toLowerCase().includes(normalizedKeyword)
        || row.prizeContent.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusFilter.value === 'all' || row.status === statusFilter.value;

    return matchKeyword && matchStatus;
  });
});

const prizeTypeLabel = (prizeType: PrizeType) => t(`bid_gift_lottery.prize_type.${prizeType}`);
const statusLabel = (status: LotteryStatus) => t(`bid_gift_lottery.status.${status}`);

const formatAmount = (value: number | null) => (
  value === null
    ? t('bid_gift_lottery.value.unlimited')
    : t('bid_gift_lottery.value.amount', { value })
);

const formatStars = (value: number | null) => (
  value === null ? t('bid_gift_lottery.value.unlimited') : String(value)
);

const statusSeverity = (status: LotteryStatus) => (
  status === LotteryStatus.InProgress ? 'success' : 'secondary'
);

function handleCreate() {
  // 原型階段：尚未實作新增頁
}

function handleDraw(row: BidGiftLotteryRow) {
  const target = router.resolve({ name: RouteName.BidGiftLotteryDraw, params: { id: row.id } });
  window.open(target.href, '_blank', 'noopener');
}

function handleEdit(_row: BidGiftLotteryRow) {
  // 原型階段：尚未實作編輯頁
}

function handleDelete(_row: BidGiftLotteryRow) {
  // 原型階段：尚未實作刪除流程
}
</script>

<template>
  <PageCardLayout
    :title="$t('bid_gift_lottery.title')"
    :show-back="false"
  >
    <template #actions>
      <Button
        :label="$t('bid_gift_lottery.button.create')"
        size="small"
        @click="handleCreate"
      >
        <template #icon>
          <FontAwesomeIcon :icon="['fas', 'plus']" />
        </template>
      </Button>
    </template>

    <div class="mb-4 flex flex-wrap items-center gap-4">
      <InputText
        v-model="keyword"
        :placeholder="$t('bid_gift_lottery.form.placeholder.search')"
        class="w-full max-w-sm"
      />

      <Select
        v-model="statusFilter"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('bid_gift_lottery.form.placeholder.status')"
        class="w-40"
      />
    </div>

    <PaginationTable
      :data="filteredList"
      :columns="columns"
    >
      <template #searchDate="{ data }">
        <div class="text-sm whitespace-nowrap">
          <div>{{ data.searchStartAt }}</div>
          <div>~ {{ data.searchEndAt }}</div>
        </div>
      </template>

      <template #prizeType="{ data }">
        {{ prizeTypeLabel(data.prizeType) }}
      </template>

      <template #requiredAmount="{ data }">
        {{ formatAmount(data.requiredAmount) }}
      </template>

      <template #starFilter="{ data }">
        {{ formatStars(data.starFilter) }}
      </template>

      <template #status="{ data }">
        <Tag
          :value="statusLabel(data.status)"
          :severity="statusSeverity(data.status)"
        />
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-1">
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.draw')"
            :aria-label="$t('bid_gift_lottery.button.draw')"
            icon="pi pi-play"
            rounded
            text
            size="small"
            severity="success"
            @click="handleDraw(data)"
          />
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.edit')"
            :aria-label="$t('bid_gift_lottery.button.edit')"
            icon="pi pi-pen-to-square"
            rounded
            text
            size="small"
            @click="handleEdit(data)"
          />
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.delete')"
            :aria-label="$t('bid_gift_lottery.button.delete')"
            icon="pi pi-trash"
            rounded
            text
            size="small"
            severity="danger"
            @click="handleDelete(data)"
          />
        </div>
      </template>
    </PaginationTable>
  </PageCardLayout>
</template>
