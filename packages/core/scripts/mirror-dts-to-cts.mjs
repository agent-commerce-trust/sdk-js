#!/usr/bin/env node
// Mirror every dist/**/*.d.ts to a sibling dist/**/*.d.cts so that consumers
// under both NodeNext ESM and NodeNext CJS resolution see matching declarations.
// The runtime is dual-emitted by tsup (dist/*.js + dist/*.cjs); types are emitted
// once by tsc (.d.ts) and copied here.
import { readdirSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distDir = new URL('../dist/', import.meta.url).pathname

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (entry.endsWith('.d.ts') && !entry.endsWith('.d.cts')) {
      const target = full.replace(/\.d\.ts$/, '.d.cts')
      copyFileSync(full, target)
    }
  }
}

walk(distDir)
