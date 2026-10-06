/**
 * 物流商選項(單一來源)。
 * 進階搜尋「物流商」篩選與「設定配送 · 已啟用物流商」下拉共用同一份,
 * 依配送類型分組(宅配 / 超商配送 / 跨境 / 自取·商家自建 / 其他)。
 */

export interface CarrierOption {
  label: string
  value: string
}
export interface CarrierGroup {
  group: string
  items: CarrierOption[]
}

export const carrierOptionGroups: CarrierGroup[] = [
  { group: '宅配', items: [
    { label: '新竹物流',       value: 'hct' },
    { label: '嘉里大榮常溫',   value: 'kerry_normal' },
    { label: '嘉里大榮低溫',   value: 'kerry_cold' },
    { label: '嘉里快遞',       value: 'kerry_express' },
    { label: '黑貓宅急便',     value: 'tcat' },
  ] },
  { group: '超商配送', items: [
    { label: '黑貓宅急便（門市寄件）', value: 'tcat_handover' },
    { label: '7-11 B2C 到府收件',      value: 'cvs711_b2c_normal' },
    { label: '7-11 B2C 冷凍到府收件',  value: 'cvs711_b2c_cold' },
    { label: '7-11 交貨便（門市寄件）', value: 'cvs711_handover' },
    { label: '全家常溫',               value: 'fm_normal' },
    { label: '全家冷凍到府收件',       value: 'fm_cold_home' },
    { label: '全家 C2C 店到店',        value: 'fm_c2c' },
  ] },
  { group: '跨境', items: [
    { label: 'Presco 跨境物流（宅配）',     value: 'presco_home' },
    { label: 'Presco 跨境物流（超商取貨）', value: 'presco_cvs' },
  ] },
  { group: '自取 / 商家自建', items: [
    { label: '郵局（商家自建）', value: 'post_self' },
  ] },
  { group: '其他', items: [
    { label: '未分類', value: 'uncategorized' },
  ] },
]

/** 扁平化:value → label / label → value / value → 所屬分組 */
const flatCarriers = carrierOptionGroups.flatMap(g => g.items.map(i => ({ ...i, group: g.group })))

/** carrier value → 中文 label */
export const CARRIER_LABEL: Record<string, string> = Object.fromEntries(
  flatCarriers.map(c => [c.value, c.label]),
)

/** carrier label → value(反查,開啟設定配送帶入既有物流商用) */
export function carrierValueOfLabel(label?: string): string {
  if (!label) return ''
  return flatCarriers.find(c => c.label === label)?.value ?? ''
}

/** carrier value → 所屬配送分組名稱(宅配 / 超商配送 / 跨境 / ...);作為「採用的物流方式」顯示 */
export function carrierGroupOf(value?: string): string {
  if (!value) return ''
  return flatCarriers.find(c => c.value === value)?.group ?? ''
}

/** 由 carrier value 推物流取號前綴(取第一段並轉大寫,如 kerry_normal → KERRY) */
export function trackingPrefixOf(value?: string): string {
  if (!value) return ''
  return value.split('_')[0].toUpperCase()
}
