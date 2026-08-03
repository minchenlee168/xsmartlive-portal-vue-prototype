<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { RouteName } from '@/admin/router';
import { mockLotteryList } from './mockData';
import { generateCandidates } from './candidateMock';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { showInfo, showSuccess, showError } = useGlobalToast();

const lotteryId = computed(() => String(route.params.id ?? ''));
const lottery = computed(() => mockLotteryList.find((row) => row.id === lotteryId.value));
// 場次名稱優先讀 query（讓不同抽獎類型可共用此頁），否則回查得標禮 mock
const sessionName = computed(() => (
  (typeof route.query.session === 'string' && route.query.session)
  || lottery.value?.sessionName
  || ''
));

function handleBackToList() {
  router.push({ name: RouteName.BidGiftLotteryList });
}

const isWinnerDialogVisible = ref(false);
const isCandidateDialogVisible = ref(false);

const winnerList = computed(() => winners.value);

function handleShowWinnerList() {
  isWinnerDialogVisible.value = true;
}

function handleShowCandidateList() {
  isCandidateDialogVisible.value = true;
}

type DrawStage = 'idle' | 'drawing' | 'result';

const BASE = import.meta.env.BASE_URL;
const STAGE_SRC: Record<DrawStage, string> = {
  idle: `${BASE}lottery/idle.html`,
  drawing: `${BASE}lottery/drawing.html`,
  result: `${BASE}lottery/result.html`,
};

const stage = ref<DrawStage>('idle');
const backgroundFrame = useTemplateRef<HTMLIFrameElement>('backgroundFrame');

// 階段切換時通知背景：drawing 啟動光束、result 立即停下光束（煙火等 result.html 通知後才觸發）
watch(stage, (next, prev) => {
  const message = next === 'drawing' ? 'start-burst' : next === 'result' ? 'stop-burst' : null;
  if (message) backgroundFrame.value?.contentWindow?.postMessage(message, '*');

  if (next === 'drawing') startCycling();
  else if (prev === 'drawing') stopCycling();

  // 進入 result：先鎖住「再抽」；禮物盒展開（winner-revealed）後才淡出、切成中獎名單並逐一填入
  if (next === 'result') {
    isAwaitingReveal.value = true;
    revealStarted = false;
    showWinnerPanel.value = false; // 先顯示禮物盒開箱
    if (revealFallback !== null) clearTimeout(revealFallback);
    // 保險：若 iframe 沒回 winner-revealed，仍在 3.5s 後啟動揭曉，避免卡在等待態
    revealFallback = window.setTimeout(beginRoundReveal, 3500);
  }
});

// result.html 在禮物盒展開後會 postMessage 'winner-revealed'：觸發背景煙火，
// 讓開箱瞬間先被看到，再切換成中獎名單面板並逐一填入
function handleStageMessage(event: MessageEvent) {
  if (event.data !== 'winner-revealed') return;
  backgroundFrame.value?.contentWindow?.postMessage('celebrate', '*');
  window.setTimeout(beginRoundReveal, 500);
}

const stageSrc = computed(() => {
  const base = STAGE_SRC[stage.value];
  if (stage.value !== 'result') return base;
  // 單抽（N=1）：圓框揭曉該位；連抽（N>1）：不放特定人，僅播機台掀蓋 + 煙火慶祝
  if (roundWinners.value.length === 1) {
    const only = roundWinners.value[0];
    const params = new URLSearchParams({ name: only.name, avatar: only.avatar });
    return `${base}?${params.toString()}`;
  }
  return base;
});

// 每輪重建 iframe，避免 result.html 重用造成動畫不重播
const stageFrameKey = computed(() => `${stage.value}-${round.value}`);
const stageLabel = computed(() => (
  stage.value === 'result' && showWinnerPanel.value
    ? 'bid_gift_lottery_draw.status.winlist'
    : `bid_gift_lottery_draw.status.${stage.value}`
));

// 完整抽獎名單（原型階段：mock 120 位以驗證高人數分級顯示）
const candidateList = ref(generateCandidates(120));

