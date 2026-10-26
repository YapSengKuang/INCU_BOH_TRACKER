import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // Let Vite preserve dependency initialization order. Manually separating
  // Firebase Auth/Firestore from their shared helpers created circular chunks
  // that crashed before React could render in the production build.
  test: { include: ['tests/*.test.ts'], testTimeout: 30000 }
})
