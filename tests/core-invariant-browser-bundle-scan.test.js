/**
 * Invariant B — browser-safe primitives.
 *
 * `@agent-commerce-trust/core` ships to browsers as well as Node. No
 * `node:` import may exist anywhere in the production build artifacts.
 * This test recursively walks `packages/core/dist/` and asserts every
 * emitted `.js` / `.cjs` / `.mjs` bundle is free of:
 *
 *   - `from "node:..."` ESM-form imports
 *   - `require("node:...")` CJS-form imports
 *   - `import("node:...")` dynamic-form imports
 *
 * `*.map` files are skipped (they only carry source-map metadata).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

async function collectBundlePaths(dir) {
	const out = []
	const entries = await readdir(dir)
	for (const entry of entries) {
		const full = join(dir, entry)
		const s = await stat(full)
		if (s.isDirectory()) {
			out.push(...(await collectBundlePaths(full)))
		} else if (/\.(?:js|cjs|mjs)$/.test(entry) && !entry.endsWith('.map')) {
			out.push(full)
		}
	}
	return out
}

const NODE_IMPORT_PATTERN = /(?:from\s*["']node:|require\(\s*["']node:|import\(\s*["']node:)/g

test('production dist has zero `node:` imports across every emitted bundle', async () => {
	const distRoot = new URL('../packages/core/dist/', import.meta.url).pathname
	const bundles = await collectBundlePaths(distRoot)
	assert.ok(bundles.length > 0, `expected to find at least one bundle under ${distRoot}`)
	for (const bundlePath of bundles) {
		const contents = await readFile(bundlePath, 'utf8')
		const hits = contents.match(NODE_IMPORT_PATTERN) ?? []
		assert.equal(
			hits.length,
			0,
			`browser-safety regression: ${bundlePath} contains ${hits.length} 'node:' import(s) — sample: ${hits[0] ?? ''}`,
		)
	}
})