type Person = { name: string; avatar: string };

// 累積得獎者（跨輪，供頂部「得獎名單」Dialog 檢視）
const winners = ref<Person[]>([]);
// 本輪抽出的 N 位：停下時一次決定，隨後在「本輪得獎名單顯示區」逐一揭曉、揭曉時併入 winners
const roundWinners = ref<Person[]>([]);
// 本輪顯示區的 N 個位置；locked 前為「抽選中…」，逐一 lock 後填入得主
const roundSlots = ref<Array<{ winner: Person | null; locked: boolean }>>([]);
const remainingCandidates = computed(() => (
  candidateList.value.filter((person) => (
    !winners.value.includes(person) && !roundWinners.value.includes(person)
  ))
));

// 連抽數量（方案 A）：預設 10，範圍 1..剩餘人數；抽獎中 / 揭曉中不可調整
const drawCount = ref(10);
const maxDraw = computed(() => Math.max(1, remainingCandidates.value.length));
watch(maxDraw, (max) => {
  if (drawCount.value > max) drawCount.value = max;
});
function stepDraw(delta: number) {
  drawCount.value = Math.min(maxDraw.value, Math.max(1, drawCount.value + delta));
}
function onDrawCountChange(event: Event) {
  const parsed = parseInt((event.target as HTMLInputElement).value, 10);
  drawCount.value = Number.isNaN(parsed) || parsed < 1
    ? 1
    : Math.min(maxDraw.value, parsed);
}

// 本輪揭曉：於 winner-revealed（圓框展開高潮）啟動，逐一 lock；N=1 即與圓框同步
const REVEAL_INTERVAL = 250;
let revealStarted = false;
let revealFallback: number | null = null;
const revealTimers: number[] = [];
// 抽完後：禮物盒展開慶祝一下即淡出，改顯示可捲動的中獎名單面板
const showWinnerPanel = ref(false);
const winlistGridEl = useTemplateRef<HTMLDivElement>('winlistGridEl');
// 每 lock 一位就把名單捲到最新一位，保持在視野內
function scrollRoundToLatest() {
  nextTick(() => {
    const grid = winlistGridEl.value;
    if (grid) grid.scrollTo({ top: grid.scrollHeight, behavior: 'smooth' });
  });
}
const latestLockedIndex = computed(() => {
  let idx = -1;
  roundSlots.value.forEach((slot, i) => {
    if (slot.locked) idx = i;
  });
  return idx;
});

function clearRevealTimers() {
  revealTimers.forEach((id) => clearTimeout(id));
  revealTimers.length = 0;
}

function lockSlot(i: number) {
  const slot = roundSlots.value[i];
  if (!slot || slot.locked) return;
  slot.winner = roundWinners.value[i];
  slot.locked = true;
  winners.value.push(roundWinners.value[i]);
  scrollRoundToLatest();
  if (roundSlots.value.every((s) => s.locked)) isAwaitingReveal.value = false;
}

function beginRoundReveal() {
  if (revealStarted) return;
  revealStarted = true;
  showWinnerPanel.value = true; // 禮物盒 → 中獎名單面板
  if (revealFallback !== null) {
    clearTimeout(revealFallback);
    revealFallback = null;
  }
  roundSlots.value.forEach((_, i) => {
    revealTimers.push(window.setTimeout(() => lockSlot(i), i * REVEAL_INTERVAL));
  });
}

// 空白鍵/提前結束：跳過剩餘揭曉節奏，立即鎖定本輪全部得主
function revealAllRemaining() {
  clearRevealTimers();
  if (revealFallback !== null) {
    clearTimeout(revealFallback);
    revealFallback = null;
  }
  revealStarted = true;
  showWinnerPanel.value = true;
  roundSlots.value.forEach((slot, i) => {
    if (slot.locked) return;
    slot.winner = roundWinners.value[i];
    slot.locked = true;
    winners.value.push(roundWinners.value[i]);
  });
  scrollRoundToLatest();
  isAwaitingReveal.value = false;
}

