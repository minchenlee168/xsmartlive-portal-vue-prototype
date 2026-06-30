<template>
  <!--
    收單來源 Dialog：
    Step 1（platform）：選 FB / IG / TikTok / LiveBuy 平台
    Step 2（session）：選平台底下要綁的直播 / 貼文
  -->
  <Dialog
    v-model:visible="innerVisible"
    modal :draggable="false" :show-header="false" :dismissable-mask="true"
    :style="{ width: dialogWidth }"
    :pt="{ content: { style: 'padding: 0; border-radius: 12px; overflow: hidden;' } }"
    @update:visible="onVisibleChange">

    <!-- ── Header（共用） ─────────────────────────── -->
    <div class="flex items-center gap-3 px-[17.5px] py-[17.5px]">
      <p class="font-semibold text-[var(--p-text-color)] shrink-0" style="font-size:17.5px">{{ headerTitle }}</p>
      <button @click="close" class="w-[35px] py-[7px] flex items-center justify-center rounded-[6px] hover:bg-[var(--p-content-hover-background)] shrink-0 ml-auto">
        <i class="pi pi-times text-[14px] text-[var(--p-text-color)]"></i>
      </button>
    </div>

    <!-- ── Step 1：選平台 ─────────────────────────── -->
    <div v-if="step === 'platform'" class="px-[17.5px] pb-[17.5px]">
      <!-- 手機固定 2 欄；桌機 ≥ md 才依平台數量擴展 -->
      <div
        class="grid gap-4 items-stretch grid-cols-2"
        :class="platformDesktopColsClass"
      >
        <button
          v-for="opt in platformOptions"
          :key="opt.key"
          @click="onPlatformPick(opt.key)"
          class="bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] rounded-[6px] px-[13px] py-[17px] flex flex-col items-start gap-4 min-h-[300px] relative overflow-hidden hover:border-[var(--p-primary-color)] transition-colors text-left"
        >
          <!-- 左上：品牌色 icon -->
          <div class="rounded-[6px] w-12 h-12 flex items-center justify-center shrink-0" :style="{ background: opt.bg }">
            <FontAwesomeIcon
              v-if="opt.faIcon"
              :icon="opt.faIcon"
              :style="{ color: opt.iconColor, fontSize: '24px' }"
            />
            <i v-else :class="opt.piIcon" class="text-white" style="font-size:24px"></i>
          </div>
          <span class="font-bold text-[20px] leading-6 text-[var(--p-text-color)] whitespace-nowrap">{{ opt.title }}</span>
          <p class="text-[13px] leading-5 text-[var(--p-text-muted-color)]">{{ opt.desc }}</p>
          <!-- 大裝飾 icon -->
          <div class="flex-1 w-full flex items-end justify-end pr-1 pb-1">
            <FontAwesomeIcon
              v-if="opt.faIcon"
              :icon="opt.faIcon"
              :style="{ color: opt.decorColor, fontSize: '90px' }"
            />
            <i v-else :class="opt.piIcon" :style="{ color: opt.decorColor, fontSize: '90px' }"></i>
          </div>
          <!-- 立即建立 -->
          <div class="self-center border border-[var(--p-primary-300)] rounded-[6px] px-[13.25px] py-[9.75px] flex gap-[7px] items-center mt-1">
            <span class="text-[var(--p-primary-color)] text-[15px] font-medium">{{ t('live_order.label.create_now') }}</span>
            <i class="pi pi-angle-right text-[var(--p-primary-color)]" style="font-size:15px"></i>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Step 2：挑選該平台底下的直播 ─────────── -->
    <div v-else-if="step === 'session'" class="px-[17.5px] pb-[17.5px]">
      <div class="flex flex-col gap-4">
        <!-- 標題列：左 label + 右平台 Tag -->
        <div class="flex items-center justify-between">
          <p class="text-[14px] font-medium text-[var(--p-text-color)]">
            {{ sessionLabel }}
            <span class="text-[var(--p-text-muted-color)]">{{ sessionHint }}</span>
          </p>
          <div
            class="flex items-center gap-[3.5px] px-[7px] py-[3.5px] rounded-[12px]"
            :style="{ background: pickedPlatformMeta.tagBg }"
          >
            <FontAwesomeIcon
              v-if="pickedPlatformMeta.faIcon"
              :icon="pickedPlatformMeta.faIcon"
              :style="{ color: pickedPlatformMeta.iconColor, fontSize: '10.5px' }"
            />
            <i v-else :class="pickedPlatformMeta.piIcon" :style="{ color: pickedPlatformMeta.iconColor, fontSize: '10.5px' }"></i>
            <span class="font-bold text-[12.25px]" :style="{ color: pickedPlatformMeta.iconColor }">{{ pickedPlatformMeta.title }}</span>
          </div>
        </div>

        <!-- 直播卡 grid：手機 3 欄、md ≥ 5 欄 -->
        <div class="h-[325px] overflow-y-auto overflow-x-hidden grid grid-cols-3 md:grid-cols-5 gap-2">
          <PostCard
            v-for="post in displayedPosts"
            :key="post.id"
            :title="post.title"
            :date="post.date"
            :image="mode === 'live' ? livePreviewImage : undefined"
            :is-live="mode === 'live' && !!post.isLive"
            :selected="selectedSessionId === post.id"
            :disabled="disabledIdSet.has(post.id)"
            :used-label="t('live_order.label.used')"
            @click="selectedSessionId = post.id"
          />
        </div>

        <!-- 分隔線 + 連結貼上 -->
        <div class="flex items-center w-full">
          <div class="flex-1 h-px bg-[var(--p-content-border-color)]"></div>
          <span class="px-6 text-[14px] font-medium text-[var(--p-text-color)]">{{ t('live_order.label.or') }}</span>
          <div class="flex-1 h-px bg-[var(--p-content-border-color)]"></div>
        </div>

        <div class="flex flex-col gap-2 w-full">
          <span class="text-[14px] font-medium text-[var(--p-text-color)]">{{ pasteLinkLabel }}</span>
          <IconField icon-position="left">
            <InputIcon><i class="pi pi-link text-[14px]"></i></InputIcon>
            <InputText v-model="pasteUrl" :placeholder="pastePlaceholder" class="w-full" />
          </IconField>
        </div>
      </div>

      <!-- footer -->
      <div class="flex gap-[7px] items-center justify-end pt-4">
        <button @click="step = 'platform'"
          class="bg-[var(--p-content-hover-background)] border border-[var(--p-content-border-color)] px-[11.5px] py-[8px] rounded-[6px] text-[14px] font-medium text-[var(--p-text-color)] hover:bg-[var(--p-content-border-color)]">{{ t('live_order.button.back') }}</button>
        <button @click="confirmSession"
          class="bg-[var(--p-primary-color)] border border-[var(--p-primary-color)] px-[11.5px] py-[8px] rounded-[6px] text-[14px] font-medium text-white hover:bg-[var(--p-primary-hover-color)]">{{ t('live_order.button.confirm') }}</button>
      </div>
    </div>

  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import livePreviewImage from '../live-preview.png'
