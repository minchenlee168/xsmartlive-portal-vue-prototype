<script setup lang="ts">
/*
 * ⚠️ mock 版面預覽：星等設定彈窗（星等 → 貨到付款資格門檻 / 新註冊預設星等）。
 * 會員資料為前端假資料（../mock/mockMembers）；儲存為本地 stub，未接後端。
 */
import { mockMembers } from '../mock/mockMembers';
import { MOCK_COD_MIN_STAR } from '../utils/mockMemberDetail';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n();
const { showSuccess } = useGlobalToast();

/** 貨到付款最低星等門檻（0 = 不限制）。 */
const codMinStar = ref<number>(MOCK_COD_MIN_STAR);
/** 新註冊會員預設星等。 */
const defaultStar = ref<number>(4);

// 每次開啟時回到目前設定（stub：以常數為初值）
watch(visible, (open) => {
  if (open) {
    codMinStar.value = MOCK_COD_MIN_STAR;
    defaultStar.value = 4;
  }
});

const codMinStarOptions = computed(() => [
  { label: t('member.star_settings.unlimited'), value: 0 },
  ...[1, 2, 3, 4, 5].map((count) => ({ label: t('member.stars.rating', { count }), value: count })),
]);
const defaultStarOptions = computed(() =>
  [1, 2, 3, 4, 5].map((count) => ({ label: t('member.stars.rating', { count }), value: count })),
);

/** 依門檻計算可使用貨到付款的會員數（全體，不受列表篩選影響）。 */
const eligibleCount = computed(() => mockMembers.filter((m) => m.stars >= codMinStar.value).length);
const totalCount = mockMembers.length;

/** 儲存（stub，僅提示）。 */
function handleSave() {
  showSuccess({ detail: t('member.star_settings.save_stub') });
  visible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="$t('member.star_settings.title')"
    :style="{ width: '32rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label
          for="cod-min-star"
          class="text-sm font-medium"
        >{{ $t('member.star_settings.cod_min_star') }}</label>
        <Select
          v-model="codMinStar"
          input-id="cod-min-star"
          :options="codMinStarOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
        <small class="text-muted-color text-xs">{{ $t('member.star_settings.cod_min_star_help') }}</small>
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="default-star"
          class="text-sm font-medium"
        >{{ $t('member.star_settings.default_star') }}</label>
        <Select
          v-model="defaultStar"
          input-id="default-star"
          :options="defaultStarOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
        <small class="text-muted-color text-xs">{{ $t('member.star_settings.default_star_help') }}</small>
      </div>

      <Message
        severity="info"
        :closable="false"
      >
        {{ $t('member.star_settings.summary', { eligible: eligibleCount, total: totalCount }) }}
      </Message>
    </div>

    <template #footer>
      <Button
        :label="$t('common.button.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
      <Button
        :label="$t('common.button.save')"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>
