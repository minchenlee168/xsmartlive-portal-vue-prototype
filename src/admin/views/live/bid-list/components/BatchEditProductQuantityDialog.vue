<script setup lang="ts">
/**
 * 群組視圖「批次編輯」對話框（對照舊系統 saleOrderList 以同得標場次方式顯示 → 批次編輯）
 * — 分類 accordion 內每個商品用步進器調整數量
 * — 上方支援搜尋（商品編號 / 商品名稱）
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

interface Props {
  visible: boolean;
  sessionName?: string;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'save'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

type SearchType = 'productCode' | 'productName';

interface ProductItem {
  code: string;
  name: string;
}

interface CategoryData {
  name: string;
  products: ProductItem[];
}

/** mock 分類與商品（對照截圖 #41 的肉類 + 其他分類補示範項目） */
const categories: CategoryData[] = [
  {
    name: '肉類',
    products: [
      { code: 'M-001', name: '帶骨牛小排' },
      { code: 'M-002', name: '紐約克' },
      { code: 'M-003', name: '骰子牛' },
      { code: 'M-004', name: '比臉大牛排' },
      { code: 'M-005', name: '戰斧丁骨牛排' },
      { code: 'M-006', name: '紐西蘭小羊排' },
      { code: 'M-007', name: '頂級無骨牛小排' },
      { code: 'M-008', name: '123' },
      { code: 'M-009', name: '松阪豬肉300G' },
    ],
  },
  {
    name: '海鮮',
    products: [
      { code: 'S-001', name: '鮭魚厚切' },
      { code: 'S-002', name: '鱸魚整尾' },
      { code: 'S-003', name: '鮑魚 6P' },
      { code: 'S-004', name: '生蠔一打' },
      { code: 'S-005', name: '波士頓龍蝦' },
    ],
  },
  {
    name: '炸物',
    products: [
      { code: 'F-001', name: '黃金脆皮炸雞' },
      { code: 'F-002', name: '起司薯條' },
      { code: 'F-003', name: '洋蔥圈' },
      { code: 'F-004', name: '芝士熱狗' },
    ],
  },
  {
    name: '1212',
    products: [
      { code: '1212-A', name: '雙 12 限定 A' },
      { code: '1212-B', name: '雙 12 限定 B' },
      { code: '1212-C', name: '雙 12 限定 C' },
    ],
  },
  {
    name: 'ee',
    products: [
      { code: 'EE-001', name: '試玩商品 X' },
      { code: 'EE-002', name: '試玩商品 Y' },
    ],
  },
];

/** 步進器數量 state，key = product code */
const quantities = reactive<Record<string, number>>({});

/** 每個分類展開/收合狀態，key = category name（預設「肉類」展開，其他收合） */
const expandedMap = reactive<Record<string, boolean>>({});

/** 搜尋類型 */
const searchType = ref<SearchType>('productCode');
/** 搜尋關鍵字 */
const keyword = ref<string>('');
/** 已套用的搜尋關鍵字（按查詢後才觸發過濾） */
const appliedKeyword = ref<string>('');

const searchTypeOptions = computed(() => [
  { value: 'productCode', label: t('bid_list.batch_edit_qty.search.type.product_code') },
  { value: 'productName', label: t('bid_list.batch_edit_qty.search.type.product_name') },
]);

/** 初始化步進器數量與展開狀態；dialog 開起來時執行 */
function initState() {
  for (const category of categories) {
    if (!(category.name in expandedMap)) {
      expandedMap[category.name] = category.name === '肉類';
    }
    for (const product of category.products) {
      if (!(product.code in quantities)) {
        quantities[product.code] = 0;
      }
    }
  }
}
initState();

watch(
  () => props.visible,
  (value) => {
    if (value) {
      appliedKeyword.value = '';
      keyword.value = '';
    }
  },
);

/** 依 appliedKeyword + searchType 過濾後的分類 */
const filteredCategories = computed(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  if (!kw) return categories;
  return categories
    .map((category) => {
      const matched = category.products.filter((product) => {
        const target = searchType.value === 'productCode' ? product.code : product.name;
        return target.toLowerCase().includes(kw);
      });
      return { ...category, products: matched };
    })
    .filter((category) => category.products.length > 0);
});

const totalMatchedCount = computed(() =>
  filteredCategories.value.reduce((sum, category) => sum + category.products.length, 0),
);