import { sourceMockPosts } from '../utils/sourceMockPosts'

interface PostCardProps {
  title: string
  date: string
  selected?: boolean
  disabled?: boolean
  usedLabel?: string
  /** 縮圖背景圖（直播模式使用真實預覽圖；貼文模式維持漸層佔位）。 */
  image?: string
  /** 直播中：左上加紅色 LIVE tag + 脈動點 */
  isLive?: boolean
}

// 子元件：直播 / 貼文縮圖卡（直播模式吃 image 當背景；貼文模式維持漸層佔位 + icon）
const PostCard: FunctionalComponent<PostCardProps, { click: [] }> = (props, { emit }) => h('button', {
  disabled: props.disabled,
  class: [
    'w-full rounded-[12px] overflow-hidden text-left transition flex items-end relative h-[188px]',
    props.image ? 'bg-cover bg-center' : 'bg-gradient-to-br from-[#fef3c7] via-[#fed7aa] to-[#fda4af]',
    'shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]',
    props.disabled
      ? 'opacity-50 cursor-not-allowed grayscale'
      : (props.selected ? 'ring-2 ring-[var(--p-primary-color)]' : 'hover:brightness-95'),
  ],
  style: props.image ? { backgroundImage: `url(${props.image})` } : undefined,
  onClick: () => { if (!props.disabled) emit('click') },
}, [
  props.image
    ? null
    : h('div', { class: 'absolute inset-0 flex items-center justify-center text-[#d97706]' }, [
        h('i', { class: 'pi pi-image', style: 'font-size:36px' }),
      ]),
  props.disabled
    ? h('span', {
        class: 'absolute top-2 left-2 bg-[var(--p-text-muted-color)] text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none',
      }, props.usedLabel ?? '')
    : (props.isLive
        ? h('span', {
            class: 'absolute top-2 left-2 inline-flex items-center gap-1 bg-[#ef4444] text-white text-[11px] font-bold px-2 py-[3px] rounded-full leading-none shadow-[0_1px_2px_rgba(0,0,0,0.25)]',
          }, [
            h('span', { class: 'w-1.5 h-1.5 rounded-full bg-white animate-pulse' }),
            'LIVE',
          ])
        : null),
  h('div', { class: 'relative w-full px-[6px] py-[8px] bg-[var(--p-content-background)]/70 flex flex-col gap-1' }, [
    h('p', { class: 'text-[var(--p-text-color)] text-[16px] leading-6 line-clamp-2 h-[49px] overflow-hidden' }, props.title),
    h('p', { class: 'text-[var(--p-text-muted-color)] text-[14px] leading-5' }, props.date),
  ]),
])
PostCard.props = ['title', 'date', 'selected', 'disabled', 'usedLabel', 'image', 'isLive']
PostCard.emits = ['click']

