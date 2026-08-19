<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ManualBidSession } from '../composables/useManualBidSessionMock';

interface Props {
  sessions: ManualBidSession[];
}

interface Emits {
  (event: 'select', session: ManualBidSession): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
</script>

<template>
  <div>
    <div
      v-if="!sessions.length"
      class="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
    >
      {{ t('bid_list.manual_bid.session_records.empty_session') }}
    </div>
    <div
      v-else
      class="grid grid-cols-2 md:grid-cols-3 gap-3"
    >
      <button
        v-for="session in sessions"
        :key="session.id"
        type="button"
        class="flex items-center justify-center text-center px-4 py-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors cursor-pointer"
        @click="emit('select', session)"
      >
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ session.name }}
        </span>
      </button>
    </div>
  </div>
</template>
