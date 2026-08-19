/**
 * 去除規格備註開頭的「規格:／規格：」前綴，回傳純規格值。
 * 得標清單各處（主表格、分組表格、編輯資料彈窗）統一以此顯示規格，確保呈現一致。
 * @param specNote 原始規格備註（可能為 undefined / null / 空字串）
 * @returns 去前綴後的純規格值；無值時回傳空字串
 * @example
 * stripSpecPrefix('規格:XL'); // 'XL'
 * stripSpecPrefix('規格：小容量'); // '小容量'
 * stripSpecPrefix(''); // ''
 */
export function stripSpecPrefix(specNote: string | undefined | null): string {
  return (specNote || '').replace(/^規格[:：]\s*/, '');
}
