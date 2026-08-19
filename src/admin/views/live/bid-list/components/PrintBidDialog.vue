<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  visible: boolean;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** mock 列印內容 */
const printRows = [
  { labelKey: 'bid_list.print.time', value: '2026-05-12 14:12:51' },
  { labelKey: 'bid_list.print.name', value: '王大明' },
  { labelKey: 'bid_list.print.session', value: '0512' },
  { labelKey: 'bid_list.print.product_name', value: 'QWER' },
  { labelKey: 'bid_list.print.quantity', value: '1' },
  { labelKey: 'bid_list.print.price', value: '500.00' },
  { labelKey: 'bid_list.print.comment', value: '加購下單' },
  { labelKey: 'bid_list.print.spec_note', value: '衣服尺寸:M/顏色:黃/size:XL' },
  { labelKey: 'bid_list.print.bid_note', value: '' },
];

function handlePrint() {
  window.print();
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.print.title')"
    :style="{ width: '32rem' }"
  >
    <div class="flex flex-col gap-2 text-sm">
      <div class="border-y border-slate-200 dark:border-slate-700 py-3 my-2">
        <div class="text-center text-slate-500 mb-2">
          {{ t('bid_list.print.divider_start') }}
        </div>
        <div class="flex flex-col gap-1">
          <div
            v-for="row in printRows"
            :key="row.labelKey"
            class="flex items-baseline gap-2"
          >
            <!-- label 框固定 4 字寬 + CJK 分散對齊：2 字 label（時間）撐成「時　　間」與 4 字 label 等寬；冒號抽離不參與分散、緊接於後 -->
            <span class="shrink-0 text-slate-500 dark:text-slate-400">
              <span class="inline-block w-[4em] text-justify [text-align-last:justify]">{{ t(row.labelKey).slice(0, -1) }}</span>{{ t(row.labelKey).slice(-1) }}
            </span>
            <span class="text-slate-800 dark:text-slate-100">{{ row.value || '—' }}</span>
          </div>
        </div>
        <div class="text-center text-slate-500 mt-2">
          {{ t('bid_list.print.divider_end') }}
        </div>
      </div>
    </div>
    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.print.button.close') }}
      </Button>
      <Button
        severity="primary"
        @click="handlePrint"
      >
        <FontAwesomeIcon :icon="['fas', 'print']" />
        <span class="ml-1">{{ t('bid_list.print.button.print') }}</span>
      </Button>
    </template>
  </Dialog>
</template>
