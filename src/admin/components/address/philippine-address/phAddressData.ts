/**
 * 菲律賓地址四層（大區 → 省 → 市 → 村里）階層資料（prototype mock，示意）。
 * 對齊正式專案 libs/philippine-address：正式為 API 載入，此處改為本地靜態資料。
 */
export const PH_ADDRESS_DATA: Record<string, Record<string, Record<string, string[]>>> = {
  'Metro Manila': {
    'METRO-MANILA': {
      BINONDO: ['BARANGAY 287', 'BARANGAY 288', 'BARANGAY 289'],
      MAKATI: ['Poblacion', 'Bel-Air', 'San Lorenzo'],
      'QUEZON CITY': ['Diliman', 'Cubao', 'Novaliches'],
      MANILA: ['Malate', 'Ermita', 'Tondo'],
    },
  },
  Calabarzon: {
    CAVITE: { Bacoor: ['Molino', 'Zapote'], Imus: ['Anabu', 'Bucandala'] },
    LAGUNA: { Calamba: ['Parian', 'Real'], 'Santa Rosa': ['Balibago', 'Malitlit'] },
  },
  'Central Luzon': {
    PAMPANGA: { 'Angeles City': ['Balibago', 'Pampang'], 'San Fernando': ['Dolores', 'Sindalan'] },
  },
  'Central Visayas': {
    CEBU: { 'Cebu City': ['Lahug', 'Mabolo'], 'Mandaue City': ['Centro', 'Guizo'] },
  },
  'Davao Region': {
    'DAVAO DEL SUR': { 'Davao City': ['Poblacion', 'Buhangin'] },
  },
}

/** 大區（最上層）選項。 */
export const PH_REGION_OPTIONS = Object.keys(PH_ADDRESS_DATA)
