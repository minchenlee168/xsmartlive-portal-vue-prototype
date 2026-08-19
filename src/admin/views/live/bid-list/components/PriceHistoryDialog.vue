<script setup lang="ts">
/**
 * 歷史價格查詢 Dialog
 * — 語意：查商品的歷史成交價；資料單位為商品卡（場次 × 商品的成交紀錄）
 * — 即時查詢：選商品、改日期區間、改收單來源、改收單方式，任一異動即刻查詢
 * — 商品名稱輸入框旁提供「選擇商品」按鈕，開共用的 ProductPickerDialog
 * — 結果表格逐張列出商品卡（一列 = 一場次的商品成交紀錄）
 * — 統計摘要、趨勢圖與明細表同時顯示、匯出、跳場次、複製、排序、分頁
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import ProductPickerStubDialog, { type PickedProduct } from './ProductPickerStubDialog.vue';

/** 收單方式（進階篩選複選值） */
type OrderMethod = 'live' | 'post' | 'group';
/** 標單來源 */
type BidSource = 'fb' | 'ig' | 'tiktok' | 'livebuy';

interface Props {
  visible: boolean;
  /** 預帶：商品 ID；有值時開啟即以該商品開查 */
  preselectedProductId?: string | null;
  /** 預帶：場次名稱；有值時放入場次篩選 */
  preselectedSessionName?: string | null;
  /** 預帶：收單方式；有值時放入收單方式篩選 */
  preselectedOrderMethod?: OrderMethod | null;
  /** 預帶：收單來源；有值時放入收單來源篩選 */
  preselectedSource?: BidSource | null;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  preselectedProductId: null,
  preselectedSessionName: null,
  preselectedOrderMethod: null,
  preselectedSource: null,
});
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess, showInfo } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 標單狀態 */
type BidStatus = 'unfinished' | 'completed' | 'transferred' | 'discarded';

/** 歷史紀錄列 */
interface PriceHistoryRow {
  createdAt: string;
  productId: string;
  productImage: string;
  sessionName: string;
  productName: string;
  spec: string;
  bidAmount: number;
  winner: {
    socialId: string;
    memberId: string;
    memberName: string;
  };
  status: BidStatus;
  orderMethod: OrderMethod;
  source: BidSource;
}

/** 查詢條件：選商品／改日期／改場次／改收單來源／改收單方式，皆會即時反映到結果 */
const keywordInput = ref('');
/** 從「選擇商品」帶入的商品 ID（來自 ProductPickerDialog；null 表示尚未選擇） */
const selectedProductId = ref<number | null>(null);
const filterDateRange = ref<[Date | null, Date | null] | null>(null);
const filterSessions = ref<string[]>([]);
const filterSources = ref<BidSource[]>([]);
const filterOrderMethods = ref<OrderMethod[]>([]);

/** 分頁 + 排序 */
const page = ref(1);
const perPage = 10;
type SortField = 'createdAt' | 'bidAmount' | 'sessionName' | 'productId';
type SortDirection = 'asc' | 'desc';
const sortField = ref<SortField>('createdAt');
const sortDirection = ref<SortDirection>('desc');

const sourceOptions = computed(() => [
  { label: t('bid_list.price_history.source.fb'), value: 'fb' as BidSource },
  { label: t('bid_list.price_history.source.ig'), value: 'ig' as BidSource },
  { label: t('bid_list.price_history.source.tiktok'), value: 'tiktok' as BidSource },
  { label: t('bid_list.price_history.source.livebuy'), value: 'livebuy' as BidSource },
]);

const orderMethodMultiOptions = computed(() => [
  { label: t('bid_list.price_history.order_method.live'), value: 'live' as OrderMethod },
  { label: t('bid_list.price_history.order_method.post'), value: 'post' as OrderMethod },
  { label: t('bid_list.price_history.order_method.group'), value: 'group' as OrderMethod },
]);

/** 場次複選選項：從 baseRows 收斂出唯一場次名稱，依名稱排序 */
const sessionMultiOptions = computed(() => {
  const uniqueSessions = Array.from(new Set(baseRows.map((row) => row.sessionName)));
  uniqueSessions.sort((a, b) => a.localeCompare(b));
  return uniqueSessions.map((name) => ({ label: name, value: name }));
});

/** 進階篩選複選觸發鈕文字：有選取時顯示「收單來源（n）」 */
const sourceTriggerLabel = computed(() =>
  t('bid_list.price_history.advanced.trigger_label.source', { count: filterSources.value.length }),
);
const orderMethodTriggerLabel = computed(() =>
  t('bid_list.price_history.advanced.trigger_label.order_method', { count: filterOrderMethods.value.length }),
);
const sessionTriggerLabel = computed(() =>
  t('bid_list.price_history.advanced.trigger_label.session', { count: filterSessions.value.length }),
);

const SAMPLE_THUMB = 'https://placehold.co/64x64/e2e8f0/475569/png?text=Product';

