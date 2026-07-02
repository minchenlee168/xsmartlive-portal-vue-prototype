<template>
  <!-- 直播收單：自訂版型（多收單來源） -->
  <!-- 上：Banner（hasAnySource）；上：Toolbar；下：空狀態 OR 收單操作頁 -->

  <div class="flex flex-col gap-2 flex-1 min-h-0">


    <!-- ── Body：空狀態 OR 收單操作頁 ───────────────── -->
    <!-- 貼文 / 社團模式進入某筆 collection 後一律顯示麵包屑（不論有沒有選來源）-->
    <Breadcrumb
      v-if="isPostMode && enteredPostId"
      :model="postBreadcrumbItems"
      :home="{ icon: 'pi pi-list', label: `${collectionNoun}收單列表`, command: backToPostList }"
      class="!p-0 !bg-transparent"
      :pt="{ root: { class: '!border-0' } }"
    >
      <template #item="{ item }">
        <button
          v-if="item.command"
          class="flex items-center gap-2 text-[13px] text-[var(--p-primary-color)] hover:underline"
          @click="item.command"
        >
          <i v-if="item.icon" :class="item.icon" style="font-size: 12px" />
          {{ item.label }}
        </button>
        <span v-else class="flex items-center gap-2 text-[13px] text-[var(--p-text-color)]">
          <i v-if="item.icon" :class="item.icon" style="font-size: 12px" />
          {{ item.label }}
        </span>
      </template>
    </Breadcrumb>

    <!-- 貼文 / 社團模式 + 尚未進入任何 collection → 顯示總覽 -->
    <template v-if="isPostMode && !enteredPostId">
      <PostCollectionOverview
        :posts="visiblePostCollections"
        :kind="collectionKind"
        @select="onSelectPostEntry"
        @create="onCreatePostCollection"
        @view-winners="onViewPostWinners"
      />
    </template>

    <!-- 直播模式尚未選來源 → 空狀態 + 「選擇收單來源」按鈕；貼文 / 社團進入 collection 後不走這條，直接進 Card 版 -->
    <template v-else-if="!isPostMode && !hasAnySource">
      <div class="flex flex-1 min-h-0 gap-2">
        <div class="flex-1 flex flex-col self-stretch min-w-0 gap-2">
          <!-- 左區 toolbar：手機分兩列（場次獨佔第一列、其他按鈕第二列）、桌機 flex-wrap 自動折行 -->
          <div class="flex items-center gap-2 flex-wrap">
            <!-- 場次 wrap 成自己一列（手機）：用 w-full 強制下一個 item 換行 -->
            <div class="w-full sm:w-auto sm:inline-flex">
              <SessionSelector
                v-if="!isPostMode"
                :sessions="sessions"
                :selected="currentSession"
                :live-elapsed="elapsedDisplay"
                size="lg"
                @select="onSessionSelect"
                @create="createDialogVisible = true" />
            </div>

            <!-- 動作群組：超出寬度自動換行（手機 / 桌機皆 wrap，不橫向 scroll） -->
            <div class="w-full sm:w-auto flex items-center gap-2 flex-wrap">
              <!-- 「選擇商品」SplitButton -->
              <span v-tooltip.bottom="currentSession ? '' : t('live_order.tooltip.pick_source_first')" class="inline-flex shrink-0">
                <SplitButton
                  :label="t('live_order.button.add_product')"
                  :model="addProductMenuItems"
                  :disabled="!currentSession"
                  icon="pi pi-plus"
                  outlined
                  size="small"
                  @click="addProductDialogVisible = true"
                />
              </span>

              <!-- 「批次設定」SplitButton -->
              <span v-tooltip.bottom="currentSession ? '' : t('live_order.tooltip.pick_source_first')" class="inline-flex shrink-0">
                <SplitButton
                  :label="t('live_order.button.batch_edit')"
                  :model="batchEditMenuItems"
                  :disabled="!currentSession"
                  outlined
                  size="small"
                  @click="batchEditDialogVisible = true"
                >
                  <template #icon>
                    <FontAwesomeIcon :icon="['far', 'gear']" class="text-sm mr-2" />
                  </template>
                </SplitButton>
              </span>

              <!-- 收單期間（貼文模式專用） -->
              <Button
                v-if="isPostMode"
                label="收單期間"
                icon="pi pi-calendar"
                outlined
                size="small"
                class="shrink-0"
                :disabled="!currentEnteredPost"
                @click="openPostPeriodDialog"
              />

              <!-- 快速新增 button：手機才顯示，點下開 dialog；桌機沿用 inline form -->
              <Button
                class="sm:hidden shrink-0"
                :disabled="!currentSession"
                label="快速新增"
                icon="pi pi-bolt"
                outlined
                size="small"
                @click="quickAddDialogVisible = true"
              />

              <!-- 卡片 / 列表 檢視切換（手機只顯示 icon，桌機 icon+label） -->
              <SelectButton
                v-model="viewMode"
                :options="viewModeOptions"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
                class="shrink-0"
              >
                <template #option="{ option }">
                  <i :class="option.icon" style="font-size: 13px"></i>
                  <span class="hidden sm:inline ml-2">{{ option.label }}</span>
                </template>
              </SelectButton>
            </div>
          </div>

          <!-- 手機版「選擇收單來源」入口 button：< md 才顯示（取代右側 340px 空狀態 column） -->
          <span v-tooltip.bottom="pickSourceTooltip" class="md:hidden inline-flex w-full">
            <Button
              class="w-full"
              :label="t('live_order.button.pick_source')"
              icon="pi pi-link"
              :disabled="!canPickSource"
              @click="onPickSource"
            />
          </span>

          <!-- 快速新增 inline form：桌機顯示、手機隱藏（手機改走 dialog） -->
          <div class="hidden sm:block">
            <QuickAddProductForm v-if="currentSession" ref="quickAddRef" @submit="onQuickAddProducts" />
          </div>

          <div v-if="selectedProducts.length === 0" class="flex flex-col items-center justify-center gap-3 pt-12">
            <i class="pi pi-inbox text-5xl text-[var(--p-text-muted-color)]"></i>
            <p class="font-bold text-[18px] leading-normal text-[var(--p-text-color)]">{{ t('live_order.empty.no_product_content') }}</p>
            <p class="text-[14px] leading-normal text-[var(--p-text-muted-color)]">{{ t('live_order.empty.no_product_hint') }}</p>
          </div>
          <div v-else class="flex-1 min-w-0 overflow-y-auto">
            <!-- 列表式貼文收單：用 LiveProductTable，其他模式維持商品卡 grid（由 viewMode 切換）-->
            <LiveProductTable
              v-if="isListView"
              :products="selectedProducts"
              :ordering-enabled="hasAnySource"
              :period-start-at="currentEnteredPost?.startAt"
              @delete="onDeleteProduct"
              @end-ordering="onCardEndOrdering"
              @adjust-period="openPostPeriodDialog"
            />
            <div v-else class="grid gap-2 grid-cols-2 md:[grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
              <LiveProductCard
                v-for="p in selectedProducts"
                :key="p.id"
                :product="p"
                :ordering-enabled="hasAnySource"
                :is-post-mode="isPostMode"
                :period-start-at="currentEnteredPost?.startAt"
                :locked="biddingLiveId !== null && p.id !== biddingLiveId && p.status === 'live'"
                v-model:status="p.status"
                @delete="onDeleteProduct"
                @end-ordering="onCardEndOrdering"
                @adjust-period="openPostPeriodDialog"
              />
            </div>
          </div>
        </div>

        <!-- 空狀態右側選擇收單來源（手機隱藏，改用上方按鈕；桌機顯示完整 340px 空狀態欄） -->
        <div class="hidden md:flex w-[340px] shrink-0 flex-col items-center gap-3 self-stretch pt-12">
          <i class="pi pi-inbox text-5xl text-[var(--p-text-muted-color)]"></i>
          <p class="font-bold text-[18px] leading-normal text-[var(--p-text-color)]">{{ t('live_order.empty.no_order_content') }}</p>
          <p class="text-[14px] leading-normal text-[var(--p-text-muted-color)]">{{ pickSourceHelperText }}</p>
          <span v-tooltip.bottom="pickSourceTooltip" class="mt-1">
            <Button
              :label="t('live_order.button.pick_source')"
              :disabled="!canPickSource"
              @click="onPickSource"
            />
          </span>
        </div>
      </div>
    </template>

    <!-- 貼文 / 社團模式：已進入 collection + 已選收單來源 → 簡化版 Card + 工具列 + LiveProductTable -->
    <template v-else-if="isPostMode">
      <div class="bg-white rounded-lg shadow-card card-pad flex flex-col gap-4 flex-1 min-h-0">
        <!-- 工具列：選擇商品 / 批次設定 / 收單期間 / 收單來源 / 留言區 -->
        <div class="flex items-center gap-2 flex-wrap">
          <SplitButton
            :label="t('live_order.button.add_product')"
            :model="addProductMenuItems"
            :disabled="!currentSession"
            icon="pi pi-plus"
            outlined
            size="small"
            @click="addProductDialogVisible = true"
          />
          <SplitButton
            :label="t('live_order.button.batch_edit')"
            :model="batchEditMenuItems"
            :disabled="!currentSession"
            outlined
            size="small"
            @click="batchEditDialogVisible = true"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'gear']" class="text-sm mr-2" />
            </template>
          </SplitButton>
          <Button
            label="收單期間"
            icon="pi pi-calendar"
            outlined
            size="small"
            :disabled="!currentEnteredPost"
            @click="openPostPeriodDialog"
          />
          <Button
            label="收單來源"
            icon="pi pi-link"
            outlined
            size="small"
            class="ml-auto"
            @click="onPickSource"
          />
          <Button
            label="留言區"
            icon="pi pi-comments"
            outlined
            size="small"
            @click="commentDrawerVisible = true"
          />
          <!-- 已結束的貼文/社團:改顯示「查看得標人」,不再讓使用者結束一次 -->
          <Button
            v-if="isPostOrderClosed"
            label="查看得標人"
            icon="pi pi-users"
            outlined
            size="small"
            @click="postWinnerDialogVisible = true"
          />
          <Button
            v-else
            :label="t('live_order.button.end_all_live')"
            icon="pi pi-power-off"
            severity="danger"
            outlined
            size="small"
            :disabled="isPostOrderNotStarted"
            v-tooltip.top="isPostOrderNotStarted ? '收單尚未開始,無法結束' : undefined"
            @click="askEndAllPostOrder"
          />
        </div>

        <!-- 商品列表：直接嵌 LiveProductTable（Design.md 6.5 巢狀不另外加外框） -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          <LiveProductTable
            :products="selectedProducts"
            :ordering-enabled="hasAnySource"
            :period-start-at="currentEnteredPost?.startAt"
            :is-post-mode="isPostMode"
            :readonly="isPostOrderClosed"
            @delete="onDeleteProduct"
            @end-ordering="onCardEndOrdering"
            @adjust-period="openPostPeriodDialog"
          />
        </div>
      </div>
    </template>

    <template v-else>

      <OrderModeView
        :sources="sources"
        :products="selectedProducts"
        :show-comments="showComments"
        :use-table="isListView"
        :is-post-mode="isPostMode"
        :bidding-live-id="biddingLiveId"
        :period-start-at="currentEnteredPost?.startAt"
        @pick-source="onPickSource"
        @remove-source="onRemoveSource"
        @delete-product="onDeleteProduct"
        @end-ordering-product="onCardEndOrdering"
        @adjust-period="openPostPeriodDialog">

        <!-- 左區 toolbar：SessionSelector + 選擇商品 / 批次設定 SplitButton -->
        <template #left-toolbar>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- 場次 wrap 成自己一列（手機）：w-full 強制下一個 item 換行 -->
            <div class="w-full sm:w-auto sm:inline-flex">
              <SessionSelector
                v-if="!isPostMode"
                :sessions="sessions"
                :selected="currentSession"
                :live-elapsed="elapsedDisplay"
                size="lg"
                @select="onSessionSelect"
                @create="createDialogVisible = true" />
            </div>

            <!-- 動作群組：超出寬度自動換行（手機 / 桌機皆 wrap，不橫向 scroll） -->
            <div class="w-full sm:w-auto flex items-center gap-2 flex-wrap">
              <span v-tooltip.bottom="currentSession ? '' : t('live_order.tooltip.pick_source_first')" class="inline-flex shrink-0">
                <SplitButton
                  :label="t('live_order.button.add_product')"
                  :model="addProductMenuItems"
                  :disabled="!currentSession"
                  icon="pi pi-plus"
                  outlined
                  size="small"
                  @click="addProductDialogVisible = true"
                />
              </span>

              <span v-tooltip.bottom="currentSession ? '' : t('live_order.tooltip.pick_source_first')" class="inline-flex shrink-0">
                <SplitButton
                  :label="t('live_order.button.batch_edit')"
                  :model="batchEditMenuItems"
                  :disabled="!currentSession"
                  outlined
                  size="small"
                  @click="batchEditDialogVisible = true"
                >
                  <template #icon>
                    <FontAwesomeIcon :icon="['far', 'gear']" class="text-sm mr-2" />
                  </template>
                </SplitButton>
              </span>

              <!-- 收單期間（貼文模式專用） -->
              <Button
                v-if="isPostMode"
                label="收單期間"
                icon="pi pi-calendar"
                outlined
                size="small"
                class="shrink-0"
                :disabled="!currentEnteredPost"
                @click="openPostPeriodDialog"
              />

              <!-- 快速新增 button：手機才顯示，點下開 dialog -->
              <Button
                class="sm:hidden shrink-0"
                :disabled="!currentSession"
                label="快速新增"
                icon="pi pi-bolt"
                outlined
                size="small"
                @click="quickAddDialogVisible = true"
              />

              <!-- 卡片 / 列表 檢視切換（手機只顯示 icon，桌機 icon+label） -->
              <SelectButton
                v-model="viewMode"
                :options="viewModeOptions"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
                class="shrink-0"
              >
                <template #option="{ option }">
                  <i :class="option.icon" style="font-size: 13px"></i>
                  <span class="hidden sm:inline ml-2">{{ option.label }}</span>
                </template>
              </SelectButton>
            </div>
          </div>
        </template>

        <!-- 右區 toolbar：顯示留言 toggle + 結束收單 -->
        <template #right-toolbar>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <i class="pi pi-comments text-[var(--p-text-color)]" style="font-size:14px"></i>
              <span class="text-[14px] font-medium text-[var(--p-text-color)]">{{ t('live_order.label.show_comments') }}</span>
              <ToggleSwitch v-model="showComments" />
            </div>
            <!-- 一鍵收單 SplitButton：主動作 = 結束所有收單中商品並開啟彙總（先跳確認）；下拉 = 移除無收單商品卡 -->
            <!-- label 用 end_all_live = 「一鍵收單」，跟商品卡 / 列表的「結束收單」區分：master 才走彙總彈窗 -->
            <SplitButton
              :label="t('live_order.button.end_all_live')"
              :model="quickActionMenuItems"
              icon="pi pi-power-off"
              severity="danger"
              outlined
              size="small"
              :disabled="isPostOrderNotStarted"
              v-tooltip.top="isPostOrderNotStarted ? '收單尚未開始，無法結束' : undefined"
              @click="askEndAllProducts"
            >
              <template #item="{ item, props: itemProps }">
                <a v-bind="itemProps.action" class="flex items-center gap-2 w-full">
                  <i v-if="item.icon" :class="item.icon" style="font-size: 13px" />
                  <span class="flex-1">{{ item.label }}</span>
                  <i
                    v-if="item.tooltip"
                    class="pi pi-info-circle text-[var(--p-text-muted-color)]"
                    style="font-size: 13px"
                    v-tooltip.top="item.tooltip"
                    @click.stop
                  />
                </a>
              </template>
            </SplitButton>
          </div>
        </template>

        <template #products-header>
          <div class="hidden sm:block">
            <QuickAddProductForm v-if="currentSession" ref="quickAddRef" @submit="onQuickAddProducts" />
          </div>
        </template>
      </OrderModeView>
    </template>

    <!-- 手機快速新增 dialog：toolbar 那顆 button 開啟 -->
    <Dialog
      v-model:visible="quickAddDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
      :pt="{
        header: { style: 'padding: 17.5px' },
        content: { style: 'padding: 0 17.5px 8px' },
        footer: { style: 'padding: 12px 17.5px 17.5px' },
      }"
    >
      <template #header>
        <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
          {{ t('live_order.quick_add.button.add_one') }}
        </span>
      </template>
      <!-- bare=true → 拿掉外框；inline「新增」鈕由 dialog footer 取代 -->
      <QuickAddProductForm
        v-if="quickAddDialogVisible && currentSession"
        ref="quickAddDialogRef"
        bare
        @submit="onQuickAddSubmitFromDialog"
      />
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <Button label="取消" severity="secondary" variant="outlined" @click="quickAddDialogVisible = false" />
          <Button
            :label="t('live_order.quick_add.button.add_one')"
            @click="quickAddDialogRef?.submit()"
          />
        </div>
      </template>
    </Dialog>

    <LiveOrderSourceDialog v-model:visible="sourceDialogVisible"
      :used-by-platform="usedByPlatform"
      :mode="isCommunityMode ? 'community' : (isPostMode ? 'post' : 'live')"
      @confirm="onSourceConfirmed" />
    <CreateSessionDialog v-model:visible="createDialogVisible" @create="onSessionCreate" />
    <CreatePostCollectionDialog v-model:visible="createPostDialogVisible" :kind="collectionKind" @create="onCreatePostSubmit" />
    <WinnerListDialog v-model:visible="winnerDialogVisible" :product="winnerDialogProduct as never" />
    <!-- 貼文/社團已結束 → 工具列「查看得標人」彈窗:列該 collection 底下所有商品的得標人 -->
    <PostWinnerListDialog
      v-model:visible="postWinnerDialogVisible"
      :products="selectedProducts"
    />
    <AddProductDialog v-model:visible="addProductDialogVisible"
      :existing-products="selectedProducts"
      @add-products="onAddProducts" />
    <BatchEditDialog v-model:visible="batchEditDialogVisible"
      :products="selectedProducts" @apply="onBatchApply" @delete="onBatchDelete" />
    <PanelSettingsDialog v-model:visible="panelSettingsDialogVisible"
      :settings="panelSettings" @save="onPanelSettingsSave" />
    <PostPeriodDialog
      v-model:visible="postPeriodDialogVisible"
      :start-at="currentEnteredPost?.startAt"
      :end-at="currentEnteredPost?.endAt"
      @save="onPostPeriodSave" />
    <GiftFormDialog v-model:visible="giftDialogVisible" @submit="onGiftSubmit" />
    <EndOrderingSummaryDialog
      v-model:visible="endSummaryDialogVisible"
      :session-name="currentSession?.name ?? ''"
      :products="endingSummaryProducts"
      :mode="isPostMode ? 'post' : 'live'"
      @submit="onEndSummarySave"
    />
    <DuplicateProductDialog v-model:visible="duplicateDialogVisible" :names="duplicateNames" />

    <!-- 貼文 / 社團模式：右側留言 Drawer；卡片用 bare + divide-y 貼齊面板 -->
    <Drawer
      v-model:visible="commentDrawerVisible"
      position="right"
      header="留言區"
      :style="{ width: 'min(420px, 100vw)' }"
    >
      <div v-if="drawerComments.length">
        <template v-for="(c, i) in drawerComments" :key="c.id">
          <Divider v-if="i > 0" class="!my-0" />
          <LiveCommentCard
            :comment="c"
            :platform-meta="getPlatformMeta(c.platform)"
            bare
          />
        </template>
      </div>
      <div v-else class="flex flex-col items-center justify-center gap-2 py-12 text-[var(--p-text-muted-color)]">
        <i class="pi pi-comments text-4xl"></i>
        <span class="text-sm">尚無留言</span>
      </div>
    </Drawer>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLayoutStore } from '@/admin/stores/layout'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import LiveOrderSourceDialog from './components/LiveOrderSourceDialog.vue'
