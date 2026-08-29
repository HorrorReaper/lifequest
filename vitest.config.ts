import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Nested git worktrees live under .claude/; without this their test
    // files are collected alongside the project's own and fail against
    // whatever that branch is mid-edit.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    environment: 'jsdom',
    clearMocks: true,
    restoreMocks: true,
  },
})
