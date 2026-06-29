<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: '1100px' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        {{
          step === 'pick'
            ? t('live_order.dialog.pick_product_header')
            : t('live_order.dialog.order_setting_header')
        }}
      </span>
    </template>

    <!-- 步驟指示（對齊批次編輯彈窗） -->
    <div class="flex items-center gap-2 pt-2">
      <template v-for="(s, i) in pickSteps" :key="s.step">
        <div class="flex items-center gap-2">
          <span
            class="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[13px] font-bold"
            :class="stepNum >= s.step
              ? 'bg-[var(--p-primary-color)] text-white'
              : 'bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)]'"
          >{{ s.step }}</span>
          <span
            class="text-[14px] font-medium"
            :class="stepNum === s.step ? 'text-[var(--p-text-color)]' : 'text-[var(--p-text-muted-color)]'"
          >{{ s.label }}</span>
        </div>
        <div v-if="i < pickSteps.length - 1" class="flex-1 h-px bg-[var(--p-content-border-color)]"></div>
      </template>
    </div>
    <!-- Step 1：選擇商品（Tabs：一般商品 / 組合商品） -->
    <div v-if="step === 'pick'" class="flex flex-col gap-3 pt-3">
      <Tabs :value="pickerTab" @update:value="(v) => pickerTab = v as PickerTab">
        <TabList>
          <Tab value="general">
            <span class="flex items-center gap-1.5 text-[14px] font-medium">
              <i class="pi pi-shopping-bag" style="font-size: 13px" />
              一般商品
              <span
                v-if="selectedProductCount > 0"
                class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-none bg-[var(--p-primary-color)] text-[var(--p-primary-contrast-color)]"
              >{{ selectedProductCount }}</span>
            </span>
          </Tab>
          <Tab value="bundle">
            <span class="flex items-center gap-1.5 text-[14px] font-medium">
              <i class="pi pi-box" style="font-size: 13px" />
              組合商品
              <span
                v-if="selectedBundleIds.size > 0"
                class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-none bg-[var(--p-primary-color)] text-[var(--p-primary-contrast-color)]"
              >{{ selectedBundleIds.size }}</span>
            </span>
          </Tab>
        </TabList>
      </Tabs>

    <!-- 一般商品 tab 內容 -->
    <div v-show="pickerTab === 'general'" class="flex flex-col gap-3">
      <!-- Row 1：分類 + 搜尋（select + input + 紫色「搜尋」鈕） -->
      <div class="flex gap-4 items-end flex-wrap">
        <div class="flex flex-col gap-2">
          <label class="text-[14px] font-medium text-[var(--p-text-color)]">
            {{ t('live_order.form.field.category') }}
          </label>
          <Select
            v-model="pickerCategory"
            :options="[
              { label: t('live_order.form.placeholder.all_categories'), value: null },
              ...productCategories,
            ]"
            option-label="label"
            option-value="value"
            :placeholder="t('live_order.form.placeholder.all_categories')"
            class="w-[220px]"
          />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-[320px]">
          <label class="text-[14px] font-medium text-[var(--p-text-color)]">
            {{ t('live_order.form.field.search') }}
          </label>
          <div class="flex h-[42px]">
            <Select
              v-model="pickerSearchField"
              :options="pickerSearchFields"
              option-label="label"
              option-value="value"
              class="w-[130px]"
              style="border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: 0"
            />
            <InputText
              v-model="pickerKeyword"
              :placeholder="t('live_order.form.placeholder.quick_search_products')"
              class="flex-1"
              style="border-radius: 0"
            />
          </div>
        </div>
        <Button label="搜尋" class="h-[42px] !min-w-[88px]" />
      </div>

      <!-- Row 2：已選擇 X 項商品（左）/ 只顯示可用商品（右） -->
      <div class="flex items-center justify-between">
        <span class="text-[13px] text-[var(--p-text-muted-color)]">
          已選擇 <span class="text-[var(--p-text-color)] font-semibold">{{ selectedProductCount }}</span> 項商品
        </span>
        <label class="flex items-center gap-[7px] cursor-pointer">
          <Checkbox v-model="pickerOnlyAvailable" binary />
          <span class="text-[14px] text-[var(--p-text-color)]">
            {{ t('live_order.label.only_show_available') }}
          </span>
        </label>
      </div>

      <div class="overflow-x-auto">
        <div style="min-width: 880px">
          <div
            class="bg-[var(--p-content-background)] border-b border-[var(--p-content-border-color)] flex items-center px-4"
          >
            <!-- checkbox 移到最前面 -->
            <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px"></div>
            <div class="px-2 py-[6px] shrink-0 w-[28px]"></div>
            <div
              class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0"
              style="width: 380px"
            >
              {{ t('live_order.label.product_name_spec') }}
            </div>
            <div
              class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0"
              style="width: 120px"
            >
              {{ t('live_order.label.cost') }}
            </div>
            <div
              class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0"
              style="width: 120px"
            >
              {{ t('live_order.label.price') }}
            </div>
            <div
              class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0"
              style="width: 100px"
            >
              {{ t('live_order.label.stock') }}
            </div>
          </div>

          <template v-for="p in pagedPickerProducts" :key="p.id">
            <div
              :class="[
                'flex items-center w-full px-4',
                pickerExpanded.includes(p.id) && p.specs?.length
                  ? 'bg-[var(--p-content-hover-background)]'
                  : 'border-b border-[var(--p-content-border-color)]',
              ]"
            >
              <!-- checkbox 移到最前面 -->
              <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px">
                <Checkbox
                  :model-value="isProductChecked(p)"
                  binary
                  :disabled="isProductExisting(p)"
                  @change="toggleProduct(p)"
                />
              </div>
              <div class="px-2 py-[6px] shrink-0 w-[28px]">
                <button
                  v-if="p.specs?.length"
                  @click="togglePickerExpand(p.id)"
                  class="w-full flex items-center justify-center"
                >
                  <i
                    :class="[
                      'pi text-[14px] text-[var(--p-text-muted-color)]',
                      pickerExpanded.includes(p.id) ? 'pi-chevron-up' : 'pi-chevron-down',
                    ]"
                  ></i>
                </button>
              </div>
              <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                <div
                  class="w-[48px] h-[48px] rounded-[6px] bg-[var(--p-content-hover-background)] flex items-center justify-center shrink-0"
                >
                  <i class="pi pi-image text-[18px] text-[var(--p-text-muted-color)]"></i>
                </div>
                <div class="flex flex-col gap-[2px]">
                  <span class="font-medium text-[15px]"
                    :class="isProductExisting(p) ? 'text-[var(--p-text-muted-color)]' : 'text-[var(--p-text-color)]'"
                  >
                    {{ p.name }}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ p.sku }}</span>
                    <span
                      v-if="p.keyword"
                      class="text-[11px] font-medium text-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-1.5 py-0.5 rounded"
                    >
                      {{ t('live_order.label.keyword_with_value', { value: p.keyword }) }}
                    </span>
                    <span v-if="isProductExisting(p)"
                      class="text-[11px] font-medium text-white bg-[var(--p-text-muted-color)] px-1.5 py-0.5 rounded">
                      {{ t('live_order.label.already_added') }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">
                  {{ specCostRange(p) }}
                </span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">
                  {{ specPriceRange(p) }}
                </span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                <span
                  class="text-[15px]"
                  :class="totalStockOf(p) <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'"
                >
                  {{ specStockRange(p) }}
                </span>
              </div>
            </div>

            <template v-if="pickerExpanded.includes(p.id) && p.specs?.length">
              <div
                v-for="(spec, si) in p.specs"
                :key="spec.id"
                :class="[
                  'bg-[var(--p-content-hover-background)] flex items-center px-[40px]',
                  si === p.specs.length - 1
                    ? 'border-b border-[var(--p-content-border-color)]'
                    : '',
                ]"
              >
                <div class="border-l border-[var(--p-content-border-color)] flex h-full items-center w-full">
                  <!-- checkbox 移到最前面（規格層） -->
                  <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px">
                    <Checkbox
                      :model-value="isItemSelected('s-' + spec.id)"
                      binary
                      :disabled="isProductExisting(p)"
                      @change="toggleSpec(p, spec)"
                    />
                  </div>
                  <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                    <div
                      class="w-[40px] h-[40px] rounded-[6px] bg-[var(--p-content-hover-background)] flex items-center justify-center shrink-0"
                    >
                      <i class="pi pi-image text-[14px] text-[var(--p-text-muted-color)]"></i>
                    </div>
                    <div class="flex flex-col gap-[2px]">
                      <span class="font-medium text-[14px] text-[var(--p-text-color)]">
                        {{ t('live_order.label.spec_label', { name: spec.name }) }}
                      </span>
                      <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ spec.sku }}</span>
                    </div>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                    <span class="text-[14px] text-[var(--p-text-color)]">
                      {{ spec.cost.toLocaleString() }}
                    </span>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                    <span class="text-[14px] text-[var(--p-text-color)]">
                      {{ spec.price.toLocaleString() }}
                    </span>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                    <span
                      class="text-[14px]"
                      :class="spec.stock <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'"
                    >
                      {{ spec.stock }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <div
            v-if="pagedPickerProducts.length === 0"
            class="flex flex-col items-center justify-center gap-2 py-12"
          >
            <i class="pi pi-inbox text-5xl text-[var(--p-text-muted-color)]"></i>
            <span class="text-[14px] text-[var(--p-text-muted-color)]">
              {{ t('live_order.empty.no_matching_product') }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-[14px] text-[var(--p-text-color)]">
          {{ t('live_order.text.total_products', { count: filteredPickerProducts.length }) }}
        </span>
        <Paginator
          :rows="pickerPageSize"
          :total-records="filteredPickerProducts.length"
          v-model:first="pickerPageFirst"
          class="border-0 p-0"
        />
      </div>
    </div>

    <!-- 組合商品 tab 內容（搜尋 + 表格 + 子商品展開 + 分頁） -->
    <div v-show="pickerTab === 'bundle'" class="flex flex-col gap-3">
      <!-- Row 1：搜尋（select + input + 紫色「搜尋」鈕） -->
      <div class="flex gap-4 items-end flex-wrap">
        <div class="flex flex-col gap-2 flex-1 min-w-[320px]">
          <label class="text-[14px] font-medium text-[var(--p-text-color)]">
            {{ t('live_order.form.field.search') }}
          </label>
          <div class="flex h-[42px]">
            <Select
              v-model="bundleSearchField"
              :options="pickerSearchFields"
              option-label="label"
              option-value="value"
              class="w-[130px]"
              style="border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: 0"
            />
            <InputText
              v-model="bundleKeyword"
              :placeholder="t('live_order.form.placeholder.quick_search_products')"
              class="flex-1"
              style="border-radius: 0"
            />
          </div>
        </div>
        <Button label="搜尋" class="h-[42px] !min-w-[88px]" />
      </div>

      <!-- Row 2：已選擇 X 項商品（左）/ 只顯示可用商品（右） -->
      <div class="flex items-center justify-between">
        <span class="text-[13px] text-[var(--p-text-muted-color)]">
          已選擇 <span class="text-[var(--p-text-color)] font-semibold">{{ selectedBundleIds.size }}</span> 項商品
        </span>
        <label class="flex items-center gap-[7px] cursor-pointer">
          <Checkbox v-model="bundleOnlyAvailable" binary />
          <span class="text-[14px] text-[var(--p-text-color)]">
            {{ t('live_order.label.only_show_available') }}
          </span>
        </label>
      </div>

      <div class="overflow-x-auto">
        <div style="min-width: 880px">
          <div class="bg-[var(--p-content-background)] border-b border-[var(--p-content-border-color)] flex items-center px-4">
            <!-- checkbox 移到最前面 -->
            <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px"></div>
            <div class="px-2 py-[6px] shrink-0 w-[28px]"></div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 380px">
              {{ t('live_order.label.product_name_spec') }}
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 120px">
              {{ t('live_order.label.cost') }}
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 120px">
              {{ t('live_order.label.price') }}
            </div>
            <div class="px-2 py-[6px] font-bold text-[15px] text-[var(--p-text-color)] shrink-0" style="width: 100px">
              {{ t('live_order.label.stock') }}
            </div>
          </div>

          <template v-for="b in pagedBundles" :key="b.id">
            <div
              :class="[
                'flex items-center w-full px-4',
                bundleExpanded.includes(b.id)
                  ? 'bg-[var(--p-content-hover-background)]'
                  : 'border-b border-[var(--p-content-border-color)]',
              ]"
            >
              <!-- checkbox 移到最前面 -->
              <div class="px-2 py-[6px] shrink-0 flex justify-center" style="width: 50px">
                <Checkbox
                  :model-value="selectedBundleIds.has(b.id)"
                  binary
                  :disabled="isBundleExisting(b)"
                  @change="toggleBundle(b.id)"
                />
              </div>
              <div class="px-2 py-[6px] shrink-0 w-[28px]">
                <button @click="toggleBundleExpand(b.id)" class="w-full flex items-center justify-center">
                  <i
                    :class="[
                      'pi text-[14px] text-[var(--p-text-muted-color)]',
                      bundleExpanded.includes(b.id) ? 'pi-chevron-up' : 'pi-chevron-down',
                    ]"
                  ></i>
                </button>
              </div>
              <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                <div class="w-[48px] h-[48px] rounded-[6px] bg-[var(--p-primary-50)] flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="['far', 'bag-shopping']" class="text-[var(--p-primary-color)]" style="font-size: 18px" />
                </div>
                <div class="flex flex-col gap-[2px]">
                  <span
                    class="font-medium text-[15px]"
                    :class="isBundleExisting(b) ? 'text-[var(--p-text-muted-color)]' : 'text-[var(--p-text-color)]'"
                  >{{ b.name }}</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ b.sku }}</span>
                    <span class="text-[11px] font-medium text-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-1.5 py-0.5 rounded">
                      {{ t('live_order.bundle_picker.keyword_with_value', { value: b.keyword }) }}
                    </span>
                    <span
                      v-if="isBundleExisting(b)"
                      class="text-[11px] font-medium text-white bg-[var(--p-text-muted-color)] px-1.5 py-0.5 rounded"
                    >{{ t('live_order.label.already_added') }}</span>
                  </div>
                </div>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">{{ costApprox(b).toLocaleString() }}</span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                <span class="text-[15px] text-[var(--p-text-color)]">{{ b.price.toLocaleString() }}</span>
              </div>
              <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                <span class="text-[15px]" :class="b.stock <= 10 ? 'text-[#ef4444]' : 'text-[var(--p-text-color)]'">{{ b.stock }}</span>
              </div>
            </div>

            <template v-if="bundleExpanded.includes(b.id)">
              <div
                v-for="(s, si) in subItemsOf(b)"
                :key="`${b.id}-${si}`"
                :class="[
                  'bg-[var(--p-content-hover-background)] flex items-center px-[40px]',
                  si === subItemsOf(b).length - 1 ? 'border-b border-[var(--p-content-border-color)]' : '',
                ]"
              >
                <div class="border-l border-[var(--p-content-border-color)] flex h-full items-center w-full">
                  <!-- 對齊新表頭：leading 50px 空欄取代原本最右側的 80px 空欄 -->
                  <div class="px-2 py-[6px] shrink-0" style="width: 50px"></div>
                  <div class="px-2 py-[6px] flex gap-3 items-center shrink-0" style="width: 380px">
                    <div class="w-[36px] h-[36px] rounded-[6px] bg-[var(--p-content-background)] border border-dashed border-[var(--p-content-border-color)] flex items-center justify-center shrink-0">
                      <i class="pi pi-image text-[14px] text-[var(--p-text-muted-color)]"></i>
                    </div>
                    <div class="flex flex-col gap-[2px]">
                      <span class="text-[14px] text-[var(--p-text-color)] truncate">{{ s.name }}</span>
                      <span class="text-[12px] text-[var(--p-text-muted-color)]">{{ s.sku }}</span>
                    </div>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px"></div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 120px">
                    <span class="text-[14px] text-[var(--p-text-color)]">{{ s.price.toLocaleString() }}</span>
                  </div>
                  <div class="px-2 py-[6px] shrink-0" style="width: 100px">
                    <span class="text-[14px] text-[var(--p-text-color)]">× {{ s.qty }}</span>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <div v-if="pagedBundles.length === 0" class="py-10 text-center text-[14px] text-[var(--p-text-muted-color)]">
            {{ t('live_order.bundle_picker.empty') }}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-[14px] text-[var(--p-text-color)]">
          {{ t('live_order.text.total_products', { count: filteredBundles.length }) }}
        </span>
        <Paginator
          :rows="bundlePageSize"
          :total-records="filteredBundles.length"
          v-model:first="bundlePageFirst"
          class="border-0 p-0"
        />
      </div>
    </div>

    </div>

    <!-- Step 2：得標設定（共同設定一次套用到所有勾選的商品） -->
    <div v-else class="pt-3">
      <OrderSettingForm
        ref="formRef"
        multiple
        :picked-names="selectedNames"
      />
    </div>

    <template #footer>
      <div v-if="step === 'pick'" class="flex items-center justify-between gap-2">
        <!-- 左側：
             - 找不到商品 → 開「新增一般商品」彈窗
             - 已勾 ≥ 2 個一般商品 → 拿勾選清單去「建立組合商品」（預填子商品） -->
        <div class="flex items-center gap-3 text-[13px]">
          <span class="text-[var(--p-text-muted-color)]">找不到商品？</span>
          <a
            class="text-[#2563EB] hover:underline cursor-pointer font-medium"
            @click="productCreateDialogVisible = true"
          >新增一般商品</a>
          <span class="text-[var(--p-text-muted-color)]">．</span>
          <a
            class="font-medium"
            :class="canBuildBundleFromSelection
              ? 'text-[#2563EB] hover:underline cursor-pointer'
              : 'text-[var(--p-text-muted-color)] cursor-not-allowed'"
            v-tooltip.top="canBuildBundleFromSelection
              ? '把已勾選的商品建立成組合商品'
              : '勾選至少 2 個一般商品後可建立組合商品'"
            @click="canBuildBundleFromSelection && openBundleCreateFromSelection()"
          >建立組合商品<span v-if="selectedProductCount > 0">（{{ selectedProductCount }}）</span></a>
        </div>
        <div class="flex justify-end gap-2">
          <Button
            :label="t('live_order.button.cancel')"
            severity="secondary"
            variant="outlined"
            @click="close"
          />
          <Button
            :label="t('live_order.button.next_step')"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :disabled="selectedCount === 0"
            @click="goToForm"
          />
        </div>
      </div>
      <div v-else class="flex justify-between gap-2">
        <Button
          :label="t('live_order.button.back_to_pick')"
          icon="pi pi-arrow-left"
          severity="secondary"
          variant="outlined"
          @click="onBackToPick"
        />
        <Button
          :label="`${t('live_order.button.save')} (${selectedCount})`"
          icon="pi pi-save"
          :disabled="selectedCount === 0"
          @click="onSaveForm"
        />
      </div>
    </template>
  </Dialog>

  <!-- 庫存問題提示：勾選 stock=0 商品 / 規格、按下一步時跳出 -->
  <StockIssueDialog
    v-model:visible="stockIssueDialogVisible"
    @confirm="onStockIssueResolve"
  />

  <!-- 從 picker 直接新建商品 / 組合商品（建好後 reactive productCatalog / bundleCatalog 自動更新） -->
  <ProductCreateDialog
    v-model:visible="productCreateDialogVisible"
    @created="onProductCreated"
  />
  <ProductBundleCreateDialog
    v-model:visible="bundleCreateDialogVisible"
    :initial-bundle-items="bundleInitialItems"
    @created="onBundleCreated"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import OrderSettingForm, { type OrderSettingFormData } from './OrderSettingForm.vue'
