import type { RouteRecordRaw } from 'vue-router'

/**
 * 電子發票模組路由 name。
 *
 * 目前只實作「發票作業」；其他發票相關功能（發票設定、紙本/電子載具管理…）
 * 之後再補對應的 RouteName + route record。
 */
export const InvoiceRouteName = {
  InvoiceOperations: 'invoice.operations',
} as const

export const invoiceRoutes: RouteRecordRaw[] = [
  {
    path: 'invoice/operations',
    name: InvoiceRouteName.InvoiceOperations,
    component: () => import('@/admin/views/invoice/InvoiceOperationsPage.vue'),
    meta: {
      i18nKey: 'route.invoice_operations',
      layout: 'default',
    },
  },
]
