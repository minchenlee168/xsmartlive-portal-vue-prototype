<script setup lang="ts">
/**
 * 紅利點數「手動贈點」Dialog（原型版）
 * — 針對「篩選到的會員」一次性直接發放紅利點數（非規則式活動；相對於列表的活動 CRUD）
 * — 篩選（關鍵字 + 等級，即時套用）→ 會員清單多選（預設全選，opt-out）→ 設定點數 + 原因
 * — 點數依商店幣別最小單位（台幣 0 位、馬幣 2 位）；原型階段不打後端，送出以 toast 回饋
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FormField from '@/admin/components/ui/FormField.vue';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import {
  mockMembers,
  type MemberKeywordField,
  type MockMemberLevel,
  type MockMemberRow,
  type MockMemberStatus,
} from '@/admin/views/member/member-list/mock/mockMembers';
import { DEFAULT_CURRENCY, currencyMeta, type StoreCurrency } from '../currency';

const props = withDefaults(defineProps<{
  /** 商店幣別（由列表頁傳入）：點數輸入的小數位 / 符號跟隨 */
  currency?: StoreCurrency;
}>(), {
  currency: DEFAULT_CURRENCY,
});

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

// 幣別衍生值：符號 / 最小單位小數位
const meta = computed(() => currencyMeta(props.currency));
const currencyDigits = computed(() => meta.value.minorUnit);
const currencySymbol = computed(() => meta.value.symbol.trim());

const formatNumber = (value: number) => value.toLocaleString('en-US');

// ---- 篩選：比照會員列表（關鍵字＋欄位 / 等級 / 狀態 / 星等 / 黑名單快切），
//      但不含「綁定管道」與「帳號建立日期」。採「按搜尋才套用」（pending → applied），與會員列表一致。
// pending：輸入框草稿
const keywordField = ref<MemberKeywordField>('name');
const keyword = ref('');
const levelFilter = ref<MockMemberLevel | null>(null);
const statusFilter = ref<MockMemberStatus | null>(null);
const starsFilter = ref<number | null>(null);
const blacklistOnly = ref(false);
// applied：按「搜尋」後才 commit 的過濾值；清單依這組計算
const appliedKeywordField = ref<MemberKeywordField>('name');
const appliedKeyword = ref('');
const appliedLevel = ref<MockMemberLevel | null>(null);
const appliedStatus = ref<MockMemberStatus | null>(null);
const appliedStars = ref<number | null>(null);
const appliedBlacklistOnly = ref(false);

/** 套用目前草稿條件（按「搜尋」或關鍵字 Enter 觸發） */
function applyFilter() {
  appliedKeywordField.value = keywordField.value;
  appliedKeyword.value = keyword.value;
  appliedLevel.value = levelFilter.value;
  appliedStatus.value = statusFilter.value;
  appliedStars.value = starsFilter.value;
  appliedBlacklistOnly.value = blacklistOnly.value;
}

/** 清除：草稿與已套用條件一併回預設（回到全部會員） */
function resetFilter() {
  keywordField.value = 'name';
  keyword.value = '';
  levelFilter.value = null;
  statusFilter.value = null;
  starsFilter.value = null;
  blacklistOnly.value = false;
  applyFilter();
}

const keywordFieldOptions = computed<{ label: string; value: MemberKeywordField }[]>(() => [
  { label: t('bonus_points.manual_grant.filter.keyword_field.name'), value: 'name' },
  { label: t('bonus_points.manual_grant.filter.keyword_field.code'), value: 'code' },
  { label: t('bonus_points.manual_grant.filter.keyword_field.phone'), value: 'phone' },
]);
const keywordPlaceholder = computed(() =>
  t(`bonus_points.manual_grant.filter.keyword_placeholder.${keywordField.value}`));

const levelOptions = computed<{ label: string; value: MockMemberLevel }[]>(() => [
  { label: t('bonus_points.manual_grant.level.normal'), value: 'normal' },
  { label: t('bonus_points.manual_grant.level.bronze'), value: 'bronze' },
  { label: t('bonus_points.manual_grant.level.silver'), value: 'silver' },
  { label: t('bonus_points.manual_grant.level.gold'), value: 'gold' },
]);
const statusOptions = computed<{ label: string; value: MockMemberStatus }[]>(() => [
  { label: t('bonus_points.manual_grant.status.normal'), value: 'normal' },
  { label: t('bonus_points.manual_grant.status.suspended'), value: 'suspended' },
]);
const starOptions = computed<{ label: string; value: number }[]>(() =>
  [5, 4, 3, 2, 1].map((count) => ({ label: t('bonus_points.manual_grant.stars_rating', { count }), value: count })));