import StockIssueDialog, { type StockIssueChoice } from './StockIssueDialog.vue'
import { productCatalog, bundleCatalog, type CatalogBundle } from '../utils/productCatalog'
import { managedProducts, type ManagedProduct } from '@/admin/views/product/utils/productMock'
import ProductCreateDialog from '@/admin/views/product/components/ProductCreateDialog.vue'
import ProductBundleCreateDialog from '@/admin/views/product/components/ProductBundleCreateDialog.vue'
import { useToast } from 'primevue/usetoast'

interface PickerSpec {
  id: number
  name: string
  sku: string
  cost: number
  originalPrice: number
  price: number
  stock: number
}

interface PickerProductRaw {
  id: number
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: string
  /** 直播關鍵字（從商品管理同步而來），加入場次時直接帶入 */
  keyword?: string
}

interface PickerProduct extends PickerProductRaw {
  cost: number
  originalPrice: number
  specs: PickerSpec[]
}

interface ProductFormApi {
  validate: () => boolean
  getSettings: () => OrderSettingFormData
  reset: () => void
  setAllowOversell?: (value: boolean) => void
}

type PickerTab = 'general' | 'bundle'

/** 步驟一勾選的商品 / 規格項目（攜帶基本資料供建立 session 商品）。 */
interface SelectedItem {
  key: string
  /** 規格項目的 parent 商品 id；商品本身被勾選時 productId === item 自身 id（自身為 parent）。 */
  productId: number
  /** 規格項目時為 spec id；商品本身被勾選時為 product id。 */
  itemId: number
  /** true = 規格項目；false = 商品本身（沒帶規格）。 */
  isSpec: boolean
  name: string
  /** 規格名稱（isSpec=true 時填）。 */
  specName?: string
  sku: string
  cost: number
  price: number
  stock: number
  /** 從 parent PickerProduct 繼承的直播關鍵字 */
  keyword?: string
}

