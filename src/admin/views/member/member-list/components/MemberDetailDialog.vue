<script setup lang="ts">
/*
 * ⚠️ mock 版面預覽：會員明細彈窗，資料來自前端假資料（../mock/mockMembers）。
 * 商家評星 / 評星備註 / 個資顯示 / 停權 / 儲存皆為本地 stub，未接後端 API。
 */
import type { MockMemberRow } from '../mock/mockMembers';
import {
  BINDING_CHANNELS,
  BINDING_UNBOUND_CLASS,
  formatLastOrderDate,
  formatSpend,
  MEMBER_LEVEL_SEVERITY,
} from '../utils/mockMemberDisplay';
import { deriveBindingAccountId, getCodEligibility } from '../utils/mockMemberDetail';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  /** 要顯示的會員（null 時彈窗不渲染內容） */
  member: MockMemberRow | null;
}

const props = defineProps<Props>();
const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n();
const { confirm } = useGlobalDialog();
const { showSuccess } = useGlobalToast();

/** 商家評星草稿（本地 stub，儲存不接後端）。 */
const draftStars = ref(0);
const draftStarNote = ref('');
/** 完整手機是否已點開顯示（個資存取為 stub）。 */
const isPhoneRevealed = ref(false);
/** 停權狀態草稿（本地 stub，實際切換不接後端）。 */
const draftSuspended = ref(false);

// 切換檢視對象時重置本地草稿
watch(
  () => props.member,
  (member) => {
    draftStars.value = member?.stars ?? 0;
    draftStarNote.value = member?.starNote ?? '';
    isPhoneRevealed.value = false;
    draftSuspended.value = member?.status === 'suspended';
  },
  { immediate: true },
);

const initial = computed(() => props.member?.name?.trim().charAt(0).toUpperCase() || '?');
const cod = computed(() => (props.member ? getCodEligibility(props.member) : null));

/** 儲存評星（stub）。 */
function handleSave() {
  showSuccess({ detail: t('member.detail.save_stub') });
  visible.value = false;
}

