<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 發放禮物 dialog：UI 沿用 PortalProductForm 的「section + 底線分隔」版型，
 * 但移除規格 / 規格表區塊；發放禮物不需要規格組合。
 *
 * 欄位：
 * - 禮物資料：名稱、關鍵字、發放數量、說明訊息
 * - 禮物圖片：本地 base64 預覽
 *
 * 直接以 toast / pinned 留言形式呈現給觀眾；不會建立 LiveProduct，不會佔商品卡欄位。
 */

export interface GiftSubmitPayload {
  name: string
  keyword: string
  quantity: number
  message: string
  imageUrl?: string
}

/** 編輯時帶入的現有禮物資料；新增流程不傳，維持空白表單。 */
export interface GiftInitial {
  name?: string
  keyword?: string
  stock?: number
  note?: string
  imageUrl?: string
}

interface Props {
  visible?: boolean
  product?: GiftInitial | null
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  product: null,
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: GiftSubmitPayload]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
const name = ref('')
const keyword = ref('')
const quantity = ref<number | null>(1)
const message = ref('')
const imageUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      // 有帶 product → 編輯模式預填；否則新增模式空白
      const g = props.product
      name.value = g?.name ?? ''
      keyword.value = g?.keyword ?? ''
      quantity.value = g?.stock ?? 1
      message.value = g?.note ?? ''
      imageUrl.value = g?.imageUrl ?? null
    }
  },
  { immediate: true },
)

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

const canSubmit = computed(
  () => name.value.trim().length > 0
    && typeof quantity.value === 'number'
    && quantity.value > 0,
)

function onPickImage(): void {
  fileInputRef.value?.click()
}

async function onImageChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  imageUrl.value = await readFileAsBase64(file)
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function clearImage(): void {
  imageUrl.value = null
}

function onSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    keyword: keyword.value.trim(),
    quantity: quantity.value ?? 1,
    message: message.value.trim(),
    imageUrl: imageUrl.value ?? undefined,
  })
  close()
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(720px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span
        class="font-semibold text-[var(--p-text-color)] flex items-center gap-2"
        style="font-size: 17.5px"
      >
        <i class="pi pi-gift text-[var(--p-primary-color)]" style="font-size: 18px"></i>
        {{ t('live_order.dialog.send_gift_header') }}
      </span>
    </template>

    <div class="flex flex-col gap-5 pt-2">
      <!-- 禮物資料 -->
      <section class="border-b border-[var(--p-content-border-color)] pb-5">
        <h3 class="text-[15px] font-semibold text-[var(--p-text-color)] mb-4">
          {{ t('live_order.gift_form.section.basic') }}
        </h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-[14px] font-medium text-[var(--p-text-color)]">
              {{ t('live_order.gift_form.field.name') }}
            </label>
            <InputText
              v-model="name"
              :placeholder="t('live_order.gift_form.placeholder.name')"
              class="w-full"
              @keyup.enter="onSubmit"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-medium text-[var(--p-text-color)]">
              {{ t('live_order.gift_form.field.keyword') }}
            </label>
            <InputText
              v-model="keyword"
              :placeholder="t('live_order.gift_form.placeholder.keyword')"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[14px] font-medium text-[var(--p-text-color)]">
              {{ t('live_order.gift_form.field.quantity') }}
            </label>
            <InputNumber
              v-model="quantity"
              :min="1"
              :use-grouping="false"
              class="w-full"
              :input-style="{ width: '100%' }"
            />
          </div>

          <div class="col-span-2 flex flex-col gap-2">
            <label class="text-[14px] font-medium text-[var(--p-text-color)]">
              {{ t('live_order.gift_form.field.message') }}
            </label>
            <Textarea
              v-model="message"
              :placeholder="t('live_order.gift_form.placeholder.message')"
              rows="3"
              class="w-full resize-none"
            />
          </div>
        </div>
      </section>

      <!-- 禮物圖片 -->
      <section>
        <h3 class="text-[15px] font-semibold text-[var(--p-text-color)] mb-4">
          {{ t('live_order.gift_form.section.image') }}
        </h3>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onImageChange"
        />

        <div v-if="imageUrl" class="flex items-start gap-3">
          <img
            :src="imageUrl"
            alt="gift"
            class="w-[120px] h-[120px] object-cover rounded-[6px] border border-[var(--p-content-border-color)]"
          />
          <div class="flex flex-col gap-2">
            <Button
              :label="t('live_order.button.upload_from_app')"
              icon="pi pi-camera"
              severity="secondary"
              variant="outlined"
              size="small"
              @click="onPickImage"
            />
            <Button
              :label="t('live_order.button.remove')"
              icon="pi pi-trash"
              severity="danger"
              variant="text"
              size="small"
              @click="clearImage"
            />
          </div>
        </div>

        <button
          v-else
          type="button"
          class="w-[120px] h-[120px] border-2 border-dashed border-[var(--p-content-border-color)] rounded-[6px] bg-[var(--p-content-hover-background)] flex flex-col items-center justify-center gap-1 text-[var(--p-text-muted-color)] hover:border-[var(--p-primary-color)] hover:text-[var(--p-primary-color)]"
          @click="onPickImage"
        >
          <i class="pi pi-image" style="font-size: 28px"></i>
          <span class="text-[11px]">
            {{ t('live_order.button.upload_from_app') }}
          </span>
        </button>
      </section>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          variant="outlined"
          @click="close"
        />
        <Button
          :label="t('live_order.button.send_gift')"
          icon="pi pi-send"
          :disabled="!canSubmit"
          @click="onSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>
