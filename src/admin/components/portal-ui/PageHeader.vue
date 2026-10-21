<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = withDefaults(defineProps<{
  title: string;
  showBack?: boolean;
}>(), {
  showBack: true,
});

const emit = defineEmits<{
  (e: 'back'): void;
}>();
</script>

<template>
  <div class="flex items-center gap-2">
    <Button
      v-if="props.showBack"
      severity="secondary"
      text
      rounded
      @click="emit('back')"
    >
      <template #icon>
        <FontAwesomeIcon :icon="['fas', 'chevron-left']" />
      </template>
    </Button>

    <p class="text-2xl font-bold">
      {{ props.title }}
    </p>
  </div>
</template>