/** 停權 / 解除停權（stub，二次確認後僅切本地狀態）。 */
async function handleSuspendToggle() {
  const accepted = await confirm({
    message: draftSuspended.value
      ? t('member.detail.suspend.confirm_unsuspend')
      : t('member.detail.suspend.confirm_suspend'),
  });
  if (!accepted) return;
  draftSuspended.value = !draftSuspended.value;
  showSuccess({ detail: t('member.detail.suspend.stub') });
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="$t('member.detail.title')"
    :style="{ width: '40rem', maxWidth: '95vw' }"
    :pt="{ content: { class: 'max-h-[75vh] overflow-y-auto' } }"
  >
    <template v-if="member">
      <!-- Hero -->
      <div class="flex items-center gap-4 border-b border-dashed border-surface-200 pb-4 dark:border-surface-700">
        <div class="bg-primary/10 text-primary flex size-13 shrink-0 items-center justify-center rounded-full text-xl font-bold">
          {{ initial }}
        </div>
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 text-lg font-bold">
            {{ member.name }}
            <Tag
              :severity="MEMBER_LEVEL_SEVERITY[member.level]"
              :value="$t(`member.level.${member.level}`)"
            />
          </p>
          <p class="text-muted-color mt-1 text-sm">
            {{ member.no }}・{{ $t(`member.status.${member.status}`) }}・{{ $t('member.detail.created_at_prefix') }} {{ formatLastOrderDate(member.createdAt) }}
          </p>
        </div>
      </div>

      <!-- 商家評星 -->
      <div class="flex flex-wrap items-center gap-3 py-4">
        <span class="text-muted-color text-sm">{{ $t('member.detail.rate_label') }}</span>
        <span class="inline-flex gap-1 text-lg">
          <FontAwesomeIcon
            v-for="index in 5"
            :key="index"
            :icon="index <= draftStars ? ['fas', 'star'] : ['far', 'star']"
            class="cursor-pointer transition-transform hover:scale-110"
            :class="index <= draftStars ? 'text-yellow-400 dark:text-yellow-300' : 'text-surface-300 dark:text-surface-600'"
            @click="draftStars = index"
          />
        </span>
        <span class="text-muted-color text-sm tabular-nums">{{ draftStars }} / 5</span>
        <InputText
          v-model="draftStarNote"
          size="small"
          class="min-w-40 flex-1"
          :placeholder="$t('member.detail.rate_note_placeholder')"
        />
      </div>

      <!-- 基本資料 -->
      <p class="section-title">{{ $t('member.detail.section.basic') }}</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="field">
          <span class="field-label">{{ $t('member.table.column.email') }}</span>
          <span
            class="field-value"
            :class="{ 'text-muted-color': !member.email }"
          >{{ member.email || $t('member.detail.unset') }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.mobile_full') }}</span>
          <span
            v-if="!member.phoneFull"
            class="field-value text-muted-color"
          >{{ $t('member.detail.not_provided') }}</span>
          <span
            v-else
            class="flex items-center gap-2"
          >
            <span class="field-value tabular-nums">{{ isPhoneRevealed ? member.phoneFull : member.mobileMasked }}</span>
            <Button
              rounded
              text
              size="small"
              severity="secondary"
              :aria-label="$t('member.detail.reveal_phone')"
              @click="isPhoneRevealed = !isPhoneRevealed"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', isPhoneRevealed ? 'eye-slash' : 'eye']" />
              </template>
            </Button>
          </span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.address') }}</span>
          <span
            class="field-value"
            :class="{ 'text-muted-color': !member.address }"
          >{{ member.address || $t('member.detail.not_filled') }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.gender_birthday') }}</span>
          <span
            class="field-value"
            :class="{ 'text-muted-color': !member.gender && !member.birthday }"
          >
            {{ member.gender || member.birthday
              ? `${member.gender ? $t(`member.gender.${member.gender}`) : '-'} / ${member.birthday || '-'}`
              : $t('member.detail.not_filled') }}
          </span>
        </div>
        <div class="field sm:col-span-2">
          <span class="field-label">{{ $t('member.detail.field.cod') }}</span>
          <span
            v-if="cod"
            class="field-value"
            :class="cod.eligible ? 'text-green-600 dark:text-green-400' : 'text-muted-color'"
          >
            {{ cod.eligible
              ? $t('member.detail.cod_eligible', { stars: cod.memberStars, min: cod.minStar })
              : $t('member.detail.cod_ineligible', { stars: cod.memberStars, min: cod.minStar }) }}
          </span>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-4 border-t border-surface-200 pt-3 sm:grid-cols-3 dark:border-surface-700">
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.last_order') }}</span>
          <span class="field-value">{{ formatLastOrderDate(member.lastOrderAt) }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.last_checkout') }}</span>
          <span class="field-value">{{ formatLastOrderDate(member.lastCheckoutAt) }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('member.detail.field.last_order_created') }}</span>
          <span class="field-value">{{ formatLastOrderDate(member.lastOrderCreatedAt) }}</span>
        </div>
      </div>

      <!-- 綁定資訊 -->
      <p class="section-title">{{ $t('member.detail.section.binding') }}</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="channel in BINDING_CHANNELS"
          :key="channel.key"
          class="flex items-center gap-2"
          :class="{ 'opacity-50': !member.bindings[channel.key] }"
        >
          <FontAwesomeIcon
            :icon="channel.icon"
            class="w-5 text-center"
            :class="member.bindings[channel.key] ? channel.boundClass : BINDING_UNBOUND_CLASS"
          />
          <div class="min-w-0">
            <div class="text-muted-color text-xs">{{ channel.name }}</div>
            <div class="truncate text-sm">
              {{ member.bindings[channel.key] ? deriveBindingAccountId(member, channel.key) : $t('member.binding.unbound') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 交易概況 -->
      <p class="section-title">{{ $t('member.detail.section.trade') }}</p>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div class="flex shrink-0 flex-col items-center justify-center gap-1 rounded-md bg-surface-100 px-6 py-3 sm:w-40 dark:bg-surface-800">
          <span class="field-label">{{ $t('member.detail.trade.spend') }}</span>
          <span class="text-xl font-semibold tabular-nums">{{ formatSpend(member.spend) }}</span>
        </div>
        <div class="grid flex-1 grid-cols-2 content-center gap-4">
          <div class="field">
            <span class="field-label">{{ $t('member.detail.trade.points') }}</span>
            <span class="field-value tabular-nums">{{ formatSpend(member.points) }}</span>
          </div>
          <div class="field">
            <span class="field-label">{{ $t('member.detail.trade.orders') }}</span>
            <span class="field-value tabular-nums">{{ member.orders }}</span>
          </div>
          <div class="field">
            <span class="field-label">{{ $t('member.detail.trade.bids') }}</span>
            <span class="field-value tabular-nums">{{ member.bids }}</span>
          </div>
          <div class="field">
            <span class="field-label">{{ $t('member.detail.trade.abandoned') }}</span>
            <span
              class="field-value tabular-nums"
              :class="{ 'text-red-600 dark:text-red-400': member.abandonedBids > 0 }"
            >{{ member.abandonedBids }}</span>
          </div>
        </div>
      </div>

      <!-- 訂閱狀況 -->
      <p class="section-title">{{ $t('member.detail.section.subscription') }}</p>
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm">{{ $t('member.detail.notif.live') }}</div>
          <div class="text-muted-color text-xs">{{ $t('member.detail.notif.live_desc') }}</div>
        </div>
        <Tag
          :severity="member.notifLiveEnabled && member.bindings.line ? 'success' : 'secondary'"
          :value="member.notifLiveEnabled && member.bindings.line ? $t('member.detail.notif.receiving') : $t('member.detail.notif.off')"
        />
      </div>

      <!-- 帳號停權 -->
      <p class="section-title">{{ $t('member.detail.section.suspend') }}</p>
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm">
            {{ $t('member.detail.suspend.status_label') }}：
            <span :class="draftSuspended ? 'text-red-600 dark:text-red-400' : ''">
              {{ draftSuspended ? $t('member.status.suspended') : $t('member.status.normal') }}
            </span>
          </div>
          <div class="text-muted-color text-xs">
            {{ draftSuspended ? $t('member.detail.suspend.desc_suspended') : $t('member.detail.suspend.desc_normal') }}
          </div>
        </div>
        <Button
          size="small"
          outlined
          :severity="draftSuspended ? 'success' : 'danger'"
          :label="draftSuspended ? $t('member.action.unban') : $t('member.detail.suspend.btn_suspend')"
          @click="handleSuspendToggle"
        >
          <template #icon>
            <FontAwesomeIcon
              :icon="['far', draftSuspended ? 'lock-open' : 'lock']"
              class="mr-1"
            />
          </template>
        </Button>
      </div>
    </template>

    <template #footer>
      <Button
        :label="$t('common.button.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
      <Button
        :label="$t('common.button.save')"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@reference "tailwindcss";

.section-title {
  @apply mt-5 mb-2.5 border-b pb-1.5 text-sm font-semibold;
  color: var(--p-text-muted-color);
  border-color: var(--p-content-border-color);
}
.field {
  @apply flex flex-col gap-1;
}
.field-label {
  @apply text-xs;
  color: var(--p-text-muted-color);
}
.field-value {
  @apply text-sm;
}
</style>
