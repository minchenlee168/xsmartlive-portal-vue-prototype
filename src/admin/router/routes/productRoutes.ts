import type { RouteRecordRaw } from 'vue-router'

/**
 * 商品管理模組路由 name。
 *
 * 目前只實作「商品列表」；賣場分頁 / 常用規格 / 商品標籤 暫以 sidebar `planning: true` 呈現，
 * 之後實作完成再補對應的 RouteName + route record。
 */
export const ProductRouteName = {
  ProductList: 'product.list',
  ProductCreate: 'product.create',
  ProductUpdate: 'product.update',
  ProductBundleCreate: 'product.bundle.create',
} as const

export const productRoutes: RouteRecordRaw[] = [
  {
    path: 'product/list',
    name: ProductRouteName.ProductList,
    component: () => import('@/admin/views/product/ProductListPage.vue'),
    meta: {
      i18nKey: 'route.product_list',
      layout: 'default',
    },
  },
  {
    path: 'product/create',
    name: ProductRouteName.ProductCreate,
    // 與編輯商品頁共用同一個元件；元件內部依 route.params.id 判斷 create / update 模式
    component: () => import('@/admin/views/product/ProductUpdatePage.vue'),
    meta: {
      i18nKey: 'route.product_create',
      layout: 'default',
    },
  },
  {
    path: 'product/update/:id?',
    name: ProductRouteName.ProductUpdate,
    component: () => import('@/admin/views/product/ProductUpdatePage.vue'),
    meta: {
      i18nKey: 'route.product_update',
      layout: 'default',
    },
  },
  {
    path: 'product/bundle/create',
    name: ProductRouteName.ProductBundleCreate,
    component: () => import('@/admin/views/product/ProductBundleCreatePage.vue'),
    meta: {
      i18nKey: 'route.product_bundle_create',
      layout: 'default',
    },
  },
]