function expandAll() {
  for (const category of filteredCategories.value) {
    expandedMap[category.name] = true;
  }
}
function collapseAll() {
  for (const category of filteredCategories.value) {
    expandedMap[category.name] = false;
  }
}
function toggleCategory(name: string) {
  expandedMap[name] = !expandedMap[name];
}
function increment(code: string) {
  quantities[code] = (quantities[code] ?? 0) + 1;
}
function decrement(code: string) {
  quantities[code] = Math.max(0, (quantities[code] ?? 0) - 1);
}
function handleQuantityInput(code: string, value: string) {
  const parsed = Number(value);
  quantities[code] = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function handleSearchApply() {
  appliedKeyword.value = keyword.value;
  // 搜尋後自動展開有結果的分類
  expandAll();
}
function handleSearchClear() {
  keyword.value = '';
  appliedKeyword.value = '';
}

function handleClearAll() {
  for (const code of Object.keys(quantities)) {
    quantities[code] = 0;
  }
  showSuccess({ detail: t('bid_list.batch_edit_qty.toast.cleared') });
}

function handleSave() {
  showSuccess({ detail: t('bid_list.batch_edit_qty.toast.saved') });
  emit('save');
  localVisible.value = false;
}

function handleClose() {
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.batch_edit_qty.title')"
    :style="{ width: '78rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-4">
      <!-- 上方搜尋列 + session 顯示 -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div
          v-if="sessionName"
          class="text-sm text-slate-600 dark:text-slate-300"
        >
          {{ t('bid_list.batch_edit_qty.session_prefix') }}：{{ sessionName }}
        </div>

        <div class="flex flex-wrap items-center gap-2 ml-auto">
          <label class="text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.batch_edit_qty.search.type_label') }}
          </label>
          <Select
            v-model="searchType"
            :options="searchTypeOptions"
            option-label="label"
            option-value="value"
            class="min-w-[140px]"
          />
          <InputText
            v-model="keyword"
            :placeholder="t('bid_list.batch_edit_qty.search.placeholder')"
            class="min-w-[200px]"
            @keyup.enter="handleSearchApply"
          />
          <Button
            type="button"
            size="small"
            severity="primary"
            @click="handleSearchApply"
          >
            {{ t('bid_list.batch_edit_qty.search.query') }}
          </Button>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            @click="handleSearchClear"
          >
            {{ t('bid_list.batch_edit_qty.search.clear') }}
          </Button>
        </div>
      </div>

      <!-- 展開控制列 -->
      <div class="flex items-center gap-2">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          @click="expandAll"
        >
          {{ t('bid_list.batch_edit_qty.button.expand_all') }}
        </Button>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          @click="collapseAll"
        >
          {{ t('bid_list.batch_edit_qty.button.collapse_all') }}
        </Button>
        <span
          v-if="appliedKeyword"
          class="text-xs text-slate-500 dark:text-slate-400 ml-2"
        >
          {{ t('bid_list.batch_edit_qty.search.result_hint', { count: totalMatchedCount, keyword: appliedKeyword }) }}
        </span>
      </div>

      <!-- 分類 accordion -->
      <div class="flex flex-col gap-3">
        <div
          v-if="filteredCategories.length === 0"
          class="text-center text-slate-500 dark:text-slate-400 py-8"
        >
          {{ t('bid_list.batch_edit_qty.empty') }}
        </div>

        <div
          v-for="category in filteredCategories"
          :key="category.name"
          class="border border-slate-200 dark:border-slate-700 rounded"
        >
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            @click="toggleCategory(category.name)"
          >
            <FontAwesomeIcon
              :icon="['fas', expandedMap[category.name] ? 'chevron-down' : 'chevron-right']"
              class="text-xs"
            />
            <span>{{ category.name }}</span>
            <span class="text-xs text-slate-400 ml-1">({{ category.products.length }})</span>
          </button>

          <div
            v-if="expandedMap[category.name]"
            class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 p-3 border-t border-slate-200 dark:border-slate-700"
          >
            <div
              v-for="product in category.products"
              :key="product.code"
              class="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5"
            >
              <span class="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {{ product.name }}
              </span>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :aria-label="t('bid_list.batch_edit_qty.stepper.decrement')"
                @click="decrement(product.code)"
              >
                <FontAwesomeIcon :icon="['fas', 'minus']" />
              </Button>
              <InputText
                :model-value="String(quantities[product.code] ?? 0)"
                class="w-14 text-center"
                @update:model-value="(value) => handleQuantityInput(product.code, value ?? '')"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :aria-label="t('bid_list.batch_edit_qty.stepper.increment')"
                @click="increment(product.code)"
              >
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          @click="handleClearAll"
        >
          {{ t('bid_list.batch_edit_qty.button.clear') }}
        </Button>
        <Button
          type="button"
          severity="primary"
          @click="handleSave"
        >
          {{ t('bid_list.batch_edit_qty.button.save') }}
        </Button>
        <Button
          type="button"
          severity="secondary"
          outlined
          @click="handleClose"
        >
          {{ t('bid_list.batch_edit_qty.button.close') }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
