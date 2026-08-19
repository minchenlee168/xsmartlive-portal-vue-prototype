<script setup lang="ts">
/**
 * 商品選擇視窗（prototype 輕量 stub）
 * — 正式 portal 版用共用的 ProductPickerDialog（牽涉 api/store/ui），
 *   prototype 不搬那套；此處提供可搜尋的假商品清單，點選即回傳 { id, name }。
 * — 僅供 PriceHistoryDialog 的「選擇商品」按鈕使用。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** 選擇結果：與原 ProductPickerDialog 對外形狀對齊（id + name） */
export interface PickedProduct {
  id: number;
  name: string;
}

interface Props {
  visible: boolean;
}
interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'select', product: PickedProduct): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 假商品清單（prototype 用；正式版由商品 API 提供） */
const mockProducts: PickedProduct[] = [
  { id: 14, name: '日本和牛燒肉片 300g' },
  { id: 22, name: '挪威鮭魚菲力 500g' },
  { id: 31, name: '古早味鹽酥雞 家庭號' },
  { id: 45, name: '泰國金枕頭榴槤 冷凍' },
  { id: 58, name: '紐西蘭奇異果 一箱' },
  { id: 63, name: '手工蛋黃酥 6入' },
];

const keyword = ref('');
const filteredProducts = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return mockProducts;
  return mockProducts.filter((product) => product.name.toLowerCase().includes(value));
});

/** 點選商品：回傳結果並關閉視窗 */
function handleSelect(product: PickedProduct): void {
  emit('select', product);
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.price_history.picker.title')"
    :style="{ width: '32rem' }"
  >
    <div class="flex flex-col gap-3">
      <InputText
        v-model="keyword"
        :placeholder="t('bid_list.price_history.picker.search_placeholder')"
        class="w-full"
      />
      <ul class="flex max-h-80 flex-col divide-y divide-surface-200 overflow-y-auto dark:divide-surface-700">
        <li v-for="product in filteredProducts" :key="product.id">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
            @click="handleSelect(product)"
          >
            <span>{{ product.name }}</span>
            <span class="text-xs text-surface-400">#{{ product.id }}</span>
          </button>
        </li>
        <li
          v-if="filteredProducts.length === 0"
          class="px-3 py-6 text-center text-sm text-surface-400"
        >
          {{ t('bid_list.price_history.picker.empty') }}
        </li>
      </ul>
    </div>
  </Dialog>
</template>
