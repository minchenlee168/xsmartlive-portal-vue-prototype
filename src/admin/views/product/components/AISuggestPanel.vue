<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * AI 商品建議面板（簡化版；對齊 portal-vue AISuggestPanel 的 UX，無 API 串接）。
 *
 * 流程：
 * 1) 使用者輸入提示（或留白用 fallback prompt）→ 按「生成建議」
 * 2) setTimeout 模擬 AI 回應 → 顯示建議區塊：商品名 / 分類 / 關鍵字（3 選 1）/ 標籤（可多選）/
 *    規格（可多組）/ 商品介紹
 * 3) 點任一建議 chip → emit('apply', payload) 讓父層 ProductUpdatePage 寫進 form；
 *    已套用的 chip 切換 success severity，再點一次切回 info（撤銷）
 *
 * 真實 API 接入時把 generate() 內的 mock 換成 fetch 即可，emit shape 不變。
 */

export interface AiSuggestion {
  productName?: string
  categories?: string[]
  keywords?: string[]
  tags?: string[]
  specs?: { groupName: string; options: string[] }[]
  description?: string
}

export type AiApplyPayload =
  | { kind: 'productName'; value: string }
  | { kind: 'category'; value: string }
  | { kind: 'keyword'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'spec'; value: { groupName: string; options: string[] } }
  | { kind: 'description'; value: string }

