import type { RouteRecordRaw } from 'vue-router'

/**
 * 訂單管理模組路由 name。
 */
export const OrderRouteName = {
  /** 新版訂單列表(不含退換貨機制) */
  OrderList: 'order.list',
  /** 舊版訂單列表(含退換貨機制) */
  OrderListLegacy: 'order.list.legacy',
} as const

export const orderRoutes: RouteRecordRaw[] = [
  {
    path: 'order/list',
    name: OrderRouteName.OrderList,
    component: () => import('@/admin/views/order/OrderListNoReturnPage.vue'),
    meta: {
      i18nKey: 'route.order_list',
      layout: 'default',
    },
  },
  {
    path: 'order/list-legacy',
    name: OrderRouteName.OrderListLegacy,
    component: () => import('@/admin/views/order/OrderListPage.vue'),
    meta: {
      i18nKey: 'route.order_list_legacy',
      layout: 'default',
    },
  },
]
