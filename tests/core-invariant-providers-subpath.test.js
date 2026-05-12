/**
 * Reserved-providers-subpath invariant for `@agent-commerce-trust/core`.
 *
 * The canonical SDK doc at `docs/domains/auth/trust-layer-sdk.md` §7.1
 * lists Aws/Gcp/Azure KMS, PKCS#11, FIDO2, and RemoteSigner as the
 * planned production implementations of the `KeyProvider` interface.
 * At rc.1 the package's `exports` field declares `"./providers": null`
 * so the subpath is bound (no other package can squat on it) but cannot
 * be resolved by consumers.
 *
 * This test asserts the negative-resolution behaviour at rc.1.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('@agent-commerce-trust/core/providers does not resolve at rc.1', async () => {
	let resolved = false
	let err
	try {
		await import('@agent-commerce-trust/core/providers')
		resolved = true
	} catch (caught) {
		err = caught
	}
	assert.equal(
		resolved,
		false,
		'import("@agent-commerce-trust/core/providers") unexpectedly resolved; the subpath must be reserved (null) until the first production KeyProvider ships',
	)
	assert.ok(err, 'expected an Error from the failed import')
	// Strict: Node's "subpath not exported" error carries code
	// ERR_PACKAGE_PATH_NOT_EXPORTED, AND the error message names the package
	// + subpath. Both must hold so a future Node version that changes the
	// error code (without preserving the subpath text in the message) still
	// trips this test, and a different package-resolution error (e.g.
	// ERR_MODULE_NOT_FOUND) doesn't silently satisfy it.
	const code = err && (err.code ?? '')
	const message = err && (err.message ?? '')
	assert.equal(
		code,
		'ERR_PACKAGE_PATH_NOT_EXPORTED',
		`expected ERR_PACKAGE_PATH_NOT_EXPORTED; got code='${code}', message='${message}'`,
	)
	assert.match(
		message,
		/@agent-commerce-trust\/core/,
		`expected error message to name the @agent-commerce-trust/core package; got '${message}'`,
	)
	assert.match(
		message,
		/(\.\/providers|providers)/,
		`expected error message to name the /providers subpath; got '${message}'`,
	)
})
