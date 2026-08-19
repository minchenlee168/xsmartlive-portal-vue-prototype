<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ManualBidSessionRecordsTab from './ManualBidSessionRecordsTab.vue';
import type {
  ManualBidBatchPayload,
  ManualBidMemberCandidate,
} from '../composables/useManualBidSessionMock';

interface Props {
  visible: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'open-form', payload?: ManualBidBatchPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const activeTab = ref<'bidRecords' | 'createManualBid'>('bidRecords');

interface ManualBidRow {
  id: string;
  submittedAt: string;
  bidNumber: string;
  productName: string;
  amount: number;
  thumbnail: string;
  winnerName: string;
  winnerAvatar: string;
}

const SAMPLE_THUMB = 'https://placehold.co/48x48/8b5cf6/ffffff/png?text=IMG';
const SAMPLE_WINNER_AVATAR = 'https://placehold.co/64x64/8b5cf6/ffffff/png?text=A';

const rows = ref<ManualBidRow[]>([
  { id: '1', submittedAt: '2026-05-12 14:12:51', bidNumber: '17795664585e08e0d', productName: 'QWER', amount: 500, thumbnail: SAMPLE_THUMB, winnerName: '孫小美', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '2', submittedAt: '2026-05-12 14:12:51', bidNumber: '17795664422e349025', productName: 'QWER', amount: 500, thumbnail: SAMPLE_THUMB, winnerName: '王大明', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '3', submittedAt: '2026-05-12 14:12:51', bidNumber: '17795664430c498ef3', productName: 'QWER', amount: 500, thumbnail: SAMPLE_THUMB, winnerName: '李小華', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '4', submittedAt: '2026-05-12 14:12:51', bidNumber: '17795663717ae4555de', productName: 'QWER（衣服尺寸:M/顏色:紅/size:L）', amount: 500, thumbnail: SAMPLE_THUMB, winnerName: '陳大力', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '5', submittedAt: '2026-05-12 14:12:51', bidNumber: '17795663710fd6502e', productName: 'QWER（衣服尺寸:M/顏色:黑/size:S）', amount: 500, thumbnail: SAMPLE_THUMB, winnerName: '林美人', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '6', submittedAt: '2026-05-16 14:40:44', bidNumber: '17795614333bbbd586', productName: 'QWER（加購商品）', amount: 100, thumbnail: SAMPLE_THUMB, winnerName: '孫小美', winnerAvatar: SAMPLE_WINNER_AVATAR },
  { id: '7', submittedAt: '2026-05-16 14:40:44', bidNumber: '17795614334b761a36', productName: 'QWER', amount: 100, thumbnail: SAMPLE_THUMB, winnerName: '張美玲', winnerAvatar: SAMPLE_WINNER_AVATAR },
]);

/** 下標紀錄勾選狀態 */
const selectedRowIds = ref<Set<string>>(new Set());
/** 準備帶去 create tab 的預帶會員（依已勾 rows 抽出、依姓名去重） */
const carriedWinners = ref<ManualBidMemberCandidate[]>([]);

function isRowSelected(id: string): boolean {
  return selectedRowIds.value.has(id);
}
function toggleRow(id: string, checked: boolean) {
  if (checked) selectedRowIds.value.add(id);
  else selectedRowIds.value.delete(id);
}
const isAllRowsSelected = computed<boolean>(() =>
  rows.value.length > 0 && rows.value.every((r) => selectedRowIds.value.has(r.id)),
);
function toggleAllRows(checked: boolean) {
  if (checked) {
    for (const r of rows.value) selectedRowIds.value.add(r.id);
  } else {
    selectedRowIds.value.clear();
  }
}

function buildCandidateFromRow(row: ManualBidRow): ManualBidMemberCandidate {
  return {
    id: `from-record-${row.winnerName}`,
    memberCode: '-',
    name: row.winnerName,
    avatar: row.winnerAvatar,
    platform: 'facebook',
    socialAccount: '-',
    phoneLast4: '-',
    email: '-',
    sessionId: '-',
    sources: [],
    contextNote: t('bid_list.manual_bid.records_note.from_records'),
  };
}

function handleCreateFromRecords() {
  if (selectedRowIds.value.size === 0) return;
  const seenNames = new Set<string>();
  const winners: ManualBidMemberCandidate[] = [];
  for (const row of rows.value) {
    if (!selectedRowIds.value.has(row.id)) continue;
    if (seenNames.has(row.winnerName)) continue;
    seenNames.add(row.winnerName);
    winners.push(buildCandidateFromRow(row));
  }
  carriedWinners.value = winners;
  activeTab.value = 'createManualBid';
}

function handleSessionRecordsComplete(payload: ManualBidBatchPayload) {
  carriedWinners.value = [];
  selectedRowIds.value.clear();
  emit('open-form', payload);
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.manual_bid.title')"
    :style="{ width: '64rem' }"
  >
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="bidRecords">
          {{ t('bid_list.manual_bid.tab.bid_records') }}
        </Tab>
        <Tab value="createManualBid">
          {{ t('bid_list.manual_bid.tab.create_manual_bid') }}
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="bidRecords">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <Select
                :options="[
                  { label: t('bid_list.manual_bid.filter.all'), value: 'all' },
                  { label: t('bid_list.manual_bid.filter.live_shopping'), value: 'liveShopping' },
                  { label: t('bid_list.manual_bid.filter.community_shopping'), value: 'communityShopping' },
                  { label: t('bid_list.manual_bid.filter.multi_cart'), value: 'multiCart' },
                ]"
                option-label="label"
                option-value="value"
                model-value="all"
                class="min-w-[140px]"
              />
              <InputText
                :placeholder="t('bid_list.manual_bid.filter.placeholder')"
                class="flex-1"
              />
              <Select
                :options="[
                  { label: t('bid_list.manual_bid.filter.all_session'), value: 'all' },
                ]"
                option-label="label"
                option-value="value"
                model-value="all"
                class="min-w-[140px]"
              />
              <Button severity="primary">
                {{ t('bid_list.manual_bid.button.search') }}
              </Button>
              <Button
                severity="primary"
                :disabled="selectedRowIds.size === 0"
                @click="handleCreateFromRecords"
              >
                {{ t('bid_list.manual_bid.button.new_manual_bid_from_records') }}
              </Button>
            </div>

            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <th class="px-3 py-2 text-left w-10">
                    <Checkbox
                      :model-value="isAllRowsSelected"
                      binary
                      @update:model-value="toggleAllRows"
                    />
                  </th>
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_bid.column.submitted_at') }}</th>
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_bid.column.media') }}</th>
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_bid.records_note.column_winner') }}</th>
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_bid.column.bid_number') }}</th>
                  <th class="px-3 py-2 text-left">{{ t('bid_list.manual_bid.column.product') }}</th>
                  <th class="px-3 py-2 text-right">{{ t('bid_list.manual_bid.column.amount') }}</th>
                  <th class="px-3 py-2 text-left w-32">{{ t('bid_list.manual_bid.column.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rows"
                  :key="row.id"
                  class="border-t border-slate-100 dark:border-slate-800"
                  :class="isRowSelected(row.id) ? 'bg-primary-50 dark:bg-primary-950' : ''"
                >
                  <td class="px-3 py-2">
                    <Checkbox
                      :model-value="isRowSelected(row.id)"
                      binary
                      @update:model-value="(value: boolean) => toggleRow(row.id, value)"
                    />
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.submittedAt }}</td>
                  <td class="px-3 py-2">
                    <img
                      :src="row.thumbnail"
                      alt=""
                      class="w-10 h-10 rounded object-cover"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <img
                        :src="row.winnerAvatar"
                        alt=""
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <span class="text-sm">{{ row.winnerName }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-xs">{{ row.bidNumber }}</td>
                  <td class="px-3 py-2">{{ row.productName }}</td>
                  <td class="px-3 py-2 text-right">{{ row.amount }}</td>
                  <td class="px-3 py-2">
                    <Button
                      size="small"
                      severity="info"
                      outlined
                    >
                      {{ t('bid_list.manual_bid.button.edit_bid') }}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabPanel>
        <TabPanel value="createManualBid">
          <ManualBidSessionRecordsTab
            :extra-winners="carriedWinners"
            @complete="handleSessionRecordsComplete"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.manual_bid.button.close') }}
      </Button>
    </template>
  </Dialog>
</template>