import SessionSelector from './components/SessionSelector.vue'
import CreateSessionDialog from './components/CreateSessionDialog.vue'
import OrderModeView from './components/OrderModeView.vue'
import LiveProductCard from './components/LiveProductCard.vue'
import AddProductDialog from './components/AddProductDialog.vue'
import BatchEditDialog from './components/BatchEditDialog.vue'
import PanelSettingsDialog, { type PanelSettings } from './components/PanelSettingsDialog.vue'
import EndOrderingSummaryDialog, { type EndOrderingPayload } from './components/EndOrderingSummaryDialog.vue'
import QuickAddProductForm from './components/QuickAddProductForm.vue'
import LiveProductTable from './components/LiveProductTable.vue'
import LiveCommentCard from './components/LiveCommentCard.vue'
import { commentTemplates, applyTemplate, getPlatformMeta, type LiveComment, type CommentProductLite } from './utils/liveComments'
import PostCollectionOverview, { type PostCollection } from './components/PostCollectionOverview.vue'
import WinnerListDialog from './components/WinnerListDialog.vue'
import PostWinnerListDialog from './components/PostWinnerListDialog.vue'
import CreatePostCollectionDialog, { type CreatePostCollectionPayload } from './components/CreatePostCollectionDialog.vue'
import PostPeriodDialog from './components/PostPeriodDialog.vue'
import { addLiveOrderRecord } from './utils/liveOrderRecords'
import GiftFormDialog, { type GiftSubmitPayload } from './components/GiftFormDialog.vue'
import DuplicateProductDialog from './components/DuplicateProductDialog.vue'
import { addToCatalog, isCatalogDuplicate } from './utils/productCatalog'
import { pickSourceMockForCollection } from './utils/sourceMockPosts'
import type { MenuItem } from 'primevue/menuitem'

