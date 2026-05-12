import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSigningInput, canonicalBytes, sha256Hex } from '@agent-commerce-trust/core'

// === Construction ===

test('buildSigningInput returns a Uint8Array of (32-byte SHA-256 prefix + payload)', async () => {
	const payload = new Uint8Array([1, 2, 3, 4, 5])
	const result = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
	assert.ok(result instanceof Uint8Array)
	assert.equal(result.byteLength, 32 + payload.byteLength)
	// The trailing payload bytes are byte-identical to the input payload.
	assert.deepEqual(Array.from(result.slice(32)), Array.from(payload))
})

test('buildSigningInput prefix equals SHA-256(canonicalBytes({payloadType, context: {}})) when no context supplied', async () => {
	const payload = new Uint8Array([9, 9, 9])
	const result = await buildSigningInput({ payload, payloadType: 'ap2.CartMandate/v1' })
	const expectedPrefixHex = await sha256Hex({ payloadType: 'ap2.CartMandate/v1', context: {} })
	const actualPrefixHex = Array.from(result.slice(0, 32))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	assert.equal(actualPrefixHex, expectedPrefixHex)
})

test('buildSigningInput prefix changes when payloadType changes', async () => {
	const payload = new Uint8Array([42])
	const a = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
	const b = await buildSigningInput({ payload, payloadType: 'ap2.CartMandate/v1' })
	// First 32 bytes (the domain hash) MUST differ; the trailing payload is the same.
	const prefixA = Array.from(a.slice(0, 32))
	const prefixB = Array.from(b.slice(0, 32))
	assert.notDeepEqual(prefixA, prefixB)
	assert.deepEqual(Array.from(a.slice(32)), Array.from(b.slice(32)))
})

test('buildSigningInput prefix changes when context changes', async () => {
	const payload = new Uint8Array([7, 7, 7])
	const a = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { sessionId: 'session-A' },
	})
	const b = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { sessionId: 'session-B' },
	})
	assert.notDeepEqual(Array.from(a.slice(0, 32)), Array.from(b.slice(0, 32)))
})

test('buildSigningInput treats undefined context identically to empty-object context', async () => {
	const payload = new Uint8Array([1, 2, 3])
	const noCtx = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
	const emptyCtx = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: {},
	})
	assert.deepEqual(Array.from(noCtx), Array.from(emptyCtx))
})

test('buildSigningInput context is canonicalised (key-order independent)', async () => {
	// Canonical JSON sorts object keys; two contexts that differ only in
	// key-iteration order MUST produce identical signing inputs.
	const payload = new Uint8Array([1])
	const a = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { a: '1', b: '2' },
	})
	const b = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { b: '2', a: '1' },
	})
	assert.deepEqual(Array.from(a), Array.from(b))
})

test('buildSigningInput is deterministic: same inputs → byte-identical output', async () => {
	const payload = canonicalBytes({ x: 1 })
	const a = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { sid: 'abc' },
	})
	const b = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		context: { sid: 'abc' },
	})
	assert.deepEqual(Array.from(a), Array.from(b))
})

test('buildSigningInput preserves payload bytes verbatim regardless of payload content', async () => {
	// Edge cases: empty payload, single byte, full byte range.
	for (const payload of [
		new Uint8Array([]),
		new Uint8Array([0]),
		new Uint8Array([255]),
		new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
	]) {
		const out = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
		assert.equal(out.byteLength, 32 + payload.byteLength)
		assert.deepEqual(Array.from(out.slice(32)), Array.from(payload))
	}
})
