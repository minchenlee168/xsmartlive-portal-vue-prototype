<script setup lang="ts">
/*
 * ⚠️ 版面預覽（mock）：對齊 portal-vue（uat8）「會員等級設定」畫面，資料來自前端假資料
 * （`./mock/mockMemberLevel.ts`），非後端 API。切總開關 / 停用級距 / 編輯級距僅改本地狀態並出
 * toast；會員名單為依級距產生的假資料。待後端補齊後應改回 API 驅動並移除 mock 相關檔案。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import PageCardLayout from '@/admin/components/portal-ui/PageCardLayout.vue';
import LevelEditDialog from './components/LevelEditDialog.vue';
import LevelMembersDialog from './components/LevelMembersDialog.vue';
import LevelTable from './components/LevelTable.vue';
import LevelToggleCard from './components/LevelToggleCard.vue';
import { useMemberLevelSetting } from './composables/useMemberLevelSetting';
import type { MemberLevel } from './types';
import { mapLevelToRow, type MemberLevelRow } from './utils/mapLevelToRow';

const { t } = useI18n();

const {
  setting,
  levels,
  isSaving,
  resyncToken,
  resync,
  toggleEnabled,
  toggleLevelEnabled,
  applyLevel,
} = useMemberLevelSetting();

const editVisible = ref(false);
const activeLevel = ref<MemberLevel | null>(null);

const membersVisible = ref(false);
const activeMembersRow = ref<MemberLevelRow | null>(null);

const rows = computed<MemberLevelRow[]>(() => levels.value.map((level) => mapLevelToRow(level, t)));

/**
 * 級距區是否停用操作。
 *
 * 總開關關閉時級距內容仍顯示（半透明），只是不可點——整區抽掉會讓使用者以為設定被清空。
 */
const isLevelAreaDisabled = computed<boolean>(() => !setting.value.isEnabled);

function handleEdit(sortOrder: number) {
  activeLevel.value = levels.value.find((level) => level.sortOrder === sortOrder) ?? null;
  editVisible.value = true;
}

function handleViewMembers(sortOrder: number) {
  activeMembersRow.value = rows.value.find((row) => row.sortOrder === sortOrder) ?? null;
  membersVisible.value = true;
}

/** 落庫 Modal 交回的級距內容：寫入成功才關窗（mock 恆成功）。 */
function handleLevelSave(level: MemberLevel) {
  const saved = applyLevel(level);
  if (saved) editVisible.value = false;
}
</script>

<template>
  <PageCardLayout
    :title="$t('member_level.setting_page.title')"
    :show-back="false"
  >
    <p class="mb-4 text-sm text-muted-color">
      {{ $t('member_level.setting_page.description') }}
    </p>

    <div class="flex flex-col gap-6">
      <LevelToggleCard
        :setting="setting"
        :is-saving="isSaving"
        :resync-token="resyncToken"
        @change="toggleEnabled"
        @cancel-disable="resync"
      />

      <LevelTable
        :rows="rows"
        :is-disabled="isLevelAreaDisabled"
        :is-saving="isSaving"
        :resync-token="resyncToken"
        @toggle="toggleLevelEnabled"
        @edit="handleEdit"
        @view-members="handleViewMembers"
        @cancel-disable="resync"
      />
    </div>

    <LevelEditDialog
      v-model:visible="editVisible"
      :level="activeLevel"
      :levels="levels"
      :is-saving="isSaving"
      @save="handleLevelSave"
    />

    <LevelMembersDialog
      v-model:visible="membersVisible"
      :level="activeMembersRow"
      :setting="setting"
    />
  </PageCardLayout>
</template>
