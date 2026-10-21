/**
 * 多購物車「運費矩陣」的設定資料與純函式（物流方式 × 付款 × 地區 × 溫層）。
 * 對齊正式專案 checkout-setting/utils：矩陣的靜態定義與 key／預設值計算抽出為獨立模組，
 * 彈窗只保留與表單 state 綁定的響應式邏輯。
 */
import type { TempLayer } from './multiCartTypes'

/** 物流方式；自取不計運費。 */
export const LOGI_OPTIONS: Array<{ value: string; noFee?: boolean }> = [
  { value: '宅配' },
  { value: '超商配送' },
  { value: '跨境' },
  { value: '自取', noFee: true },
  { value: '商家自建（如郵局）' },
]

/** 溫層欄順序（常溫 / 冷藏 / 冷凍）；運費索引以此為準。 */
export const TEMP_OPTIONS: TempLayer[] = ['常溫', '冷藏', '冷凍']

/** 「全溫層皆支援」標記；沿用 TEMP_OPTIONS 以免溫層順序漂移導致運費索引對不上。 */
export const ALL_TEMPS: TempLayer[] = TEMP_OPTIONS

/** 運費矩陣的物流群組。 */
export interface FeeGroup {
  name: string
  dot: string
  sub?: string
  /** [物流商名稱, 客代數, 支援溫層] */
  carriers: Array<[string, number, TempLayer[]]>
}

/** 國內預設運費（本島常溫/冷藏/冷凍、離島常溫/冷藏/冷凍）。 */
export const DOMESTIC_FEE: Record<string, number[]> = {
  on: [60, 110, 130, 100, 150, 170],
  cod: [70, 120, 140, 110, 160, 180],
}

/** 跨境預設運費（馬來西亞常溫/冷藏/冷凍、香港常溫/冷藏/冷凍）。 */
export const CB_FEE: Record<string, number[]> = {
  on: [100, 200, 200, 0, 0, 0],
  cod: [100, 200, 200, 0, 0, 0],
}

/** 物流方式 → 國內運費群組。 */
export const METHOD_CONFIG: Record<string, FeeGroup[]> = {
  宅配: [
    {
      name: '宅配',
      dot: '#3b82f6',
      carriers: [
        ['新竹物流', 3, ['常溫']],
        ['嘉里大榮常溫', 2, ['常溫']],
        ['嘉里大榮低溫', 0, ['冷藏', '冷凍']],
        ['嘉里快遞', 0, ALL_TEMPS],
        ['黑貓宅急便', 0, ALL_TEMPS],
      ],
    },
  ],
  超商配送: [
    { name: '超商配送 - 黑貓', dot: '#f97316', carriers: [['黑貓宅急便（門市寄件）', 0, ['常溫']]] },
    {
      name: '超商配送 - 7-11',
      dot: '#f97316',
      carriers: [
        ['7-11 B2C 到府收件', 0, ['常溫']],
        ['7-11 B2C 冷凍到府收件', 0, ['冷凍']],
        ['7-11 交貨便（門市寄件）', 0, ['常溫']],
      ],
    },
    {
      name: '超商配送 - 全家',
      dot: '#f97316',
      carriers: [
        ['全家常溫到府收件', 0, ['常溫']],
        ['全家冷凍到府收件', 0, ['冷凍']],
      ],
    },
  ],
  '商家自建（如郵局）': [
    { name: '商家自建（如郵局）', dot: '#8b5cf6', carriers: [['中華郵局', 0, ALL_TEMPS]] },
  ],
}

/** 跨境運費群組。 */
export const CB_GROUPS: FeeGroup[] = [
  { name: 'Presco 跨境物流', dot: '#a855f7', sub: '宅配', carriers: [['Presco 跨境物流（宅配＋超商代收）', 1, ['常溫']]] },
  { name: 'Presco 跨境物流', dot: '#a855f7', sub: '超商配送', carriers: [['Presco 跨境物流（宅配＋超商代收）', 1, ['常溫']]] },
]

/** 國內地區欄（本島 / 離島）。 */
export const DOMESTIC_REGIONS = ['台灣本島', '台灣離島']
/** 跨境目的地欄。 */
export const CB_REGIONS = ['馬來西亞（目的地）', '香港（目的地）']

/** 「物流群組 × 付款」的列 key。 */
export function rowKeyOf(scope: string, g: FeeGroup, payId: string): string {
  return `${scope}|${g.name}|${g.sub ?? ''}|${payId}`
}

/** 單一格子的 key（列 key + 地區/溫層格索引）。 */
export function cellKeyOf(scope: string, g: FeeGroup, payId: string, k: number): string {
  return `${rowKeyOf(scope, g, payId)}|${k}`
}

/** 某 scope／付款／格索引的預設運費。 */
export function defaultFeeOf(scope: string, payId: string, k: number): number {
  return (scope === 'dom' ? DOMESTIC_FEE : CB_FEE)[payId][k]
}

/** 物流商是否支援某溫層。 */
export function carrierSupports(c: [string, number, TempLayer[]], t: TempLayer): boolean {
  return c[2].includes(t)
}

/** 群組內是否有物流商支援某溫層。 */
export function groupSupportsTemp(g: FeeGroup, t: TempLayer): boolean {
  return g.carriers.some((c) => carrierSupports(c, t))
}
