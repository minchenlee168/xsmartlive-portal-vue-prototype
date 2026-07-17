import type { PermissionKey } from '@/admin/constants/permissions'
import { RouteName } from '@/admin/router'
import liveLogoUrl from '@/admin/assets/live-logo.svg'

export interface MenuItem {
  labelKey: string
  /** FontAwesome icon（prefix + name）。 */
  icon?: string | string[]
  /** 以 SVG 圖片取代 FA icon（直播收單區用 live-logo.svg）。優先於 `icon`。 */
  imgSrc?: string
  to?: string
  url?: string
  target?: string
  items?: MenuItem[]
  permissionKey?: PermissionKey | PermissionKey[]
  /** 規劃中：不導頁，只跳「此功能規劃中」toast。 */
  planning?: boolean
}

/**
 * 主選單。
 *
 * 對齊 portal-vue 的 sidebarMenu 結構（labelKey / icon / to / items），
 * 但只放本 prototype 已實作的模組：直播收單區、行銷活動。
 * portal-vue 既有但尚未在本 prototype 開發的（商品管理 / 訂單管理 / 我的商城 /
 * 客服管理 / 會員管理 / 設定…）暫不列入。
 */
export const sidebarMenu: MenuItem[] = [
  {
    labelKey: 'nav.live',
    imgSrc: liveLogoUrl,
    items: [
      {
        labelKey: 'nav.live_order',
        icon: ['far', 'circle-play'],
        to: RouteName.LiveOrder,
      },
      {
        labelKey: 'nav.live_order_post',
        icon: ['far', 'comment'],
        to: RouteName.LiveOrderPost,
      },
      {
        labelKey: 'nav.live_order_community',
        icon: ['far', 'users'],
        to: RouteName.LiveOrderCommunity,
      },
      {
        labelKey: 'nav.live_records',
        icon: ['far', 'clipboard-list'],
        to: RouteName.LiveRecords,
      },
    ],
  },
  {
    labelKey: 'nav.product.product',
    icon: ['far', 'box-isometric'],
    items: [
      {
        labelKey: 'nav.product.list',
        icon: ['far', 'clipboard-list'],
        to: RouteName.ProductList,
      },
      {
        labelKey: 'nav.product.category',
        icon: ['far', 'chart-tree-map'],
        planning: true,
      },
      {
        labelKey: 'nav.product.common_spec',
        icon: ['far', 'chart-tree-map'],
        planning: true,
      },
      {
        labelKey: 'nav.product.tag',
        icon: ['far', 'tags'],
        planning: true,
      },
    ],
  },
  {
    labelKey: 'nav.order',
    icon: ['far', 'file-invoice-dollar'],
    items: [
      {
        labelKey: 'nav.order_list',
        icon: ['far', 'list-radio'],
        to: RouteName.OrderList,
      },
    ],
  },
  // 多購物車設定：獨立頂層項，與訂單管理同級（依規劃藍圖）
  {
    labelKey: 'nav.multi_cart_settings',
    icon: ['far', 'bag-shopping'],
    to: RouteName.MultiCartSettings,
  },
  {
    labelKey: 'nav.invoice.invoice',
    icon: ['far', 'receipt'],
    items: [
      {
        labelKey: 'nav.invoice.operations',
        icon: ['far', 'clipboard-list'],
        to: RouteName.InvoiceOperations,
      },
      {
        labelKey: 'nav.invoice.manual',
        icon: ['far', 'pen-to-square'],
        to: RouteName.InvoiceManual,
      },
    ],
  },
  {
    labelKey: 'nav.marketing',
    icon: ['far', 'chart-mixed'],
    items: [
      {
        labelKey: 'nav.bid_gift_lottery',
        icon: ['far', 'gift'],
        to: RouteName.BidGiftLotteryList,
      },
      {
        labelKey: 'nav.keyword_lottery',
        icon: ['far', 'hashtag'],
        to: RouteName.KeywordLotteryList,
      },
    ],
  },
]

/**
 * 商家管理子選單（sidebar 底部「商家管理」按鈕點下後切換到的選單）。
 */
export const merchantManagementMenu: MenuItem[] = [
  {
    labelKey: 'nav.merchant_management.store_management',
    icon: ['far', 'shop'],
    to: RouteName.StoreManagement,
  },
]
