/**
 * 金額顯示格式化（mock 版面預覽）。
 *
 * prototype 幣別固定 TWD（NT$、無小數位），只格式化、不做面值運算。負值照原樣顯示
 * （退款會讓區間加總變負）。
 */

/** 金額加上 `NT$` 與千分位，例如 `NT$ 3,000`。 */
export function formatMoney(amount: number): string {
  return `NT$ ${amount.toLocaleString('en-US')}`;
}

/** 純數字千分位（不帶幣別符號），例如 `3,000`。 */
export function formatThousands(value: number): string {
  return value.toLocaleString('en-US');
}