// 候選人格陣採雙層景深：後排（小、模糊）+ 前排（清晰、輪動），多出來摺成右上「+X 人」
// 內容收在 1000px 中央後一排放不下原本 22 / 30 顆頭像 → 收成單排上限，避免換行
const POOL_FRONT_LIMIT = 14;
const POOL_BACK_LIMIT = 20;
const POOL_CYCLE_INTERVAL = 200;

const foregroundCandidates = computed(() => remainingCandidates.value.slice(0, POOL_FRONT_LIMIT));
const backgroundCandidates = computed(() => (
  remainingCandidates.value.slice(POOL_FRONT_LIMIT, POOL_FRONT_LIMIT + POOL_BACK_LIMIT)
));
const overflowCount = computed(() => Math.max(
  0,
  remainingCandidates.value.length - POOL_FRONT_LIMIT - POOL_BACK_LIMIT,
));

const activeSlotIndex = ref<number | null>(0);
const round = ref(0);
const isAwaitingReveal = ref(false);
const frontRowEl = useTemplateRef<HTMLDivElement>('frontRowEl');
const trackerStyle = ref<Record<string, string>>({ opacity: '0' });
let cycleTimer: number | null = null;

// 浮動主色外框：依 activeSlotIndex 移動到目前頭像位置，產生「外框跟著頭像跑」的感覺
watch([activeSlotIndex, foregroundCandidates], async () => {
  await nextTick();
  if (activeSlotIndex.value === null || !frontRowEl.value) {
    trackerStyle.value = { opacity: '0' };
    return;
  }
  const items = frontRowEl.value.querySelectorAll<HTMLElement>('.lottery-draw__pool-item');
  const target = items[activeSlotIndex.value];
  if (!target) {
    trackerStyle.value = { opacity: '0' };
    return;
  }
  trackerStyle.value = {
    transform: `translate(${target.offsetLeft}px, ${target.offsetTop}px)`,
    width: `${target.offsetWidth}px`,
    height: `${target.offsetHeight}px`,
    opacity: '1',
  };
});

function startCycling() {
  let idx = 0;
  activeSlotIndex.value = idx;
  round.value += 1;
  cycleTimer = window.setInterval(() => {
    if (foregroundCandidates.value.length === 0) return;
    idx = (idx + 1) % foregroundCandidates.value.length;
    activeSlotIndex.value = idx;
  }, POOL_CYCLE_INTERVAL);
}

function stopCycling() {
  if (cycleTimer !== null) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
  activeSlotIndex.value = null;
}

const candidateCount = computed(() => candidateList.value.length);
const winnerCount = computed(() => winners.value.length);

const canStart = computed(() => (
  (stage.value === 'idle' || (stage.value === 'result' && !isAwaitingReveal.value))
  && remainingCandidates.value.length > 0
));
const startButtonLabelKey = computed(() => (
  winners.value.length === 0 ? 'bid_gift_lottery_draw.button.start' : 'bid_gift_lottery_draw.button.draw_again'
));
const canStop = computed(() => stage.value === 'drawing');
const canSubmit = computed(() => stage.value === 'result' && !isAwaitingReveal.value);
const canCopy = computed(() => stage.value === 'result' && !isAwaitingReveal.value);
// 連抽數量選擇器：抽獎中與揭曉中不可調整（避免直播中誤觸改到數量）
const isDrawingOrRevealing = computed(() => stage.value === 'drawing' || isAwaitingReveal.value);

function handleStart() {
  if (!canStart.value) return;
  // 清空上一輪顯示區，待機/滾動期間收合不占版面
  roundSlots.value = [];
  roundWinners.value = [];
  showWinnerPanel.value = false;
  stage.value = 'drawing';
}

