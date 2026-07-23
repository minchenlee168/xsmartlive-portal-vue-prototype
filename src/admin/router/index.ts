import type { RouteRecordRaw } from 'vue-router'
import { liveOrderRoutes, RouteName as LiveOrderRouteName } from './routes/liveOrderRoutes'
import {
  marketingRoutes,
  lotteryFullscreenRoutes,
  MarketingRouteName,
} from './routes/marketingRoutes'
import {
  merchantManagementRoutes,
  MerchantManagementRouteName,
} from './routes/merchantManagementRoutes'
import { orderRoutes, OrderRouteName } from './routes/orderRoutes'
import { invoiceRoutes, InvoiceRouteName } from './routes/invoiceRoutes'
import { productRoutes, ProductRouteName } from './routes/productRoutes'
import { notificationRoutes, NotificationRouteName } from './routes/notificationRoutes'

export { lotteryFullscreenRoutes }

/**
 * 後台路由 name 集中入口。
 *
 * 直播收單 (`live.*`)、行銷 (`marketing.*`)、商家管理 (`merchant-management.*`) 三個模組
 * 各自宣告 RouteName，這裡合併匯出方便引用。
 */
export const RouteName = {
  ...LiveOrderRouteName,
  ...MarketingRouteName,
  ...MerchantManagementRouteName,
  ...OrderRouteName,
  ...InvoiceRouteName,
  ...ProductRouteName,
  ...NotificationRouteName,
} as const

export { registerTitleGuard } from './guards/titleGuard'

/**
 * 後台子路由：掛在父路由 `/admin` 下。
 *
 * 路徑採相對形式（不以 `/` 開頭），實際 URL 範例：
 * - `/admin/live-order`、`/admin/live-records`
 * - `/admin/marketing/bid-gift-lottery`、`/admin/marketing/keyword-lottery`
 * - `/admin/merchant-management/store-management`
 */
export const adminChildRoutes: RouteRecordRaw[] = [
  ...liveOrderRoutes,
  ...marketingRoutes,
  ...merchantManagementRoutes,
  ...orderRoutes,
  ...invoiceRoutes,
  ...productRoutes,
  ...notificationRoutes,
]