interface ProductSpec {
  id?: number
  name?: string
  stock?: number
  sold?: number
  price?: number
  [key: string]: unknown
}

interface LiveProduct {
  id: number
  name?: string
  keyword?: string
  sku?: string
  price?: number
  stock?: number
  sold?: number
  status?: string
  startedAt?: number
  selectedSpecs?: ProductSpec[]
  specs?: ProductSpec[]
  [key: string]: unknown
}

interface LiveSource {
  id: number
  type: string
  label: string
  addedAt: Date
  postId?: number | string | null
  groupId?: number | string | null
}

interface LiveSession {
  id: number
  name: string
  date: string
  products: LiveProduct[]
  sources: LiveSource[]
}

interface SessionCreatePayload {
  name: string
  date: string
}

interface BatchApplyPayload {
  productIds: number[]
  patch: Record<string, unknown>
}

interface SourceConfirmExtras {
  postId?: number | string | null
  groupId?: number | string | null
  /** 使用者在 dialog 內選到的卡片標題（社團 / 貼文 post 名稱），用來覆蓋 source 的 label */
  title?: string | null
}

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()
const route = useRoute()

/**
 * 頁面模式：依 route 名稱判斷。
 * - `live.order` → 直播收單（完整功能）
 * - `live.order.post` → 貼文收單（清單模式、無場次、無快速新增）
 * - `live.order.community` → 社團收單（清單模式，與貼文收單同設計，只差資料來源 + 標籤）
 *
 * `isPostMode` 為歷史命名，現在代表「清單模式」（貼文 + 社團共用一套 UX）；
 * 細分時用 `collectionKind`（'post' / 'community'）切換標題、按鈕文案、breadcrumb。
 */
const isCommunityMode = computed(() => route.name === 'live.order.community')
const isPostMode = computed(() =>
  route.name === 'live.order.post'
  || route.name === 'live.order.post.list'
  || isCommunityMode.value,
)
const collectionKind = computed<'post' | 'community'>(() =>
  isCommunityMode.value ? 'community' : 'post',
)
/** 給 UI 標籤用的中文文案：依 collectionKind 決定要顯示「貼文」還是「社團」 */
const collectionNoun = computed(() => collectionKind.value === 'community' ? '社團' : '貼文')
/** 貼文 / 社團收單資料不同步:overview 依 collectionKind 篩出各自的 list;未標 kind 的舊資料視為 'post'。 */
const visiblePostCollections = computed<PostCollection[]>(() =>
  postCollections.value.filter((p) => (p.kind ?? 'post') === collectionKind.value),
)
/** 列表式貼文收單：body 改用 LiveProductTable 而非商品卡 grid。 */
const isPostListMode = computed(() => route.name === 'live.order.post.list')

/**
 * 貼文收單頁可在卡片/列表式之間切換的本地 UI 狀態。
 * 初始值依路由決定（保留 .post.list 直接進列表式的舊行為），之後完全由使用者按鈕主導。
 */
type ViewMode = 'card' | 'list'
const viewMode = ref<ViewMode>(isPostListMode.value ? 'list' : 'card')
watch(isPostMode, (post) => {
  if (post) viewMode.value = isPostListMode.value ? 'list' : 'card'
})
const isListView = computed(() => viewMode.value === 'list')
const viewModeOptions: Array<{ value: ViewMode; icon: string; label: string }> = [
  { value: 'card', icon: 'pi pi-th-large', label: '卡片式' },
  { value: 'list', icon: 'pi pi-list',     label: '列表式' },
]

const addProductDialogVisible = ref(false)
/** 手機尺寸快速新增 dialog */
const quickAddDialogVisible = ref(false)
const quickAddDialogRef = ref<{ submit: () => void } | null>(null)
function onQuickAddSubmitFromDialog(payloads: Parameters<typeof onQuickAddProducts>[0]): void {
  onQuickAddProducts(payloads)
  quickAddDialogVisible.value = false
}
const giftDialogVisible = ref(false)

// SplitButton：主按鈕開選擇商品（dialog 內 Tabs 可切到組合商品）；下拉只剩送禮物
const addProductMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('live_order.button.send_gift'),
    icon: 'pi pi-gift',
    command: () => { giftDialogVisible.value = true },
  },
])

// SplitButton：主按鈕開批次設定；下拉開面板設定
const panelSettingsDialogVisible = ref(false)
const batchEditMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('live_order.button.panel_setting'),
    icon: 'pi pi-sliders-h',
    command: () => { panelSettingsDialogVisible.value = true },
  },
])

// 貼文模式專屬：收單期間設定獨立按鈕（在「批次設定」SplitButton 右側）
const postPeriodDialogVisible = ref(false)
function openPostPeriodDialog(): void {
  postPeriodDialogVisible.value = true
}
function onPostPeriodSave(payload: { startAt: Date | null; endAt: Date | null }): void {
  const post = currentEnteredPost.value
  if (!post) return
  post.startAt = payload.startAt
  post.endAt = payload.endAt
  const dl = deadlineFieldsFor(post.startAt, post.endAt)
  post.deadlineText = dl.deadlineText
  post.deadlineSeverity = dl.deadlineSeverity
  post.deadlineMinutes = dl.deadlineMinutes
  // 重新依時間判斷 status（已結單的不動）：startAt 還沒到 → ready；已到 / 未設 → ongoing
  // 否則使用者把期間改到未來時，外面列表還顯示「收單中」，會跟內頁狀態不同步
  if (post.status !== 'closed_today') {
    const futureStart = payload.startAt && payload.startAt.getTime() > Date.now()
    post.status = futureStart ? 'ready' : 'ongoing'
  }
  toast.add({ severity: 'success', summary: '收單期間已更新', life: 1800 })
}

/**
 * 在貼文 / 社團模式下「使用者進入哪一筆 collection」用獨立 state 紀錄；
 * 不再依賴 sources 來判斷，避免「進入貼文 = 自動有來源」的耦合。
 */
const enteredPostId = ref<number | null>(null)

/** 當下從 overview 點進來的那筆 PostCollection（依 enteredPostId 找） */
const currentEnteredPost = computed<PostCollection | undefined>(() => {
  if (!isPostMode.value || enteredPostId.value == null) return undefined
  return postCollections.value.find((p) => p.id === enteredPostId.value)
})

/**
 * 貼文 / 社團模式下，當下進入的這筆收單還沒開始（status = 'ready'）。
 * 用來讓「結束收單」按鈕在還沒開始前 disable — 直播模式不適用。
 */
const isPostOrderNotStarted = computed(() => {
  if (!isPostMode.value) return false
  return currentEnteredPost.value?.status === 'ready'
})

/** 進入的貼文/社團已結束 → 工具列改顯示「查看得標人」而非「一鍵結束收單」。 */
const isPostOrderClosed = computed(() => {
  if (!isPostMode.value) return false
  return currentEnteredPost.value?.status === 'closed_today'
})

/** 貼文/社團「查看得標人」彈窗 visible */
const postWinnerDialogVisible = ref(false)