function handleStop() {
  if (!canStop.value) return;
  // 停下即一次決定本輪 N 位得主（N 受剩餘人數上限約束）
  const count = Math.min(drawCount.value, remainingCandidates.value.length);
  const pool = remainingCandidates.value.slice();
  const picked: Person[] = [];
  for (let i = 0; i < count; i += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(randomIndex, 1)[0]);
  }
  roundWinners.value = picked;
  roundSlots.value = picked.map(() => ({ winner: null, locked: false }));
  stage.value = 'result';
}

function handleSubmit() {
  showInfo({
    summary: t('bid_gift_lottery_draw.toast.submit_summary'),
    detail: t('bid_gift_lottery_draw.toast.submit_detail'),
  });
}

async function handleCopy() {
  const lines = winners.value.map((person, idx) => `${idx + 1}. ${person.name}`);
  const text = [sessionName.value, ...lines].filter(Boolean).join('\n');

  try {
    await navigator.clipboard.writeText(text);
    showSuccess({ detail: t('bid_gift_lottery_draw.toast.copied') });
  } catch {
    showError({ detail: t('bid_gift_lottery_draw.toast.copy_failed') });
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.code !== 'Space') return;

  // 避免目前 focus 在按鈕時，按鈕的 keydown 又觸發一次 click 造成雙重觸發
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) {
    active.blur();
  }

  event.preventDefault();
  if (stage.value === 'drawing') {
    handleStop();
  } else if (stage.value === 'result' && isAwaitingReveal.value) {
    revealAllRemaining();
  } else if (canStart.value) {
    handleStart();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('message', handleStageMessage);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('message', handleStageMessage);
  stopCycling();
  clearRevealTimers();
  if (revealFallback !== null) clearTimeout(revealFallback);
});
</script>

