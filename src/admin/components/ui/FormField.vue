<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    className?: string
    hintSeverity?: 'default' | 'error'
    /** 必填欄位：label 後接紅色星號（design.md §7.8） */
    required?: boolean
  }>(),
  {
    label: '',
    hint: '',
    className: '',
    hintSeverity: 'default',
    required: false,
  },
)

// 走 surface / 成對 dark: 語意色，深淺色都成立（design.md §2.4 鐵則）
const hintClass = computed(() =>
  props.hintSeverity === 'error'
    ? 'text-red-600 dark:text-red-400'
    : 'text-surface-500 dark:text-surface-400',
)
</script>

<template>
  <div
    class="max-w-lg flex flex-col gap-2"
    :class="props.className"
  >
    <span
      v-if="props.label"
      class="text-sm font-medium cursor-default"
    >
      {{ props.label }}<span
        v-if="props.required"
        class="text-[#DC2626]"
      >*</span>
    </span>

    <slot />

    <small
      v-if="props.hint"
      :class="hintClass"
    >
      {{ props.hint }}
    </small>
  </div>
</template>
