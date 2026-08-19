import type { RouteRecordRaw } from 'vue-router'
import { PERMISSIONS } from '@/admin/constants/permissions'

/**
 * 開始收單模組路由（後台 `/admin` 下的子路由）。
 *
 * URL path 用相對 kebab-case（不以 `/` 開頭），實際 URL 會是 `/admin/live-order`、`/admin/live-records`。
 */
export const RouteName = {
  LiveOrder: 'live.order',
  LiveOrderPost: 'live.order.post',
  LiveOrderPostList: 'live.order.post.list',
  LiveOrderCommunity: 'live.order.community',
  LiveRecords: 'live.records',
  BidList: 'live.bid_list',
  MultiCartSettings: 'live.multi_cart_settings',
} as const

export const liveOrderRoutes: RouteRecordRaw[] = [
  {
    path: 'live-order',
    name: RouteName.LiveOrder,
    component: () => import('@/admin/views/live-order/LiveOrderPage.vue'),
    meta: {
      i18nKey: 'route.live_order',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'live-order-post',
    name: RouteName.LiveOrderPost,
    component: () => import('@/admin/views/live-order/LiveOrderPage.vue'),
    meta: {
      i18nKey: 'route.live_order_post',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'live-order-post-list',
    name: RouteName.LiveOrderPostList,
    component: () => import('@/admin/views/live-order/LiveOrderPage.vue'),
    meta: {
      i18nKey: 'route.live_order_post_list',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'live-order-community',
    name: RouteName.LiveOrderCommunity,
    component: () => import('@/admin/views/live-order/LiveOrderPage.vue'),
    meta: {
      i18nKey: 'route.live_order_community',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'live-records',
    name: RouteName.LiveRecords,
    component: () => import('@/admin/views/live-records/LiveRecordsPage.vue'),
    meta: {
      i18nKey: 'route.live_records',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'bid-list',
    name: RouteName.BidList,
    component: () => import('@/admin/views/live/bid-list/BidListPage.vue'),
    meta: {
      i18nKey: 'route.bid_list',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
  {
    path: 'multi-cart-settings',
    name: RouteName.MultiCartSettings,
    component: () => import('@/admin/views/live-order/MultiCartSettingsPage.vue'),
    meta: {
      i18nKey: 'route.multi_cart_settings',
      permissionKey: PERMISSIONS.LIVE_ORDER_VIEW,
      layout: 'default',
    },
  },
]
