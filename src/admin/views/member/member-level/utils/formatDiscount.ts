/** 顯示層的翻譯函式（vue-i18n 的 `t`，帶具名插值）。 */
export type TranslateFn = (key: string, named?: Record<string, unknown>) => string;

/**
 * 購物折扣百分比的台灣折數顯示文字。
 *
 * 百分比是「實付比例」（值域 1~100）：100 代表原價、90 代表付九成。折數的整十者除以 10 顯示成
 * 一位數（90 → 9 折），非整十者直接顯示原值（98 → 98 折）。
 *
 * @param discountPercent - 折扣百分比，值域 1~100 整數
 * @param translate - 顯示層的翻譯函式
 */
export function formatDiscount(discountPercent: number, translate: TranslateFn): string {
  if (discountPercent >= 100) {
    return translate('member_level.text.discount.none');
  }

  const tenth = discountPercent / 10;

  return translate('member_level.text.discount.value', {
    discount: Number.isInteger(tenth) ? tenth : discountPercent,
    percent: discountPercent,
  });
}