<template>
  <div class="lottery-draw">
    <iframe
      ref="backgroundFrame"
      class="lottery-draw__background"
      :src="`${BASE}lottery/background.html`"
      title="background"
      aria-hidden="true"
      tabindex="-1"
    />

    <div class="lottery-draw__content">
      <div class="lottery-draw__topbar">
        <button
          type="button"
          class="lottery-draw__back"
          :aria-label="$t('bid_gift_lottery_draw.button.back_to_list')"
          @click="handleBackToList"
        >
          <FontAwesomeIcon :icon="['fas', 'chevron-left']" />
        </button>

        <span class="lottery-draw__session-name">{{ sessionName }}</span>

        <div class="lottery-draw__topbar-actions">
          <button
            type="button"
            class="lottery-draw__pill"
            @click="handleShowWinnerList"
          >
            <span>{{ $t('bid_gift_lottery_draw.button.winner_list') }}</span>
            <span class="lottery-draw__pill-count">{{ winnerCount }}</span>
          </button>
          <button
            type="button"
            class="lottery-draw__pill"
            @click="handleShowCandidateList"
          >
            <span>{{ $t('bid_gift_lottery_draw.button.candidate_list') }}</span>
            <span class="lottery-draw__pill-count">{{ candidateCount }}</span>
          </button>
        </div>
      </div>

      <div class="lottery-draw__stage">
        <!-- 待機/滾動/開箱：iframe 動畫；抽完禮物盒淡出，改成可捲動的中獎名單面板 -->
        <iframe
          v-if="!showWinnerPanel"
          :key="stageFrameKey"
          class="lottery-draw__stage-frame"
          :src="stageSrc"
          title="lottery-stage"
          scrolling="no"
        />
        <div
          v-else
          class="lottery-draw__winlist"
        >
          <div
            ref="winlistGridEl"
            class="lottery-draw__winlist-grid"
            tabindex="0"
            role="group"
            :aria-label="$t('bid_gift_lottery_draw.round.track_aria')"
          >
            <div
              v-for="(slot, index) in roundSlots"
              :key="index"
              class="lottery-draw__winrow"
              :class="{
                'lottery-draw__winrow--pending': !slot.locked,
                'lottery-draw__winrow--latest': slot.locked && index === latestLockedIndex,
              }"
            >
              <span class="lottery-draw__winrow-num">{{ index + 1 }}</span>
              <img
                v-if="slot.locked && slot.winner"
                class="lottery-draw__winrow-avatar"
                :src="slot.winner.avatar"
                :alt="slot.winner.name"
              >
              <span
                v-else
                class="lottery-draw__winrow-avatar lottery-draw__winrow-avatar--pending"
                aria-hidden="true"
              >?</span>
              <span class="lottery-draw__winrow-name">
                {{ slot.locked && slot.winner ? slot.winner.name : $t('bid_gift_lottery_draw.round.selecting') }}
              </span>
              <span
                class="lottery-draw__winrow-emoji"
                aria-hidden="true"
              >🎉</span>
            </div>
          </div>
          <button
            v-if="isAwaitingReveal"
            type="button"
            class="lottery-draw__winlist-skip"
            @click="revealAllRemaining"
          >
            {{ $t('bid_gift_lottery_draw.button.skip_reveal') }}
          </button>
        </div>
        <p class="lottery-draw__stage-label">
          {{ $t(stageLabel) }}
        </p>
      </div>

      <div class="lottery-draw__pool">
        <div
          ref="frontRowEl"
          class="lottery-draw__pool-row lottery-draw__pool-row--front"
        >
          <div
            v-for="(person, index) in foregroundCandidates"
            :key="`front-${person.name}-${index}`"
            v-tooltip.top="person.name"
            class="lottery-draw__pool-item"
          >
            <img
              class="lottery-draw__pool-avatar"
              :src="person.avatar"
              :alt="person.name"
            >
          </div>
          <div
            class="lottery-draw__pool-tracker"
            :style="trackerStyle"
          />
        </div>
        <div class="lottery-draw__pool-row lottery-draw__pool-row--back">
          <div
            v-for="(person, index) in backgroundCandidates"
            :key="`back-${person.name}-${index}`"
            v-tooltip.top="person.name"
            class="lottery-draw__pool-item lottery-draw__pool-item--back"
          >
            <img
              class="lottery-draw__pool-avatar"
              :src="person.avatar"
              :alt="person.name"
            >
          </div>
          <button
            v-if="overflowCount > 0"
            type="button"
            class="lottery-draw__pool-more"
            @click="handleShowCandidateList"
          >
            +{{ overflowCount }} 人
          </button>
        </div>
      </div>

      <div class="lottery-draw__actions">
        <!-- 連抽數量 stepper 手刻（非用 PrimeVue InputNumber），以沿用本頁半透明玻璃視覺；邏輯與無障礙自行補齊 -->
        <div
          class="lottery-draw__count"
          :class="{ 'lottery-draw__count--disabled': isDrawingOrRevealing }"
          role="group"
          :aria-label="$t('bid_gift_lottery_draw.draw_count.aria')"
        >
          <span class="lottery-draw__count-label">{{ $t('bid_gift_lottery_draw.draw_count.label') }}</span>
          <button
            type="button"
            class="lottery-draw__count-step"
            :aria-label="$t('bid_gift_lottery_draw.draw_count.decrease')"
            :disabled="isDrawingOrRevealing || drawCount <= 1"
            @click="stepDraw(-1)"
          >−</button>
          <input
            class="lottery-draw__count-input"
            type="number"
            inputmode="numeric"
            :min="1"
            :max="maxDraw"
            :value="drawCount"
            :disabled="isDrawingOrRevealing"
            :aria-label="$t('bid_gift_lottery_draw.draw_count.aria')"
            @change="onDrawCountChange"
            @focus="($event.target as HTMLInputElement).select()"
          >
          <button
            type="button"
            class="lottery-draw__count-step"
            :aria-label="$t('bid_gift_lottery_draw.draw_count.increase')"
            :disabled="isDrawingOrRevealing || drawCount >= maxDraw"
            @click="stepDraw(1)"
          >+</button>
          <span class="lottery-draw__count-unit">{{ $t('bid_gift_lottery_draw.draw_count.unit') }}</span>
        </div>

        <div class="lottery-draw__action-group">
          <Button
            :label="$t(startButtonLabelKey)"
            severity="info"
            rounded
            size="large"
            class="lottery-draw__action"
            :disabled="!canStart"
            @click="handleStart"
          />
          <Button
            :label="$t('bid_gift_lottery_draw.button.stop')"
            severity="danger"
            rounded
            size="large"
            class="lottery-draw__action"
            :class="{ 'lottery-draw__action--pulse': canStop }"
            :disabled="!canStop"
            @click="handleStop"
          />
          <Button
            :label="$t('bid_gift_lottery_draw.button.submit')"
            severity="success"
            rounded
            size="large"
            class="lottery-draw__action"
            :disabled="!canSubmit"
            @click="handleSubmit"
          />
          <Button
            :label="$t('bid_gift_lottery_draw.button.copy')"
            severity="help"
            rounded
            size="large"
            class="lottery-draw__action"
            :disabled="!canCopy"
            @click="handleCopy"
          />
        </div>
      </div>

      <p class="lottery-draw__hint">
        {{ $t('bid_gift_lottery_draw.hint.spacebar') }}
      </p>
    </div>

    <Dialog
      v-model:visible="isWinnerDialogVisible"
      modal
      dismissable-mask
      :header="$t('bid_gift_lottery_draw.button.winner_list') + ` (${winnerCount})`"
      :style="{ width: '28rem' }"
      :pt="{ closeButton: { class: 'border-0! bg-transparent! shadow-none! hover:bg-transparent!' } }"
    >
      <ul
        v-if="winnerList.length"
        class="lottery-draw__people"
      >
        <li
          v-for="(person, index) in winnerList"
          :key="index"
          class="lottery-draw__person"
        >
          <img
            :src="person.avatar"
            :alt="person.name"
            class="lottery-draw__person-avatar"
          >
          <span class="lottery-draw__person-name">{{ person.name }}</span>
        </li>
      </ul>
      <div
        v-else
        class="lottery-draw__empty"
      >
        {{ $t('bid_gift_lottery_draw.dialog.no_winner') }}
      </div>
    </Dialog>

    <Dialog
      v-model:visible="isCandidateDialogVisible"
      modal
      dismissable-mask
      :header="$t('bid_gift_lottery_draw.button.candidate_list') + ` (${candidateCount})`"
      :style="{ width: '28rem' }"
      :pt="{ closeButton: { class: 'border-0! bg-transparent! shadow-none! hover:bg-transparent!' } }"
    >
      <ul class="lottery-draw__people">
        <li
          v-for="(person, index) in candidateList"
          :key="index"
          class="lottery-draw__person"
        >
          <img
            :src="person.avatar"
            :alt="person.name"
            class="lottery-draw__person-avatar"
          >
          <span class="lottery-draw__person-name">{{ person.name }}</span>
        </li>
      </ul>
    </Dialog>
  </div>
