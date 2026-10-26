import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'

it('initialises the production Firebase bundle without constructor/order errors', async () => {
  const output = mkdtempSync(join(tmpdir(), 'boh-production-import-'))
  try {
    // Exercise the real production bundling configuration, not Vitest's module
    // loader. A fresh process exposes circular chunk initialisation failures.
    await build({ configFile: resolve('vite.config.ts'), logLevel: 'silent', build: {
      outDir: output, minify: true,
      rolldownOptions: { preserveEntrySignatures: 'allow-extension' },
      lib: { entry: resolve('src/lib/api.ts'), formats: ['es'], fileName: () => 'api.mjs' },
    } })
    const entry = pathToFileURL(join(output, 'api.mjs')).href
    const probe = `try { const api = await import(${JSON.stringify(entry)}); if (typeof api.signIn !== 'function' || typeof api.loadSnapshot !== 'function') throw new Error('Missing API exports'); console.log('Firebase bundle ready'); process.exit(0) } catch (error) { console.error(error.name + ': ' + error.message); process.exit(1) }`
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' })
    expect(result.trim()).toBe('Firebase bundle ready')
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})
