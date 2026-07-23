import type { RouteRecordRaw } from 'vue-router'

/**
 * 通知中心模組路由 name。
 */
export const NotificationRouteName = {
  NotificationCenter: 'notification.center',
} as const

export const notificationRoutes: RouteRecordRaw[] = [
  {
    path: 'notification/center',
    name: NotificationRouteName.NotificationCenter,
    component: () => import('@/admin/views/notification/NotificationCenterPage.vue'),
    meta: {
      i18nKey: 'route.notification_center',
      layout: 'default',
    },
  },
]
