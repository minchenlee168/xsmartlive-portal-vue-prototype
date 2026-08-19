<script setup lang="ts">
/*
 * ⚠️ mock 版面預覽：訂單紀錄彈窗，訂單資料為 deterministic 假算式（../utils/mockMemberDetail）。
 */
import type { MockMemberRow } from '../mock/mockMembers';
import { formatSpend } from '../utils/mockMemberDisplay';
import { formatDateTime, genMemberOrders, ORDER_STATUS_SEVERITY } from '../utils/mockMemberDetail';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  member: MockMemberRow | null;
}

const props = defineProps<Props>();
const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n();

const orders = computed(() => (props.member ? genMemberOrders(props.member) : []));
const headerText = computed(() =>
  props.member
    ? `${t('member.orders.title')} — ${props.member.name}（${props.member.no}）`
    : t('member.orders.title'),
);
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="headerText"
    :style="{ width: '42rem', maxWidth: '95vw' }"
  >
    <DataTable
      :value="orders"
      data-key="id"
      size="small"
      striped-rows
      scrollable
      scroll-height="24rem"
    >
      <Column
        :header="$t('member.orders.column.no')"
        field="no"
      >
        <template #body="{ data }">
          <span class="text-primary inline-flex items-center gap-1 tabular-nums">
            {{ data.no }}
            <FontAwesomeIcon
              :icon="['far', 'arrow-up-right-from-square']"
              class="text-xs"
            />
          </span>
        </template>
      </Column>
      <Column :header="$t('member.orders.column.date')">
        <template #body="{ data }">
          <span class="text-muted-color">{{ formatDateTime(data.date) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.orders.column.amount')">
        <template #body="{ data }">
          <span class="tabular-nums">{{ formatSpend(data.amount) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.orders.column.status')">
        <template #body="{ data }">
          <Tag
            :severity="ORDER_STATUS_SEVERITY[data.status as keyof typeof ORDER_STATUS_SEVERITY]"
            :value="$t(`member.orders.status.${data.status}`)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="text-muted-color py-12 text-center text-sm">
          {{ $t('member.orders.empty') }}
        </div>
      </template>
    </DataTable>

    <template #footer>
      <Button
        :label="$t('common.button.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>
