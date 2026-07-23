import { createI18n } from 'vue-i18n'

import appZhTW from '@/admin/locales/zh-TW.json'
import appEnUS from '@/admin/locales/en-US.json'
import liveOrderZhTW from '@/admin/views/live-order/locales/zh-TW.json'
import liveOrderEnUS from '@/admin/views/live-order/locales/en-US.json'
import portalProductZhTW from '@/admin/views/live-order/portal-product-form/locales/zh-TW.json'
import portalProductEnUS from '@/admin/views/live-order/portal-product-form/locales/en-US.json'
import liveRecordsZhTW from '@/admin/views/live-records/locales/zh-TW.json'
import liveRecordsEnUS from '@/admin/views/live-records/locales/en-US.json'
import bidGiftLotteryZhTW from '@/admin/views/marketing/bid-gift-lottery/locales/zh-TW.json'
import bidGiftLotteryEnUS from '@/admin/views/marketing/bid-gift-lottery/locales/en-US.json'
import keywordLotteryZhTW from '@/admin/views/marketing/keyword-lottery/locales/zh-TW.json'
import keywordLotteryEnUS from '@/admin/views/marketing/keyword-lottery/locales/en-US.json'
import storeManagementZhTW from '@/admin/views/merchant-management/store-management/locales/zh-TW.json'
import storeManagementEnUS from '@/admin/views/merchant-management/store-management/locales/en-US.json'
import notificationZhTW from '@/admin/views/notification/locales/zh-TW.json'
import notificationEnUS from '@/admin/views/notification/locales/en-US.json'

/**
 * 合併 app 級與各 view 級 locale；後者覆寫前者。
 *
 * portal-vue 規範：page-level locale 放在 `views/{module}/locales/`，
 * app 級放在 `src/locales/`；i18n 入口以 deep merge 合併。
 */
function mergeMessages(...sources: Record<string, unknown>[]): Record<string, unknown> {
  return Object.assign({}, ...sources)
}

const messages = {
  'zh-TW': mergeMessages(
    appZhTW,
    liveOrderZhTW,
    portalProductZhTW,
    liveRecordsZhTW,
    bidGiftLotteryZhTW,
    keywordLotteryZhTW,
    storeManagementZhTW,
    notificationZhTW,
  ),
  'en-US': mergeMessages(
    appEnUS,
    liveOrderEnUS,
    portalProductEnUS,
    liveRecordsEnUS,
    bidGiftLotteryEnUS,
    keywordLotteryEnUS,
    storeManagementEnUS,
    notificationEnUS,
  ),
}

/**
 * 全域 i18n 實例（Composition API mode）。
 * 預設語系 zh-TW；fallback 同為 zh-TW（en-US 補充用）。
 */
export const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW',
  fallbackLocale: 'zh-TW',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: messages as any,
})
