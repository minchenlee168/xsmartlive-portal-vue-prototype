<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 綜合收單頁設定彈窗。
 *
 * 由「批次設定」的 SplitButton 下拉開啟；分區設定：
 * - 重複下單判定模式（radio）+ 允許關鍵字取消下單（checkbox）
 * - 通知設定（多個 checkbox）
 * - 列印設定
 *
 * 原型階段以本地 model 暫存，按下儲存 emit('save', value)。
 */

export type DuplicateOrderMode = 'keep_latest' | 'keep_highest_bid' | 'allow' | 'reject'

export interface PanelSettings {
  duplicateOrderMode: DuplicateOrderMode
  allowKeywordCancel: boolean
  notifyOrderStart: boolean
  notifyOrderEnd: boolean
  notifyOutOfStock: boolean
  notifyWinnerOrderCreated: boolean
  autoPrintShipment: boolean
}

interface Props {
  visible?: boolean
  settings: PanelSettings
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [settings: PanelSettings]
}>()

const { t } = useI18n()

/** 內部編輯 buffer，打開時 deep clone props.settings；按儲存才 emit。 */
const form = ref<PanelSettings>(clone(props.settings))

watch(
  () => props.visible,
  (v) => { if (v) form.value = clone(props.settings) },
)

function clone(s: PanelSettings): PanelSettings { return { ...s } }
function onVisibleChange(v: boolean): void { emit('update:visible', v) }
function onSave(): void {
  emit('save', clone(form.value))
  onVisibleChange(false)
}
function onCancel(): void { onVisibleChange(false) }
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="true"
    :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 18px 22px' },
      content: { style: 'padding: 0 22px 16px' },
      footer: { style: 'padding: 12px 22px' },
    }"
    @update:visible="onVisibleChange"
  >
    <template #header>
      <span class="font-bold text-[var(--p-text-color)]" style="font-size: 18px">
        {{ t('live_order.panel_setting.header') }}
      </span>
    </template>

    <div class="flex flex-col gap-6 pt-1">

      <!-- 區塊 1：重複下單判定模式 -->
      <section class="flex flex-col gap-2">
        <h3 class="font-bold text-[15px] text-[var(--p-text-color)]">
          {{ t('live_order.panel_setting.duplicate_order_mode') }}
        </h3>
        <p class="text-[13px] text-[var(--p-text-muted-color)]">
          {{ t('live_order.panel_setting.duplicate_order_mode_desc') }}
        </p>
        <div class="flex flex-col gap-2 pt-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <RadioButton v-model="form.duplicateOrderMode" value="keep_latest" input-id="dup-latest" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.dup_keep_latest') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <RadioButton v-model="form.duplicateOrderMode" value="keep_highest_bid" input-id="dup-highest" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.dup_keep_highest') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <RadioButton v-model="form.duplicateOrderMode" value="allow" input-id="dup-allow" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.dup_allow') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <RadioButton v-model="form.duplicateOrderMode" value="reject" input-id="dup-reject" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.dup_reject') }}</span>
          </label>
        </div>

        <!-- 允許關鍵字取消下單（接在 radio 下） -->
        <div class="flex flex-col gap-1 pt-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.allowKeywordCancel" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">
              {{ t('live_order.panel_setting.allow_keyword_cancel') }}
            </span>
          </label>
          <p class="text-[12.5px] text-[var(--p-text-muted-color)] pl-7">
            {{ t('live_order.panel_setting.allow_keyword_cancel_desc') }}
          </p>
        </div>
      </section>

      <!-- 區塊 2：通知設定 -->
      <section class="flex flex-col gap-2">
        <h3 class="font-bold text-[15px] text-[var(--p-text-color)]">
          {{ t('live_order.panel_setting.notification_section') }}
        </h3>
        <div class="flex flex-col gap-2 pt-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.notifyOrderStart" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.notify_order_start') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.notifyOrderEnd" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.notify_order_end') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.notifyOutOfStock" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.notify_out_of_stock') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.notifyWinnerOrderCreated" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.notify_winner_order_created') }}</span>
          </label>
        </div>
      </section>

      <!-- 區塊 3：列印設定 -->
      <section class="flex flex-col gap-2">
        <h3 class="font-bold text-[15px] text-[var(--p-text-color)]">
          {{ t('live_order.panel_setting.print_section') }}
        </h3>
        <div class="flex flex-col gap-2 pt-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox v-model="form.autoPrintShipment" :binary="true" />
            <span class="text-[14px] text-[var(--p-text-color)]">{{ t('live_order.panel_setting.auto_print_shipment') }}</span>
          </label>
        </div>
      </section>

    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          outlined
          @click="onCancel"
        />
        <Button
          :label="t('live_order.panel_setting.save')"
          icon="pi pi-save"
          @click="onSave"
        />
      </div>
    </template>
  </Dialog>
</template>
