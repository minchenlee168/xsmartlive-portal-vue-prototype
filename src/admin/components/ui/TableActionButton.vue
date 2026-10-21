<script setup lang="ts">
/**
 * 表格操作欄按鈕（design.md §7.4 / §7.5，對齊正式專案 libs/ui TableActionButton）。
 *
 * 封裝 `variant="text"`、`size="small"`、`rounded`、`v-tooltip.top` 與 `aria-label`——
 * 操作欄按鈕只放 icon、靠 tooltip 補語意。`label` 為已翻譯字串，兼作 tooltip 與 aria-label，不可省略。
 *
 * 配色（§7.4）：
 * - 編輯（主要操作）→ 不指定 severity（PrimeVue 預設主色紫）；icon 用 FontAwesome ['far','edit']
 * - 刪除 → severity="danger"（危險紅）；icon 用 FontAwesome ['far','trash']
 * - 檢視 / 更多等次要操作 → severity="secondary"
 */
withDefaults(
  defineProps<{
    /** 已翻譯的操作名稱；兼作 tooltip 與 aria-label（必填）。 */
    label: string
    /** FontAwesome icon（如 ['far','edit']）。design.md 鐵則 #3：icon 一律 FontAwesome，禁 pi-*。 */
    icon: string[]
    /** 次要／危險操作的語意色；省略＝主色（編輯類）。 */
    severity?: 'secondary' | 'danger'
    disabled?: boolean
  }>(),
  { severity: undefined, disabled: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <Button
    v-tooltip.top="label"
    :aria-label="label"
    :severity="severity"
    :disabled="disabled"
    variant="text"
    size="small"
    rounded
    @click.stop="emit('click', $event)"
  >
    <template #icon>
      <FontAwesomeIcon :icon="icon" />
    </template>
  </Button>
</template>