// 一鍵結束收單 SplitButton 下拉：一鍵開始 / 一鍵停止 / 移除無收單商品
const quickActionMenuItems = computed<Array<MenuItem & { tooltip?: string }>>(() => [
  {
    label: t('live_order.button.start_all_live'),
    icon: 'pi pi-play',
    disabled: !hasReadyProduct.value,
    command: () => { startAllReadyProducts() },
    tooltip: '把所有「準備中」商品一次切到收單中',
  },
  {
    label: t('live_order.button.stop_all_live'),
    icon: 'pi pi-pause',
    disabled: !hasLiveProduct.value,
    command: () => { stopAllLiveProducts() },
    tooltip: '把所有「收單中」商品停住回準備中（不寫入紀錄）',
  },
  {
    label: t('live_order.button.remove_done'),
    icon: 'pi pi-trash',
    disabled: !hasNoSaleProduct.value,
    command: () => { removeNoSaleProducts() },
    tooltip: '移除尚未開始收單過的商品',
  },
])

/** 是否有「準備中」商品（給「一鍵開始收單」decide disabled） */
const hasReadyProduct = computed(() =>
  selectedProducts.value.some(p => (p.status ?? 'ready') === 'ready'),
)

/** 一鍵把全部 ready 商品切到 live。 */
function startAllReadyProducts(): void {
  if (!currentSession.value || !hasReadyProduct.value) return
  let changed = 0
  selectedProducts.value.forEach((p) => {
    if ((p.status ?? 'ready') === 'ready') {
      p.status = 'live'
      changed++
    }
  })
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.button.start_all_live'),
    detail: `${changed} 件商品已開始收單`,
    life: 2000,
  })
}

/** 一鍵把全部 live 商品停住（status 回 ready，不寫紀錄）。 */
function stopAllLiveProducts(): void {
  if (!currentSession.value || !hasLiveProduct.value) return
  let changed = 0
  selectedProducts.value.forEach((p) => {
    if (p.status === 'live') {
      p.status = 'ready'
      changed++
    }
  })
  toast.removeAllGroups()
  toast.add({
    severity: 'info',
    summary: t('live_order.button.stop_all_live'),
    detail: `${changed} 件商品已停止收單（未寫入紀錄）`,
    life: 2000,
  })
}

// 綜合收單頁設定：原型階段以本地 state 保存，存擋僅 toast
const panelSettings = ref<PanelSettings>({
  duplicateOrderMode: 'keep_latest',
  allowKeywordCancel: true,
  notifyOrderStart: true,
  notifyOrderEnd: true,
  notifyOutOfStock: true,
  notifyWinnerOrderCreated: false,
  autoPrintShipment: true,
})
function onPanelSettingsSave(next: PanelSettings): void {
  panelSettings.value = next
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.panel_setting_saved'),
    life: 2000,
  })
}

/**
 * 送禮物送出：把禮物加進當前場次商品列表，呈現為商品卡。
 *
 * `isGift: true` 旗標標記禮物來源，給商品卡渲染辨識。
 * 庫存扣減 / 入庫策略尚未規劃，暫時把 stock 直接設為發放數量，由後續實作決定是否扣除。
 */
function onGiftSubmit(payload: GiftSubmitPayload): void {
  if (!currentSession.value) return
  currentSession.value.products.push({
    id: Date.now(),
    name: payload.name,
    keyword: payload.keyword,
    price: 0,
    stock: payload.quantity,
    sold: 0,
    status: 'ready',
    specs: [],
    isGift: true,
    note: payload.message,
    imageUrl: payload.imageUrl,
  })
  toast.removeAllGroups();   toast.add({
    severity: 'success',
    summary: t('live_order.toast.gift_sent'),
    detail: payload.name,
    life: 2500,
  })
}
const batchEditDialogVisible = ref(false)
const showComments = ref(true)

/** Apply a batch-edit patch to selected products in the current session. */
function onBatchApply({ productIds, patch }: BatchApplyPayload): void {
  if (!currentSession.value) return
  const idSet = new Set(productIds)
  let updated = 0
  currentSession.value.products.forEach(p => {
    if (!idSet.has(p.id)) return
    Object.entries(patch).forEach(([key, value]) => { (p as Record<string, unknown>)[key] = value })
    updated++
  })
  toast.removeAllGroups();   toast.add({
    severity: 'success',
    summary: t('live_order.toast.batch_edit_done'),
    detail: t('live_order.toast.batch_edit_detail', { count: updated, fields: Object.keys(patch).length }),
    life: 2500,
  })
}

/** 批次刪除：依勾選 id 從當前場次的 products 移除，並 toast 提示。 */
function onBatchDelete(productIds: number[]): void {
  if (!currentSession.value || productIds.length === 0) return
  const idSet = new Set(productIds)
  const list = currentSession.value.products
  const before = list.length
  currentSession.value.products = list.filter(p => !idSet.has(p.id))
  const removed = before - currentSession.value.products.length
  if (removed > 0) {
    toast.removeAllGroups();     toast.add({
      severity: 'success',
      summary: t('live_order.toast.bulk_delete_done'),
      detail: t('live_order.toast.bulk_delete_detail', { count: removed }),
      life: 2500,
    })
  }
}

// ── 場次 ─────────────────────────────────────────
const sessions = ref<LiveSession[]>([
  { id: 1, name: '春季首播',   date: '2025/05/13', products: [], sources: [] },
  { id: 2, name: '母親節特賣', date: '2025/05/10', products: [], sources: [] },
])
const currentSession = ref<LiveSession | null>(null)

/**
 * 貼文收單獨立容器：和直播收單的 `sessions` 完全隔離，避免兩邊建立的商品 / 來源互相同步。
 * 不放進 `sessions` 陣列，避免 SessionSelector 把它列在直播模式可選清單。
 * name 給有意義的預設文字，結束收單彙總彈窗與收單紀錄寫入時才不會空白。
 */
const postSession = ref<LiveSession>({
  id: -1,
  name: '貼文收單',
  date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
  products: [],
  sources: [],
})

// 貼文收單總覽 mock：對齊 multi_post_collection_overview_mockup.html
const postCollections = ref<PostCollection[]>([
  {
    id: 8001,
    name: '日本藥妝代購',

    pendingCount: 22,
    updateNote: '3 分鐘前更新',
    soldCount: 188,
    commentCount: 210,
    deadlineText: '整年收單',
    deadlineSeverity: 'secondary',
    status: 'ongoing',
    deadlineMinutes: 60 * 24 * 180,
    lastCommentMinutes: 3,
    startAt: new Date(2026, 0, 1),
    endAt:   new Date(2026, 11, 31, 23, 59),
    products: [
      { id: 80101, name: '麗芙隆隔離乳 50ml', keyword: 'JP1', price: 590, stock: 200, sold: 70 },
      { id: 80102, name: '蜂王乳面膜 5 入', keyword: 'JP2', price: 320, stock: 250, sold: 90 },
      { id: 80103, name: '茶花泡澡入浴劑 10 入', keyword: 'JP3', price: 280, stock: 150, sold: 28 },
    ],
  },
  {
    id: 8002,
    name: '2/14 日韓零食團',
    kind: 'community',
    pendingCount: 9,
    updateNote: '2 分鐘前更新',
    soldCount: 112,
    commentCount: 128,
    deadlineText: '整年收單',
    deadlineSeverity: 'secondary',
    status: 'ongoing',
    deadlineMinutes: 60 * 24 * 180,
    lastCommentMinutes: 2,
    startAt: new Date(2026, 0, 1),
    endAt:   new Date(2026, 11, 31, 23, 59),
    products: [
      { id: 80201, name: '日本 LOTTE 巧克力派 12 入', keyword: 'A1', price: 199, stock: 100, sold: 45 },
      { id: 80202, name: '韓國 ORION 蜂蜜奶油薯片', keyword: 'A2', price: 89, stock: 200, sold: 67 },
    ],
  },
  {
    id: 8003,
    name: '母親節康乃馨預購',

    pendingCount: 4,
    updateNote: '11 分鐘前更新',
    soldCount: 60,
    commentCount: 64,
    deadlineText: '整年收單',
    deadlineSeverity: 'secondary',
    status: 'ongoing',
    deadlineMinutes: 60 * 24 * 180,
    lastCommentMinutes: 11,
    startAt: new Date(2026, 0, 1),
    endAt:   new Date(2026, 11, 31, 23, 59),
    products: [
      { id: 80301, name: '康乃馨花束 6 朵', keyword: 'M1', price: 680, stock: 80, sold: 36 },
      { id: 80302, name: '永生花禮盒', keyword: 'M2', price: 1280, stock: 40, sold: 24 },
    ],
  },
  {
    id: 8004,
    name: '週三蔬菜箱',
    kind: 'community',
    updateNote: '剛剛更新',
    soldCount: 45,
    commentCount: 45,
    deadlineText: '整年收單',
    deadlineSeverity: 'secondary',
    status: 'ongoing',
    deadlineMinutes: 60 * 24 * 180,
    lastCommentMinutes: 0,
    startAt: new Date(2026, 0, 1),
    endAt:   new Date(2026, 11, 31, 23, 59),
    products: [
      { id: 80401, name: '有機葉菜綜合箱', keyword: 'V1', price: 480, stock: 60, sold: 30 },
      { id: 80402, name: '產地直送番茄', keyword: 'V2', price: 220, stock: 80, sold: 15 },
    ],
  },
  {
    id: 8005,
    name: '韓國服飾團',

    pendingCount: 3,
    updateNote: '已達結單時間',
    soldCount: 30,
    commentCount: 33,
    deadlineText: '整年收單',
    deadlineSeverity: 'secondary',
    status: 'ongoing',
    deadlineMinutes: 60 * 24 * 180,
    lastCommentMinutes: 8,
    startAt: new Date(2026, 0, 1),
    endAt:   new Date(2026, 11, 31, 23, 59),
    products: [
      { id: 80501, name: '韓版針織毛衣', keyword: 'K1', price: 890, stock: 50, sold: 18 },
      { id: 80502, name: '高腰寬褲', keyword: 'K2', price: 650, stock: 60, sold: 12 },
    ],
  },
  // 給「準備中」tab 測試用：startAt 設在 24 小時後，進入後按「開始收單」會跳「收單期間還沒到」提示
  {
    id: 8006,
    name: '夏季美妝預購團',

    pendingCount: 0,
    updateNote: '剛建立',
    soldCount: 0,
    commentCount: 0,
    deadlineText: '24 小時後開單',
    deadlineSeverity: 'secondary',
    status: 'ready',
    deadlineMinutes: 60 * 24,
    lastCommentMinutes: 0,
    startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endAt:   new Date(Date.now() + 48 * 60 * 60 * 1000),
    products: [
      { id: 80601, name: '日韓夏日防曬乳', keyword: 'S1', price: 590, stock: 100, sold: 0 },
      { id: 80602, name: '輕透氣墊粉餅', keyword: 'S2', price: 880, stock: 80, sold: 0 },
    ],
  },
])

