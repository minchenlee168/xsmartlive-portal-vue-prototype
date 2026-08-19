<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ManualBidProduct } from '../composables/useManualBidSessionMock';

interface Props {
  products: ManualBidProduct[];
}

interface Emits {
  (event: 'select', product: ManualBidProduct): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
</script>

<template>
  <div>
    <div
      v-if="!products.length"
      class="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
    >
      {{ t('bid_list.manual_bid.session_records.empty_product') }}
    </div>
    <div
      v-else
      class="grid grid-cols-2 md:grid-cols-3 gap-3"
    >
      <button
        v-for="product in products"
        :key="product.id"
        type="button"
        class="flex gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors text-left cursor-pointer"
        @click="emit('select', product)"
      >
        <img
          :src="product.image"
          alt=""
          class="w-16 h-16 rounded object-cover flex-shrink-0"
        />
        <div class="flex flex-col justify-center min-w-0">
          <div class="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {{ product.name }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {{ t('bid_list.manual_bid.session_records.product.keyword') }}：
            <span class="text-primary-500 font-medium">{{ product.keyword }}</span>
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('bid_list.manual_bid.session_records.product.price') }}：${{ product.price }}
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
