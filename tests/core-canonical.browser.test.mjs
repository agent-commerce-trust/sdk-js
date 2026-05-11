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

// Imports must come AFTER registration so that the package's top-level
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

after(() => {
	// Restore Node's default globals when this suite finishes so subsequent
	// test files (if any are invoked in the same Node process) see a clean env.
	GlobalRegistrator.unregister()
})

test('[browser] canonicalize produces RFC 8785-shaped output under happy-dom', () => {
	assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
	assert.equal(
		canonicalize({ items: [{ y: 2, x: 1 }] }),
		'{"items":[{"x":1,"y":2}]}',
	)
})

test('[browser] canonicalBytes returns a Uint8Array via the registered TextEncoder', () => {
	const bytes = canonicalBytes({ a: 1 })
	assert.ok(bytes instanceof Uint8Array)
	assert.equal(new TextDecoder().decode(bytes), '{"a":1}')
})

test('[browser] sha256Hex uses happy-dom WebCrypto and matches the hardcoded fixture', async () => {
	// Same fixture as tests/core-canonical.test.js so any divergence between
	// Node-native WebCrypto and happy-dom's WebCrypto surfaces here.
	const hash = await sha256Hex({ a: 1, b: 2 })
	assert.equal(hash, '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777')
})

test('[browser] sha384Hex uses happy-dom WebCrypto and matches the hardcoded fixture', async () => {
	const hash = await sha384Hex({ a: 1, b: 2 })
	assert.equal(
		hash,
		'5b5061937d9429347654a4a661c91ebd23a83dd2233309e3d1a9eaab2085f2399ddfaee0fccfb405324e6bb5e008400b',
	)
})

test('[browser] sha256Hex of empty-object matches hardcoded fixture', async () => {
	const hash = await sha256Hex({})
	assert.equal(hash, '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a')
})