</template>

<style scoped>
.lottery-draw {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.lottery-draw__background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
}

.lottery-draw__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 直播主用手機拍攝電腦螢幕 → 內容收在中央約 1040px 寬，左右留背景空間方便 framing；
     stage iframe 內 wrapper 是 960px，所以 max-width 至少要容得下 960 + 左右 padding。 */
  justify-content: flex-start;
  gap: 1.25rem;
  height: 100%;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2rem;
  /* 矮螢幕（如 720p）result 階段多出名單條時，保底可捲動，避免底部按鈕被裁出畫面 */
  overflow-y: auto;
}

.lottery-draw__topbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.5rem;
}

.lottery-draw__back {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.lottery-draw__back:hover {
  background-color: rgba(255, 255, 255, 0.25);
  transform: translateX(-2px);
}

.lottery-draw__session-name {
  flex: 1;
  text-align: left;
  padding-left: 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.lottery-draw__topbar-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.lottery-draw__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.55);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.lottery-draw__pill:hover {
  background-color: rgba(255, 255, 255, 0.28);
}

.lottery-draw__pill-count {
  min-width: 1.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 9999px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.78);
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
}

.lottery-draw__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  flex: 1;
  justify-content: center;
}

.lottery-draw__stage-frame {
  /* iframe 內 wrapper 固定 960×425，這層尺寸要對齊才不會被裁切或冒出內捲軸 */
  width: 960px;
  height: 425px;
  max-width: 100%;
  border: 0;
  background: transparent;
  overflow: hidden;
}

