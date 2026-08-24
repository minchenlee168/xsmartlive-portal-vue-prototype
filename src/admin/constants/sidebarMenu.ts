import type { PermissionKey } from '@/admin/constants/permissions'
import { RouteName } from '@/admin/router'
import liveLogoUrl from '@/admin/assets/live-logo.svg'
import memberListIconUrl from '@/admin/assets/icons/icon-member-list.svg'

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
  /** 標籤後方的小徽章（如 '🚧' 表示規劃中）。 */
  badge?: string
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
  // 綜合收單區：目前僅「得標清單」已實作
  {
    labelKey: 'nav.live_commerce',
    imgSrc: liveLogoUrl,
    items: [
      {
        labelKey: 'nav.bid_list',
        icon: ['far', 'list-radio'],
        to: RouteName.BidList,
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
  /* 電子發票暫時隱藏（先隱藏，日後恢復移除此註解即可）
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
  */
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
  // 會員管理：會員列表 + 會員等級設定
  {
    labelKey: 'nav.member',
    icon: ['far', 'users'],
    items: [
      {
        labelKey: 'nav.member_list',
        imgSrc: memberListIconUrl,
        to: RouteName.MemberList,
      },
      {
        labelKey: 'nav.member_level_setting',
        icon: ['far', 'ranking-star'],
        to: RouteName.MemberLevelSetting,
      },
    ],
  },
  // 通知中心：帳號級收件匣（頂層項，放在行銷活動之後）
  {
    labelKey: 'nav.notification_center',
    icon: ['far', 'bell'],
    to: RouteName.NotificationCenter,
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