const filteredMembers = computed<MockMemberRow[]>(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  return mockMembers.filter((m) => {
    if (appliedLevel.value !== null && m.level !== appliedLevel.value) return false;
    if (appliedStatus.value !== null && m.status !== appliedStatus.value) return false;
    if (appliedStars.value !== null && m.stars !== appliedStars.value) return false;
    if (appliedBlacklistOnly.value && m.status !== 'blacklisted') return false;
    if (kw.length > 0) {
      const haystack = appliedKeywordField.value === 'code'
        ? m.no
        : appliedKeywordField.value === 'phone'
          ? m.phoneFull ?? ''
          : m.name;
      if (!haystack.toLowerCase().includes(kw)) return false;
    }
    return true;
  });
});

// ---- 選取（預設「篩選到的全部會員」皆選；opt-out 語意，與列表批次刪除的 opt-in 相反）----
const selected = ref<MockMemberRow[]>([]);

// 開窗時重置篩選與表單
watch(visible, (open) => {
  if (!open) return;
  resetFilter();
  points.value = null;
  reason.value = '';
});
// 套用搜尋（applied 變動 → filteredMembers 重算）後「重新全選」：opt-out 語意——對這群人發、
// 排除不想發的，故不是清空。因清單只在按搜尋 / 清除 / 開窗時才變，全選不會在打字途中被重置。
watch(filteredMembers, (list) => {
  selected.value = [...list];
}, { immediate: true });

// ---- 贈點設定 ----
const points = ref<number | null>(null);
const reason = ref('');

const totalPoints = computed(() => selected.value.length * (points.value ?? 0));
const confirmDisabled = computed(
  () => selected.value.length === 0 || points.value === null || points.value <= 0,
);

// ---- 呈現輔助 ----
const levelLabel = (level: MockMemberLevel) => t(`bonus_points.manual_grant.level.${level}`);
const levelSeverity = (level: MockMemberLevel): 'secondary' | 'warn' | 'info' | 'success' => {
  if (level === 'gold') return 'success';
  if (level === 'silver') return 'info';
  if (level === 'bronze') return 'warn';
  return 'secondary';
};

function handleCancel() {
  visible.value = false;
}

