<script setup lang="ts">
/**
 * 等級會員名單 Dialog：列出目前落在某一級距的會員（mock 假資料，client 端分頁）。
 *
 * 消費欄的標題寫得出計算範圍（「近 12 個月消費」），說明再交代實際區間與快照語意：這個數字是
 * 等級重算當下算的。「累計訂單數」是全期已付款單數，兩者範圍不同不可相除。名單無操作入口：
 * 等級依消費自動判定，後台不能手動指派。
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { createMockLevelMembers } from '../mock/mockMemberLevel';
import type { MemberLevelMember, MemberLevelSetting } from '../types';
import { formatMoney, formatThousands } from '../utils/formatMoney';
import type { MemberLevelRow } from '../utils/mapLevelToRow';
import { formatSpentNote, formatWindowSpentHeader } from '../utils/statsPeriod';

const props = defineProps<{
  /** 要看名單的級距；為 null 時不載入 */
  level: MemberLevelRow | null;
  /** 目前的等級設定，供消費欄交代計算範圍與統計區間；載入完成前為 null */
  setting: MemberLevelSetting | null;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();

/** 當前級距的假會員名單；開窗時依級距重建。 */
const members = ref<MemberLevelMember[]>([]);

const windowSpentHeader = computed<string>(() => formatWindowSpentHeader(props.setting, t));

const spentNote = computed<string>(() => formatSpentNote(props.setting, t));

/** 標題人數取名單總筆數。 */
const title = computed<string>(() =>
  props.level
    ? t('member_level.members.title', {
        name: props.level.name,
        count: formatThousands(members.value.length),
      })
    : t('member_level.members.title_fallback'),
);

// 開窗時依級距產出假名單（筆數對齊該級距的 memberCount）
watch(visible, (isOpen) => {
  if (!isOpen || !props.level) return;

  members.value = createMockLevelMembers(
    props.level.sortOrder,
    props.level.threshold,
    props.level.memberCount ?? 0,
  );
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="title"
    :style="{ width: '48rem', maxWidth: '95vw' }"
  >
    <Message
      severity="info"
      size="small"
      :closable="false"
      class="mb-3"
    >
      {{ spentNote }}
    </Message>

    <DataTable
      :value="members"
      data-key="id"
      striped-rows
      size="small"
      paginator
      :rows="10"
    >
      <Column
        field="memberCode"
        :header="$t('member_level.members.column.member_code')"
        class="w-40"
      />
      <Column
        field="name"
        :header="$t('member_level.members.column.member_name')"
      />
      <Column
        :header="windowSpentHeader"
        class="w-40"
      >
        <template #body="{ data }">
          {{ formatMoney(data.windowSpent) }}
        </template>
      </Column>
      <Column
        :header="$t('member_level.members.column.paid_order_count')"
        class="w-48"
      >
        <template #body="{ data }">
          {{ formatThousands(data.paidOrderCount) }}
        </template>
      </Column>
    </DataTable>

    <p class="mt-3 text-xs text-muted-color">
      {{ $t('member_level.members.text.footnote') }}
    </p>

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
