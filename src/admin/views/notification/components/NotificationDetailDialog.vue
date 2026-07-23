<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGlobalToast } from '@/admin/composables/useGlobalToast'
import { useNotificationStore, type AppNotification } from '@/admin/stores/notification'

const props = defineProps<{
  /** 目前檢視的通知；null 時不顯示內容。 */
  notification: AppNotification | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { showSuccess } = useGlobalToast()
const notificationStore = useNotificationStore()

/** 依 categoryId 取類別（名稱 + severity），供 Tag 顯示。 */
const category = computed(() =>
  props.notification ? notificationStore.categoryById(props.notification.categoryId) : null,
)

function handleAction() {
  // Demo：導引動作僅示意，跳 toast 不實際導頁
  showSuccess({ detail: t('notification.center.toast.action_mock') })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    dismissable-mask
    :style="{ width: 'min(560px, calc(100vw - 32px))' }"
  >
    <template #header>
      <Tag
        v-if="category"
        :value="category.name"
        :severity="category.severity"
      />
    </template>

    <div
      v-if="notification"
      class="flex flex-col gap-3"
    >
      <h3 class="text-lg font-bold text-surface-700 dark:text-surface-100 leading-snug">
        {{ notification.title }}
      </h3>
      <p class="text-xs text-surface-500 dark:text-surface-400">
        {{ notification.time }}
      </p>
      <p class="text-sm leading-relaxed text-surface-700 dark:text-surface-200 whitespace-pre-wrap">
        {{ notification.body }}
      </p>
      <div v-if="notification.action">
        <Button
          size="small"
          severity="secondary"
          variant="outlined"
          :label="notification.action.label"
          @click="handleAction"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['far', 'angle-right']" />
          </template>
        </Button>
      </div>
    </div>

    <template #footer>
      <Button
        text
        severity="secondary"
        :label="t('notification.center.detail.close')"
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>
