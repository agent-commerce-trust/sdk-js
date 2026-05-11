#!/usr/bin/env node
// Mirror every dist/**/*.d.ts to a sibling dist/**/*.d.cts so NodeNext-strict
// CJS consumers resolve types via the require condition in package.json exports.
// The runtime is dual-emitted by tsup (dist/*.js + dist/*.cjs); declarations are
// emitted once by tsc (.d.ts) and copied here with the sourceMappingURL stripped
// (the .d.ts.map files are emitted alongside the .d.ts originals and would not
// resolve correctly from a sibling .d.cts).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distDir = new URL('../dist/', import.meta.url).pathname
const sourceMappingUrlPattern = /\n?\/\/# sourceMappingURL=.*$/m

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (entry.endsWith('.d.ts') && !entry.endsWith('.d.cts')) {
      const target = full.replace(/\.d\.ts$/, '.d.cts')
      const contents = readFileSync(full, 'utf8').replace(sourceMappingUrlPattern, '')
      writeFileSync(target, contents)
    }
  }
}

walk(distDir)