/* ===== 中獎名單面板（抽完後取代禮物盒）===== */
.lottery-draw__winlist {
  width: 100%;
  max-width: 830px;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  animation: winlistIn 0.4s ease;
}

/* 跳過動畫：名單右側，逐一揭曉中才出現，點了立即補齊全部 */
.lottery-draw__winlist-skip {
  flex-shrink: 0;
  padding: 0.55rem 1rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.55);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.lottery-draw__winlist-skip:hover {
  background-color: rgba(255, 255, 255, 0.28);
}

.lottery-draw__winlist-skip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--p-primary-color);
}

@keyframes winlistIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.lottery-draw__winlist-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: min-content;
  gap: 0.55rem 0.9rem;
  max-height: 390px; /* 超過此高度才出現捲軸；未滿則貼齊內容不留空 */
  overflow-y: auto;
  padding: 0.75rem;
  border-radius: 18px;
  background: rgba(18, 13, 46, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
}

.lottery-draw__winlist-grid:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--p-primary-color);
}

.lottery-draw__winlist-grid::-webkit-scrollbar {
  width: 7px;
}

.lottery-draw__winlist-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 4px;
}

.lottery-draw__winrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem 0.4rem 0.4rem;
  border-radius: 9999px;
  background: rgba(42, 34, 92, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.14);
  min-height: 3rem;
}

.lottery-draw__winrow--pending {
  opacity: 0.5;
}

.lottery-draw__winrow--latest {
  border-color: rgba(247, 209, 91, 0.85);
  box-shadow: 0 0 0 1px rgba(247, 209, 91, 0.6), 0 0 14px 1px rgba(247, 209, 91, 0.3);
}

.lottery-draw__winrow:not(.lottery-draw__winrow--pending) {
  animation: roundPop 0.3s ease;
}

.lottery-draw__winrow-num {
  flex-shrink: 0;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 9999px;
  background: linear-gradient(180deg, #f7d15b, #e3a72f);
  color: #5c3a00;
  font-size: 0.85rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.lottery-draw__winrow-avatar {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  object-fit: cover;
  border: 2px solid #fff;
  background: rgba(255, 255, 255, 0.7);
}

.lottery-draw__winrow-avatar--pending {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 800;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.lottery-draw__winrow-name {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lottery-draw__winrow-emoji {
  flex-shrink: 0;
  font-size: 1rem;
}

.lottery-draw__stage-label {
  font-size: 1rem;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.lottery-draw__pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  max-width: min(70rem, 92vw);
  margin: 0 auto 1.25rem;
  padding: 0.5rem;
}

.lottery-draw__pool-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  max-width: min(64rem, 86vw);
}

.lottery-draw__pool-row--front {
  position: relative;
}

.lottery-draw__pool-row--back {
  gap: 0.3rem;
  opacity: 0.55;
}

.lottery-draw__pool-tracker {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 9999px;
  box-shadow: 0 0 0 3px var(--p-primary-color), 0 0 14px 4px color-mix(in srgb, var(--p-primary-color) 60%, transparent);
  pointer-events: none;
  transition: transform 0.18s ease, opacity 0.2s ease, width 0.18s, height 0.18s;
  z-index: 2;
}

.lottery-draw__pool-item {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  position: relative;
}

.lottery-draw__pool-item--back {
  width: 1.75rem;
  height: 1.75rem;
}

.lottery-draw__pool-avatar {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  object-fit: cover;
  display: block;
  border: 2px solid #fff;
  background-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.lottery-draw__pool-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.25rem;
  height: 1.75rem;
  padding: 0 0.6rem;
  border-radius: 9999px;
  border: 1px dashed rgba(255, 255, 255, 0.7);
  background-color: rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
  white-space: nowrap;
}

.lottery-draw__pool-more:hover {
  background-color: rgba(255, 255, 255, 0.35);
}

.lottery-draw__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  /* 設定群（stepper）與執行群（四鈕）之間留較大間距，降低直播中誤觸 */
  gap: 2rem;
  margin-bottom: 0.5rem;
}

.lottery-draw__action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
}

.lottery-draw__action {
  min-width: 9rem;
}

/* 連抽數量 stepper：沿用膠囊的半透明白視覺 */
.lottery-draw__count {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.85rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.55);
  color: #fff;
  transition: opacity 0.15s ease;
}

