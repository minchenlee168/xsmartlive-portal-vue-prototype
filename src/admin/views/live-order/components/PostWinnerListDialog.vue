<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(1100px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="v => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size:17.5px">
        查看得標人
      </span>
    </template>

    <div class="flex flex-col gap-4">
      <!-- 篩選列：搜尋用戶 / 排序方式依照 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm text-[var(--p-text-color)]">搜尋用戶</label>
          <InputText v-model="searchQuery" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm text-[var(--p-text-color)]">排序方式依照...</label>
          <Select
            v-model="sortBy"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <DataTable
        :value="filteredWinners"
        :striped-rows="true"
        class="w-full"
        :pt="{
          column: { headerCell: { style: 'white-space: nowrap;' } },
        }"
      >
        <Column field="member" header="用戶名稱">
          <template #body="{ data }">
            <span class="text-[var(--p-text-color)]">{{ data.member }}</span>
          </template>
        </Column>
        <Column field="productName" header="商品名稱">
          <template #body="{ data }">
            <span class="text-[var(--p-text-color)]">{{ data.productName }}</span>
          </template>
        </Column>
        <Column field="keyword" header="關鍵字">
          <template #body="{ data }">
            <Tag v-if="data.keyword" :value="data.keyword" severity="info" />
            <span v-else class="text-[var(--p-text-muted-color)]">—</span>
          </template>
        </Column>
        <Column field="commentText" header="得標留言">
          <template #body="{ data }">
            <span class="text-[var(--p-text-color)]">{{ data.commentText || '—' }}</span>
          </template>
        </Column>

        <template #empty>
          <div class="py-12 text-center text-sm font-medium text-[#ef4444]">
            無法取得銷售紀錄
          </div>
        </template>
      </DataTable>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getWinnersByProduct } from '../utils/liveWinners'

interface ProductLike {
  id: number
  name?: string
  keyword?: string
  [key: string]: unknown
}

interface WinnerRow {
  member: string
  productName: string
  keyword: string
  commentText: string
  qty: number
}

interface Props {
  visible?: boolean
  /** 進入的 collection 底下所有商品；用來組出所有得標人清單 */
  products?: ProductLike[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  products: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const innerVisible = ref(props.visible)
watch(() => props.visible, v => { innerVisible.value = v })

const searchQuery = ref('')
const sortBy = ref<'member' | 'qty'>('member')

const sortOptions = [
  { label: '用戶名稱', value: 'member' as const },
  { label: '購買數量', value: 'qty'    as const },
]

/** 把 collection 底下每個商品的 winners 打平合併,補上商品名稱與關鍵字。 */
const allWinners = computed<WinnerRow[]>(() =>
  props.products.flatMap((p) =>
    getWinnersByProduct(p.id).value.map((w) => ({
      member: w.member,
      productName: p.name ?? w.productName ?? '',
      keyword: p.keyword ?? '',
      commentText: w.commentText ?? '',
      qty: w.qty,
    }))
  ),
)

const filteredWinners = computed<WinnerRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = allWinners.value
  if (q) list = list.filter((w) => w.member.toLowerCase().includes(q))
  if (sortBy.value === 'qty') {
    return [...list].sort((a, b) => b.qty - a.qty)
  }
  return [...list].sort((a, b) => a.member.localeCompare(b.member, 'zh-Hant'))
})
</script>
