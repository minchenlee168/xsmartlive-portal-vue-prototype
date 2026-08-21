/**
 * 會員列表 CSV 匯出（mock 版面預覽）。
 *
 * ⚠️ 依「目前篩選結果」匯出（不受分頁限制），純前端從假資料產生並下載；待接後端後改由 API 匯出。
 * 為維持 prototype 精簡，欄位標題採中文（zh-TW 為主要語系）。
 */
import type { MockMemberRow } from '../mock/mockMembers';
import { formatLastOrderDate, formatSpend, getAbandonRate } from './mockMemberDisplay';

const LEVEL_LABEL: Record<MockMemberRow['level'], string> = {
  normal: '一般', bronze: '銅卡', silver: '銀卡', gold: '金卡',
};
const STATUS_LABEL: Record<MockMemberRow['status'], string> = {
  normal: '正常', suspended: '停權', blacklisted: '黑名單',
};
const GENDER_LABEL: Record<'male' | 'female', string> = { male: '男', female: '女' };

/** 已綁定管道的中文清單（以頓號串接）。 */
function boundChannels(member: MockMemberRow): string {
  const map: [keyof MockMemberRow['bindings'], string][] = [
    ['phone', '手機'], ['facebook', 'Facebook'], ['instagram', 'Instagram'],
    ['line', 'LINE'], ['google', 'Google'], ['whatsapp', 'WhatsApp'], ['tiktok', 'TikTok'],
  ];
  return map.filter(([key]) => member.bindings[key]).map(([, name]) => name).join('、');
}

/** CSV 欄位跳脫（含逗號 / 引號 / 換行時加引號並跳脫）。 */
function csvEscape(value: string | number): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 產生會員列表 CSV 並觸發下載。
 *
 * @param members 目前篩選後的會員列
 * @param detailed 是否含完整明細（多帶個資與交易欄位）
 * @param dateStamp 檔名日期戳（YYYY-MM-DD；由呼叫端提供，避免工具層依賴系統時間）
 */
export function exportMembersCsv(members: MockMemberRow[], detailed: boolean, dateStamp: string): void {
  const headers = detailed
    ? ['會員編號', '姓名', '手機', '完整手機', 'Email', '地址', '性別', '生日', '會員等級', '星等',
      '累積消費', '紅利點數', '訂單數', '標單數', '棄標數', '棄標率', '綁定管道', '帳號建立日', '最後購買日', '會員狀態']
    : ['會員編號', '姓名', '手機', '會員等級', '星等', '累積消費', '標單數', '棄標數', '棄標率', '最後購買日', '會員狀態'];

  const lineOf = (m: MockMemberRow): (string | number)[] => {
    const abandon = getAbandonRate(m.bids, m.abandonedBids).label;
    if (detailed) {
      return [
        m.no, m.name, m.mobileMasked, m.phoneFull ?? '-', m.email || '-', m.address || '-',
        m.gender ? GENDER_LABEL[m.gender] : '-', m.birthday || '-', LEVEL_LABEL[m.level], m.stars,
        formatSpend(m.spend), formatSpend(m.points), m.orders, m.bids, m.abandonedBids, abandon,
        boundChannels(m) || '-', formatLastOrderDate(m.createdAt), formatLastOrderDate(m.lastOrderAt), STATUS_LABEL[m.status],
      ];
    }
    return [
      m.no, m.name, m.mobileMasked, LEVEL_LABEL[m.level], m.stars, formatSpend(m.spend),
      m.bids, m.abandonedBids, abandon, formatLastOrderDate(m.lastOrderAt), STATUS_LABEL[m.status],
    ];
  };

  const body = [headers, ...members.map(lineOf)]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');

  // 加 BOM 讓 Excel 正確辨識 UTF-8
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `會員列表_${detailed ? '完整明細' : '基本'}_${dateStamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
