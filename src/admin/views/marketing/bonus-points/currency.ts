/**
 * 紅利點數多幣別支援（原型階段）。
 *
 * 設計理念（見設計圖）：
 * - 紅利點以「該商店的貨幣」為主；跨幣別使用時，需依匯率換算再扣除。
 * - 金額 / 點數一律四捨五入到該幣別的最小單位：台幣小數 0 位、馬幣小數 2 位。
 *
 * prototype 說明：這裡只負責「顯示 / 輸入」的幣別符號與小數位，不做真正的面值運算或
 * 匯率換算。切換商店幣別時，既有活動的數值不變，只是換一組符號 / 小數位呈現，方便展示
 * 同一畫面在不同店幣下的樣子。實際跨幣別扣點計算由會員端結帳時處理。
 */

/** 商店貨幣代碼 */
export const StoreCurrency = {
  /** 新台幣（台灣，小數 0 位） */
  TWD: 'TWD',
  /** 馬來西亞令吉 / 馬幣（小數 2 位） */
  MYR: 'MYR',
  /** 港幣（小數 2 位） */
  HKD: 'HKD',
  /** 美元（小數 2 位） */
  USD: 'USD',
} as const;

export type StoreCurrency = (typeof StoreCurrency)[keyof typeof StoreCurrency];

/** 單一幣別的呈現設定 */
export interface CurrencyMeta {
  code: StoreCurrency;
  /** 選單顯示名稱（如「MYR 馬幣」） */
  label: string;
  /** 金額符號 prefix（如 `NT$ ` / `RM `），已含尾隨空白，可直接接數字 */
  symbol: string;
  /** 最小單位小數位：台幣 0、馬幣 2 */
  minorUnit: number;
}

/**
 * 支援的商店幣別清單（原型 demo 用）。
 * 涵蓋小數 0 位（TWD）與 2 位（MYR / HKD / USD）兩種，方便展示四捨五入差異。
 */
export const CURRENCIES: Record<StoreCurrency, CurrencyMeta> = {
  [StoreCurrency.TWD]: { code: StoreCurrency.TWD, label: 'TWD 台幣', symbol: 'NT$ ', minorUnit: 0 },
  [StoreCurrency.MYR]: { code: StoreCurrency.MYR, label: 'MYR 馬幣', symbol: 'RM ', minorUnit: 2 },
  [StoreCurrency.HKD]: { code: StoreCurrency.HKD, label: 'HKD 港幣', symbol: 'HK$ ', minorUnit: 2 },
  [StoreCurrency.USD]: { code: StoreCurrency.USD, label: 'USD 美元', symbol: 'US$ ', minorUnit: 2 },
};

/** 預設商店幣別（台幣，維持原型既有行為） */
export const DEFAULT_CURRENCY: StoreCurrency = StoreCurrency.TWD;

/** 取得幣別設定（查無則回退台幣） */
export function currencyMeta(code: StoreCurrency): CurrencyMeta {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}

/** 四捨五入到該幣別最小單位（台幣→整數、馬幣→2 位） */
export function roundToMinorUnit(amount: number, code: StoreCurrency): number {
  const { minorUnit } = currencyMeta(code);
  const factor = 10 ** minorUnit;
  return Math.round(amount * factor) / factor;
}

/**
 * 依幣別格式化金額：四捨五入到最小單位 + 千分位 + 符號 prefix。
 * 例：`formatCurrency(300, 'MYR')` → `RM 300.00`；`formatCurrency(300, 'TWD')` → `NT$ 300`。
 */
export function formatCurrency(amount: number, code: StoreCurrency): string {
  const meta = currencyMeta(code);
  const rounded = roundToMinorUnit(amount, code);
  const number = rounded.toLocaleString('en-US', {
    minimumFractionDigits: meta.minorUnit,
    maximumFractionDigits: meta.minorUnit,
  });
  return `${meta.symbol}${number}`;
}

/** 供 Select 使用的幣別選項 */
export const CURRENCY_OPTIONS: { label: string; value: StoreCurrency }[] =
  Object.values(CURRENCIES).map((c) => ({ label: c.label, value: c.code }));