/** 各貼文上一次離開時的商品 / 設定快照；以 post.id 為 key。
 *  從 overview 進入時優先吃 cache，沒有的話再用 post.products mock。 */
const postSessionCache = new Map<number, LiveProduct[]>()
/**
 * 各 PostCollection 已挑過的 sources 快照；離開時 sync、進入時還原。
 * 用來判斷「這個社團 / 貼文（依 sourceMockPosts.id）有沒有被某筆 collection 用過」
 * → 在 LiveOrderSourceDialog 內 disable 對應卡片，避免重複選同一篇貼文當來源。
 */
const postSourcesCache = ref<Map<number, LiveSource[]>>(new Map())

/** 從總覽點按一筆 → 視為已挑選來源 + 把該貼文商品塞進 postSession，直接進入收單畫面 */
function onSelectPostEntry(id: number): void {
  const post = postCollections.value.find((p) => p.id === id)
  if (!post) return
  postSession.value.name = post.name
  // 收單期間自動判斷：post.startAt 為 null 或已過 → 商品直接 live 開始收單；
  // 尚未到 startAt → 商品先停在 ready，由排程 watcher 在時間到時自動切 live；
  // 已結束的貼文 → 商品停在 ready 供檢視
  const isStarted = !post.startAt || post.startAt.getTime() <= Date.now()
  const initialStatus = post.status === 'closed_today' ? 'ready' : (isStarted ? 'live' : 'ready')
  // 先看 cache 有沒有上次留下的狀態，沒有就用 overview 的 mock 商品
  const cached = postSessionCache.get(post.id)
  postSession.value.products = cached ?? (post.products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    keyword: p.keyword,
    price: p.price,
    stock: p.stock,
    sold: p.sold ?? 0,
    status: initialStatus,
    specs: [],
  }))
  // 「進入哪一筆 collection」用 enteredPostId 紀錄；source 還原順序：
  // 1) 有 cache（之前選過 / 自動補過）→ 用 cache
  // 2) 沒 cache 但是 ongoing → 自動補一筆，label 用 sourceMockPosts 代表貼文 / 社團貼文
  //    （不能直接套 collection name — 跟列表上的「貼文／社團團名」會重複）
  // 3) 其他狀態（ready / closed_today）→ 空 sources，使用者進去再按「選擇收單來源」
  enteredPostId.value = post.id
  const cachedSources = postSourcesCache.value.get(post.id)
  if (cachedSources && cachedSources.length > 0) {
    postSession.value.sources = cachedSources.map((s) => ({ ...s })) as unknown as never[]
  } else if (post.status === 'ongoing') {
    const isCommunity = isCommunityMode.value
    const mockSrc = pickSourceMockForCollection(post.id)
    const autoSource = {
      id: post.id,
      type: isCommunity ? 'group' : 'fb',
      label: mockSrc.title,
      addedAt: new Date(),
      postId: isCommunity ? null : mockSrc.id,
      groupId: isCommunity ? mockSrc.id : null,
    } as unknown as never
    postSession.value.sources = [autoSource]
    // 立刻寫進 cache，這樣下面 usedPostIds / usedGroupIds 立即包含此筆
    postSourcesCache.value.set(post.id, [autoSource as unknown as LiveSource])
  } else {
    postSession.value.sources = []
  }
  currentSession.value = postSession.value
}

/** 從貼文列表點「得標清單」icon → 開 WinnerListDialog（用該檔第一個商品） */
const winnerDialogVisible = ref(false)
const winnerDialogProduct = ref<Record<string, unknown>>({})
function onViewPostWinners(id: number): void {
  const post = postCollections.value.find((p) => p.id === id)
  const first = (postSessionCache.get(id)?.[0] ?? post?.products?.[0]) as Record<string, unknown> | undefined
  if (!first) {
    toast.add({ severity: 'info', summary: '此貼文尚無商品', life: 1500 })
    return
  }
  winnerDialogProduct.value = first
  winnerDialogVisible.value = true
}


/** 「新增貼文收單」按鈕：開啟命名 + 渠道對話框。 */
const createPostDialogVisible = ref(false)
function onCreatePostCollection(): void {
  createPostDialogVisible.value = true
}

/** 把 Date 起迄轉成 deadline*** 顯示欄位 */
function deadlineFieldsFor(startAt: Date | null, endAt: Date | null): {
  deadlineText: string
  deadlineSeverity: 'secondary' | 'warning' | 'danger'
  deadlineMinutes: number | null
  orderingPeriod: string
} {
  const fmt = (d: Date): string => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day} ${hh}:${mm}`
  }
  const orderingPeriod = startAt && endAt
    ? `${fmt(startAt)} - ${fmt(endAt)}`
    : (endAt ? `- ${fmt(endAt)}` : '未設')
  if (!endAt) {
    return { deadlineText: '未設結單', deadlineSeverity: 'warning', deadlineMinutes: null, orderingPeriod }
  }
  const now = Date.now()
  const diffMin = Math.round((endAt.getTime() - now) / 60000)
  if (diffMin <= 0) {
    return { deadlineText: '已達結單時間', deadlineSeverity: 'warning', deadlineMinutes: 0, orderingPeriod }
  }
  let text: string
  let severity: 'secondary' | 'warning' | 'danger' = 'secondary'
  if (diffMin < 60) {
    text = `${diffMin} 分鐘後結單`
    severity = 'danger'
  } else if (diffMin < 60 * 24) {
    text = `今天 ${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')} 結單`
    severity = 'warning'
  } else {
    const days = Math.ceil(diffMin / (60 * 24))
    text = `${days} 天後結單`
  }
  return { deadlineText: text, deadlineSeverity: severity, deadlineMinutes: diffMin, orderingPeriod }
}

/** 命名後送出 → 在 overview 最前面 unshift 新檔 + 自動進入該檔的收單頁 */
function onCreatePostSubmit(payload: CreatePostCollectionPayload): void {
  const newId = Date.now()
  const dl = deadlineFieldsFor(payload.startAt, payload.endAt)
  // startAt 還沒到 → 準備中（ready）；已到 / 未設 → 收單中（ongoing）
  const initialStatus: PostCollection['status'] = payload.startAt && payload.startAt.getTime() > Date.now()
    ? 'ready'
    : 'ongoing'
  const newPost: PostCollection = {
    id: newId,
    name: payload.name,
    kind: collectionKind.value,
    pendingCount: 0,
    updateNote: '剛建立',
    soldCount: 0,
    commentCount: 0,
    deadlineText: dl.deadlineText,
    deadlineSeverity: dl.deadlineSeverity,
    status: initialStatus,
    deadlineMinutes: dl.deadlineMinutes,
    lastCommentMinutes: 0,
    products: [],
    startAt: payload.startAt,
    endAt: payload.endAt,
  }
  postCollections.value.unshift(newPost)
  onSelectPostEntry(newId)
}

/** 麵包屑：第二層顯示當前進入的貼文名稱 */
const postBreadcrumbItems = computed<MenuItem[]>(() => [
  { label: currentSession.value?.name ?? '貼文收單', icon: 'pi pi-file' },
])
/** 返回貼文收單列表：把當下商品快照寫進 cache、同步「已成單」回 overview，
 *  再清掉 enteredPostId / sources / products → 觸發回 overview 的條件
 *  sources 寫進 postSourcesCache，下次重新進入這筆 collection 時還原 + 影響 used 判斷 */
function backToPostList(): void {
  syncPostStatsBack()
  const pid = enteredPostId.value
  if (pid != null) {
    const currentSources = postSession.value.sources as unknown as LiveSource[]
    if (currentSources && currentSources.length > 0) {
      postSourcesCache.value.set(pid, currentSources.map((s) => ({ ...s })))
    } else {
      postSourcesCache.value.delete(pid)
    }
  }
  enteredPostId.value = null
  postSession.value.sources = []
  postSession.value.products = []
  currentSession.value = postSession.value
}

/** 把 postSession 當下商品的 sold 加總，同步回 overview：
 *  - soldCount = 全部商品 sold 相加（得標總數）
 *  - 新增的得標數 → 從 pendingCount 扣掉（已消化的待處理留言）
 *  - commentCount 保持 >= soldCount + pendingCount（避免 progressbar 超過 100%）
 *  進度條 = soldCount / commentCount，會跟著一起刷新。
 *  同步順便把商品快照寫進 cache，下次進來能還原。 */
