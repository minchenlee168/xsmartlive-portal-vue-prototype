/**
 * 會員等級設定頁的自包含狀態與讀寫動作（mock 版）。
 *
 * ⚠️ 無後端：切總開關、停用單一級距、存回編輯結果三個動作都只改本地 `setting` 並出成功 toast。
 * 本地狀態同步更新，永遠成功；`resyncToken` 仍保留——控制項是純值受控綁定（撥動只發事件，
 * 值等狀態更新才反映回來），凡「使用者撥了開關、但 `setting` 沒變」的路徑（取消停用的二次確認）
 * 光靠資料綁定回不去，要換 `:key` 重掛。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { createMockMemberLevelSetting } from '../mock/mockMemberLevel';
import type { MemberLevel, MemberLevelSetting } from '../types';

export function useMemberLevelSetting() {
  const { t } = useI18n();
  const { showSuccess } = useGlobalToast();

  /** 目前設定；mock 以初值起始（已開啟＋四個級距）。 */
  const setting = ref<MemberLevelSetting>(createMockMemberLevelSetting());

  /** 四個級距，依 `sortOrder` 0~3 排列。 */
  const levels = computed<MemberLevel[]>(() => setting.value.levels);

  /**
   * 開關重掛序號；顯示層把它混進開關的 `:key`，遞增即逼開關重掛回實際設定。
   * 使用者撥了、但 `setting` 沒變的路徑（取消停用的二次確認）由此收尾。
   */
  const resyncToken = ref(0);

  /** mock 無非同步寫入，恆為 false；保留是為了對齊顯示層的 prop 介面。 */
  const isSaving = ref(false);

  /** 讓顯示層的開關退回實際設定（見 `resyncToken`）。 */
  function resync(): void {
    resyncToken.value += 1;
  }

  /** 切換總開關；`false` 方向的二次確認由顯示層先擋，這裡收到的都是已確認的值。 */
  function toggleEnabled(value: boolean): void {
    setting.value.isEnabled = value;
    showSuccess({ detail: t('member_level.setting_page.toast.updated') });
  }

  /** 切換單一級距的啟用狀態。 */
  function toggleLevelEnabled(sortOrder: number, value: boolean): void {
    const target = setting.value.levels.find((level) => level.sortOrder === sortOrder);
    if (!target) return;

    target.isEnabled = value;
    showSuccess({ detail: t('member_level.setting_page.toast.updated') });
  }

  /**
   * 把編輯 Modal 改好的級距寫回；以 `sortOrder` 對位（級距不可增刪，順序即身分）。
   *
   * @returns 是否寫入成功（mock 恆為 true，供頁面決定是否關窗）
   */
  function applyLevel(editedLevel: MemberLevel): boolean {
    setting.value.levels = setting.value.levels.map((level) =>
      level.sortOrder === editedLevel.sortOrder ? editedLevel : level,
    );
    showSuccess({ detail: t('member_level.setting_page.toast.updated') });

    return true;
  }

  return {
    setting,
    levels,
    isSaving,
    resyncToken,
    resync,
    toggleEnabled,
    toggleLevelEnabled,
    applyLevel,
  };
}
