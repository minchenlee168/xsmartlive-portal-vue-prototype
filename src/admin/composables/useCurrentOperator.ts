/**
 * 目前登入的操作人員（prototype：mock 固定值）。
 *
 * 用於個資頁浮水印、個資存取稽核記錄、操作紀錄的操作者欄位等需要「誰在操作」的情境。
 * ⚠️ 待接後端登入流程後，改由 auth store 提供實際登入者帳號與姓名。
 */
export function useCurrentOperator() {
  /** 登入者帳號 */
  const id = 'ops001';
  /** 登入者姓名 */
  const name = '測試人員';
  /** 稽核記錄用顯示字串：帳號 + 姓名 */
  const displayName = `${id} ${name}`;
  return { id, name, displayName };
}