interface Props {
  /** 控制 Drawer 顯示 */
  visible: boolean
  /** 當前已採用的標籤（讓 chip 顯示 success severity） */
  adoptedTags?: string[]
  /** 當前是否已採用某條 productName 建議（用 chip severity 反映） */
  adoptedProductName?: string | null
  /** 當前是否已採用 description 建議 */
  adoptedDescription?: string | null
  /** 已採用的關鍵字 */
  adoptedKeyword?: string | null
  /** 已採用的分類 */
  adoptedCategory?: string | null
  /** 已採用的規格組合名稱 set */
  adoptedSpecGroupNames?: string[]
}
const props = withDefaults(defineProps<Props>(), {
  adoptedTags: () => [],
  adoptedProductName: null,
  adoptedDescription: null,
  adoptedKeyword: null,
  adoptedCategory: null,
  adoptedSpecGroupNames: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  apply: [payload: AiApplyPayload]
}>()

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const prompt = ref('')
const isGenerating = ref(false)
const suggestion = ref<AiSuggestion | null>(null)

/** 模擬 AI：固定 mock，setTimeout 模擬延遲；真實接入時換成 fetch */
function generate(): void {
  if (isGenerating.value) return
  isGenerating.value = true
  suggestion.value = null
  window.setTimeout(() => {
    suggestion.value = {
      productName: '夏季韓系寬版短袖',
      categories: ['服飾配件', '健康與美容'],
      keywords: ['TOP', 'SUMMER', 'KOREA'],
      tags: ['熱銷', '新品', '限量'],
      specs: [
        { groupName: '尺寸', options: ['S', 'M', 'L', 'XL'] },
        { groupName: '顏色', options: ['白', '黑', '米', '杏'] },
      ],
      description: '採用輕透氣材質，下擺微傘狀，搭配高腰褲或裙裝都好看；建議手洗或洗衣袋低速。',
    }
    isGenerating.value = false
  }, 1200)
}

function applyProductName(): void {
  if (!suggestion.value?.productName) return
  emit('apply', { kind: 'productName', value: suggestion.value.productName })
}
function applyCategory(value: string): void { emit('apply', { kind: 'category', value }) }
function applyKeyword(value: string): void { emit('apply', { kind: 'keyword', value }) }
function applyTag(value: string): void { emit('apply', { kind: 'tag', value }) }
function applySpec(value: { groupName: string; options: string[] }): void {
  emit('apply', { kind: 'spec', value })
}
function applyDescription(): void {
  if (!suggestion.value?.description) return
  emit('apply', { kind: 'description', value: suggestion.value.description })
}

function isProductNameAdopted(): boolean {
  return !!(suggestion.value?.productName && props.adoptedProductName === suggestion.value.productName)
}
function isDescriptionAdopted(): boolean {
  return !!(suggestion.value?.description && props.adoptedDescription === suggestion.value.description)
}
function isCategoryAdopted(c: string): boolean { return props.adoptedCategory === c }
function isKeywordAdopted(k: string): boolean { return props.adoptedKeyword === k }
function isTagAdopted(t: string): boolean { return props.adoptedTags.includes(t) }
function isSpecAdopted(s: { groupName: string }): boolean { return props.adoptedSpecGroupNames.includes(s.groupName) }
</script>

<template>
  <Drawer
    v-model:visible="innerVisible"
    position="right"
    :modal="true"
    :dismissable="true"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :pt="{
      root:    { class: '!max-w-[95vw]' },
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
    }"
  >
    <template #header>
      <span class="font-semibold text-color flex items-center gap-2" style="font-size: 18px">
        <i class="pi pi-sparkles text-primary" style="font-size: 16px"></i>
        AI 商品建議
      </span>
    </template>

    <!-- Prompt -->
    <div class="flex flex-col gap-3">
      <label class="text-sm font-bold text-color">描述你的商品</label>
      <Textarea
        v-model="prompt"
        rows="4"
        placeholder="例：夏季韓系寬版短袖，主打透氣材質，鎖定 25-35 歲女性"
      />
      <Button
        :label="isGenerating ? '產生中…' : '生成建議'"
        :icon="isGenerating ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"
        :disabled="isGenerating"
        @click="generate"
      />
    </div>

    <!-- 建議區塊 -->
    <div v-if="suggestion" class="flex flex-col gap-5 mt-6">
      <!-- 商品名稱 -->
      <section v-if="suggestion.productName" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">商品名稱</h4>
        <Tag
          rounded
          :severity="isProductNameAdopted() ? 'success' : 'info'"
          class="cursor-pointer transition-all hover:scale-[1.02] w-fit"
          @click="applyProductName"
        >
          <span class="px-1">{{ suggestion.productName }}</span>
        </Tag>
      </section>

      <!-- 分類 -->
      <section v-if="suggestion.categories?.length" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">分類建議</h4>
        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="c in suggestion.categories"
            :key="c"
            rounded
            :severity="isCategoryAdopted(c) ? 'success' : 'info'"
            class="cursor-pointer transition-all hover:scale-[1.02]"
            @click="applyCategory(c)"
          >
            <span class="px-1">{{ c }}</span>
          </Tag>
        </div>
      </section>

      <!-- 關鍵字 -->
      <section v-if="suggestion.keywords?.length" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">關鍵字（擇一）</h4>
        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="k in suggestion.keywords"
            :key="k"
            rounded
            :severity="isKeywordAdopted(k) ? 'success' : 'info'"
            class="cursor-pointer transition-all hover:scale-[1.02]"
            @click="applyKeyword(k)"
          >
            <span class="px-1">{{ k }}</span>
          </Tag>
        </div>
      </section>

      <!-- 標籤 -->
      <section v-if="suggestion.tags?.length" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">標籤（可多選）</h4>
        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="t in suggestion.tags"
            :key="t"
            rounded
            :severity="isTagAdopted(t) ? 'success' : 'info'"
            class="cursor-pointer transition-all hover:scale-[1.02]"
            @click="applyTag(t)"
          >
            <span class="px-1">{{ t }}</span>
          </Tag>
        </div>
      </section>

      <!-- 規格 -->
      <section v-if="suggestion.specs?.length" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">規格</h4>
        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="s in suggestion.specs"
            :key="s.groupName"
            rounded
            :severity="isSpecAdopted(s) ? 'success' : 'info'"
            class="cursor-pointer transition-all hover:scale-[1.02]"
            @click="applySpec(s)"
          >
            <span class="px-1">
              <strong>{{ s.groupName }}</strong>：{{ s.options.join(' / ') }}
            </span>
          </Tag>
        </div>
      </section>

      <!-- 商品介紹 -->
      <section v-if="suggestion.description" class="flex flex-col gap-2">
        <h4 class="text-sm font-bold text-color">商品介紹</h4>
        <p class="text-sm text-color-secondary leading-relaxed rounded-md border border-surface bg-surface-50 p-3">
          {{ suggestion.description }}
        </p>
        <Tag
          rounded
          :severity="isDescriptionAdopted() ? 'success' : 'info'"
          class="cursor-pointer transition-all hover:scale-[1.02] w-fit"
          @click="applyDescription"
        >
          <span class="px-1">{{ isDescriptionAdopted() ? '已套用商品介紹' : '套用為商品介紹' }}</span>
        </Tag>
      </section>
    </div>

    <!-- 空狀態 -->
    <div v-else-if="!isGenerating" class="mt-8 flex flex-col items-center gap-2 text-color-secondary">
      <i class="pi pi-sparkles text-primary opacity-40" style="font-size: 36px"></i>
      <p class="text-sm">按「生成建議」獲取 AI 提供的商品文案</p>
    </div>
  </Drawer>
</template>
