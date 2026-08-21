<script setup lang="ts">
/*
 * ⚠️ mock 版面預覽：發送訊息彈窗。可用管道依綁定 / 資料判定；送出為 stub，未接後端。
 */
import type { MockMemberRow } from '../mock/mockMembers';
import { MESSAGE_CHANNELS, formatDateTime, genMemberSentMessages, type MessageChannel } from '../utils/mockMemberDetail';
import Empty from '@/admin/components/portal-ui/Empty.vue';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  member: MockMemberRow | null;
}

const props = defineProps<Props>();
const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n();
const { showSuccess, showWarn } = useGlobalToast();

const MAX_LENGTH = 300;

const selectedChannels = ref<string[]>(['inapp']);
const templateText = ref<string | null>(null);
const content = ref('');

/** 已發送訊息紀錄（mock，依會員 deterministic 產生）。 */
const sentMessages = computed(() => (props.member ? genMemberSentMessages(props.member) : []));
/** 已發送訊息區塊展開狀態（可展開／收合，預設展開）。 */
const historyExpanded = ref(true);

const templateOptions = computed(() => [
  { label: t('member.message.template.live.label'), value: t('member.message.template.live.text') },
  { label: t('member.message.template.coupon.label'), value: t('member.message.template.coupon.text') },
  { label: t('member.message.template.cart.label'), value: t('member.message.template.cart.text') },
]);

// 切換會員時重置
watch(
  () => props.member,
  () => {
    selectedChannels.value = ['inapp'];
    templateText.value = null;
    content.value = '';
  },
  { immediate: true },
);

function isAvailable(channel: MessageChannel): boolean {
  return props.member ? channel.available(props.member) : false;
}

function toggleChannel(channel: MessageChannel) {
  if (!isAvailable(channel)) return;
  const index = selectedChannels.value.indexOf(channel.key);
  if (index >= 0) selectedChannels.value.splice(index, 1);
  else selectedChannels.value.push(channel.key);
}

function applyTemplate(value: string | null) {
  templateText.value = value;
  if (value) content.value = value.slice(0, MAX_LENGTH);
}

/** 送出（stub，僅驗證與提示）。 */
function handleSend() {
  if (selectedChannels.value.length === 0) {
    showWarn({ detail: t('member.message.validation.channel') });
    return;
  }
  if (!content.value.trim()) {
    showWarn({ detail: t('member.message.validation.content') });
    return;
  }
  showSuccess({ detail: t('member.message.send_stub') });
  visible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="$t('member.message.title')"
    :style="{ width: '34rem', maxWidth: '95vw' }"
    :pt="{ content: { class: 'max-h-[75vh] overflow-y-auto' } }"
  >
    <p
      v-if="member"
      class="text-muted-color mb-4 text-sm"
    >
      {{ $t('member.message.recipient') }}
      <b class="text-color">{{ member.name }}</b>（{{ member.no }}）
    </p>

    <span class="text-muted-color mb-1.5 block text-sm">{{ $t('member.message.channel_label') }}</span>
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="channel in MESSAGE_CHANNELS"
        :key="channel.key"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors"
        :class="{
          'cursor-not-allowed border-dashed border-surface-200 text-surface-300 dark:border-surface-700 dark:text-surface-600': !isAvailable(channel),
          'border-primary bg-primary/10 text-primary': isAvailable(channel) && selectedChannels.includes(channel.key),
          'border-surface-200 hover:border-primary dark:border-surface-700': isAvailable(channel) && !selectedChannels.includes(channel.key),
        }"
        :disabled="!isAvailable(channel)"
        @click="toggleChannel(channel)"
      >
        <FontAwesomeIcon
          :icon="channel.icon"
          :class="selectedChannels.includes(channel.key) ? '' : channel.colorClass"
        />
        {{ $t(`member.message.channel.${channel.labelKey}`) }}
        <span
          v-if="!isAvailable(channel)"
          class="text-xs"
        >{{ $t('member.message.unavailable') }}</span>
      </button>
    </div>

    <span class="text-muted-color mb-1.5 block text-sm">{{ $t('member.message.template_label') }}</span>
    <Select
      :model-value="templateText"
      :options="templateOptions"
      option-label="label"
      option-value="value"
      :placeholder="$t('member.message.template_placeholder')"
      show-clear
      class="mb-4 w-full"
      @update:model-value="applyTemplate"
    />

    <span class="text-muted-color mb-1.5 block text-sm">{{ $t('member.message.content_label') }}</span>
    <Textarea
      v-model="content"
      :maxlength="MAX_LENGTH"
      rows="4"
      class="w-full"
      :placeholder="$t('member.message.content_placeholder')"
    />
    <div class="text-muted-color mt-1 text-right text-xs tabular-nums">{{ content.length }} / {{ MAX_LENGTH }}</div>

    <button
      type="button"
      class="section-title flex w-full items-center justify-between"
      :aria-expanded="historyExpanded"
      @click="historyExpanded = !historyExpanded"
    >
      <span>
        {{ $t('member.message.history') }}
        <span
          v-if="sentMessages.length"
          class="text-muted-color font-normal tabular-nums"
        >（{{ sentMessages.length }}）</span>
      </span>
      <FontAwesomeIcon
        :icon="['far', 'chevron-down']"
        class="text-xs transition-transform"
        :class="{ '-rotate-90': !historyExpanded }"
      />
    </button>
    <DataTable
      v-show="historyExpanded"
      :value="sentMessages"
      data-key="id"
      size="small"
      striped-rows
      scrollable
      scroll-height="16rem"
    >
      <Column :header="$t('member.message.column.time')">
        <template #body="{ data }">
          <span class="text-muted-color whitespace-nowrap">{{ formatDateTime(data.sentAt) }}</span>
        </template>
      </Column>
      <Column :header="$t('member.message.column.content')">
        <template #body="{ data }">
          <span class="line-clamp-2">{{ data.content }}</span>
        </template>
      </Column>
      <Column :header="$t('member.message.column.read')">
        <template #body="{ data }">
          <Tag
            :severity="data.read ? 'success' : 'secondary'"
            :value="data.read ? $t('member.message.read.read') : $t('member.message.read.unread')"
          />
        </template>
      </Column>
      <template #empty>
        <Empty />
      </template>
    </DataTable>

    <template #footer>
      <Button
        :label="$t('common.button.cancel')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
      <Button
        :label="$t('member.message.send')"
        @click="handleSend"
      >
        <template #icon>
          <FontAwesomeIcon
            :icon="['far', 'paper-plane']"
            class="mr-1"
          />
        </template>
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
@reference "tailwindcss";

.section-title {
  @apply mt-6 mb-2 border-b pb-2 text-base font-semibold;
  color: var(--p-text-muted-color);
  border-color: var(--p-content-border-color);
}
</style>