/** 20 筆 mock 資料，涵蓋不同商品／規格／得標人／場次／收單方式／狀態／來源 */
const baseRows: PriceHistoryRow[] = [
  {
    createdAt: '2026-07-14 09:17:41',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '0114',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 5,
    winner: { socialId: 'anna.fb', memberId: 'M-1001', memberName: '安娜' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-01-14 11:17:29',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '0114',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 5,
    winner: { socialId: 'bella.ig', memberId: 'M-1002', memberName: '貝拉' },
    status: 'transferred',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2024-07-08 11:15:30',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '123',
    productName: '米色外衣_(s)',
    spec: 'S',
    bidAmount: 490,
    winner: { socialId: 'cindy.tt', memberId: 'M-1003', memberName: '欣蒂' },
    status: 'completed',
    orderMethod: 'post',
    source: 'tiktok',
  },
  {
    createdAt: '2024-02-02 11:39:01',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '123',
    productName: '米色外衣_(s)',
    spec: 'S',
    bidAmount: 490,
    winner: { socialId: 'diana.fb', memberId: 'M-1004', memberName: '黛安娜' },
    status: 'transferred',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2022-08-24 15:19:53',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: 'test123',
    productName: '2222',
    spec: 'L',
    bidAmount: 0,
    winner: { socialId: 'ella.ig', memberId: 'M-1005', memberName: '艾拉' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2022-08-15 14:57:03',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: 'ere',
    productName: '2222',
    spec: 'M',
    bidAmount: 0,
    winner: { socialId: 'flora.fb', memberId: 'M-1006', memberName: '芙蘿拉' },
    status: 'discarded',
    orderMethod: 'group',
    source: 'livebuy',
  },
  {
    createdAt: '2026-06-20 14:12:00',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '夏季新品',
    productName: '亞麻長褲',
    spec: 'L',
    bidAmount: 780,
    winner: { socialId: 'grace.lb', memberId: 'M-1007', memberName: '葛蕾絲' },
    status: 'completed',
    orderMethod: 'live',
    source: 'livebuy',
  },
  {
    createdAt: '2026-06-18 20:45:12',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '夏季新品',
    productName: '亞麻長褲',
    spec: 'M',
    bidAmount: 780,
    winner: { socialId: 'hannah.fb', memberId: 'M-1008', memberName: '漢娜' },
    status: 'transferred',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-06-15 09:03:22',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '夏季新品',
    productName: '亞麻長褲',
    spec: 'S',
    bidAmount: 820,
    winner: { socialId: 'ivy.ig', memberId: 'M-1009', memberName: '艾薇' },
    status: 'unfinished',
    orderMethod: 'post',
    source: 'ig',
  },
  {
    createdAt: '2026-05-30 21:08:45',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '週年慶',
    productName: '皮革手提包',
    spec: '棕色',
    bidAmount: 2680,
    winner: { socialId: 'jenny.fb', memberId: 'M-1010', memberName: '珍妮' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-05-28 22:15:33',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '週年慶',
    productName: '皮革手提包',
    spec: '黑色',
    bidAmount: 2680,
    winner: { socialId: 'karen.tt', memberId: 'M-1011', memberName: '凱倫' },
    status: 'completed',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2026-05-15 18:22:11',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '週年慶',
    productName: '皮革手提包',
    spec: '棕色',
    bidAmount: 2500,
    winner: { socialId: 'lily.fb', memberId: 'M-1012', memberName: '莉莉' },
    status: 'discarded',
    orderMethod: 'group',
    source: 'fb',
  },
  {
    createdAt: '2026-04-22 13:40:59',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '春裝出清',
    productName: '2222',
    spec: 'L',
    bidAmount: 150,
    winner: { socialId: 'mia.ig', memberId: 'M-1013', memberName: '米亞' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-04-10 10:11:08',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '春裝出清',
    productName: '2222',
    spec: 'S',
    bidAmount: 150,
    winner: { socialId: 'nina.fb', memberId: 'M-1014', memberName: '妮娜' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2026-03-14 16:52:38',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '會員專場',
    productName: '亞麻長褲',
    spec: 'M',
    bidAmount: 720,
    winner: { socialId: 'olivia.lb', memberId: 'M-1015', memberName: '奧莉薇' },
    status: 'completed',
    orderMethod: 'live',
    source: 'livebuy',
  },
  {
    createdAt: '2026-02-20 11:19:24',
    productId: '1234',
    productImage: SAMPLE_THUMB,
    sessionName: '福袋開賣',
    productName: '幸運福袋',
    spec: '標準',
    bidAmount: 1000,
    winner: { socialId: 'penny.tt', memberId: 'M-1016', memberName: '佩妮' },
    status: 'completed',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2026-02-15 19:33:47',
    productId: '1234',
    productImage: SAMPLE_THUMB,
    sessionName: '福袋開賣',
    productName: '幸運福袋',
    spec: '尊爵',
    bidAmount: 2000,
    winner: { socialId: 'queenie.fb', memberId: 'M-1017', memberName: '昆妮' },
    status: 'unfinished',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-01-30 08:44:15',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '冬末特賣',
    productName: '米色外衣',
    spec: 'L',
    bidAmount: 380,
    winner: { socialId: 'rachel.ig', memberId: 'M-1018', memberName: '瑞秋' },
    status: 'completed',
    orderMethod: 'post',
    source: 'ig',
  },
  {
    createdAt: '2025-12-01 22:03:56',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '年終回饋',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 420,
    winner: { socialId: 'sara.fb', memberId: 'M-1019', memberName: '莎拉' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'fb',
  },
  {
    createdAt: '2025-11-11 20:20:20',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '雙11大促',
    productName: '皮革手提包',
    spec: '黑色',
    bidAmount: 2380,
    winner: { socialId: 'tina.tt', memberId: 'M-1020', memberName: '緹娜' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'tiktok',
  },
  // ==== 擴充區塊 start（僅新增，不修改上方既有 rows） ====
  // ---- 123 米色外衣 +8 ----
  {
    createdAt: '2026-07-13 20:42:11',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日限定',
    productName: '米色外衣',
    spec: 'L',
    bidAmount: 520,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-07-05 14:08:22',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '週三夜市',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 480,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-06-22 19:45:03',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '米色外衣',
    spec: 'S',
    bidAmount: 460,
    winner: { socialId: 'yizhen.fb', memberId: 'M-1023', memberName: '宜蓁' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2026-05-30 10:12:47',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '米色外衣',
    spec: 'L',
    bidAmount: 450,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'completed',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2026-04-18 22:33:15',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 500,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'unfinished',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-03-02 15:20:39',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '早鳥搶購',
    productName: '米色外衣',
    spec: 'S',
    bidAmount: 470,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2025-10-14 21:05:58',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '秋季新款',
    productName: '米色外衣',
    spec: 'L',
    bidAmount: 550,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'completed',
    orderMethod: 'group',
    source: 'fb',
  },
  {
    createdAt: '2025-08-05 13:47:26',
    productId: '123',
    productImage: SAMPLE_THUMB,
    sessionName: '回娘家專場',
    productName: '米色外衣',
    spec: 'M',
    bidAmount: 530,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'completed',
    orderMethod: 'live',
    source: 'livebuy',
  },
  // ---- 456 2222 +4 ----
  {
    createdAt: '2026-07-10 16:22:08',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '週三夜市',
    productName: '2222',
    spec: 'L',
    bidAmount: 320,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-05-08 11:03:41',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '2222',
    spec: 'M',
    bidAmount: 300,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2025-11-25 19:18:29',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '感恩節',
    productName: '2222',
    spec: 'S',
    bidAmount: 290,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'unfinished',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2025-06-14 09:55:17',
    productId: '456',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日開賣',
    productName: '2222',
    spec: 'M',
    bidAmount: 280,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  // ---- 789 亞麻長褲 +6 ----
  {
    createdAt: '2026-07-12 18:35:04',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日限定',
    productName: '亞麻長褲',
    spec: 'L',
    bidAmount: 780,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-06-28 20:14:52',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '亞麻長褲',
    spec: 'M',
    bidAmount: 820,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'tiktok',
  },
  {
    createdAt: '2026-05-15 12:47:31',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '亞麻長褲',
    spec: 'S',
    bidAmount: 720,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'completed',
    orderMethod: 'post',
    source: 'ig',
  },
  {
    createdAt: '2026-03-11 21:08:14',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '早鳥搶購',
    productName: '亞麻長褲',
    spec: 'M',
    bidAmount: 800,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2025-12-24 22:56:47',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '聖誕限定',
    productName: '亞麻長褲',
    spec: 'L',
    bidAmount: 750,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2025-09-08 14:32:19',
    productId: '789',
    productImage: SAMPLE_THUMB,
    sessionName: '秋季新款',
    productName: '亞麻長褲',
    spec: 'M',
    bidAmount: 830,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'transferred',
    orderMethod: 'live',
    source: 'fb',
  },
  // ---- 1001 皮革手提包 +4 ----
  {
    createdAt: '2026-07-09 15:50:36',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '週三夜市',
    productName: '皮革手提包',
    spec: '駝色',
    bidAmount: 2450,
    winner: { socialId: 'yizhen.fb', memberId: 'M-1023', memberName: '宜蓁' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-06-05 19:24:11',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '皮革手提包',
    spec: '黑色',
    bidAmount: 2400,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'unfinished',
    orderMethod: 'post',
    source: 'livebuy',
  },
  {
    createdAt: '2026-02-14 20:11:38',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '情人節精選',
    productName: '皮革手提包',
    spec: '酒紅',
    bidAmount: 2500,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'tiktok',
  },
  {
    createdAt: '2025-10-01 11:38:29',
    productId: '1001',
    productImage: SAMPLE_THUMB,
    sessionName: '秋季新款',
    productName: '皮革手提包',
    spec: '黑色',
    bidAmount: 2350,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  // ---- 1234 幸運福袋 +3 ----
  {
    createdAt: '2026-07-01 21:12:03',
    productId: '1234',
    productImage: SAMPLE_THUMB,
    sessionName: '預購倒數',
    productName: '幸運福袋',
    spec: '綜合款',
    bidAmount: 990,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'completed',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2026-04-02 10:44:56',
    productId: '1234',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '幸運福袋',
    spec: '女款',
    bidAmount: 950,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'fb',
  },
  {
    createdAt: '2026-01-25 22:38:41',
    productId: '1234',
    productImage: SAMPLE_THUMB,
    sessionName: '新春開運',
    productName: '幸運福袋',
    spec: '男款',
    bidAmount: 1080,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'post',
    source: 'ig',
  },
  // ---- 2001 珍珠耳環 6 筆 ----
  {
    createdAt: '2026-07-08 19:20:15',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日限定',
    productName: '珍珠耳環',
    spec: '單顆',
    bidAmount: 980,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-06-16 20:03:47',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '直播感恩會',
    productName: '珍珠耳環',
    spec: '雙顆垂墜',
    bidAmount: 1180,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-05-02 14:26:18',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '珍珠耳環',
    spec: '單顆',
    bidAmount: 890,
    winner: { socialId: 'yizhen.fb', memberId: 'M-1023', memberName: '宜蓁' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2026-02-08 21:47:35',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '情人節精選',
    productName: '珍珠耳環',
    spec: '雙顆垂墜',
    bidAmount: 1200,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'unfinished',
    orderMethod: 'live',
    source: 'livebuy',
  },
  {
    createdAt: '2025-11-30 18:12:59',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '感恩節',
    productName: '珍珠耳環',
    spec: '單顆',
    bidAmount: 850,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'completed',
    orderMethod: 'group',
    source: 'tiktok',
  },
  {
    createdAt: '2025-08-19 20:55:22',
    productId: '2001',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日開賣',
    productName: '珍珠耳環',
    spec: '單顆',
    bidAmount: 950,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'ig',
  },
  // ---- 2002 純棉 T 恤 8 筆（明顯降價：350→320→280→250→220） ----
  {
    createdAt: '2026-07-14 12:03:29',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日限定',
    productName: '純棉T恤',
    spec: 'M / 白',
    bidAmount: 220,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-07-07 15:31:44',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '週三夜市',
    productName: '純棉T恤',
    spec: 'L / 黑',
    bidAmount: 250,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-06-10 19:48:57',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '純棉T恤',
    spec: 'M / 灰',
    bidAmount: 280,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'fb',
  },
  {
    createdAt: '2026-05-20 14:15:08',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '純棉T恤',
    spec: 'S / 白',
    bidAmount: 320,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'unfinished',
    orderMethod: 'post',
    source: 'tiktok',
  },
  {
    createdAt: '2026-04-30 20:39:11',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '純棉T恤',
    spec: 'L / 白',
    bidAmount: 320,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-03-25 11:52:36',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '早鳥搶購',
    productName: '純棉T恤',
    spec: 'M / 黑',
    bidAmount: 350,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2025-12-30 22:07:43',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '跨年下殺',
    productName: '純棉T恤',
    spec: 'L / 黑',
    bidAmount: 350,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2025-08-28 16:24:52',
    productId: '2002',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日開賣',
    productName: '純棉T恤',
    spec: 'M / 白',
    bidAmount: 350,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'transferred',
    orderMethod: 'live',
    source: 'livebuy',
  },
  // ---- 2003 運動短褲 5 筆 ----
  {
    createdAt: '2026-07-11 18:47:03',
    productId: '2003',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日限定',
    productName: '運動短褲',
    spec: 'M',
    bidAmount: 620,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-06-19 13:09:28',
    productId: '2003',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '運動短褲',
    spec: 'L',
    bidAmount: 680,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2026-04-25 21:32:14',
    productId: '2003',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '運動短褲',
    spec: 'S',
    bidAmount: 580,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'completed',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2026-01-19 17:44:07',
    productId: '2003',
    productImage: SAMPLE_THUMB,
    sessionName: '早鳥搶購',
    productName: '運動短褲',
    spec: 'M',
    bidAmount: 700,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2025-10-22 19:03:51',
    productId: '2003',
    productImage: SAMPLE_THUMB,
    sessionName: '秋季新款',
    productName: '運動短褲',
    spec: 'L',
    bidAmount: 650,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'group',
    source: 'ig',
  },
  // ---- 2004 皮帶 4 筆 ----
  {
    createdAt: '2026-06-25 14:52:19',
    productId: '2004',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '皮帶',
    spec: '棕色',
    bidAmount: 1180,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'completed',
    orderMethod: 'live',
    source: 'livebuy',
  },
  {
    createdAt: '2026-05-11 20:19:37',
    productId: '2004',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '皮帶',
    spec: '黑色',
    bidAmount: 950,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'tiktok',
  },
  {
    createdAt: '2026-03-19 12:41:22',
    productId: '2004',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '皮帶',
    spec: '棕色',
    bidAmount: 1050,
    winner: { socialId: 'yizhen.fb', memberId: 'M-1023', memberName: '宜蓁' },
    status: 'unfinished',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2025-09-24 16:28:03',
    productId: '2004',
    productImage: SAMPLE_THUMB,
    sessionName: '畢業季',
    productName: '皮帶',
    spec: '黑色',
    bidAmount: 1200,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  // ---- 2005 針織帽 3 筆 ----
  {
    createdAt: '2026-04-08 22:16:44',
    productId: '2005',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '針織帽',
    spec: '米白',
    bidAmount: 420,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2025-12-08 19:37:11',
    productId: '2005',
    productImage: SAMPLE_THUMB,
    sessionName: '聖誕限定',
    productName: '針織帽',
    spec: '灰色',
    bidAmount: 450,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2025-11-05 15:04:28',
    productId: '2005',
    productImage: SAMPLE_THUMB,
    sessionName: '秋冬預熱',
    productName: '針織帽',
    spec: '黑色',
    bidAmount: 380,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'ig',
  },
  // ---- 2006 蕾絲洋裝 6 筆 ----
  {
    createdAt: '2026-06-30 20:48:15',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '蕾絲洋裝',
    spec: 'M / 白',
    bidAmount: 1980,
    winner: { socialId: 'yuting.fb', memberId: 'M-1021', memberName: '郁婷' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-05-25 21:15:39',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '蕾絲洋裝',
    spec: 'S / 黑',
    bidAmount: 2280,
    winner: { socialId: 'jieyu.livebuy', memberId: 'M-1027', memberName: '婕妤' },
    status: 'completed',
    orderMethod: 'live',
    source: 'livebuy',
  },
  {
    createdAt: '2026-03-30 19:22:47',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '春夏新品',
    productName: '蕾絲洋裝',
    spec: 'M / 粉',
    bidAmount: 2100,
    winner: { socialId: 'shihan.ig', memberId: 'M-1025', memberName: '詩涵' },
    status: 'transferred',
    orderMethod: 'group',
    source: 'ig',
  },
  {
    createdAt: '2026-02-20 14:38:52',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '情人節精選',
    productName: '蕾絲洋裝',
    spec: 'S / 白',
    bidAmount: 2400,
    winner: { socialId: 'peishan.tt', memberId: 'M-1024', memberName: '佩珊' },
    status: 'unfinished',
    orderMethod: 'post',
    source: 'tiktok',
  },
  {
    createdAt: '2025-10-30 22:47:19',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '秋季新款',
    productName: '蕾絲洋裝',
    spec: 'L / 黑',
    bidAmount: 2200,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'tiktok',
  },
  {
    createdAt: '2025-07-22 20:11:34',
    productId: '2006',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日開賣',
    productName: '蕾絲洋裝',
    spec: 'M / 白',
    bidAmount: 1850,
    winner: { socialId: 'yaqi.ig', memberId: 'M-1022', memberName: '雅琪' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  // ---- 2007 帆布鞋 5 筆 ----
  {
    createdAt: '2026-07-06 17:29:11',
    productId: '2007',
    productImage: SAMPLE_THUMB,
    sessionName: '週三夜市',
    productName: '帆布鞋',
    spec: '23 / 白',
    bidAmount: 1280,
    winner: { socialId: 'jiaying.fb', memberId: 'M-1026', memberName: '佳穎' },
    status: 'completed',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2026-06-12 19:53:42',
    productId: '2007',
    productImage: SAMPLE_THUMB,
    sessionName: '品牌快閃',
    productName: '帆布鞋',
    spec: '24 / 黑',
    bidAmount: 1350,
    winner: { socialId: 'yizhen.fb', memberId: 'M-1023', memberName: '宜蓁' },
    status: 'transferred',
    orderMethod: 'post',
    source: 'fb',
  },
  {
    createdAt: '2026-05-18 21:04:28',
    productId: '2007',
    productImage: SAMPLE_THUMB,
    sessionName: '母親節專題',
    productName: '帆布鞋',
    spec: '25 / 白',
    bidAmount: 1200,
    winner: { socialId: 'yunru.ig', memberId: 'M-1028', memberName: '韻如' },
    status: 'completed',
    orderMethod: 'live',
    source: 'ig',
  },
  {
    createdAt: '2026-03-05 15:36:57',
    productId: '2007',
    productImage: SAMPLE_THUMB,
    sessionName: '早鳥搶購',
    productName: '帆布鞋',
    spec: '23 / 黑',
    bidAmount: 1420,
    winner: { socialId: 'wanru.fb', memberId: 'M-1029', memberName: '宛儒' },
    status: 'discarded',
    orderMethod: 'live',
    source: 'fb',
  },
  {
    createdAt: '2025-08-11 20:22:16',
    productId: '2007',
    productImage: SAMPLE_THUMB,
    sessionName: '夏日開賣',
    productName: '帆布鞋',
    spec: '24 / 白',
    bidAmount: 1500,
    winner: { socialId: 'shufen.tt', memberId: 'M-1030', memberName: '淑芬' },
    status: 'completed',
    orderMethod: 'group',
    source: 'tiktok',
  },
  // ==== 擴充區塊 end ====
];

/** 以 mock 最新資料日期為基準日，計算預設日期區間 */
const ANCHOR_DATE = new Date('2026-07-14T23:59:59');

/** 產生預設日期區間：以 ANCHOR_DATE 為迄日，往前推 3 個月為起日 */
function buildDefaultDateRange(): [Date, Date] {
  const end = new Date(ANCHOR_DATE);
  end.setHours(23, 59, 59, 999);
  const start = new Date(ANCHOR_DATE);
  start.setMonth(start.getMonth() - 3);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

/** 是否已選擇商品；沒選之前不查詢，畫面顯示提示 */
const hasSelectedProduct = computed(() => selectedProductId.value !== null);

/**
 * 過濾流程：必先選擇商品 → 時間 → 收單來源 → 收單方式。
 * 未選商品時直接回空陣列，讓表格顯示「請先選擇商品」提示。
 */
const filteredRows = computed<PriceHistoryRow[]>(() => {
  if (selectedProductId.value === null) {
    return [];
  }

  const productIdText = String(selectedProductId.value);
  let list = baseRows.filter((row) => row.productId === productIdText);

  // 場次（多選；若有選則保留有匹配的列）
  if (filterSessions.value.length > 0) {
    const sessions = new Set(filterSessions.value);
    list = list.filter((row) => sessions.has(row.sessionName));
  }

  // 時間區間（起訖任一或皆有值都做對應過濾）
  const rangeValue = filterDateRange.value;
  const startDate = rangeValue?.[0] ?? null;
  const endDate = rangeValue?.[1] ?? null;
  if (startDate || endDate) {
    const startMs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
    list = list.filter((row) => {
      const rowMs = new Date(row.createdAt).getTime();
      if (startMs !== null && rowMs < startMs) return false;
      if (endMs !== null && rowMs > endMs) return false;
      return true;
    });
  }

  // 收單來源
  if (filterSources.value.length > 0) {
    const sources = new Set(filterSources.value);
    list = list.filter((row) => sources.has(row.source));
  }

  // 收單方式
  if (filterOrderMethods.value.length > 0) {
    const methods = new Set(filterOrderMethods.value);
    list = list.filter((row) => methods.has(row.orderMethod));
  }

  return list;
});

/** 排序後的完整列表 */
const sortedRows = computed<PriceHistoryRow[]>(() => {
  const list = [...filteredRows.value];
  const direction = sortDirection.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let compareResult = 0;
    switch (sortField.value) {
      case 'bidAmount':
        compareResult = a.bidAmount - b.bidAmount;
        break;
      case 'sessionName':
        compareResult = a.sessionName.localeCompare(b.sessionName);
        break;
      case 'productId':
        compareResult = a.productId.localeCompare(b.productId);
        break;
      case 'createdAt':
      default:
        compareResult = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
        break;
    }
    return compareResult * direction;
  });
  return list;
});

/** 目前頁列表（表格檢視、不分組時使用） */
const paginatedRows = computed<PriceHistoryRow[]>(() => {
  const start = (page.value - 1) * perPage;
  return sortedRows.value.slice(start, start + perPage);
});

const totalRecords = computed(() => sortedRows.value.length);

/** 統計摘要 */
interface SummaryStats {
  count: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
  discardRate: number;
}

const summary = computed<SummaryStats>(() => {
  const list = sortedRows.value;
  if (list.length === 0) {
    return {
      count: 0,
      averageAmount: 0,
      maxAmount: 0,
      minAmount: 0,
      discardRate: 0,
    };
  }
  // 成交金額只計非棄標
  const settled = list.filter((row) => row.status !== 'discarded');
  const settledAmounts = settled.map((row) => row.bidAmount);
  const totalAmount = settledAmounts.reduce((sum, value) => sum + value, 0);
  const averageAmount = settledAmounts.length > 0 ? totalAmount / settledAmounts.length : 0;
  const maxAmount = settledAmounts.length > 0 ? Math.max(...settledAmounts) : 0;
  const minAmount = settledAmounts.length > 0 ? Math.min(...settledAmounts) : 0;
  const discardCount = list.filter((row) => row.status === 'discarded').length;
  const discardRate = list.length > 0 ? (discardCount / list.length) * 100 : 0;
  return {
    count: list.length,
    averageAmount,
    maxAmount,
    minAmount,
    discardRate,
  };
});

/** 圖表資料：單一商品的歷史拍賣價格趨勢（一條線）；X 軸為建立時間、Y 軸為拍賣金額，排除棄標 */
interface ChartDataset {
  label: string;
  data: Array<{ x: string; y: number }>;
  borderColor: string;
  backgroundColor: string;
  tension: number;
  fill: boolean;
}

const CHART_LINE_COLOR = '#6366f1';

const chartData = computed(() => {
  // 排除棄標，並依時間由舊到新排序，組成單一 dataset
  const points = sortedRows.value
    .filter((row) => row.status !== 'discarded')
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((row) => ({ x: row.createdAt, y: row.bidAmount }));

  // dataset label：優先使用當前查詢關鍵字，其次使用第一筆的商品名稱，最後 fallback 到 i18n 預設
  const keyword = keywordInput.value.trim();
  const firstProductName = sortedRows.value[0]?.productName ?? '';
  const label =
    keyword ||
    firstProductName ||
    t('bid_list.price_history.chart.dataset_label');

  const datasets: ChartDataset[] = [
    {
      label,
      data: points,
      borderColor: CHART_LINE_COLOR,
      backgroundColor: CHART_LINE_COLOR,
      tension: 0.25,
      fill: false,
    },
  ];
  return { datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
  },
  scales: {
    x: {
      type: 'category' as const,
      title: { display: true, text: t('bid_list.price_history.chart.x_axis') },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: t('bid_list.price_history.chart.y_axis') },
    },
  },
}));

/** 清除全部條件：回到預設（keyword 空、日期預設近 3 個月、多選清空） */
function handleClearAll() {
  keywordInput.value = '';
  selectedProductId.value = null;
  filterDateRange.value = buildDefaultDateRange();
  filterSessions.value = [];
  filterSources.value = [];
  filterOrderMethods.value = [];
  page.value = 1;
  showInfo({ detail: t('bid_list.price_history.toast.cleared') });
}

/** 選擇商品：開本地商品選擇 stub 視窗 */
const isPickerVisible = ref(false);
function handlePickProduct() {
  isPickerVisible.value = true;
}

/** 從 stub 選到商品：把商品名稱填入搜尋框、記下商品 ID */
function handleProductPicked(product: PickedProduct) {
  keywordInput.value = product.name;
  selectedProductId.value = product.id;
}

/** 排序：同一欄再點切換方向；不同欄改回預設遞減 */
function handleSort(field: SortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'desc';
  }
}

/** 匯出（mock） */
function handleExport() {
  showSuccess({ detail: t('bid_list.price_history.toast.exported') });
}

/** 跳場次（mock） */
function handleGoSession(row: PriceHistoryRow) {
  showInfo({ detail: t('bid_list.price_history.toast.go_session', { session: row.sessionName }) });
}

/** 複製此價格（mock） */
function handleCopyPrice(row: PriceHistoryRow) {
  showSuccess({ detail: t('bid_list.price_history.toast.price_copied', { amount: row.bidAmount }) });
}

function orderMethodLabel(value: OrderMethod): string {
  return t(`bid_list.price_history.order_method.${value}`);
}

function sourceLabel(value: BidSource): string {
  return t(`bid_list.price_history.source.${value}`);
}

function sortIconClass(field: SortField): [string, string] {
  if (sortField.value !== field) return ['fas', 'arrows-up-down'];
  return ['fas', sortDirection.value === 'asc' ? 'arrow-up' : 'arrow-down'];
}

function handlePageChange(event: { page: number; rows: number }) {
  page.value = event.page + 1;
}

/**
 * dialog 開啟時 reset 到預設條件（日期預設近 3 個月、其餘清空），
 * 若父層有帶 preselected*，開啟後即以帶入值當作起始篩選。
 */
watch(localVisible, (isOpen) => {
  if (!isOpen) {
    return;
  }
  keywordInput.value = '';
  selectedProductId.value = null;
  filterDateRange.value = buildDefaultDateRange();
  filterSessions.value = [];
  filterSources.value = [];
  filterOrderMethods.value = [];
  page.value = 1;
  sortField.value = 'createdAt';
  sortDirection.value = 'desc';

  // 預帶：商品 ID（同步以 baseRows 找到該商品名稱填入搜尋框）
  if (props.preselectedProductId) {
    const productIdNumber = Number(props.preselectedProductId);
    if (Number.isFinite(productIdNumber)) {
      selectedProductId.value = productIdNumber;
      const matched = baseRows.find((row) => row.productId === props.preselectedProductId);
      keywordInput.value = matched?.productName ?? '';
    }
  }
  // 預帶：場次名稱
  if (props.preselectedSessionName) {
    filterSessions.value = [props.preselectedSessionName];
  }
  // 預帶：收單方式
  if (props.preselectedOrderMethod) {
    filterOrderMethods.value = [props.preselectedOrderMethod];
  }
  // 預帶：收單來源
  if (props.preselectedSource) {
    filterSources.value = [props.preselectedSource];
  }
});

/** 任一查詢條件變動 → 分頁回第一頁，避免停在超出範圍的頁次 */
watch(
  [selectedProductId, keywordInput, filterDateRange, filterSessions, filterSources, filterOrderMethods],
  () => {
    page.value = 1;
  },
);
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.price_history.title')"
    :style="{ width: '80rem', maxWidth: '96vw' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 搜尋列：選商品、日期區間 -->
      <div class="flex flex-wrap items-center gap-2">
        <InputText
          v-model="keywordInput"
          :placeholder="t('bid_list.price_history.placeholder')"
          class="w-72"
          readonly
        />
        <Button
          type="button"
          severity="primary"
          outlined
          :label="keywordInput ? t('bid_list.price_history.button.change_product') : t('bid_list.price_history.button.pick_product')"
          @click="handlePickProduct"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['fas', 'magnifying-glass']" />
          </template>
        </Button>
        <!-- 日期區間（起訖，預設近 3 個月） -->
        <DatePicker
          v-model="filterDateRange"
          selection-mode="range"
          date-format="yy/mm/dd"
          :placeholder="t('bid_list.price_history.advanced.placeholder.date_range')"
          show-icon
          :manual-input="true"
          class="w-72"
        />
      </div>

      <!-- 進階篩選：一排下拉平鋪（對齊得標清單頁樣式） -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- 場次複選 -->
        <MultiSelect
          v-model="filterSessions"
          :options="sessionMultiOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('bid_list.price_history.advanced.placeholder.session')"
          :show-toggle-all="false"
          :max-selected-labels="0"
          :selected-items-label="sessionTriggerLabel"
          filter
          class="w-48"
        >
          <template #header>
            <button
              v-if="filterSessions.length > 0"
              type="button"
              class="flex w-full items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm text-primary-600 hover:bg-slate-50 dark:border-slate-700 dark:text-primary-400 dark:hover:bg-slate-800"
              @click="filterSessions = []"
            >
              <FontAwesomeIcon :icon="['fas', 'xmark']" />
              {{ t('bid_list.price_history.advanced.clear_multi', { count: filterSessions.length }) }}
            </button>
          </template>
        </MultiSelect>

        <!-- 收單來源複選 -->
        <MultiSelect
          v-model="filterSources"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('bid_list.price_history.advanced.placeholder.source')"
          :show-toggle-all="false"
          :max-selected-labels="0"
          :selected-items-label="sourceTriggerLabel"
          class="w-40"
        >
          <template #header>
            <button
              v-if="filterSources.length > 0"
              type="button"
              class="flex w-full items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm text-primary-600 hover:bg-slate-50 dark:border-slate-700 dark:text-primary-400 dark:hover:bg-slate-800"
              @click="filterSources = []"
            >
              <FontAwesomeIcon :icon="['fas', 'xmark']" />
              {{ t('bid_list.price_history.advanced.clear_multi', { count: filterSources.length }) }}
            </button>
          </template>
        </MultiSelect>

        <!-- 收單方式複選 -->
        <MultiSelect
          v-model="filterOrderMethods"
          :options="orderMethodMultiOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('bid_list.price_history.advanced.placeholder.order_method')"
          :show-toggle-all="false"
          :max-selected-labels="0"
          :selected-items-label="orderMethodTriggerLabel"
          class="w-40"
        >
          <template #header>
            <button
              v-if="filterOrderMethods.length > 0"
              type="button"
              class="flex w-full items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm text-primary-600 hover:bg-slate-50 dark:border-slate-700 dark:text-primary-400 dark:hover:bg-slate-800"
              @click="filterOrderMethods = []"
            >
              <FontAwesomeIcon :icon="['fas', 'xmark']" />
              {{ t('bid_list.price_history.advanced.clear_multi', { count: filterOrderMethods.length }) }}
            </button>
          </template>
        </MultiSelect>

        <!-- 匯出／清除（查詢即時，不需套用按鈕） -->
        <div class="ml-auto flex items-center gap-2">
          <Button
            type="button"
            severity="success"
            :label="t('bid_list.price_history.button.export')"
            @click="handleExport"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['fas', 'arrow-down']" />
            </template>
          </Button>
          <Button
            type="button"
            severity="secondary"
            variant="text"
            :label="t('bid_list.price_history.button.clear')"
            @click="handleClearAll"
          />
        </div>
      </div>

        <template v-if="totalRecords > 0">
          <!-- 統計摘要卡片列（筆數、平均、最高、最低、棄標率） -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.price_history.summary.count') }}
              </p>
              <p class="text-lg font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                {{ summary.count.toLocaleString() }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.price_history.summary.average') }}
              </p>
              <p class="text-lg font-semibold text-primary-600 dark:text-primary-400 tabular-nums">
                $ {{ Math.round(summary.averageAmount).toLocaleString() }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.price_history.summary.max') }}
              </p>
              <p class="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                $ {{ summary.maxAmount.toLocaleString() }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.price_history.summary.min') }}
              </p>
              <p class="text-lg font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                $ {{ summary.minAmount.toLocaleString() }}
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('bid_list.price_history.summary.discard_rate') }}
              </p>
              <p class="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                {{ summary.discardRate.toFixed(1) }}%
              </p>
            </div>
          </div>

        </template>

        <!-- 空狀態：未選商品 → 提示先選商品；已選但無結果 → 查無資料 -->
        <div
          v-if="totalRecords === 0"
          class="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-12"
        >
          <FontAwesomeIcon
            :icon="['fas', 'circle-info']"
            class="text-xl text-slate-300 dark:text-slate-600"
          />
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ hasSelectedProduct
              ? t('bid_list.price_history.empty')
              : t('bid_list.price_history.hint.please_pick_product') }}
          </p>
        </div>

        <!-- 有結果：趨勢圖（上）＋ 明細表（下） -->
        <template v-else>
          <!-- 趨勢圖：單一商品的歷史拍賣價格趨勢（一條線） -->
          <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div class="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {{ t('bid_list.price_history.chart.title') }}
            </div>
            <div class="h-80">
              <Chart
                type="line"
                :data="chartData"
                :options="chartOptions"
                class="h-full w-full"
              />
            </div>
          </div>

          <!-- 明細表（逐張商品卡） -->
          <div
            class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
          >
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th
                  class="px-3 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none"
                  @click="handleSort('createdAt')"
                >
                  {{ t('bid_list.price_history.column.created_at') }}
                  <FontAwesomeIcon
                    :icon="sortIconClass('createdAt')"
                    class="ml-1 text-slate-400"
                  />
                </th>
                <th class="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  {{ t('bid_list.price_history.column.order_method') }}
                </th>
                <th class="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  {{ t('bid_list.price_history.column.source') }}
                </th>
                <th
                  class="px-3 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none"
                  @click="handleSort('sessionName')"
                >
                  {{ t('bid_list.price_history.column.session') }}
                  <FontAwesomeIcon
                    :icon="sortIconClass('sessionName')"
                    class="ml-1 text-slate-400"
                  />
                </th>
                <th class="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  {{ t('bid_list.price_history.column.image') }}
                </th>
                <th
                  class="px-3 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none"
                  @click="handleSort('productId')"
                >
                  {{ t('bid_list.price_history.column.product_id') }}
                  <FontAwesomeIcon
                    :icon="sortIconClass('productId')"
                    class="ml-1 text-slate-400"
                  />
                </th>
                <th class="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  {{ t('bid_list.price_history.column.spec') }}
                </th>
                <th
                  class="px-3 py-3 text-right font-semibold whitespace-nowrap cursor-pointer select-none"
                  @click="handleSort('bidAmount')"
                >
                  {{ t('bid_list.price_history.column.bid_amount') }}
                  <FontAwesomeIcon
                    :icon="sortIconClass('bidAmount')"
                    class="ml-1 text-slate-400"
                  />
                </th>
                <th class="px-3 py-3 text-right font-semibold whitespace-nowrap">
                  {{ t('bid_list.price_history.column.actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in paginatedRows"
                :key="index"
                class="border-t border-slate-100 dark:border-slate-800 align-middle hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td class="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">
                  {{ row.createdAt }}
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {{ orderMethodLabel(row.orderMethod) }}
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {{ sourceLabel(row.source) }}
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                  <span class="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {{ row.sessionName }}
                  </span>
                </td>
                <td class="px-3 py-3">
                  <img
                    :src="row.productImage"
                    :alt="row.productName"
                    class="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">
                  {{ row.productId }}
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                  {{ row.spec }}
                </td>
                <td class="px-3 py-3 text-right font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap tabular-nums">
                  $ {{ row.bidAmount.toLocaleString() }}
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-right">
                  <div class="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      severity="secondary"
                      text
                      size="small"
                      v-tooltip.top="t('bid_list.price_history.action.go_session')"
                      :aria-label="t('bid_list.price_history.action.go_session')"
                      @click="handleGoSession(row)"
                    >
                      <template #icon>
                        <FontAwesomeIcon :icon="['fas', 'arrow-up-right-from-square']" />
                      </template>
                    </Button>
                    <Button
                      type="button"
                      severity="secondary"
                      text
                      size="small"
                      v-tooltip.top="t('bid_list.price_history.action.copy_price')"
                      :aria-label="t('bid_list.price_history.action.copy_price')"
                      @click="handleCopyPrice(row)"
                    >
                      <template #icon>
                        <FontAwesomeIcon :icon="['fas', 'copy']" />
                      </template>
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- 分頁器（超過每頁筆數才顯示，僅影響明細表） -->
          <Paginator
            v-if="totalRecords > perPage"
            :rows="perPage"
            :total-records="totalRecords"
            :first="(page - 1) * perPage"
            @page="handlePageChange"
          />
        </template>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.price_history.button.close') }}
      </Button>
    </template>

  </Dialog>

  <!-- 選擇商品 stub（prototype 版；正式版用共用 ProductPickerDialog） -->
  <ProductPickerStubDialog
    v-model:visible="isPickerVisible"
    @select="handleProductPicked"
  />
</template>
