/**
 * Profile-neutrality invariant for `@agent-commerce-trust/core`.
 *
 * The canonical SDK doc at `docs/domains/auth/trust-layer-sdk.md` §7.1
 * establishes that profiles depend on core, never the reverse. This test
 * machine-enforces that contract by parsing core's `package.json` and
 * asserting no `@ap2-travel/*` package appears in any dependency map.
 * Failure means a future PR has accidentally coupled core to a vertical
 * profile and must be reverted before merge.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

test('core has zero @ap2-travel/* runtime/peer/optional dependencies', async () => {
	const manifest = JSON.parse(
		await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
	)
	for (const depMapName of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
		const deps = manifest[depMapName] ?? {}
		for (const depName of Object.keys(deps)) {
			assert.equal(
				depName.startsWith('@ap2-travel/'),
				false,
				`@agent-commerce-trust/core must remain profile-neutral; '${depName}' found in '${depMapName}'`,
			)
		}
	}
})

test('core declares an empty top-level `dependencies` map at rc.1', async () => {
	// Release-scoped: this assertion guards the rc.1 surface specifically.
	// core is the foundation every other package transitively depends on,
	// so any runtime dep here propagates across the ecosystem. If a future
	// release legitimately needs a runtime dep, relax this test at the same
	// time as the dep is added — but require explicit reviewer attention.
	const manifest = JSON.parse(
		await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
	)
	const deps = manifest.dependencies ?? {}
	assert.deepEqual(
		Object.keys(deps),
		[],
		`@agent-commerce-trust/core should declare zero runtime dependencies at rc.1; found: ${Object.keys(deps).join(', ')}`,
	)
})
