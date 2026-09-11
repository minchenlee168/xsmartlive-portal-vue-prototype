import type { RouteRecordRaw } from 'vue-router'

/**
 * 行銷模組路由 name。
 *
 * BidGiftLotteryDraw 是「直播大螢幕抽獎頁」，從 List 點「開始抽獎」會 `window.open` 另開分頁，
 * 因此抽獎頁不掛在 `/admin/` 殼層下、走獨立的 top-level 路由 `/lottery/draw/:id?`。
 */
export const MarketingRouteName = {
  BidGiftLotteryList: 'marketing.bid-gift-lottery.list',
  BidGiftLotteryDraw: 'marketing.bid-gift-lottery.draw',
  KeywordLotteryList: 'marketing.keyword-lottery.list',
  BonusPointsList: 'marketing.bonus-points.list',
} as const

/**
 * 在 `/admin/` 殼層下的行銷子路由（List 類，會走 DefaultLayout）。
 */
export const marketingRoutes: RouteRecordRaw[] = [
  {
    path: 'marketing/bid-gift-lottery',
    name: MarketingRouteName.BidGiftLotteryList,
    component: () => import('@/admin/views/marketing/bid-gift-lottery/BidGiftLotteryListPage.vue'),
    meta: {
      i18nKey: 'route.bid_gift_lottery_list',
      layout: 'default',
    },
  },
  {
    path: 'marketing/keyword-lottery',
    name: MarketingRouteName.KeywordLotteryList,
    component: () => import('@/admin/views/marketing/keyword-lottery/KeywordLotteryListPage.vue'),
    meta: {
      i18nKey: 'route.keyword_lottery_list',
      layout: 'default',
    },
  },
  {
    path: 'marketing/bonus-points',
    name: MarketingRouteName.BonusPointsList,
    component: () => import('@/admin/views/marketing/bonus-points/BonusPointsListPage.vue'),
    meta: {
      i18nKey: 'route.bonus_points_list',
      layout: 'default',
    },
  },
]

/**
 * 直播大螢幕抽獎頁（top-level，不走 admin 殼層）。
 *
 * 由 BidGiftLotteryListPage / KeywordLotteryListPage 的「開始抽獎」按鈕透過
 * `window.open(... '_blank')` 另開分頁。
 */
export const lotteryFullscreenRoutes: RouteRecordRaw[] = [
  {
    path: '/lottery/draw/:id?',
    name: MarketingRouteName.BidGiftLotteryDraw,
    component: () => import('@/admin/views/marketing/bid-gift-lottery/BidGiftLotteryDrawPage.vue'),
    meta: {
      i18nKey: 'route.bid_gift_lottery_draw',
    },
  },
]
