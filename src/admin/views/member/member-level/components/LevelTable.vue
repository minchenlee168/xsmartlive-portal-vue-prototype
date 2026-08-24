<script setup lang="ts">
import { computed, ref } from 'vue';

import { formatThousands } from '../utils/formatMoney';
import type { LevelBadgeVariant, MemberLevelRow } from '../utils/mapLevelToRow';
import LevelDisableConfirmDialog from './LevelDisableConfirmDialog.vue';

/** 空值佔位符（對齊專案慣例的 `-`）。 */
const EMPTY_FIELD = '-';

/** 停用單一級距的三條影響文案（i18n key）；逐條列出，與總開關的確認框同一形式。 */
const DISABLE_EFFECT_KEYS = [
  'member_level.disable_level.text.effect.members_regraded',
  'member_level.disable_level.text.effect.discount_stops',
  'member_level.disable_level.text.effect.issued_unaffected',
] as const;

const props = defineProps<{
  rows: MemberLevelRow[];
  /** 總開關關閉或尚未載入完成時為 true：整區半透明且不可操作 */
  isDisabled: boolean;
  /** 寫入進行中；期間停用列上的開關與編輯鈕防連點 */
  isSaving: boolean;
  /** 級距開關的重掛序號，混入各列 `:key`；遞增即逼開關重掛回 `rows` 的實際值 */
  resyncToken: number;
}>();

const emit = defineEmits<{
  /** 使用者確定要切換某級距的啟用狀態（停用方向已通過二次確認） */
  toggle: [sortOrder: number, value: boolean];
  /** 開啟該級距的編輯 Modal */
  edit: [sortOrder: number];
  /** 開啟該級距的會員名單 Modal */
  'view-members': [sortOrder: number];
  /** 使用者沒按確定就關掉停用確認窗；呼叫端據此讓開關退回實際設定 */
  'cancel-disable': [];
}>();

/**
 * 徽章 severity；由 `badgeVariant` 對應，不從等級名稱猜色（名稱可被商家改成任意字串）。
 *
 * 對齊會員列表的等級 Tag 配色（`MEMBER_LEVEL_SEVERITY`），兩頁的等級徽章視覺一致；
 * 金屬色無專屬 severity，取語意上可區分的近色。
 */
const BADGE_SEVERITY: Record<LevelBadgeVariant, 'secondary' | 'contrast' | 'info' | 'warn'> = {
  base: 'secondary',
  bronze: 'contrast',
  silver: 'info',
  gold: 'warn',
};

/** 待確認停用的級距；null 代表確認框未開 */
const pendingDisableRow = ref<MemberLevelRow | null>(null);

/** 確認框的顯示狀態＝有沒有待確認的級距；關窗即清掉待確認目標。 */
const isConfirmVisible = computed<boolean>({
  get: () => pendingDisableRow.value !== null,
  set: (value) => {
    if (!value) pendingDisableRow.value = null;
  },
});

function handleToggle(row: MemberLevelRow, value: boolean) {
  // 啟用不影響既有權益，直接送出；停用會讓該級距的會員重新歸級，才要二次確認
  if (value) {
    emit('toggle', row.sortOrder, true);
    return;
  }

  pendingDisableRow.value = row;
}

function handleConfirmDisable() {
  const row = pendingDisableRow.value;
  if (!row) return;

  emit('toggle', row.sortOrder, false);
  pendingDisableRow.value = null;
}
</script>

