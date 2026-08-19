<script setup lang="ts">
/**
 * 星星評分（1~5，0 代表未評）
 * — 對應舊 168money saleOrderList 的 rating 元件
 * — 支援 readonly 純顯示，或可點選變更
 */
import { computed } from 'vue';

interface Props {
  modelValue: number;
  readonly?: boolean;
  size?: 'xs' | 'small' | 'base';
}

interface Emits {
  (event: 'update:modelValue', value: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  size: 'base',
});
const emit = defineEmits<Emits>();

const stars = computed(() => [1, 2, 3, 4, 5]);

const starClass = computed(() => {
  if (props.size === 'xs') return 'text-[8px]';
  return props.size === 'small' ? 'text-sm' : 'text-lg';
});

/** xs 尺寸不留星間距，5 顆星總寬對齊會員頭像（w-10） */
const gapClass = computed(() => (props.size === 'xs' ? 'gap-0' : 'gap-0.5'));

function handleClick(value: number) {
  if (props.readonly) return;
  emit('update:modelValue', value);
}
</script>

<template>
  <div
    class="inline-flex items-center"
    :class="[gapClass, readonly ? 'cursor-default' : 'cursor-pointer']"
  >
    <button
      v-for="value in stars"
      :key="value"
      type="button"
      :class="[
        starClass,
        value <= modelValue
          ? 'text-amber-400'
          : 'text-slate-300 dark:text-slate-600',
        readonly ? 'cursor-default' : 'hover:text-amber-500',
      ]"
      :disabled="readonly"
      :aria-label="`${value} star`"
      @click="handleClick(value)"
    >
      ★
    </button>
  </div>
</template>