/** picker 已勾選項目轉換給 BundleContentsCard 初始資料用 */
interface BundlePickedSeed {
  key: string
  productId: number
  specId?: number
  name: string
  stock: number
  quantity: number
  maxPerPurchase: number | null
}

interface Props {
  visible?: boolean
  /** 當前場次已加入的商品；用 name 判斷是否已加入，已加入的 picker row 整列 disabled。 */
  existingProducts?: Array<{ name?: string;[key: string]: unknown }>
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  existingProducts: () => [],
})

/** 已加入的商品名稱 set（picker 用來決定 disabled）。 */
const existingNames = computed(() => new Set(
  props.existingProducts.map((p) => p?.name).filter((n): n is string => Boolean(n)),
))

/** 該 picker 商品是否已存在於場次（依名稱）。 */
function isProductExisting(p: PickerProduct): boolean {
  return existingNames.value.has(p.name)
}

/**
 * 把一組數字壓成顯示用區間字串：相同 → 單一數字；不同 → 「min ~ max」。
 * 給多規格商品主列的成本 / 售價 / 庫存欄位用，看到 specs 內最小最大值的差距。
 */
function rangeStr(values: number[]): string {
  if (values.length === 0) return '0'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? min.toLocaleString() : `${min.toLocaleString()} ~ ${max.toLocaleString()}`
}
function specCostRange(p: PickerProduct): string {
  return rangeStr(p.specs.length ? p.specs.map((s) => s.cost) : [p.cost])
}
function specPriceRange(p: PickerProduct): string {
  return rangeStr(p.specs.length ? p.specs.map((s) => s.price) : [p.price])
}
function specStockRange(p: PickerProduct): string {
  // 庫存固定顯示總和（規格加總），不走區間，與主商品「總庫存」概念對齊。
  const total = p.specs.length
    ? p.specs.reduce((sum, s) => sum + (s.stock ?? 0), 0)
    : (p.stock ?? 0)
  return total.toLocaleString()
}
function minSpecStock(p: PickerProduct): number {
  if (!p.specs.length) return p.stock
  return Math.min(...p.specs.map((s) => s.stock))
}
/** 主商品總庫存（規格加總）；庫存欄與低庫存警示用同一個值。 */
function totalStockOf(p: PickerProduct): number {
  return p.specs.length
    ? p.specs.reduce((sum, s) => sum + (s.stock ?? 0), 0)
    : (p.stock ?? 0)
}
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'add-products': [products: Array<Record<string, unknown>>]
}>()