function handleConfirm() {
  if (confirmDisabled.value) return;
  showSuccess({
    detail: t('bonus_points.manual_grant.toast.granted', {
      count: selected.value.length,
      points: formatNumber(points.value ?? 0),
    }),
  });
  visible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="$t('bonus_points.manual_grant.title')"
    :style="{ width: 'min(800px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 1. 會員篩選：比照會員列表（緊湊模式，placeholder 當提示，見 design.md §7.6）；
           不含綁定管道與帳號建立日期。即時套用。 -->
      <div class="flex flex-wrap items-center gap-2">
        <InputGroup class="w-full sm:w-auto">
          <Select
            v-model="keywordField"
            :options="keywordFieldOptions"
            option-label="label"
            option-value="value"
            :aria-label="$t('bonus_points.manual_grant.filter.keyword_field_label')"
            class="w-40 shrink-0"
          />
          <InputText
            v-model="keyword"
            class="w-full sm:w-56"
            :placeholder="keywordPlaceholder"
            :aria-label="keywordPlaceholder"
            @keyup.enter="applyFilter"
          />
        </InputGroup>
        <Select
          v-model="levelFilter"
          :options="levelOptions"
          option-label="label"
          option-value="value"
          show-clear
          :placeholder="$t('bonus_points.manual_grant.filter.level_all')"
          :aria-label="$t('bonus_points.manual_grant.filter.level_all')"
          class="w-40"
        />
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          show-clear
          :placeholder="$t('bonus_points.manual_grant.filter.status_all')"
          :aria-label="$t('bonus_points.manual_grant.filter.status_all')"
          class="w-40"
        />
        <Select
          v-model="starsFilter"
          :options="starOptions"
          option-label="label"
          option-value="value"
          show-clear
          :placeholder="$t('bonus_points.manual_grant.filter.star_all')"
          :aria-label="$t('bonus_points.manual_grant.filter.star_all')"
          class="w-40"
        />
        <div class="flex items-center gap-2">
          <Checkbox v-model="blacklistOnly" binary input-id="grant-blacklist-only" />
          <label for="grant-blacklist-only" class="cursor-pointer text-sm">
            {{ $t('bonus_points.manual_grant.filter.blacklist_only') }}
          </label>
        </div>
        <div class="flex items-center gap-2">
          <Button
            :label="$t('bonus_points.manual_grant.filter.search')"
            @click="applyFilter"
          />
          <Button
            :label="$t('bonus_points.manual_grant.filter.reset')"
            severity="secondary"
            outlined
            @click="resetFilter"
          />
        </div>
      </div>

      <!-- 2. 清單狀態列：小標（左）+ 已選 / 篩選到（右） -->
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">{{ $t('bonus_points.manual_grant.list.title') }}</span>
        <span class="text-sm text-[var(--p-text-muted-color)] whitespace-nowrap">
          {{ $t('bonus_points.manual_grant.list.selected_count', {
            selected: formatNumber(selected.length),
            filtered: formatNumber(filteredMembers.length),
          }) }}
        </span>
      </div>

      <!-- 3. 會員清單：桌機 DataTable（表頭全選）；手機卡片列表 -->
      <DataTable
        v-model:selection="selected"
        :value="filteredMembers"
        data-key="no"
        selection-mode="multiple"
        size="small"
        striped-rows
        scrollable
        scroll-height="280px"
        class="hidden md:block"
      >
        <Column selection-mode="multiple" header-style="width:3rem" />
        <Column field="no" :header="$t('bonus_points.manual_grant.col.no')" />
        <Column field="name" :header="$t('bonus_points.manual_grant.col.name')" />
        <Column :header="$t('bonus_points.manual_grant.col.level')">
          <template #body="{ data }">
            <Tag :value="levelLabel(data.level)" :severity="levelSeverity(data.level)" class="w-fit" />
          </template>
        </Column>
        <Column :header="$t('bonus_points.manual_grant.col.points')">
          <template #body="{ data }">{{ formatNumber(data.points) }}</template>
        </Column>
        <template #empty>
          <div class="py-12 text-center text-muted-color">
            {{ $t('bonus_points.manual_grant.list.empty') }}
          </div>
        </template>
      </DataTable>

      <!-- 手機（<md）：卡片列表 + 左側 Checkbox -->
      <div class="max-h-72 overflow-y-auto divide-y divide-[var(--p-content-border-color)] md:hidden">
        <label
          v-for="m in filteredMembers"
          :key="m.no"
          class="flex cursor-pointer items-center gap-3 px-1 py-2"
        >
          <Checkbox v-model="selected" :value="m" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm font-medium">{{ m.name }}</span>
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ m.no }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Tag :value="levelLabel(m.level)" :severity="levelSeverity(m.level)" />
            <span class="text-sm">{{ formatNumber(m.points) }}</span>
          </div>
        </label>
        <div v-if="!filteredMembers.length" class="py-12 text-center text-muted-color">
          {{ $t('bonus_points.manual_grant.list.empty') }}
        </div>
      </div>

      <!-- 4. 贈點設定：點數 + 原因 -->
      <div class="flex flex-col gap-4 border-t border-[var(--p-content-border-color)] pt-4">
        <FormField
          :label="$t('bonus_points.manual_grant.field.points')"
          :required="true"
          class-name="max-w-none"
        >
          <InputGroup class="w-full sm:w-56">
            <InputNumber
              v-model="points"
              fluid
              :min="0"
              :max="9999999"
              :max-fraction-digits="currencyDigits"
              :aria-label="$t('bonus_points.manual_grant.field.points')"
              :placeholder="$t('bonus_points.manual_grant.placeholder.points')"
            />
            <InputGroupAddon>{{ $t('bonus_points.form_dialog.unit.point') }}</InputGroupAddon>
          </InputGroup>
        </FormField>

        <FormField
          :label="$t('bonus_points.manual_grant.field.reason')"
          :optional="true"
          :hint="$t('bonus_points.manual_grant.hint.reason')"
          class-name="max-w-none"
        >
          <Textarea
            v-model="reason"
            fluid
            auto-resize
            rows="2"
            :maxlength="200"
            :aria-label="$t('bonus_points.manual_grant.field.reason')"
            :placeholder="$t('bonus_points.manual_grant.placeholder.reason')"
          />
        </FormField>
      </div>

      <!-- 5. 發放摘要（送出前最後一眼確認，取代 modal-on-modal 二次確認） -->
      <p class="text-sm text-surface-600 dark:text-surface-300">
        <i18n-t keypath="bonus_points.manual_grant.summary" tag="span">
          <template #count><span class="font-semibold text-[var(--p-text-color)]">{{ formatNumber(selected.length) }}</span></template>
          <template #points><span class="font-semibold text-[var(--p-text-color)]">{{ points ? formatNumber(points) : '—' }}</span></template>
          <template #total><span class="font-semibold text-primary">{{ formatNumber(totalPoints) }}</span></template>
        </i18n-t>
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="$t('bonus_points.manual_grant.button.cancel')"
          @click="handleCancel"
        />
        <Button
          type="button"
          :disabled="confirmDisabled"
          :label="$t('bonus_points.manual_grant.button.confirm')"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>
