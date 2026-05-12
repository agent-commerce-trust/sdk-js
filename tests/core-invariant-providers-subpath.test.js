/**
 * Invariant D — production KeyProvider implementations ship at a
 * dedicated `/providers` subpath, which is RESERVED but UNEXPORTED at
 * rc.1.
 *
 * The canonical SDK doc at `docs/domains/auth/trust-layer-sdk.md` §7.1
 * lists Aws/Gcp/Azure KMS, PKCS#11, FIDO2, and RemoteSigner as the
 * planned production implementations; the package's `exports` field
 * declares `"./providers": null` so the subpath is bound (no other
 * package can squat on it) but cannot be resolved by consumers.
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
	// Node's "subpath not exported" error carries code ERR_PACKAGE_PATH_NOT_EXPORTED.
	// We accept any error whose code or message points at the package-exports
	// machinery so the test stays robust across minor Node versions.
	const code = err && (err.code ?? '')
	const message = err && (err.message ?? '')
	assert.ok(
		code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
			/not exported|no exports main resolved|package exports/i.test(message),
		`expected a package-exports error; got code='${code}', message='${message}'`,
	)
})