function syncPostStatsBack(): void {
  const postId = enteredPostId.value
  if (postId == null) return
  const products = postSession.value.products as LiveProduct[]
  postSessionCache.set(postId, products)
  const post = postCollections.value.find((p) => p.id === postId)
  if (!post) return
  const newSold = products.reduce((s, p) => s + (p.sold ?? 0), 0)
  const delta = newSold - post.soldCount
  post.soldCount = newSold
  if (delta > 0) {
    post.pendingCount = Math.max(0, (post.pendingCount ?? 0) - delta)
    const minComment = newSold + (post.pendingCount ?? 0)
    if ((post.commentCount ?? 0) < minComment) post.commentCount = minComment
  }
}

/**
 * 切換模式時恢復對應容器，避免直播 / 貼文 / 社團之間殘留 currentSession 或 enteredPostId：
 * - 進貼文 / 社團模式：先保存目前直播選擇的場次，再切到 postSession
 * - 回直播模式：恢復先前的直播場次（null 表示尚未選擇）
 */
let lastLiveSession: LiveSession | null = null
watch(isPostMode, (post, oldPost) => {
  if (post) {
    if (oldPost !== undefined && currentSession.value !== postSession.value) {
      lastLiveSession = currentSession.value
    }
    currentSession.value = postSession.value
  } else if (oldPost !== undefined) {
    currentSession.value = lastLiveSession
  }
}, { immediate: true })

/**
 * 側邊欄路由切換（live.order ↔ live.order.post ↔ live.order.community）時：
 * - 一律把 collection 模式下的進入狀態清掉 → 直接顯示對應的總覽 / 直播空狀態
 * - postSourcesCache 也要清掉 — 它記錄的 source.type 是進入當下模式產生的（fb / group），
 *   切到別的模式後 type 對不上對應 icon / 顏色，會看到「貼文模式顯示社團 icon」的問題
 */
watch(() => route.name, (next, prev) => {
  if (next === prev) return
  enteredPostId.value = null
  postSession.value.sources = []
  postSession.value.products = []
  postSourcesCache.value = new Map()
})

function onSessionSelect(s: LiveSession): void { currentSession.value = s }

const createDialogVisible = ref(false)
/** Create a new session from the dialog payload and select it. */
function onSessionCreate(payload: SessionCreatePayload): void {
  const newSession: LiveSession = { id: Date.now(), ...payload, products: [], sources: [] }
  sessions.value.unshift(newSession)
  currentSession.value = newSession
  toast.removeAllGroups();   toast.add({ severity: 'success', summary: t('live_order.toast.session_created'), detail: newSession.name, life: 2500 })
}

// ── 商品（綁定到當前場次）─────────────────────────
const selectedProducts = computed<LiveProduct[]>(() => currentSession.value?.products ?? [])

/**
 * 當前場次中正在「競價 + 收單中」的商品 id；任一支競價商品 live 時其他卡片就被鎖住。
 * 用於 OrderModeView / 空狀態 grid 把 `locked` 傳給非該卡的 LiveProductCard。
 */
const biddingLiveId = computed<number | null>(() => {
  const p = selectedProducts.value.find(p => (p as Record<string, unknown>).bidding && p.status === 'live')
  return p ? p.id : null
})

interface QuickAddProductPayload {
  id: number
  name: string
  keyword: string
  price: number
  stock: number
  specs: never[]
}

// 重複商品提示彈窗
const duplicateDialogVisible = ref(false)
const duplicateNames = ref<string[]>([])

/**
 * 快速新增商品：把每筆都加入當前場次的 products 清單；
 * 原型階段不做重複名稱檢查、不彈重複 dialog，只顯示一個成功 toast。
 */
function onQuickAddProducts(payloads: QuickAddProductPayload[]): void {
  if (!currentSession.value || payloads.length === 0) return
  payloads.forEach((p) => {
    currentSession.value!.products.push({
      id: p.id,
      name: p.name,
      keyword: p.keyword,
      price: p.price,
      stock: p.stock,
      sold: 0,
      status: 'ready',
      specs: [],
    })
    // 同步寫進「選擇商品」picker 的目錄；名稱重複就不重複加（避免 duplicate id 進去）
    if (!isCatalogDuplicate(p.name)) {
      addToCatalog({
        id: p.id,
        name: p.name,
        sku: p.keyword || `QA-${p.id}`,
        category: '快速新增',
        price: p.price,
        stock: p.stock,
        status: '上架中',
      })
    }
  })
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.products_added'),
    detail: t('live_order.toast.products_added_detail', { added: payloads.length }),
    life: 2000,
  })
}

/** Remove a product card from the current session. */
function onDeleteProduct(id: number): void {
  if (!currentSession.value) return
  const list = currentSession.value.products
  const idx = list.findIndex((p) => p.id === id)
  if (idx === -1) return
  list.splice(idx, 1)
}

/**
 * Merge newly added products into the current session, skipping duplicates.
 *
 * 貼文模式下若該貼文的收單期間已開始（startAt 已過 / 未設），新加入的商品直接 status=live，
 * 並用 confirm dialog 告知使用者「收單期間已開始，會直接開始收單」。
 */
function onAddProducts(products: LiveProduct[]): void {
  if (!currentSession.value) return
  const target = currentSession.value.products
  const ids = new Set(target.map(p => p.id))

  const enteredPost = currentEnteredPost.value
  const periodStarted = isPostMode.value
    && !!enteredPost
    && enteredPost.status !== 'closed_today'
    && (!enteredPost.startAt || enteredPost.startAt.getTime() <= Date.now())
  const initialStatus = periodStarted ? 'live' : 'ready'

  let added = 0
  products.forEach(p => {
    if (!ids.has(p.id)) {
      target.push({ ...p, status: p.status || initialStatus, sold: p.sold ?? 0 })
      added++
    }
  })
  const skipped = products.length - added

  if (added > 0 && periodStarted) {
    confirm.require({
      header: '收單期間已開始',
      message: `目前已在收單期間內，新加入的 ${added} 件商品會直接開始收單。`,
      icon: 'pi pi-info-circle',
      modal: true,
      rejectProps: { style: 'display: none' },
      acceptProps: { label: '我知道了' },
      accept: () => {},
    })
    return
  }

  toast.removeAllGroups()
  toast.add({
    severity: added > 0 ? 'success' : 'warn',
    summary: added > 0 ? t('live_order.toast.products_added') : t('live_order.toast.products_not_added'),
    detail: skipped > 0
      ? t('live_order.toast.products_added_with_skipped', { added, skipped })
      : t('live_order.toast.products_added_detail', { added }),
    life: 2500,
  })
}

// ── 收單來源（多筆，綁定到當前場次） ─────────────
const sourceDialogVisible = ref(false)
const sources = computed<LiveSource[]>(() => currentSession.value?.sources ?? [])

const hasAnySource = computed(() => sources.value.length > 0)

// ── 貼文 / 社團收單：留言區 Drawer ─────────────
/**
 * 貼文 / 社團模式進入某筆 collection 後，工具列的「留言區」按鈕開這個 Drawer。
 * 內容用 commentTemplates 30 筆模板 + 當前貼文商品做動態替換，避免直播模式塞 Comment Tab 到 post entered 版面。
 */
const commentDrawerVisible = ref(false)
const drawerCommentProducts = computed<CommentProductLite[]>(() =>
  selectedProducts.value.map((p) => ({
    name: p.name ?? '',
    keyword: p.keyword ?? '',
    isGift: !!p.isGift,
    bidding: !!p.bidding,
    flatPrice: (p.flatPrice as number | undefined) ?? p.price ?? 0,
    specs: ((p.selectedSpecs?.length ? p.selectedSpecs : p.specs) ?? [])
      .map((s) => s.name ?? '')
      .filter(Boolean),
  })),
)
const drawerBidProduct = computed<CommentProductLite | null>(
  () => drawerCommentProducts.value.find((p) => p.bidding) ?? null,
)
const drawerComments = computed<LiveComment[]>(() =>
  commentTemplates.map((c) => ({
    ...c,
    text: applyTemplate(c.text, drawerCommentProducts.value, drawerBidProduct.value),
  })),
)

const hasLiveProduct = computed(() => selectedProducts.value.some(p => p.status === 'live'))

// 各狀態的商品數，給工具列上的小型統計顯示用
const statusCounts = computed(() => ({
  live: selectedProducts.value.filter(p => p.status === 'live').length,
  ready: selectedProducts.value.filter(p => p.status === 'ready' || !p.status).length,
  done: selectedProducts.value.filter(p => p.status === 'done').length,
}))

/**
 * 銷售總計：當前場次「已成功下標」商品金額（禮物不列入）。
 * 直接讀每商品實際的 `sold`（由 LiveProductCard 收單中 ticker 累計），
 * 因此會隨商品卡上升、所有商品結束收單後自然停在該金額。
 */
const salesTotal = computed(() => {
  return selectedProducts.value.reduce((sum, p) => {
    if ((p as { isGift?: boolean }).isGift) return sum
    const price = (p.price as number | undefined) ?? 0
    const sold = (p.sold as number | undefined) ?? 0
    return sum + price * sold
  }, 0)
})

/** 銷售總計顯示：>= 1000 用 k 後綴（保留至多 1 位小數，去掉尾 .0），小於則直接千分位。圖示已是錢符號，數字前不重複加 $。 */
const salesTotalDisplay = computed(() => {
  const n = salesTotal.value
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString()
})

// 收單來源不再依賴是否已加商品；只需先建立 / 選擇場次即可開啟來源 dialog
const canPickSource = computed(() => Boolean(currentSession.value))

const pickSourceTooltip = computed(() => {
  if (!currentSession.value) return t('live_order.tooltip.pick_or_create_session')
  return ''
})

