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
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.batch_done.title')"
    :style="{ width: '24rem' }"
  >
    <div class="flex flex-col items-center py-6 gap-3">
      <FontAwesomeIcon
        :icon="['fas', 'circle-check']"
        class="text-5xl text-emerald-500"
      />
      <p class="text-slate-700 dark:text-slate-200">
        {{ t('bid_list.batch_done.message') }}
      </p>
    </div>
    <template #footer>
      <Button
        severity="primary"
        @click="localVisible = false"
      >
        {{ t('bid_list.batch_done.button.ok') }}
      </Button>
    </template>
  </Dialog>
</template>