const { t } = useI18n()

/** 由 picker 帶入後鎖定不可改的欄位（成本/售價/庫存/商品圖） */
const LOCKED_FIELDS = ['cost', 'price', 'stock', 'image']

const innerVisible = ref(props.visible)
const step = ref<'pick' | 'form'>('pick')

// 步驟指示器：選擇商品(1) → 得標設定(2)
const stepNum = computed(() => (step.value === 'pick' ? 1 : 2))
const pickSteps = computed(() => [
  { step: 1, label: t('live_order.dialog.pick_product_header') },
  { step: 2, label: t('live_order.dialog.order_setting_header') },
])
const formRef = ref<ProductFormApi | null>(null)

/** 當前 Step 1 顯示的 tab：「general」一般商品 / 「bundle」組合商品 */
const pickerTab = ref<PickerTab>('general')

/** 跨展開/分頁記憶已勾選的項目；key = `p-{id}`（整個商品）或 `s-{id}`（單一規格）。 */
const selectedItems = ref<Map<string, SelectedItem>>(new Map())
/** 勾選的組合商品 id（與 selectedItems 分開維護，存檔時各自轉換） */
const selectedBundleIds = ref<Set<number>>(new Set())
/** 一般商品 tab 的徽章數：勾選的「主商品」數，不細計到規格層 */
const selectedProductCount = computed(() => {
  const ids = new Set<number>()
  selectedItems.value.forEach((it) => ids.add(it.productId))
  return ids.size
})
const selectedCount = computed(() => selectedProductCount.value + selectedBundleIds.value.size)
/**
 * 得標設定步驟顯示用：去除規格、依 productId 摺合成一個「主商品名」清單；
 * 後段附加組合商品名稱（套同一份得標設定）。
 */