<template>
  <div :class="{ 'pointer-events-none opacity-50': props.isDisabled }">
    <div class="mb-3 flex flex-wrap items-baseline gap-2">
      <p class="font-semibold">
        {{ $t('member_level.title.levels') }}
      </p>
      <span class="text-xs text-muted-color">{{ $t('member_level.text.levels_note') }}</span>
    </div>

    <!-- 桌面：DataTable 橫向捲動；手機改用下方堆疊卡片 -->
    <div class="hidden overflow-x-auto md:block">
      <DataTable
        :value="props.rows"
        data-key="sortOrder"
        striped-rows
        class="min-w-[52rem]"
      >
      <Column
        :header="$t('member_level.table.column.level')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          <Tag :severity="BADGE_SEVERITY[(data as MemberLevelRow).badgeVariant]">
            {{ data.name }}
          </Tag>
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.threshold')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          <span :class="{ 'text-muted-color': data.isBase }">{{ data.thresholdDisplay }}</span>
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.discount')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          {{ data.discountDisplay }}
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.benefits')"
        class="min-w-64"
      >
        <template #body="{ data }">
          <span
            v-if="data.benefits.length === 0"
            class="text-muted-color"
          >{{ EMPTY_FIELD }}</span>
          <ul
            v-else
            class="space-y-0.5 text-sm text-muted-color"
          >
            <li
              v-for="benefit in data.benefits"
              :key="benefit.kind"
            >
              {{ benefit.text }}
            </li>
          </ul>
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.member_count')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          <!-- null＝該店還沒算過等級；顯示 0 人會被讀成「這一級真的沒人」，兩者要分得出來 -->
          <span
            v-if="data.memberCount === null"
            class="text-muted-color"
          >{{ EMPTY_FIELD }}</span>
          <Button
            v-else-if="data.memberCount > 0"
            link
            size="small"
            class="p-0"
            :label="$t('member_level.text.member_count', { count: formatThousands(data.memberCount) })"
            @click="emit('view-members', data.sortOrder)"
          />
          <span
            v-else
            class="text-color text-sm tabular-nums"
          >{{ $t('member_level.text.member_count', { count: 0 }) }}</span>
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.status')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          <!-- 基礎級距是所有會員的起始級距，停用它會讓未達門檻者無級可歸，故不給開關 -->
          <span
            v-if="data.isBase"
            class="text-sm text-muted-color"
          >{{ $t('member_level.text.fixed_enabled') }}</span>
          <span
            v-else
            class="inline-flex items-center gap-2"
          >
            <ToggleSwitch
              :key="`${data.sortOrder}-${props.resyncToken}`"
              :model-value="data.isEnabled"
              :disabled="props.isSaving"
              :aria-label="$t('member_level.text.status_aria', { name: data.name })"
              @update:model-value="handleToggle(data, $event)"
            />
            <span
              class="text-sm"
              :class="data.isEnabled ? 'text-color' : 'text-muted-color'"
            >{{ data.isEnabled ? $t('member_level.text.status_on') : $t('member_level.text.status_off') }}</span>
          </span>
        </template>
      </Column>

      <Column
        :header="$t('member_level.table.column.actions')"
        class="whitespace-nowrap"
      >
        <template #body="{ data }">
          <Button
            v-tooltip.top="$t('common.button.edit')"
            :aria-label="$t('common.button.edit')"
            text
            size="small"
            :disabled="props.isSaving"
            @click="emit('edit', data.sortOrder)"
          >
            <template #icon>
              <i class="pi pi-pen-to-square" />
            </template>
          </Button>
        </template>
        </Column>
      </DataTable>
    </div>

    <!--
      手機：堆疊卡片列表（比照會員列表手機版）。卡片本身不設點擊事件——每張卡有開關 /
      會員人數連結 / 編輯鈕多個互動元素，整卡再包一層點擊會與子元素打架且違反 a11y。
      資訊由上而下依重要性排：等級＋狀態 → 門檻／折扣 → 權益 → 會員人數 → 編輯。
    -->
    <div class="divide-y divide-[var(--p-content-border-color)] md:hidden">
      <div
        v-for="data in props.rows"
        :key="data.sortOrder"
        class="flex flex-col gap-2 px-1 py-3"
      >
        <!-- 第一層：等級 Tag（左）／狀態開關 + 文字（右） -->
        <div class="flex items-center justify-between gap-2">
          <Tag
            :severity="BADGE_SEVERITY[data.badgeVariant]"
            class="min-w-0 max-w-full truncate"
            :title="data.name"
          >
            {{ data.name }}
          </Tag>
          <span
            v-if="data.isBase"
            class="text-sm text-muted-color shrink-0"
          >{{ $t('member_level.text.fixed_enabled') }}</span>
          <span
            v-else
            class="inline-flex items-center gap-2 shrink-0"
          >
            <ToggleSwitch
              :key="`${data.sortOrder}-${props.resyncToken}`"
              :model-value="data.isEnabled"
              :disabled="props.isSaving"
              :aria-label="$t('member_level.text.status_aria', { name: data.name })"
              @update:model-value="handleToggle(data, $event)"
            />
            <span
              class="text-sm"
              :class="data.isEnabled ? 'text-color' : 'text-muted-color'"
            >{{ data.isEnabled ? $t('member_level.text.status_on') : $t('member_level.text.status_off') }}</span>
          </span>
        </div>

        <!-- 第二層：門檻 + 折扣（2 欄短數值） -->
        <div class="grid grid-cols-2 gap-x-4 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-color shrink-0">{{ $t('member_level.table.column.threshold') }}</span>
            <span
              class="truncate text-sm tabular-nums"
              :class="data.isBase ? 'text-muted-color' : 'text-color'"
            >{{ data.thresholdDisplay }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-color shrink-0">{{ $t('member_level.table.column.discount') }}</span>
            <span class="text-color truncate text-sm tabular-nums">{{ data.discountDisplay }}</span>
          </div>
        </div>

        <!-- 第三層：權益（變長清單，獨立區塊 label 在上） -->
        <div class="flex flex-col gap-2 text-xs">
          <span class="text-muted-color">{{ $t('member_level.table.column.benefits') }}</span>
          <span
            v-if="data.benefits.length === 0"
            class="text-muted-color"
          >{{ EMPTY_FIELD }}</span>
          <ul
            v-else
            class="space-y-0.5 text-sm text-muted-color"
          >
            <li
              v-for="benefit in data.benefits"
              :key="benefit.kind"
            >
              {{ benefit.text }}
            </li>
          </ul>
        </div>

        <!-- 第四層：會員人數（可互動連結，整行獨立） -->
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-color shrink-0">{{ $t('member_level.table.column.member_count') }}</span>
          <span
            v-if="data.memberCount === null"
            class="text-muted-color"
          >{{ EMPTY_FIELD }}</span>
          <Button
            v-else-if="data.memberCount > 0"
            link
            size="small"
            class="p-0"
            :label="$t('member_level.text.member_count', { count: formatThousands(data.memberCount) })"
            @click="emit('view-members', data.sortOrder)"
          />
          <span
            v-else
            class="text-color text-sm tabular-nums"
          >{{ $t('member_level.text.member_count', { count: 0 }) }}</span>
        </div>

        <!-- 第五層：操作（編輯） -->
        <div class="flex items-center justify-end">
          <Button
            v-tooltip.top="$t('common.button.edit')"
            :aria-label="$t('common.button.edit')"
            text
            size="small"
            :disabled="props.isSaving"
            @click="emit('edit', data.sortOrder)"
          >
            <template #icon>
              <i class="pi pi-pen-to-square" />
            </template>
          </Button>
        </div>
      </div>
    </div>

    <LevelDisableConfirmDialog
      v-model:visible="isConfirmVisible"
      :header="$t('member_level.disable_level.title')"
      :lead="$t('member_level.disable_level.text.lead', { name: pendingDisableRow?.name ?? '' })"
      :effect-keys="DISABLE_EFFECT_KEYS"
      :footnote="$t('member_level.disable_level.text.footnote')"
      @confirm="handleConfirmDisable"
      @cancel="emit('cancel-disable')"
    />
  </div>
</template>
