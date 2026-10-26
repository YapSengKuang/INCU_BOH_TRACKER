import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] } }
    }
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 }
})