const selectedNames = computed(() => {
  const seen = new Set<number>()
  const names: string[] = []
  selectedItems.value.forEach((it) => {
    if (seen.has(it.productId)) return
    seen.add(it.productId)
    const parent = allPickerProducts.value.find((p) => p.id === it.productId)
    names.push(parent?.name ?? it.name)
  })
  selectedBundleIds.value.forEach((id) => {
    const b = bundleCatalog.find((x) => x.id === id)
    if (b) names.push(b.name)
  })
  return names
})

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      step.value = 'pick'
      pickerTab.value = 'general'
      selectedItems.value = new Map()
      selectedBundleIds.value = new Set()
      resetPicker()
      resetBundlePicker()
    }
  },
)

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function isItemSelected(key: string): boolean {
  return selectedItems.value.has(key)
}

function toggleItem(item: SelectedItem): void {
  const map = new Map(selectedItems.value)
  if (map.has(item.key)) {
    map.delete(item.key)
  } else {
    map.set(item.key, item)
  }
  selectedItems.value = map
}

/**
 * 勾選 / 取消整個商品。
 *
 * 行為：
 * - 有規格 → 主商品本身不計入下標項，只把全部規格加入（取消則整批移除）
 * - 沒規格 → 直接加入主商品本身（取消則移除）
 *
 * 內部以 Map 一次性更新，避免每個 spec 各自觸發 reactive 多次重渲染。
 */
function toggleProduct(p: PickerProduct): void {
  const map = new Map(selectedItems.value)
  const productKey = `p-${p.id}`
  const isOn = !isProductChecked(p)

  if (p.specs.length > 0) {
    // 有規格：只操作 spec 條目，主商品不入 map
    if (isOn) {
      p.specs.forEach((spec) => {
        const k = `s-${spec.id}`
        map.set(k, {
          key: k,
          productId: p.id,
          itemId: spec.id,
          isSpec: true,
          name: `${p.name} - ${spec.name}`,
          specName: spec.name,
          sku: spec.sku,
          cost: spec.cost,
          price: spec.price,
          stock: spec.stock,
          keyword: p.keyword,
        })
      })
    } else {
      p.specs.forEach((spec) => map.delete(`s-${spec.id}`))
    }
  } else {
    // 沒規格：主商品本身就是下標項
    if (isOn) {
      map.set(productKey, {
        key: productKey,
        productId: p.id,
        itemId: p.id,
        isSpec: false,
        name: p.name,
        sku: p.sku,
        cost: p.cost,
        price: p.price,
        stock: p.stock,
        keyword: p.keyword,
      })
    } else {
      map.delete(productKey)
    }
  }
  selectedItems.value = map
}

/**
 * 主商品 checkbox 顯示狀態：
 * - 有規格 → 所有規格皆已勾起才算「主商品已勾」
 * - 沒規格 → 看主商品本身是否在 selectedItems
 */
function isProductChecked(p: PickerProduct): boolean {
  if (p.specs.length > 0) {
    return p.specs.every((spec) => selectedItems.value.has(`s-${spec.id}`))
  }
  return selectedItems.value.has(`p-${p.id}`)
}

/** 勾選單一規格，name 帶「商品 - 規格」格式、用 spec 的 cost/price/stock。 */
function toggleSpec(p: PickerProduct, spec: PickerSpec): void {
  toggleItem({
    key: `s-${spec.id}`,
    productId: p.id,
    itemId: spec.id,
    isSpec: true,
    name: `${p.name} - ${spec.name}`,
    specName: spec.name,
    sku: spec.sku,
    cost: spec.cost,
    price: spec.price,
    stock: spec.stock,
    keyword: p.keyword,
  })
}

// ── 直接從 picker 新建商品 / 組合商品 ─────────────────
const toast = useToast()
const productCreateDialogVisible = ref(false)
const bundleCreateDialogVisible = ref(false)
/** 開組合商品 dialog 時要預填的子商品列（從 picker 已勾選項目轉換出來） */
const bundleInitialItems = ref<BundlePickedSeed[]>([])

/** 至少要勾 2 個一般商品才能建立組合商品 */
const canBuildBundleFromSelection = computed(() => selectedProductCount.value >= 2)

/**
 * 拿目前 picker 已勾選的項目當「組合子商品」打開組合商品建立彈窗。
 * - 主商品（含全規格）→ 一筆 BundleItem，無 specId
 * - 單一規格勾選 → 一筆 BundleItem，帶 specId
 */
