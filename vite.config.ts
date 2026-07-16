import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

/**
 * 抓最後一次 commit 時間注入到 client，TopBar 用來顯示 prototype 更新時間。
 * 失敗時退回 build 當下時間（避免 CI 沒有 git 時 crash）。
 */
const cwd = fileURLToPath(new URL('.', import.meta.url))
const lastCommitTime = (() => {
  try {
    return execSync('git log -1 --format=%cI', { cwd }).toString().trim()
  } catch {
    return new Date().toISOString()
  }
})()

/**
 * 最近 10 筆 commit，每筆格式：第一行 `ISO|subject`，後續為 body 多行。
 * commit 之間用 `\u0000` 分隔（不會出現在 commit message）。
 * TopBar 點 info icon → Dialog 顯示這份 changelog。
 */
const recentCommits = (() => {
  try {
    return execSync('git log -10 --format=%cI|%s%n%b%x00', { cwd })
      .toString()
      .split('\x00\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
})()

export default defineConfig({
  base: '/xsmartlive-portal-vue-prototype/',
  define: {
    __LAST_COMMIT_TIME__: JSON.stringify(lastCommitTime),
    __RECENT_COMMITS__: JSON.stringify(recentCommits),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    Components({
      dts: false,
      resolvers: [PrimeVueResolver()],
    }),
  ],
})
