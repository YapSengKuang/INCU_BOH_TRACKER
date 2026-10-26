import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: { codeSplitting: { includeDependenciesRecursively: false, groups: [{ name: 'firestore', test: /node_modules\/@firebase\/firestore/, priority: 2 }, { name: 'auth', test: /node_modules\/@firebase\/auth/, priority: 2 }, { name: 'vendor', test: /node_modules/, priority: 1 }] } }
    }
  },
  test: { include: ['tests/*.test.ts'], testTimeout: 30000 }
})