function openBundleCreateFromSelection(): void {
  const groups = new Map<number, SelectedItem[]>()
  selectedItems.value.forEach((it) => {
    const arr = groups.get(it.productId) ?? []
    arr.push(it)
    groups.set(it.productId, arr)
  })
  const seeds: BundlePickedSeed[] = []
  groups.forEach((items, productId) => {
    const parent = allPickerProducts.value.find((p) => p.id === productId)
    const checkedSpecs = items.filter((it) => it.isSpec)
    const parentSpecs = parent?.specs ?? []
    // 整個主商品被勾（含規格全選）→ 一筆 productId 條目（不帶 specId）
    const wholeProductChecked = parentSpecs.length > 0
      ? checkedSpecs.length === parentSpecs.length
      : items.some((it) => !it.isSpec)
    if (wholeProductChecked) {
      seeds.push({
        key: `p-${productId}`,
        productId,
        name: parent?.name ?? items[0].name,
        stock: parentSpecs.length
          ? parentSpecs.reduce((sum, s) => sum + (s.stock ?? 0), 0)
          : (parent?.stock ?? 0),
        quantity: 1,
        maxPerPurchase: null,
      })
    } else {
      checkedSpecs.forEach((s) => {
        seeds.push({
          key: `s-${productId}-${s.itemId}`,
          productId,
          specId: s.itemId,
          name: s.name,
          stock: s.stock ?? 0,
          quantity: 1,
          maxPerPurchase: null,
        })
      })
    }
  })
  bundleInitialItems.value = seeds
  bundleCreateDialogVisible.value = true
}

function onProductCreated(p: ManagedProduct): void {
  toast.add({ severity: 'success', summary: `已加進商品庫：${p.name}`, life: 1800 })
  pickerTab.value = 'general'
  pickerKeyword.value = ''
  pickerPageFirst.value = 0
  void nextTick(() => {
    const picker = allPickerProducts.value.find((x) => x.id === p.id)
    if (picker) toggleProduct(picker)
  })
}
function onBundleCreated(p: ManagedProduct): void {
  toast.add({ severity: 'success', summary: `已加進組合商品庫：${p.name}`, life: 1800 })
  pickerTab.value = 'bundle'
  // 清空當下勾選的「組成組合商品的個別商品」，只留下組合商品本身被勾
  selectedItems.value = new Map()
  void nextTick(() => {
    if (bundleCatalog.some((b) => b.id === p.id)) {
      selectedBundleIds.value = new Set([...selectedBundleIds.value, p.id])
    }
  })
}

// ── 庫存問題檢查（勾選了 stock=0 的商品 / 規格 / 組合） ──────
const stockIssueDialogVisible = ref(false)
const itemsWithZeroStock = computed(() => {
  const zeros: Array<{ name: string }> = Array.from(selectedItems.value.values())
    .filter(it => (it.stock ?? 0) === 0)
    .map(it => ({ name: it.name }))
  selectedBundleIds.value.forEach((id) => {
    const b = bundleCatalog.find((x) => x.id === id)
    if (b && (b.stock ?? 0) === 0) zeros.push({ name: b.name })
  })
  return zeros
})
/** 進入得標設定步驟（至少勾一項）；勾到 stock=0 的項目 → 先跳庫存問題彈窗。 */
function goToForm(): void {
  if (selectedCount.value === 0) return
  if (itemsWithZeroStock.value.length > 0) {
    stockIssueDialogVisible.value = true
    return
  }
  step.value = 'form'
}
/**
 * 庫存問題使用者選好處理方式：
 * - oversell → 進入得標設定（OrderSettingForm 預設 allowOversell=true，儲存時會帶到所有商品）
 * - skip-zero → 關閉提示彈窗，停留在「選擇商品」步驟讓使用者自行改選其他商品（不自動過濾）
 */
function onStockIssueResolve(choice: StockIssueChoice): void {
  if (choice === 'oversell') {
    step.value = 'form'
    // 進入得標設定後再強制把超賣開關打開（form 預設為 false）
    void nextTick(() => formRef.value?.setAllowOversell?.(true))
  }
  // skip-zero：什麼都不做，停在 pick step
}

function onBackToPick(): void {
  step.value = 'pick'
}

/**
 * 儲存：依「所屬商品」群組勾選項目，再依共同得標設定產生 session 商品卡：
 * - 勾主商品 + 該商品本身有規格 → 1 張主商品卡，selectedSpecs 自動帶入「全部規格」
 * - 只勾部分規格（沒勾主商品）→ 1 張主商品卡，selectedSpecs 帶被勾選的那幾個規格
 * - 勾主商品 + 商品沒規格 → 1 張單純商品卡（無 selectedSpecs）
 *
 * 主商品 price 取規格的最小價、stock 加總、cost 取平均，作為預設與摺疊狀態的顯示值。
 */
