/** 台灣地址三段控制項的文案（元件不內建可見文案，一律由呼叫端注入）。 */
export interface TwAddressFieldTexts {
  /** 縣市下拉的提示文字。 */
  cityPlaceholder: string
  /** 鄉鎮市區下拉的提示文字。 */
  districtPlaceholder: string
  /** 詳細地址輸入框的提示文字。 */
  detailPlaceholder: string
}

/** 收件地址欄沿用的預設文案。 */
export const DEFAULT_TW_ADDRESS_FIELD_TEXTS: TwAddressFieldTexts = {
  cityPlaceholder: '請選擇城市',
  districtPlaceholder: '請選擇區',
  detailPlaceholder: '街道、門牌、樓層',
}
