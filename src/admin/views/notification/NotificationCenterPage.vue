<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore, type AppNotification } from '@/admin/stores/notification'
import NotificationDetailDialog from './components/NotificationDetailDialog.vue'

const { t } = useI18n()
const notificationStore = useNotificationStore()

/** 目前分類 tab：'all' 或 categoryId。 */
const activeCategory = ref<string>('all')
/** 只看未讀。 */
const unreadOnly = ref(false)

/** 詳情彈窗狀態。 */
const detailVisible = ref(false)
const currentNotification = ref<AppNotification | null>(null)

/** 依分類 + 未讀篩選後的列表（置頂優先、時間新到舊由 store 排序）。 */
const rows = computed<AppNotification[]>(() =>
  notificationStore.sortedItems.filter((n) => {
    if (activeCategory.value !== 'all' && n.categoryId !== activeCategory.value) return false
    if (unreadOnly.value && n.read) return false
    return true
  }),
)

/** 收件匣時間省略年份（近期通知為主）。 */
function shortTime(time: string): string {
  return time.replace(/^\d{4}\//, '')
}

function openDetail(notification: AppNotification) {
  currentNotification.value = notification
  notificationStore.markRead(notification.id)
  detailVisible.value = true
}

function toggleRead(notification: AppNotification) {
  notificationStore.toggleRead(notification.id)
}
</script>

<template>
  <Card>
    <template #title>
      <div class="mb-4">
        <h1 class="text-2xl font-bold leading-8">{{ t('notification.center.title') }}</h1>
        <p class="mt-1 text-xs font-normal text-surface-500 dark:text-surface-400">
          {{ t('notification.center.subtitle') }}
        </p>
      </div>
    </template>

    <template #content>
      <!-- design.md 6.6 模式二：Tabs（分類）左、篩選右，同一列 -->
      <div class="mb-4 flex items-center justify-between gap-4">
        <Tabs
          v-model:value="activeCategory"
          scrollable
          class="min-w-0 flex-1"
        >
          <TabList>
            <Tab value="all">
              {{ t('notification.center.tab_all') }}
              <Badge
                :value="notificationStore.items.length"
                severity="secondary"
                class="ml-1"
              />
            </Tab>
            <Tab
              v-for="cat in notificationStore.categories"
              :key="cat.id"
              :value="cat.id"
            >
              {{ cat.name }}
              <Badge
                :value="notificationStore.countByCategory(cat.id)"
                severity="secondary"
                class="ml-1"
              />
            </Tab>
          </TabList>
        </Tabs>

        <label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox
            v-model="unreadOnly"
            binary
            input-id="notification-unread-only"
          />
          {{ t('notification.center.filter.unread_only') }}
        </label>
      </div>

      <DataTable
        :value="rows"
        striped-rows
        data-key="id"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        row-hover
        class="cursor-pointer"
        @row-click="(event) => openDetail(event.data as AppNotification)"
      >
        <template #empty>
          <div class="py-12 text-center text-color-secondary">
            {{ t('notification.center.empty') }}
          </div>
        </template>

        <Column
          :header="t('notification.center.table.column.category')"
          style="width: 150px"
        >
          <template #body="{ data }">
            <Tag
              :value="notificationStore.categoryById(data.categoryId).name"
              :severity="notificationStore.categoryById(data.categoryId).severity"
            />
          </template>
        </Column>

        <Column :header="t('notification.center.table.column.notification')">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span
                v-if="!data.read"
                class="h-2 w-2 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"
                :aria-label="t('notification.center.status.unread')"
              />
              <Tag
                v-if="data.pinned"
                :value="t('notification.center.badge.pinned')"
                severity="warn"
              />
              <span
                class="text-surface-700 dark:text-surface-100"
                :class="data.read ? 'font-normal' : 'font-semibold'"
              >
                {{ data.title }}
              </span>
            </div>
            <div class="mt-1 max-w-[520px] truncate text-xs text-surface-500 dark:text-surface-400">
              {{ data.body }}
            </div>
          </template>
        </Column>

        <Column
          :header="t('notification.center.table.column.time')"
          style="width: 120px"
        >
          <template #body="{ data }">
            <span class="text-xs text-surface-500 dark:text-surface-400">{{ shortTime(data.time) }}</span>
          </template>
        </Column>

        <Column
          :header="t('notification.center.table.column.status')"
          style="width: 90px"
        >
          <template #body="{ data }">
            <span
              v-if="!data.read"
              class="text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              {{ t('notification.center.status.unread') }}
            </span>
            <span
              v-else
              class="text-xs text-surface-500 dark:text-surface-400"
            >
              {{ t('notification.center.status.read') }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('notification.center.table.column.actions')"
          style="width: 100px"
        >
          <template #body="{ data }">
            <Button
              text
              rounded
              size="small"
              severity="secondary"
              :aria-label="data.read ? t('notification.center.action.mark_unread') : t('notification.center.action.mark_read')"
              v-tooltip.top="data.read ? t('notification.center.action.mark_unread') : t('notification.center.action.mark_read')"
              @click.stop="toggleRead(data as AppNotification)"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', data.read ? 'envelope-open' : 'envelope']" />
              </template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <NotificationDetailDialog
    v-model:visible="detailVisible"
    :notification="currentNotification"
  />
</template>
