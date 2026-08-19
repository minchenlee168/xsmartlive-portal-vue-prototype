<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useManualBidSessionMock } from '../composables/useManualBidSessionMock';
import type { ManualBidProduct } from '../composables/useManualBidSessionMock';

interface Props {
  visible: boolean;
  /** 目前已選商品名稱（用來預選同名商品） */
  currentProductName?: string;
}

interface ConfirmPayload {
  name: string;
  image: string;
  unitPrice: number;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'confirm', product: ConfirmPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { products } = useManualBidSessionMock();

const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const keyword = ref('');
const selectedProductId = ref<string | null>(null);
const page = ref<number>(1);
const pageSize = 5;

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    keyword.value = '';
    page.value = 1;
    const preselected = props.currentProductName
      ? products.value.find((p) => p.name === props.currentProductName)
      : null;
    selectedProductId.value = preselected?.id ?? null;
  },
  { immediate: true },
);

const filteredProducts = computed<ManualBidProduct[]>(() => {
  const trimmed = keyword.value.trim().toLowerCase();
  if (!trimmed) return products.value;
  return products.value.filter(
    (product) =>
      product.name.toLowerCase().includes(trimmed) ||
      product.keyword.toLowerCase().includes(trimmed),
  );
});

const totalRecords = computed<number>(() => filteredProducts.value.length);

const paginatedProducts = computed<ManualBidProduct[]>(() => {
  const start = (page.value - 1) * pageSize;
  return filteredProducts.value.slice(start, start + pageSize);
});

const selectedProduct = computed<ManualBidProduct | null>(() =>
  products.value.find((p) => p.id === selectedProductId.value) ?? null,
);

function handleSearch() {
  page.value = 1;
}

function handlePageChange(event: { page: number; rows: number }) {
  page.value = event.page + 1;
}

function handleConfirm() {
  if (!selectedProduct.value) return;
  emit('confirm', {
    name: selectedProduct.value.name,
    image: selectedProduct.value.image,
    unitPrice: selectedProduct.value.price,
  });
  localVisible.value = false;
}

function handleCancel() {
  localVisible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.product_picker.title')"
    :style="{ width: '50rem' }"
    :pt="{
      footer: {
        class: ['relative', 'pb-0'],
      },
    }"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-end gap-2">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs text-slate-500">
            {{ t('bid_list.product_picker.keyword') }}
          </label>
          <InputText
            v-model="keyword"
            :placeholder="t('bid_list.product_picker.placeholder')"
            @keyup.enter="handleSearch"
          />
        </div>
        <Button
          severity="primary"
          @click="handleSearch"
        >
          {{ t('bid_list.product_picker.search') }}
        </Button>
      </div>

      <DataView :value="paginatedProducts">
        <template #empty>
          <div class="py-8 text-center text-slate-500">
            {{ t('bid_list.product_picker.empty') }}
          </div>
        </template>
        <template #list="slotProps">
          <div class="flex flex-col">
            <div
              v-for="(product, index) in (slotProps.items as ManualBidProduct[])"
              :key="product.id"
            >
              <div
                class="flex flex-col sm:flex-row sm:items-center py-4 gap-4"
                :class="{ 'border-t border-slate-200 dark:border-slate-700': index !== 0 }"
              >
                <div class="flex items-center justify-center">
                  <RadioButton
                    v-model="selectedProductId"
                    :value="product.id"
                  />
                </div>
                <div
                  class="md:w-40 relative cursor-pointer"
                  @click="selectedProductId = product.id"
                >
                  <img
                    class="block mx-auto rounded w-full"
                    :src="product.image"
                    :alt="product.name"
                  />
                </div>
                <div class="flex flex-col justify-between md:self-start flex-1 gap-2">
                  <div class="flex gap-1 flex-wrap">
                    <Tag :value="product.keyword">
                      <template #icon>
                        <FontAwesomeIcon :icon="['fas', 'hashtag']" />
                      </template>
                    </Tag>
                    <Tag
                      v-if="product.isPreorder"
                      severity="info"
                      :value="t('bid_list.product_picker.preorder')"
                    />
                    <Tag
                      v-else-if="product.allowOversell"
                      severity="warn"
                      :value="t('bid_list.product_picker.oversell')"
                    />
                    <Tag
                      v-else
                      :severity="product.stock > 0 ? 'secondary' : 'danger'"
                      :value="`${t('bid_list.product_picker.column.stock')}: ${product.stock}`"
                    />
                  </div>
                  <div class="text-lg font-medium">
                    {{ product.name }}
                  </div>
                </div>
                <div class="flex flex-col gap-2 items-end">
                  <span class="text-xl font-semibold">
                    ${{ product.price }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </DataView>
    </div>

    <template #footer>
      <Paginator
        v-if="totalRecords > pageSize"
        class="mx-auto"
        :rows="pageSize"
        :total-records="totalRecords"
        :first="(page - 1) * pageSize"
        @page="handlePageChange"
      />
      <div class="absolute right-4 bottom-4 flex gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('bid_list.product_picker.cancel')"
          @click="handleCancel"
        />
        <Button
          type="button"
          severity="primary"
          :label="`${t('bid_list.product_picker.confirm')} (${selectedProductId ? 1 : 0})`"
          :disabled="!selectedProductId"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>
