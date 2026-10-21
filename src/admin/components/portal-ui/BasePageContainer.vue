<script setup lang="ts">
import PageHeader from './PageHeader.vue';

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
  <Card>
    <template #title>
      <div class="mb-4 flex items-start justify-between gap-4">
        <PageHeader
          :title="props.title"
          :show-back="props.showBack"
          @back="emit('back')"
        />
        <div v-if="$slots.actions">
          <slot name="actions" />
        </div>
      </div>
    </template>

    <template #content>
      <slot />
    </template>
  </Card>
</template>
