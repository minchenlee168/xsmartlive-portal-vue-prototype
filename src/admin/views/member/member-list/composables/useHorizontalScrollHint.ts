import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** 常駐捲軸保留的殘差寬度：判斷「還能往右」時扣掉，避免捲到底右箭頭仍誤顯示（design.md §7.5）。 */
const EDGE_THRESHOLD = 16;

/**
 * 寬表橫向捲動可發現性提示（design.md §7.5）。
 *
 * 掛在包住 `PaginationTable` 的 wrapper 上，內部尋找 PrimeVue DataTable 的捲動容器
 * （`.p-datatable-table-container`），令其水平捲軸常駐可見，並依捲動位置回報左右是否可續捲，
 * 供頁面疊放漸層 fade + chevron 按鈕。分頁列在該容器之外，不受影響。
 *
 * @param wrapperRef - 由元件以 `useTemplateRef` 建立、包住 PaginationTable 的容器 ref
 * @returns `canScrollLeft` / `canScrollRight`（是否還能往該方向捲）、`headerHeight`（表頭列高度，供箭頭垂直對齊表頭）、`frozenRightWidth`（右側凍結欄寬度，供右箭頭貼齊凍結欄內側）、`scrollByViewport`（點箭頭捲動約 60% 視寬）
 */
export function useHorizontalScrollHint(wrapperRef: Ref<HTMLElement | null>) {
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);
  const headerHeight = ref(0);
  const frozenRightWidth = ref(0);

  let container: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | undefined;

  function update() {
    if (!container) return;

    // §7.5①：水平捲軸常駐可見。在 update 內（非僅 onMounted）重設，避免被 PrimeVue 的 layout 覆蓋。
    container.style.overflowX = 'scroll';
    container.style.scrollbarGutter = 'stable';

    canScrollLeft.value = container.scrollLeft > EDGE_THRESHOLD;
    canScrollRight.value = container.scrollWidth - (container.scrollLeft + container.clientWidth) > EDGE_THRESHOLD;

    // 表頭列高度：箭頭按鈕垂直對齊表頭列（比照訂單管理範式）
    const header = container.querySelector('thead');
    headerHeight.value = header instanceof HTMLElement ? header.offsetHeight : 0;

    // 右側凍結欄寬度：供右箭頭貼齊凍結欄內側（design.md §7.5，避免蓋到操作 icon）
    const lastHeaderCell = container.querySelector('thead th:last-child');
    frozenRightWidth.value = lastHeaderCell instanceof HTMLElement
      && lastHeaderCell.classList.contains('p-datatable-frozen-column')
      ? lastHeaderCell.offsetWidth
      : 0;
  }

  /** 點擊箭頭捲動約 60% 視寬（design.md §7.5）。 */
  function scrollByViewport(direction: 1 | -1) {
    if (!container) return;
    container.scrollBy({ left: direction * container.clientWidth * 0.6, behavior: 'smooth' });
  }

  onMounted(() => {
    container = wrapperRef.value?.querySelector<HTMLElement>('.p-datatable-table-container') ?? null;
    if (!container) return;

    container.addEventListener('scroll', update, { passive: true });
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    update();
  });

  onBeforeUnmount(() => {
    container?.removeEventListener('scroll', update);
    resizeObserver?.disconnect();
  });

  return { canScrollLeft, canScrollRight, headerHeight, frozenRightWidth, scrollByViewport };
}