.lottery-draw__count--disabled {
  opacity: 0.45;
}

.lottery-draw__count-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.lottery-draw__count-step {
  width: 2.1rem;
  height: 2.1rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background-color: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.lottery-draw__count-step:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.3);
}

.lottery-draw__count-step:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--p-primary-color);
}

.lottery-draw__count-step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lottery-draw__count-input {
  width: 3rem;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
  background: transparent;
  border: none;
  border-bottom: 1.5px dashed rgba(255, 255, 255, 0.6);
  padding: 0.1rem 0;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.lottery-draw__count-input::-webkit-outer-spin-button,
.lottery-draw__count-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.lottery-draw__count-input:focus {
  border-bottom-color: #fff;
}

.lottery-draw__count-input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--p-primary-color);
  border-radius: 4px;
}

.lottery-draw__count-input:disabled {
  opacity: 0.75;
}

.lottery-draw__count-unit {
  font-size: 0.85rem;
  opacity: 0.85;
}

/* 本輪得獎名單：固定單排高度的水平跑馬燈條 */
.lottery-draw__round {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  min-height: 3rem;
}

.lottery-draw__round-lead {
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.lottery-draw__round-track {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0.1rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
}

.lottery-draw__round-track:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--p-primary-color);
  border-radius: 9999px;
}

.lottery-draw__round-track::-webkit-scrollbar {
  height: 5px;
}

.lottery-draw__round-track::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 3px;
}

.lottery-draw__round-item {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.75rem 0.3rem 0.35rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  opacity: 0.55;
  transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.lottery-draw__round-item--locked {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.16);
  animation: roundPop 0.3s ease;
}

.lottery-draw__round-item--latest {
  border-color: var(--p-primary-color);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--p-primary-color) 55%, transparent),
    0 0 14px 2px color-mix(in srgb, var(--p-primary-color) 45%, transparent);
}

@keyframes roundPop {
  0% { transform: scale(0.85); }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.lottery-draw__round-idx {
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lottery-draw__round-item--latest .lottery-draw__round-idx {
  background-color: var(--p-primary-color);
}

.lottery-draw__round-avatar {
  width: 1.9rem;
  height: 1.9rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
  border: 2px solid #fff;
  background-color: rgba(255, 255, 255, 0.6);
}

.lottery-draw__round-avatar--pending {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 800;
  font-size: 0.9rem;
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.lottery-draw__round-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* 最新一位除主色外框外，另加文字標記，不單靠顏色承載語意 */
.lottery-draw__round-tag {
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border-radius: 9999px;
  background-color: var(--p-primary-color);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.4;
}

.lottery-draw__action--pulse {
  animation: pulseStop 1.1s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
}

@keyframes pulseStop {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 14px rgba(239, 68, 68, 0);
    transform: scale(1.04);
  }
}

.lottery-draw__hint {
  font-size: 0.85rem;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.lottery-draw__people {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 22rem;
  overflow-y: auto;
}

.lottery-draw__person {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background-color: rgba(0, 0, 0, 0.04);
}

.lottery-draw__person-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  object-fit: cover;
}

.lottery-draw__person-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
}

.lottery-draw__empty {
  padding: 1.5rem 0;
  text-align: center;
  color: rgba(0, 0, 0, 0.5);
}
</style>
