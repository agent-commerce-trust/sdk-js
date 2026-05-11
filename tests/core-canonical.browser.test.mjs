/**
 * Browser-environment smoke test for @agent-commerce-trust/core canonical +
 * hashing helpers. Runs under happy-dom's GlobalRegistrator, which replaces
 * Node's default globalThis with a browser-shaped one (window, document,
 * Crypto, etc.).
 *
 * The point is not to exhaustively re-verify every canonical edge case — the
 * primary suite at tests/core-canonical.test.js covers those — but to confirm
 * that the package's source compiles and executes correctly without leaking
 * any Node-only API into the browser code path. If the canonical or hashing
 * helpers were to accidentally pull in `node:crypto` or other Node primitives,
 * the import or execution would fail here.
 *
 * Per the PR 3 exit gate in TRUST_LAYER_SDK_PUBLIC_BUILDOUT.md: "browser path
 * runs under happy-dom".
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

// Imports must come AFTER registration so the package's top-level
// initialization sees happy-dom's globalThis (TextEncoder, crypto, etc.)
const assertModule = await import('node:assert/strict')
const assert = assertModule.default
const { test, after } = await import('node:test')
const {
	canonicalize,
	canonicalBytes,
	sha256Hex,
	sha384Hex,
} = await import('@agent-commerce-trust/core')
const { canonicalReferenceFixtures } = await import('./_fixtures/canonical-fixtures.mjs')

after(() => {
	// Restore Node's default globals when this suite finishes so subsequent
	// test files (if any are invoked in the same Node process) see a clean env.
	GlobalRegistrator.unregister()
})

test('[browser] canonicalize matches every shared reference fixture under happy-dom', () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			canonicalize(fixture.input),
			fixture.canonical,
			`canonicalize mismatch for fixture '${fixture.name}'`,
		)
	}
})

test('[browser] canonicalBytes returns a Uint8Array via happy-dom TextEncoder', () => {
	const bytes = canonicalBytes({ a: 1 })
	assert.ok(bytes instanceof Uint8Array)
	assert.equal(new TextDecoder().decode(bytes), '{"a":1}')
})

test('[browser] sha256Hex matches every shared reference fixture under happy-dom WebCrypto', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			await sha256Hex(fixture.input),
			fixture.sha256,
			`sha256Hex mismatch for fixture '${fixture.name}'`,
		)
	}
})

test('[browser] sha384Hex matches every shared reference fixture under happy-dom WebCrypto', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			await sha384Hex(fixture.input),
			fixture.sha384,
			`sha384Hex mismatch for fixture '${fixture.name}'`,
		)
	}
})