function onSaveForm(): void {
  if (!formRef.value?.validate()) return
  const settings = formRef.value.getSettings()
  const base = Date.now()

  // 依 productId 群組
  const groups = new Map<number, SelectedItem[]>()
  Array.from(selectedItems.value.values()).forEach((it) => {
    const arr = groups.get(it.productId) ?? []
    arr.push(it)
    groups.set(it.productId, arr)
  })

  let offset = 0
  const products: Array<Record<string, unknown>> = []
  groups.forEach((items, productId) => {
    const parent = allPickerProducts.value.find((p) => p.id === productId)
    const productItem = items.find((it) => !it.isSpec)
    const checkedSpecItems = items.filter((it) => it.isSpec)
    const parentSpecs = parent?.specs ?? []

    // 若勾選主商品 → selectedSpecs 用該商品「全部規格」；
    // 否則用使用者勾的那幾個規格。
    const effectiveSpecs = (productItem && parentSpecs.length > 0)
      ? parentSpecs.map((s) => ({
          itemId: s.id,
          specName: s.name,
          sku: s.sku,
          cost: s.cost,
          price: s.price,
          stock: s.stock,
        }))
      : checkedSpecItems.map((s) => ({
          itemId: s.itemId,
          specName: s.specName,
          sku: s.sku,
          cost: s.cost,
          price: s.price,
          stock: s.stock,
        }))

    // 共用欄位
    const baseFields: Record<string, unknown> = {
      ...settings,
      quantityDiscounts: settings.quantityDiscounts.map((t) => ({ ...t })),
      id: base + offset,
    }
    offset += 1

    if (effectiveSpecs.length > 0) {
      // 主商品 + selectedSpecs：商品卡會顯示價格區間
      const prices = effectiveSpecs.map((s) => s.price)
      const stocks = effectiveSpecs.map((s) => s.stock)
      products.push({
        ...baseFields,
        name: parent?.name ?? productItem?.name ?? '',
        sku: parent?.sku ?? productItem?.sku ?? '',
        keyword: parent?.keyword ?? productItem?.keyword ?? '',
        cost: Math.round(effectiveSpecs.reduce((sum, s) => sum + s.cost, 0) / effectiveSpecs.length),
        price: Math.min(...prices),
        stock: stocks.reduce((sum, s) => sum + s, 0),
        selectedSpecs: effectiveSpecs.map((s) => ({
          id: s.itemId,
          name: s.specName,
          sku: s.sku,
          cost: s.cost,
          price: s.price,
          stock: s.stock,
          sold: 0,
        })),
      })
    } else if (productItem) {
      // 主商品本體被勾、且商品沒規格 → 單張單純商品卡
      products.push({
        ...baseFields,
        name: productItem.name,
        sku: productItem.sku,
        keyword: parent?.keyword ?? productItem.keyword ?? '',
        cost: productItem.cost,
        price: productItem.price,
        stock: productItem.stock,
      })
    }
  })

  // 組合商品：套同一份得標設定，附帶 isBundle / bundleItems 給商品卡判斷
  selectedBundleIds.value.forEach((id) => {
    const b = bundleCatalog.find((x) => x.id === id)
    if (!b) return
    products.push({
      ...settings,
      quantityDiscounts: settings.quantityDiscounts.map((t) => ({ ...t })),
      id: base + offset,
      name: b.name,
      sku: b.sku,
      keyword: b.keyword,
      price: b.price,
      stock: b.stock,
      sold: 0,
      status: 'ready',
      specs: [],
      isBundle: true,
      bundleItems: b.bundleItems.map((it) => ({
        catalogProductId: it.catalogProductId,
        qty: it.qty,
      })),
    })
    offset += 1
  })

  emit('add-products', products)
  close()
}

// ── Picker 資料 ───────────────────────────────────
const productCategories = computed(() => [
  { label: t('live_order.category.electronics'), value: '3C 電子' },
  { label: t('live_order.category.gaming'),      value: '電玩周邊' },
  { label: t('live_order.category.accessory'),   value: '配件' },
  { label: t('live_order.category.headphone'),   value: '耳機' },
  { label: t('live_order.category.apparel'),     value: '服飾' },
  { label: t('live_order.category.quick_added'), value: '快速新增' },
])
// 規格價格刻意拉開（模擬同商品不同規格各自不同售價）：商品卡可顯示價格區間。
const pickerSpecsMap: Record<number, PickerSpec[]> = {
  1: [
    { id: 101, name: '透明', sku: 'ACC-IP15P-001-CL', cost: 295, originalPrice: 588, price: 490, stock: 40 },
    { id: 102, name: '黑色', sku: 'ACC-IP15P-001-BK', cost: 320, originalPrice: 620, price: 520, stock: 30 },
    { id: 103, name: '深藍', sku: 'ACC-IP15P-001-NV', cost: 340, originalPrice: 660, price: 550, stock: 15 },
  ],
  3: [
    { id: 301, name: '灰色 / 普通版', sku: 'GAM-NSW-001-GR', cost: 5880, originalPrice: 11760, price: 9800, stock: 3 },
    { id: 302, name: '紅色 / 特別版', sku: 'GAM-NSW-001-RD', cost: 6480, originalPrice: 12960, price: 10800, stock: 3 },
  ],
  5: [
    { id: 501, name: '55 吋', sku: '3C-SAM-TV55', cost: 20000, originalPrice: 51480, price: 42900, stock: 2 },
    { id: 502, name: '65 吋', sku: '3C-SAM-TV65', cost: 25740, originalPrice: 61500, price: 51900, stock: 3 },
  ],
  7: [
    { id: 701, name: '黑色 / 青軸', sku: 'GAM-RZR-010-BK-CY', cost: 2100, originalPrice: 4200, price: 3500, stock: 5 },
    { id: 702, name: '白色 / 紅軸', sku: 'GAM-RZR-010-WH-RD', cost: 2400, originalPrice: 4800, price: 3980, stock: 3 },
  ],
  11: [
    { id: 1101, name: 'S / 白',    sku: 'CLO-TS-001-S-WH',   cost: 180, originalPrice: 590, price: 490, stock: 20 },
    { id: 1102, name: 'S / 黑',    sku: 'CLO-TS-001-S-BK',   cost: 180, originalPrice: 590, price: 490, stock: 18 },
    { id: 1103, name: 'M / 白',    sku: 'CLO-TS-001-M-WH',   cost: 180, originalPrice: 590, price: 490, stock: 25 },
    { id: 1104, name: 'M / 黑',    sku: 'CLO-TS-001-M-BK',   cost: 180, originalPrice: 590, price: 490, stock: 22 },
    { id: 1105, name: 'L / 白',    sku: 'CLO-TS-001-L-WH',   cost: 180, originalPrice: 590, price: 490, stock: 15 },
    { id: 1106, name: 'L / 黑',    sku: 'CLO-TS-001-L-BK',   cost: 180, originalPrice: 590, price: 490, stock: 10 },
    { id: 1107, name: 'XL / 白',   sku: 'CLO-TS-001-XL-WH',  cost: 180, originalPrice: 590, price: 490, stock: 8 },
    { id: 1108, name: 'XL / 黑',   sku: 'CLO-TS-001-XL-BK',  cost: 180, originalPrice: 590, price: 490, stock: 6 },
    { id: 1109, name: 'XL / 灰',   sku: 'CLO-TS-001-XL-GY',  cost: 200, originalPrice: 620, price: 510, stock: 5 },
    { id: 1110, name: 'XL / 海軍藍', sku: 'CLO-TS-001-XL-NV',  cost: 200, originalPrice: 620, price: 510, stock: 4 },
    { id: 1111, name: 'XXL / 黑',  sku: 'CLO-TS-001-XXL-BK', cost: 210, originalPrice: 640, price: 530, stock: 3 },
    { id: 1112, name: 'XXL / 灰',  sku: 'CLO-TS-001-XXL-GY', cost: 210, originalPrice: 640, price: 530, stock: 2 },
  ],
}
/**
 * 把 ManagedProduct 上的 flat specs 投影成 picker 用的 PickerSpec：
 * - 「單一規格」或只有 1 筆 → 視為無規格，回空陣列
 * - 多筆 → 沿用 name/price/stock；cost/originalPrice/sku 比照原本 picker 慣例由 price 估
 */
