<script setup lang="ts">
import { PageCardLayout, PaginationTable } from '@/admin/components/portal-ui';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { KeywordLotteryStatus, type KeywordLotteryRow } from './types';
import { mockKeywordLotteryList } from './mockData';
import { RouteName } from '@/admin/router';

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

type StatusFilter = 'all' | KeywordLotteryStatus;

const keyword = ref('');
const statusFilter = ref<StatusFilter>('all');

const statusOptions = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('keyword_lottery.status.all'), value: 'all' },
  { label: t('keyword_lottery.status.not_started'), value: KeywordLotteryStatus.NotStarted },
  { label: t('keyword_lottery.status.in_progress'), value: KeywordLotteryStatus.InProgress },
  { label: t('keyword_lottery.status.ended'), value: KeywordLotteryStatus.Ended },
]);

const columns = computed(() => [
  { field: 'index', header: t('keyword_lottery.table.index'), slot: 'index' },
  { field: 'sessionName', header: t('keyword_lottery.table.session_name') },
  { field: 'keyword', header: t('keyword_lottery.table.keyword'), slot: 'keyword' },
  { field: 'period', header: t('keyword_lottery.table.period'), slot: 'period' },
  { field: 'prizeContent', header: t('keyword_lottery.table.prize_content'), slot: 'prizeContent' },
  { field: 'winnerCount', header: t('keyword_lottery.table.winner_count') },
  { field: 'status', header: t('keyword_lottery.table.status'), slot: 'status' },
  { field: 'createdAt', header: t('keyword_lottery.table.created_at') },
  { field: 'actions', header: t('keyword_lottery.table.actions'), slot: 'actions' },
]);

const filteredList = computed<KeywordLotteryRow[]>(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return mockKeywordLotteryList.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.sessionName.toLowerCase().includes(normalizedKeyword)
        || row.keyword.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusFilter.value === 'all' || row.status === statusFilter.value;

    return matchKeyword && matchStatus;
  });
});

const statusLabel = (status: KeywordLotteryStatus) => t(`keyword_lottery.status.${status}`);

const statusSeverity = (status: KeywordLotteryStatus): 'success' | 'info' | 'secondary' => {
  if (status === KeywordLotteryStatus.InProgress) return 'success';
  if (status === KeywordLotteryStatus.NotStarted) return 'info';
  return 'secondary';
};

const prizeText = (row: KeywordLotteryRow) => t(`keyword_lottery.prize_format.${row.prizeType}`, { content: row.prizeContent });

function handleCreate() {
  // 原型階段：尚未實作新增頁
}

function handleDraw(row: KeywordLotteryRow) {
  const target = router.resolve({
    name: RouteName.BidGiftLotteryDraw,
    params: { id: row.id },
    query: { session: row.sessionName },
  });
  window.open(target.href, '_blank', 'noopener');
}

function handleEdit(_row: KeywordLotteryRow) {
  // 原型階段：尚未實作編輯頁
}

function handleDelete(_row: KeywordLotteryRow) {
  // 原型階段：尚未實作刪除流程
}
</script>

<template>
  <PageCardLayout
    :title="$t('keyword_lottery.title')"
    :show-back="false"
  >
    <template #actions>
      <Button
        :label="$t('keyword_lottery.button.create')"
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
        :placeholder="$t('keyword_lottery.form.placeholder.search')"
        class="w-full max-w-sm"
      />

      <Select
        v-model="statusFilter"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('keyword_lottery.form.placeholder.status')"
        class="w-40"
      />
    </div>

    <PaginationTable
      :data="filteredList"
      :columns="columns"
    >
      <template #index="{ data }">
        {{ filteredList.indexOf(data) + 1 }}
      </template>

      <template #keyword="{ data }">
        <Tag
          :value="data.keyword"
          severity="secondary"
        />
      </template>

      <template #period="{ data }">
        <div class="text-sm whitespace-nowrap">
          <div>{{ data.startAt }}</div>
          <div>~ {{ data.endAt }}</div>
        </div>
      </template>

      <template #prizeContent="{ data }">
        {{ prizeText(data) }}
      </template>

      <template #status="{ data }">
        <Tag
          :value="statusLabel(data.status)"
          :severity="statusSeverity(data.status)"
        />
      </template>

      <template #actions="{ data }">
        <!-- 操作 icon button：改用線框樣式（rounded + outlined）統一視覺 -->
        <div class="flex items-center gap-1.5">
          <Button
            v-tooltip.top="$t('keyword_lottery.button.draw')"
            rounded
            text
            size="small"
            severity="success"
            @click="handleDraw(data)"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'shuffle']" />
            </template>
          </Button>

          <Button
            v-tooltip.top="$t('keyword_lottery.button.edit')"
            rounded
            text
            size="small"
            @click="handleEdit(data)"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'pen']" />
            </template>
          </Button>

          <Button
            v-tooltip.top="$t('keyword_lottery.button.delete')"
            rounded
            text
            size="small"
            severity="danger"
            @click="handleDelete(data)"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'trash']" />
            </template>
          </Button>
        </div>
      </template>
    </PaginationTable>
  </PageCardLayout>
</template>