type PlatformKey = 'fb' | 'ig' | 'tiktok' | 'livebuy'

interface PlatformOption {
  key: PlatformKey
  title: string
  desc: string
  /** FontAwesome icon `[prefix, name]`；沒有的走 `piIcon`。 */
  faIcon?: [string, string]
  piIcon?: string
  bg: string
  iconColor: string
  decorColor: string
  tagBg: string
}

interface ConfirmExtras {
  postId?: number | string | null
  groupId?: number | string | null
  /** 使用者選擇的卡片標題（社團 / 貼文 post 名稱）→ 父層拿來當 source 顯示 label */
  title?: string | null
}

interface Props {
  visible?: boolean
  /**
   * 已使用的來源 id：依平台類型分桶。範例：
   *   { fb: [1, 3], ig: [2], group: [5], tiktok: [], livebuy: [] }
   * 不同平台之間互不干擾：picked FB 時只 disable fb 桶內的 id，IG 桶不影響。
   * 社團模式下選 FB 入口但實際存的是 'group' type，dialog 內會自動換算。
   */
  usedByPlatform?: Record<string, Array<number | string>>
  /** 'live'：選擇直播；'post'：選擇貼文；'community'：選擇社團（平台只有 FB，描述顯示「Facebook 社團」）。 */
  mode?: 'live' | 'post' | 'community'
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  usedByPlatform: () => ({}),
  mode: 'live',
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [type: string, extras?: ConfirmExtras]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
const step = ref<'platform' | 'session'>('platform')
const pickedPlatform = ref<PlatformKey | null>(null)
const selectedSessionId = ref<number | null>(null)
const pasteUrl = ref('')

watch(() => props.visible, (v) => {
  innerVisible.value = v
  if (v) {
    step.value = 'platform'
    pickedPlatform.value = null
    selectedSessionId.value = null
    pasteUrl.value = ''
  }
})

function onVisibleChange(v: boolean): void { emit('update:visible', v) }
function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

const dialogWidth = computed(() => {
  if (step.value === 'session') return '900px'
  // 平台選擇步驟：寬度依平台數量自動調整（每張卡 ~ 220px + gap 16px + 內距 35px）
  const n = platformOptions.value.length
  return `${n * 220 + (n - 1) * 16 + 35}px`
})

const headerTitle = computed(() => {
  if (step.value === 'platform') return t('live_order.title.pick_platform')
  if (props.mode === 'community') return t('live_order.title.pick_group')
  return props.mode === 'post'
    ? t('live_order.title.pick_post')
    : t('live_order.title.pick_session')
})

/**
 * 依模式切換 step 2 的副標 / hint / 連結 placeholder 文案：
 * - community 模式統一用「社團」字眼，不要出現「直播」
 * - post 模式用「貼文」
 * - live 模式（直播收單）保留原本「直播」
 */
const sessionLabel = computed(() => {
  if (props.mode === 'community') return t('live_order.label.pick_group')
  return props.mode === 'post'
    ? t('live_order.label.pick_post')
    : t('live_order.label.pick_session')
})
const sessionHint = computed(() => {
  if (props.mode === 'community') return t('live_order.label.pick_one_group_hint')
  return props.mode === 'post'
    ? t('live_order.label.pick_one_post_hint')
    : t('live_order.label.pick_one_session_hint')
})
const pasteLinkLabel = computed(() => {
  if (props.mode === 'community') return t('live_order.label.paste_group_link')
  return props.mode === 'post'
    ? t('live_order.label.paste_post_link')
    : t('live_order.label.paste_live_link')
})
const pastePlaceholder = computed(() => {
  if (props.mode === 'community') return t('live_order.form.placeholder.group_url')
  return props.mode === 'post'
    ? t('live_order.form.placeholder.post_url')
    : t('live_order.form.placeholder.live_url')
})

const platformOptions = computed<PlatformOption[]>(() => {
  // 社團模式只給 FB，小字改成「Facebook 社團」
  if (props.mode === 'community') {
    return [{
      key: 'fb',
      title: t('live_order.platform.fb'),
      desc: t('live_order.platform.fb_group_desc'),
      faIcon: ['fab', 'facebook'],
      bg: '#dbeafe',
      iconColor: '#1877f2',
      decorColor: '#e0e7ff',
      tagBg: '#dbeafe',
    }]
  }
  // 貼文模式底下，FB / IG 的小字不能出現「直播」，改用對應的 _post_desc
  const isPostOnly = props.mode === 'post'
  const opts: PlatformOption[] = [
    {
      key: 'fb',
      title: t('live_order.platform.fb'),
      desc: t(isPostOnly ? 'live_order.platform.fb_post_desc' : 'live_order.platform.fb_desc'),
      faIcon: ['fab', 'facebook'],
      bg: '#dbeafe',
      iconColor: '#1877f2',
      decorColor: '#e0e7ff',
      tagBg: '#dbeafe',
    },
    {
      key: 'ig',
      title: t('live_order.platform.ig'),
      desc: t(isPostOnly ? 'live_order.platform.ig_post_desc' : 'live_order.platform.ig_desc'),
      faIcon: ['fab', 'instagram'],
      bg: '#fce7f3',
      iconColor: '#db2777',
      decorColor: '#fce7f3',
      tagBg: '#fce7f3',
    },
  ]
  // 貼文收單只支援 FB / IG；直播收單再加上 TikTok / 直播購
  if (isPostOnly) return opts
  opts.push(
    {
      key: 'tiktok',
      title: t('live_order.platform.tiktok'),
      desc: t('live_order.platform.tiktok_desc'),
      faIcon: ['fab', 'tiktok'],
      bg: '#fce4ec',
      iconColor: '#000000',
      decorColor: '#cbd5e1',
      tagBg: '#f1f5f9',
    },
    {
      key: 'livebuy',
      title: t('live_order.platform.livebuy'),
      desc: t('live_order.platform.livebuy_desc'),
      piIcon: 'pi pi-video',
      bg: 'var(--p-primary-color)',
      iconColor: 'var(--p-primary-color)',
      decorColor: '#e9d5ff',
      tagBg: '#ede9fe',
    },
  )
  return opts
})

const pickedPlatformMeta = computed<PlatformOption>(() =>
  platformOptions.value.find((p) => p.key === pickedPlatform.value) ?? platformOptions.value[0],
)

/** 平台卡 grid 桌機 ≥ md 的欄數（依當前模式的平台數量），手機固定 2 欄
 *  字面字串列出來讓 Tailwind JIT 抓得到 */
const platformDesktopColsClass = computed(() => {
  switch (platformOptions.value.length) {
    case 1: return 'md:grid-cols-1'
    case 2: return 'md:grid-cols-2'
    case 3: return 'md:grid-cols-3'
    case 4: return 'md:grid-cols-4'
    case 5: return 'md:grid-cols-5'
    default: return 'md:grid-cols-4'
  }
})

function onPlatformPick(key: PlatformKey): void {
  pickedPlatform.value = key
  selectedSessionId.value = null
  pasteUrl.value = ''
  step.value = 'session'
}

// Step 2 顯示的 mock 卡：與 LiveOrderPage 共用 utils/sourceMockPosts.ts，
// 確保「進入收單中時自動補的 source 名稱」跟彈窗清單一致。
const placeholderPosts = sourceMockPosts
// 直播模式只列「直播中」的卡（isLive=true）；其他模式列全部
const displayedPosts = computed(() =>
  props.mode === 'live'
    ? placeholderPosts.filter((p) => !!p.isLive)
    : placeholderPosts,
)
/**
 * 當前 step 2 要 disable 的 id：取自 usedByPlatform 對應平台的桶。
 * 社團模式下使用者選 FB 入口，但 source 實際存的是 'group' type → 改抓 group 桶。
 */
const disabledIdSet = computed<Set<number | string>>(() => {
  if (!pickedPlatform.value) return new Set()
  const effective = props.mode === 'community' ? 'group' : pickedPlatform.value
  return new Set(props.usedByPlatform[effective] ?? [])
})

function confirmSession(): void {
  if (!pickedPlatform.value) return
  const picked = selectedSessionId.value != null
    ? placeholderPosts.find((p) => p.id === selectedSessionId.value)
    : null
  // 1) 點選清單卡片 → 拿卡片標題當 source label；
  // 2) 沒選卡片但貼了連結 → 用 URL 當 source label，至少能跟「Facebook」這種泛用字眼區分
  const title = picked?.title ?? (pasteUrl.value.trim() || null)
  emit('confirm', pickedPlatform.value, {
    postId: selectedSessionId.value,
    title,
  })
  close()
}
</script>
