<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useManualBidSessionMock } from '../composables/useManualBidSessionMock';
import type {
  ManualBidBatchPayload,
  ManualBidMemberCandidate,
  ManualBidPickedMember,
  ManualBidProduct,
  ManualBidSession,
} from '../composables/useManualBidSessionMock';
import ManualBidSessionGrid from './ManualBidSessionGrid.vue';
import ManualBidProductGrid from './ManualBidProductGrid.vue';
import ManualBidMemberPicker from './ManualBidMemberPicker.vue';

interface Props {
  /** 從外部帶入的預帶會員（例：由「下標紀錄」勾選的下標人） */
  extraWinners?: ManualBidMemberCandidate[];
}

interface Emits {
  (event: 'complete', payload: ManualBidBatchPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const extraWinnerIds = computed<string[]>(() =>
  props.extraWinners?.map((m) => m.id) ?? [],
);

const { t } = useI18n();
const { showSuccess } = useGlobalToast();
const { sessions, products, members } = useManualBidSessionMock();

const step = ref<1 | 2 | 3>(1);
const selectedSession = ref<ManualBidSession | null>(null);
const selectedProduct = ref<ManualBidProduct | null>(null);

const sessionProducts = computed<ManualBidProduct[]>(() => {
  if (!selectedSession.value) {
    return [];
  }
  return products.value.filter((product) => product.sessionId === selectedSession.value?.id);
});

function handleSelectSession(session: ManualBidSession) {
  selectedSession.value = session;
  selectedProduct.value = null;
  step.value = 2;
}

function handleSelectProduct(product: ManualBidProduct) {
  selectedProduct.value = product;
  step.value = 3;
}

function handleSubmitMembers(payload: ManualBidPickedMember[]) {
  if (!selectedSession.value || !selectedProduct.value || payload.length === 0) {
    return;
  }
  showSuccess({
    detail: t('bid_list.manual_bid.session_records.member.confirm_toast', { count: payload.length }),
  });
  emit('complete', {
    session: selectedSession.value,
    product: selectedProduct.value,
    members: payload,
  });
  step.value = 1;
  selectedSession.value = null;
  selectedProduct.value = null;
}

function goBack() {
  if (step.value === 3) {
    step.value = 2;
    selectedProduct.value = null;
  } else if (step.value === 2) {
    step.value = 1;
    selectedSession.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-sm">
      <Button
        v-if="step > 1"
        size="small"
        severity="secondary"
        outlined
        @click="goBack"
      >
        <FontAwesomeIcon :icon="['fas', 'arrow-left']" />
        <span class="ml-1">{{ t('bid_list.manual_bid.session_records.back') }}</span>
      </Button>
      <span :class="step === 1 ? 'text-primary-500 font-medium' : 'text-slate-400'">
        1. {{ t('bid_list.manual_bid.session_records.step.select_session') }}
      </span>
      <FontAwesomeIcon
        :icon="['fas', 'chevron-right']"
        class="text-slate-300 text-xs"
      />
      <span :class="step === 2 ? 'text-primary-500 font-medium' : 'text-slate-400'">
        2. {{ t('bid_list.manual_bid.session_records.step.select_product') }}
        <span
          v-if="selectedSession && step > 1"
          class="ml-1 text-xs text-slate-500"
        >（{{ selectedSession.name }}）</span>
      </span>
      <FontAwesomeIcon
        :icon="['fas', 'chevron-right']"
        class="text-slate-300 text-xs"
      />
      <span :class="step === 3 ? 'text-primary-500 font-medium' : 'text-slate-400'">
        3. {{ t('bid_list.manual_bid.session_records.step.select_member') }}
        <span
          v-if="selectedProduct && step > 2"
          class="ml-1 text-xs text-slate-500"
        >（{{ selectedProduct.name }}）</span>
      </span>
    </div>

    <ManualBidSessionGrid
      v-if="step === 1"
      :sessions="sessions"
      @select="handleSelectSession"
    />

    <ManualBidProductGrid
      v-else-if="step === 2"
      :products="sessionProducts"
      @select="handleSelectProduct"
    />

    <ManualBidMemberPicker
      v-else-if="step === 3 && selectedSession && selectedProduct"
      :members="members"
      :session-id="selectedSession.id"
      :product="selectedProduct"
      :extra-members="extraWinners"
      :default-selected-ids="extraWinnerIds"
      @submit="handleSubmitMembers"
    />
  </div>
</template>
