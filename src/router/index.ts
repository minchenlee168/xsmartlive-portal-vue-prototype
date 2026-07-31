import { createRouter, createWebHistory } from 'vue-router'
import AdminApp from '../admin/AdminApp.vue'
import {
  adminChildRoutes,
  lotteryFullscreenRoutes,
  RouteName as AdminRouteName,
  registerTitleGuard,
} from '../admin/router'
import { useUiStore } from '../stores/ui'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/admin' },
    {
      path: '/admin',
      component: AdminApp,
      redirect: { name: AdminRouteName.ProductList },
      children: adminChildRoutes,
    },
    // 直播大螢幕抽獎頁（全螢幕、無 admin 殼層）
    ...lotteryFullscreenRoutes,
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

// 換頁 loading
let loadingTimer: ReturnType<typeof setTimeout> | null = null
router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    if (loadingTimer) clearTimeout(loadingTimer)
    useUiStore().setRouteLoading(true)
  }
  return true
})
router.afterEach(() => {
  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => useUiStore().setRouteLoading(false), 500)
})

registerTitleGuard(router)

export default router