const pickSourceHelperText = computed(() => {
  if (!currentSession.value) return t('live_order.tooltip.pick_or_create_session')
  return t('live_order.empty.click_button_below_to_pick_source')
})

/** 快速新增區的 component ref，用來在切到收單來源 dialog 時程式化收合。 */
const quickAddRef = ref<{ collapse?: () => void } | null>(null)

function onPickSource(): void {
  if (!canPickSource.value) return
  // 點下「選擇收單來源」順手把快速新增收合，讓 dialog / 下方商品卡更聚焦
  quickAddRef.value?.collapse?.()
  sourceDialogVisible.value = true
}

/** Map a confirmed source type/extras to a LiveSource entry on the current session. */
function onSourceConfirmed(type: string, extras: SourceConfirmExtras = {}): void {
  const labelKeyMap: Record<string, string> = {
    fb: 'live_order.source_type_label.fb',
    ig: 'live_order.source_type_label.ig',
    group: 'live_order.source_type_label.group',
    live: 'live_order.source_type_label.live',
    tiktok: 'live_order.source_type_label.tiktok',
    livebuy: 'live_order.source_type_label.livebuy',
  }
  // 社團模式：dialog 內以 'fb' 觸發，但實際 source 要當 'group' 存（這樣右側面板顯示用社團色 + 社團 icon）
  const isCommunity = isCommunityMode.value
  const effectiveType = isCommunity && type === 'fb' ? 'group' : type
  const fallbackLabel = t(labelKeyMap[effectiveType] ?? labelKey)
  // label 優先用使用者選到的「貼文名稱」（社團 / 貼文都適用），沒選就 fallback 平台類型字眼
  const label = extras.title ?? fallbackLabel
  if (!currentSession.value) return
  currentSession.value.sources.push({
    id: Date.now() + Math.random(),
    type: effectiveType,
    label,
    addedAt: new Date(),
    postId:  isCommunity ? null : (extras.postId ?? null),
    // 社團模式：dialog 內傳回的 id 視為 groupId，餵到 usedGroupIds 做去重
    groupId: isCommunity ? (extras.postId ?? null) : (extras.groupId ?? null),
  })
  // 寫進 cache 讓「跨 collection 不可重複選同一篇」的 usedPostIds / usedGroupIds 即時生效
  if (enteredPostId.value != null) {
    postSourcesCache.value.set(
      enteredPostId.value,
      (currentSession.value.sources as unknown as LiveSource[]).map((s) => ({ ...s })),
    )
  }
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.source_added'),
    detail: label,
    life: 2500,
  })
}

/**
 * 已使用的來源 id：依平台類型分桶（傳入 dialog 用於 disable）。
 * 不同平台之間互不干擾 — 在 IG 選到 id=1 不會讓 FB id=1 變灰。
 * 來源 = 當前 session 的 sources ∪ 其他直播場次 sources ∪ 其他 post collection 已快取的 sources。
 * （場次間 sources 不同步,故同一來源不允許被兩個場次同時挑到,避免資料互不同步造成困擾）
 */
const usedByPlatform = computed<Record<string, Array<number | string>>>(() => {
  const buckets: Record<string, Set<number | string>> = {}
  const add = (type: string, id: number | string | null | undefined): void => {
    if (id == null) return
    if (!buckets[type]) buckets[type] = new Set()
    buckets[type].add(id)
  }
  ;(currentSession.value?.sources ?? []).forEach((s) => {
    add(s.type, s.postId)
    add(s.type, s.groupId)
  })
  // 其他直播場次的 sources 也要納入 → 避免同一貼文/社團被兩場次同時選走
  sessions.value.forEach((sess) => {
    if (sess.id === currentSession.value?.id) return
    sess.sources.forEach((s) => {
      add(s.type, s.postId)
      add(s.type, s.groupId)
    })
  })
  postSourcesCache.value.forEach((sources, pid) => {
    if (pid === enteredPostId.value) return  // 當前 session 已加入，避免重複
    sources.forEach((s) => {
      add(s.type, s.postId)
      add(s.type, s.groupId)
    })
  })
  const out: Record<string, Array<number | string>> = {}
  Object.keys(buckets).forEach((k) => { out[k] = Array.from(buckets[k]) })
  return out
})