function adaptManagedSpecs(p: { id: number; specs: { id: number; name: string; price: number; stock: number }[]; sku?: string }): PickerSpec[] {
  if (p.specs.length <= 1) return []
  if (p.specs.length === 1 && p.specs[0].name === '單一規格') return []
  return p.specs.map((s) => ({
    id:            s.id,
    name:          s.name,
    sku:           `MP-${p.id}-${s.id}`,
    cost:          Math.round(s.price * 0.6),
    originalPrice: Math.round(s.price * 1.2),
    price:         s.price,
    stock:         s.stock,
  }))
}

/**
 * 用 computed 包起來，讓 productCatalog 透過 addToCatalog 新增條目時 picker 自動同步。
 *
 * specs 來源優先序：
 * 1. 商品管理裡有對應 ManagedProduct 且帶多規格 → 沿用 MP 的規格（保持商品列表 ↔ picker 一致）
 * 2. 否則 fallback 到內建 pickerSpecsMap（舊 mock 商品 1~11 走這條）
 */
const allPickerProducts = computed<PickerProduct[]>(() =>
  productCatalog.map((p) => {
    const mp = managedProducts.find((m) => m.id === p.id)
    const mpSpecs = mp ? adaptManagedSpecs(mp) : []
    const specs = mpSpecs.length > 0 ? mpSpecs : (pickerSpecsMap[p.id] ?? [])
    return {
      ...p,
      cost:          Math.round(p.price * 0.6),
      originalPrice: Math.round(p.price * 1.2),
      specs,
    }
  }),
)

const pickerCategory = ref<string | null>(null)
const pickerSearchField = ref('name')
const pickerKeyword = ref('')
const pickerOnlyAvailable = ref(false)
const pickerExpanded = ref<number[]>([])
const pickerPageFirst = ref(0)
const pickerPageSize = 10
const pickerSearchFields = computed(() => [
  { label: t('live_order.search_field.name'), value: 'name' },
  { label: t('live_order.search_field.sku'),  value: 'sku'  },
])

function resetPicker(): void {
  pickerCategory.value = null
  pickerKeyword.value = ''
  pickerOnlyAvailable.value = false
  pickerExpanded.value = []
  pickerPageFirst.value = 0
}

const filteredPickerProducts = computed(() =>
  allPickerProducts.value.filter((p) => {
    if (pickerCategory.value && p.category !== pickerCategory.value) return false
    if (pickerOnlyAvailable.value && p.status !== '上架中') return false
    if (pickerKeyword.value) {
      return pickerSearchField.value === 'sku'
        ? p.sku.includes(pickerKeyword.value)
        : p.name.includes(pickerKeyword.value)
    }
    return true
  }),
)
const pagedPickerProducts = computed(() =>
  filteredPickerProducts.value.slice(pickerPageFirst.value, pickerPageFirst.value + pickerPageSize),
)

function togglePickerExpand(id: number): void {
  const i = pickerExpanded.value.indexOf(id)
  i === -1 ? pickerExpanded.value.push(id) : pickerExpanded.value.splice(i, 1)
}

// ── 組合商品 picker（從原 AddBundleDialog 整併） ────────────────
const bundleKeyword = ref('')
const bundleSearchField = ref<'name' | 'sku'>('name')
const bundleOnlyAvailable = ref(false)
const bundleExpanded = ref<number[]>([])
const bundlePageFirst = ref(0)
const bundlePageSize = 10

function resetBundlePicker(): void {
  bundleKeyword.value = ''
  bundleSearchField.value = 'name'
  bundleOnlyAvailable.value = false
  bundleExpanded.value = []
  bundlePageFirst.value = 0
}

const filteredBundles = computed(() =>
  bundleCatalog.filter((b) => {
    if (bundleOnlyAvailable.value && b.status !== '上架中') return false
    if (!bundleKeyword.value) return true
    const k = bundleKeyword.value.trim().toLowerCase()
    return bundleSearchField.value === 'sku'
      ? b.sku.toLowerCase().includes(k)
      : b.name.toLowerCase().includes(k)
  }),
)
const pagedBundles = computed(() =>
  filteredBundles.value.slice(bundlePageFirst.value, bundlePageFirst.value + bundlePageSize),
)

function toggleBundleExpand(id: number): void {
  const i = bundleExpanded.value.indexOf(id)
  if (i === -1) bundleExpanded.value = [...bundleExpanded.value, id]
  else bundleExpanded.value = bundleExpanded.value.filter((x) => x !== id)
}
function toggleBundle(id: number): void {
  const next = new Set(selectedBundleIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedBundleIds.value = next
}
function isBundleExisting(b: CatalogBundle): boolean {
  return existingNames.value.has(b.name)
}

const productLookup = computed(() => {
  const m = new Map<number, { name: string; price: number; sku: string }>()
  productCatalog.forEach((p) => m.set(p.id, { name: p.name, price: p.price, sku: p.sku }))
  return m
})
function costApprox(b: CatalogBundle): number {
  // 用子品原價合計的 60% 當組合成本（mock，與原 AddBundleDialog 一致）
  const total = b.bundleItems.reduce((sum, it) => {
    const p = productLookup.value.get(it.catalogProductId)
    return sum + (p?.price ?? 0) * it.qty
  }, 0)
  return Math.round(total * 0.6)
}
function subItemsOf(b: CatalogBundle): Array<{ name: string; sku: string; price: number; qty: number }> {
  return b.bundleItems.map((it) => {
    const p = productLookup.value.get(it.catalogProductId)
    return {
      name: p?.name ?? `#${it.catalogProductId}`,
      sku: p?.sku ?? '',
      price: p?.price ?? 0,
      qty: it.qty,
    }
  })
}
</script>
