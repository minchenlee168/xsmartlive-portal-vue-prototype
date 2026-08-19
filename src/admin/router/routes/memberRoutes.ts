import type { RouteRecordRaw } from 'vue-router'

/**
 * 會員管理模組路由 name。
 */
export const MemberRouteName = {
  MemberList: 'member.list',
} as const

export const memberRoutes: RouteRecordRaw[] = [
  {
    path: 'member/list',
    name: MemberRouteName.MemberList,
    component: () => import('@/admin/views/member/member-list/MemberListPage.vue'),
    meta: {
      i18nKey: 'route.member_list',
      layout: 'default',
    },
  },
]
