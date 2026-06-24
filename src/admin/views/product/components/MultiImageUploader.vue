<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useToast } from 'primevue/usetoast'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/**
 * 多圖上傳元件（簡化版；對齊 portal-vue MultiImageUploader 的 UX，無 cropper / base64 cache）。
 *
 * 功能：
 * - 多檔選取（支援拖入 input 或點 + 按鈕）
 * - 拖曳排序（HTML5 drag），首張視為主圖並掛 badge
 * - 每張獨立刪除
 * - 限制總張數 + 單檔大小（超過 toast warn 並略過該檔）
 * - 以 FileReader 轉 data URL（prototype 不打上傳 API）
 *
 * v-model:images binding：
 *   <MultiImageUploader v-model:images="form.images" ... />
 */

export interface UploaderItem {
  /** 本地識別 id（API 上傳完才會換回 server-side id） */
  id: number | string
  /** 圖片 src（dataURL / blobURL / API URL） */
  url: string
  /** 原始檔名（顯示用） */
  filename?: string
  /** 檔案大小 bytes（檢查用） */
  size?: number
}

interface Props {
  /** 最多張數 */
  maxCount?: number
  /** 單檔上限 bytes，預設 5MB */
  maxFileSize?: number
  /** 唯讀模式 */
  disabled?: boolean
  /** 圖片格 aspect ratio：1=正方，4/3=4:3 */
  aspectRatio?: number
}
const props = withDefaults(defineProps<Props>(), {
  maxCount: 8,
  maxFileSize: 5 * 1024 * 1024,
  disabled: false,
  aspectRatio: 1,
})

const images = defineModel<UploaderItem[]>('images', { default: () => [] })

const emit = defineEmits<{
  removed: [id: number | string]
}>()

const toast = useToast()
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

const canAddMore = computed(() => !props.disabled && images.value.length < props.maxCount)

function openPicker(): void {
  if (!canAddMore.value) return
  fileInputRef.value?.click()
}

function onFilePick(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  void addFiles(files)
  input.value = ''  // reset 讓同一檔可重選
}

async function addFiles(files: File[]): Promise<void> {
  const remaining = props.maxCount - images.value.length
  if (remaining <= 0) return
  const taking = files.slice(0, remaining)
  const oversize: string[] = []
  const readPromises = taking.map(async (file) => {
    if (file.size > props.maxFileSize) {
      oversize.push(file.name)
      return null
    }
    const url = await readAsDataUrl(file)
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      filename: file.name,
      size: file.size,
    } satisfies UploaderItem
  })
  const results = (await Promise.all(readPromises)).filter((x): x is UploaderItem => !!x)
  images.value = [...images.value, ...results]
  if (oversize.length) {
    toast.add({
      severity: 'warn',
      summary: `${oversize.length} 張圖片過大已略過`,
      detail: `單檔上限 ${(props.maxFileSize / 1024 / 1024).toFixed(0)}MB`,
      life: 3000,
    })
  }
  if (files.length > remaining) {
    toast.add({
      severity: 'warn',
      summary: `只加入 ${remaining} 張`,
      detail: `已達上限 ${props.maxCount} 張`,
      life: 2500,
    })
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function removeAt(id: number | string): void {
  images.value = images.value.filter((img) => img.id !== id)
  emit('removed', id)
}

// HTML5 drag reorder
const draggingId = ref<number | string | null>(null)
function onDragStart(id: number | string): void {
  if (props.disabled) return
  draggingId.value = id
}
function onDragOver(event: DragEvent): void {
  event.preventDefault()
}
function onDrop(targetId: number | string): void {
  if (props.disabled || draggingId.value == null) return
  const fromIdx = images.value.findIndex((i) => i.id === draggingId.value)
  const toIdx = images.value.findIndex((i) => i.id === targetId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
    draggingId.value = null
    return
  }
  const next = [...images.value]
  const [moved] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, moved)
  images.value = next
  draggingId.value = null
}
function onDragEnd(): void {
  draggingId.value = null
}

const slotStyle = computed(() => ({
  aspectRatio: String(props.aspectRatio),
}))
</script>

<template>
  <div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onFilePick"
    />

    <div class="flex flex-wrap gap-3">
      <!-- 既有圖片 -->
      <div
        v-for="(img, idx) in images"
        :key="img.id"
        :style="slotStyle"
        class="relative w-[140px] rounded-md border border-surface bg-surface-50 overflow-hidden group"
        :class="{ 'opacity-50': draggingId === img.id }"
        :draggable="!disabled"
        @dragstart="onDragStart(img.id)"
        @dragover="onDragOver"
        @drop="onDrop(img.id)"
        @dragend="onDragEnd"
      >
        <img :src="img.url" :alt="img.filename ?? ''" class="size-full object-cover" />

        <!-- 主圖 badge -->
        <span
          v-if="idx === 0"
          class="absolute top-1.5 left-1.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold leading-none bg-primary text-white"
        >主圖</span>

        <!-- 移除按鈕 -->
        <button
          v-if="!disabled"
          v-tooltip.top="'移除'"
          type="button"
          class="absolute top-1.5 right-1.5 size-[24px] rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          @click="removeAt(img.id)"
        >
          <FontAwesomeIcon :icon="['far', 'trash']" class="text-[11px]" />
        </button>

        <!-- 拖曳手柄提示（hover 才出現） -->
        <span
          v-if="!disabled"
          class="absolute bottom-1.5 right-1.5 size-[24px] rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
          v-tooltip.top="'拖曳調整順序'"
        >
          <i class="pi pi-bars" style="font-size: 11px"></i>
        </span>
      </div>

      <!-- 新增格 -->
      <button
        v-if="canAddMore"
        type="button"
        :style="slotStyle"
        class="w-[140px] rounded-md border-2 border-dashed border-primary text-primary hover:bg-primary-50 flex flex-col items-center justify-center gap-1"
        @click="openPicker"
      >
        <i class="pi pi-plus" style="font-size: 20px"></i>
        <span class="text-xs">上傳圖片</span>
      </button>
    </div>

    <p class="mt-3 text-xs text-color-secondary">
      已上傳 {{ images.length }} / {{ maxCount }} 張，單檔上限
      {{ (maxFileSize / 1024 / 1024).toFixed(0) }}MB；首張為主圖，拖曳可調整順序。
    </p>
  </div>
</template>