function onRemoveSource(id: number | string): void {
  const target = sources.value.find(s => s.id === id)
  if (!target) return
  confirm.require({
    message: t('live_order.dialog.remove_source_message', { label: target.label }),
    header: t('live_order.dialog.remove_source_header'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('live_order.button.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('live_order.dialog.remove'), severity: 'danger' },
    accept: () => {
      if (!currentSession.value) return
      const arr = currentSession.value.sources
      const idx = arr.findIndex(s => s.id === id)
      if (idx !== -1) arr.splice(idx, 1)
      // 同步 cache → 立即釋放該篇貼文在「選擇收單來源」彈窗的 disabled 鎖定
      if (enteredPostId.value != null) {
        postSourcesCache.value.set(
          enteredPostId.value,
          (currentSession.value.sources as unknown as LiveSource[]).map((s) => ({ ...s })),
        )
      }
      toast.removeAllGroups()
      toast.add({ severity: 'info', summary: t('live_order.toast.source_removed'), detail: target.label, life: 2000 })
    },
  })
}

// ── 結束收單：開彙總 dialog；右上「結束收單」結束全部 live 商品，單卡按鈕只結束該張 ──
const endSummaryDialogVisible = ref(false)
/** 取消／關閉彙總彈窗時，把被凍結的商品 ticker 重新解凍（恢復累加）。 */
watch(endSummaryDialogVisible, (open) => {
  if (open) return
  selectedProducts.value.forEach((p) => {
    if (endingProductIds.value.has(p.id)) {
      ;(p as Record<string, unknown>).frozen = false
    }
  })
  endingProductIds.value = new Set()
})
/** 這次摘要要結束的商品 id 集合；dialog 內容與儲存時 status 歸位都依此 */
const endingProductIds = ref<Set<number>>(new Set())

const endingSummaryProducts = computed(() =>
  selectedProducts.value.filter((p) => endingProductIds.value.has(p.id)),
)

/** 標記本次「結束收單」是否為「一鍵結束」— 一鍵結束才會關閉整個 collection / 移除整場;
 *  單一商品結束(從商品卡)結束後,collection 內其他商品要保留在列表,不 close collection。 */
const bulkEndingIntent = ref(false)

function confirmEndAllProducts(): void {
  // 結束收單彙總納入：仍在收單中 OR 已有得標（sold > 0）的商品
  const ids = selectedProducts.value
    .filter((p) => p.status === 'live' || (p.sold ?? 0) > 0)
    .map((p) => p.id)
  endingProductIds.value = new Set(ids)
  bulkEndingIntent.value = true
  // 立刻凍結 ticker（避免結帳時還在累加）
  selectedProducts.value.forEach((p) => {
    if (endingProductIds.value.has(p.id)) (p as Record<string, unknown>).frozen = true
  })
  endSummaryDialogVisible.value = true
}

/** 按下右區「結束收單」主按鈕：先跳確認彈窗，確認後才開啟結束收單彙總（即便當下沒收單中商品，也會列出已有得標的紀錄）。 */
function askEndAllProducts(): void {
  confirm.require({
    header: t('live_order.dialog.end_ordering_confirm_header'),
    message: t('live_order.dialog.end_ordering_confirm_message'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('live_order.button.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('live_order.button.confirm'), severity: 'danger' },
    accept: () => { confirmEndAllProducts() },
  })
}

/**
 * 貼文/社團收單「一鍵結束收單」：若當前貼文 endAt 尚未到 → 改問「是否要提前結束收單」;
 * 已過收單期間則走一般確認流程。
 */
function askEndAllPostOrder(): void {
  const post = currentEnteredPost.value
  const endAt = post?.endAt
  const isEarly = endAt instanceof Date && endAt.getTime() > Date.now()
  if (isEarly) {
    const d = endAt as Date
    const pad = (n: number): string => String(n).padStart(2, '0')
    const display = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    confirm.require({
      header: '提前結束收單',
      message: `此${collectionNoun.value}設定的收單結束時間為 ${display},是否要提前結束收單?`,
      icon: 'pi pi-exclamation-triangle',
      rejectProps: { label: t('live_order.button.cancel'), severity: 'secondary', outlined: true },
      acceptProps: { label: '提前結束', severity: 'danger' },
      accept: () => { confirmEndAllProducts() },
    })
    return
  }
  askEndAllProducts()
}

/** 一鍵移除：把當前場次中所有「沒有收單過」（sold 為 0 或 undefined）的商品卡刪掉 */
const hasNoSaleProduct = computed(() => selectedProducts.value.some(p => !(p.sold ?? 0) && p.status !== 'live'))
function removeNoSaleProducts(): void {
  if (!currentSession.value || !hasNoSaleProduct.value) return
  currentSession.value.products = currentSession.value.products.filter((p) => {
    // 留住：有售出 或 收單中（避免誤刪正在收單的卡）
    return (p.sold ?? 0) > 0 || p.status === 'live'
  })
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.batch_edit_done'),
    detail: t('live_order.button.remove_done'),
    life: 2000,
  })
}

/** 商品卡（或 table 列）emit 的單筆結束收單 → 彙總彈窗只列那一張卡。 */
function onCardEndOrdering(id: number): void {
  endingProductIds.value = new Set([id])
  bulkEndingIntent.value = false
  const p = selectedProducts.value.find((x) => x.id === id)
  if (p) (p as Record<string, unknown>).frozen = true
  endSummaryDialogVisible.value = true
}

/** Summary dialog 按下「儲存」：寫入收單紀錄、把摘要內商品 status 回 ready。 */
function onEndSummarySave(payload: EndOrderingPayload): void {
  const orderCount = payload.products.reduce((sum, p) => sum + p.winnerCount, 0)
  addLiveOrderRecord({
    sessionName: payload.sessionName,
    endedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    totalAmount: payload.totalAmount,
    productCount: payload.products.length,
    orderCount,
    products: payload.products.map((p) => ({
      id: p.id,
      name: p.name,
      keyword: p.keyword,
      price: p.price,
      winnerCount: p.winnerCount,
      sold: p.sold,
      total: p.total,
      freeShipping: p.freeShipping,
      specs: p.specs,
    })),
  })
  // 結束的商品一律轉 'done'(已結單),保留 sold 顯示成單量。
  // 一鍵結束:直播會直接把場次移除、貼文/社團會關 collection,所以「留下 done 商品」的狀態
  // 只有在單筆結束時看得到;bulk 分支後續會處理場次 / collection。
  let changed = 0
  selectedProducts.value.forEach((p) => {
    if (!endingProductIds.value.has(p.id)) return
    p.status = 'done'
    ;(p.startedAt as number | undefined) = undefined
    ;(p as Record<string, unknown>).frozen = false
    changed++
  })
  endingProductIds.value = new Set()
  toast.removeAllGroups()
  toast.add({
    severity: 'success',
    summary: t('live_order.toast.ordering_ended'),
    detail: t('live_order.toast.ordering_ended_detail', { count: changed }),
    life: 2500,
  })
  // 結束收單儲存後：
  // - 直播模式 + 一鍵結束:把該場次從 sessions 移除、currentSession = null(回空狀態);單筆結束不動場次。
  // - 貼文模式 + 一鍵結束:清掉 postSession.sources + 把該檔狀態改成 closed_today → 回到 overview;
  //   單筆結束只 syncStats(更新 overview 已成單),商品留在列表。
  if (!isPostMode.value && bulkEndingIntent.value && currentSession.value) {
    const sid = currentSession.value.id
    sessions.value = sessions.value.filter((s) => s.id !== sid)
    currentSession.value = null
  } else if (isPostMode.value) {
    // 不論一鍵/單筆結束,都先把當下 sold 同步回 overview 上的「已成單」
    syncPostStatsBack()
    // 一鍵結束 OR 單筆結束後所有商品都已 done → 自動關閉整個 collection
    const products = postSession.value.products as LiveProduct[]
    const allDone = products.length > 0 && products.every((p) => p.status === 'done')
    if (bulkEndingIntent.value || allDone) {
      const postId = enteredPostId.value
      if (postId != null) {
        const post = postCollections.value.find((p) => p.id === postId)
        if (post) post.status = 'closed_today'
        // 該 collection 結單後 → 釋放其所有 source,這些貼文/社團可重新被其他 collection 選用
        postSourcesCache.value.delete(postId)
      }
      enteredPostId.value = null
      postSession.value.sources = []
      postSession.value.products = []
    }
  }
  bulkEndingIntent.value = false
}

// ── 計時器：以當前場次最早「開始收單」的商品為起點 ─────
// 商品狀態變為 live 時自動記錄 startedAt（首次記錄後保留，允許 undo 接續）
watch(
  () => selectedProducts.value.map(p => ({ id: p.id, status: p.status })),
  () => {
    selectedProducts.value.forEach(p => {
      if (p.status === 'live' && !p.startedAt) p.startedAt = Date.now()
    })
  },
  { deep: true, immediate: true }
)

/**
 * 競價模式互斥：場次內同一時間最多一支「競價 + 收單中」商品；
 * 任一商品 ready→live 時，若會跟既有的競價/其他 live 衝突 → 撤回剛上 live 的那支 + 跳提示。
 * - 競價想開始收單，但已有其他收單中商品 → 撤回競價、提示「請先暫停其他商品」
 * - 已有競價在收單中，其他商品想開始收單 → 撤回該商品、提示「競價中無法開啟其他收單」
 */
let isBiddingConflictDialogOpen = false
watch(
  () => selectedProducts.value.map(p => ({ id: p.id, status: p.status, bidding: !!(p as Record<string, unknown>).bidding })),
  (list, oldList) => {
    const biddingLive = list.find(p => p.status === 'live' && p.bidding)
    if (!biddingLive) return
    const otherLive = list.filter(p => p.id !== biddingLive.id && p.status === 'live')
    if (otherLive.length === 0) return

    // 找出「剛從 ready 變 live」的商品，那支才是要撤回的對象
    const justWentLive = list.find(p =>
      p.status === 'live'
      && oldList?.find(o => o.id === p.id)?.status !== 'live',
    )
    if (!justWentLive) return

    const revertTarget = selectedProducts.value.find(p => p.id === justWentLive.id)
    if (revertTarget) revertTarget.status = 'ready'

    if (isBiddingConflictDialogOpen) return
    isBiddingConflictDialogOpen = true

    // 文案依據撤回的是競價 / 其他商品分別給出
    const isBiddingBlocked = justWentLive.bidding
    confirm.require({
      header: isBiddingBlocked ? '無法開始競價' : '已有競價商品收單中',
      message: isBiddingBlocked
        ? `目前還有 ${otherLive.length} 件商品收單中，請先手動暫停所有收單中的商品後再開始競價。`
        : '目前有競價商品正在收單中，無法同時開啟其他商品的收單。請等競價結束後再進行。',
      icon: 'pi pi-exclamation-triangle',
      // 強制 modal + 不可關閉 X / 不可點 mask 關閉：使用者必須按「我知道了」才能繼續操作
      modal: true,
      closable: false,
      dismissableMask: false,
      closeOnEscape: false,
      // 用 style 隱藏 reject 按鈕（PrimeVue ConfirmDialog 沒有原生 rejectVisible prop）
      rejectProps: { style: 'display: none' },
      acceptProps: { label: '我知道了' },
      accept: () => { isBiddingConflictDialogOpen = false },
      reject: () => { isBiddingConflictDialogOpen = false },
      onHide: () => { isBiddingConflictDialogOpen = false },
    })
  },
  { deep: true },
)

const startedAt = computed<number | null>(() => {
  const live = selectedProducts.value.filter((p): p is LiveProduct & { startedAt: number } => p.status === 'live' && typeof p.startedAt === 'number')
  if (live.length === 0) return null
  return Math.min(...live.map(p => p.startedAt))
})
const now = ref(Date.now())
let timerId: ReturnType<typeof setInterval> | null = null

const elapsedDisplay = computed(() => {
  if (!startedAt.value) return '00:00:00'
  const sec = Math.max(0, Math.floor((now.value - startedAt.value) / 1000))
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
})

watch(hasLiveProduct, (yes) => {
  if (yes) {
    now.value = Date.now()
    if (!timerId) timerId = setInterval(() => { now.value = Date.now() }, 1000)
  } else {
    if (timerId) { clearInterval(timerId); timerId = null }
  }
}, { immediate: true })

onUnmounted(() => { if (timerId) clearInterval(timerId) })

/** 排程自動切狀態：每 30 秒檢查
 *  (a) 所有 ready 的 PostCollection，startAt 到了 → status 切 ongoing
 *  (b) 當前進入的 collection 內，商品 ready → live（免手動按開始收單）
 */
let scheduleTimerId: ReturnType<typeof setInterval> | null = null
function checkScheduledStart(): void {
  const now = Date.now()
  // (a) PostCollection 整體：ready → ongoing
  postCollections.value.forEach((p) => {
    if (p.status === 'ready' && p.startAt && p.startAt.getTime() <= now) {
      p.status = 'ongoing'
    }
  })
  // (b) 商品層自動切 live（限定貼文 / 社團模式 + 已進入某筆 collection）
  if (!isPostMode.value) return
  const post = currentEnteredPost.value
  if (!post || post.status === 'closed_today') return
  if (!post.startAt) return
  if (post.startAt.getTime() > now) return
  postSession.value.products.forEach((p) => {
    if (p.status === 'ready') p.status = 'live'
  })
}
onMounted(() => {
  // 元件 mount 時先 run 一次，避免使用者要等 30 秒才看到狀態變化
  checkScheduledStart()
  scheduleTimerId = setInterval(checkScheduledStart, 30_000)
})
onUnmounted(() => { if (scheduleTimerId) clearInterval(scheduleTimerId) })

/**
 * 收單期間變動時「立即」雙向同步商品狀態（免等 30 秒排程）：
 *  - 期間已開始（startAt <= now 或未設）→ 所有 ready 商品自動 live
 *  - 期間被改成未來（startAt > now）→ 所有 live 商品退回 ready（尚未賣任何一件 → 全退；已賣過 → 保留 live 避免破壞交易）
 * 對應使用情境：使用者從 PostPeriodDialog 更改 startAt，畫面立刻反映。
 */
watch(
  () => [enteredPostId.value, currentEnteredPost.value?.startAt] as const,
  () => {
    if (!isPostMode.value || enteredPostId.value == null) return
    const post = currentEnteredPost.value
    if (!post || post.status === 'closed_today') return
    const list = currentSession.value?.products
    if (!list) return
    const startAt = post.startAt
    const periodStarted = !startAt || startAt.getTime() <= Date.now()
    list.forEach((p) => {
      if (periodStarted && p.status === 'ready') {
        p.status = 'live'
      } else if (!periodStarted && p.status === 'live' && (p.sold ?? 0) === 0) {
        p.status = 'ready'
      }
    })
  },
  { immediate: true },
)

// 直播 / 貼文 / 社群 收單頁進入時自動收合 sidebar，把畫面寬度留給商品 + 留言面板。
// 離開頁面（unmount）後不自動展開，使用者若要展開靠 TopBar 摺疊鈕。
const layoutStore = useLayoutStore()
onMounted(() => {
  layoutStore.isSidebarCollapsed = true
})
</script>
