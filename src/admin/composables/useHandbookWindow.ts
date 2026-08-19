/**
 * 「頁面手冊」開窗 composable（prototype stub）。
 *
 * 正式 portal 版會 `router.resolve({ name: Handbook, params: { section } })`
 * 開新分頁到 `/handbook/{section}`；prototype 目前沒有 handbook 路由，
 * 故此處為安全 no-op，只在 console 標記被呼叫的 section，避免 404。
 *
 * @returns openHandbook(section) — 呼叫時傳入該頁的 i18n key prefix
 */
export function useHandbookWindow() {
  return function openHandbook(section: string): void {
    // prototype 無 handbook 路由：不開窗，僅記錄
    console.info(`[handbook stub] open section: ${section}`);
  };
}
