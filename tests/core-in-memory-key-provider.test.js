import assert from 'node:assert/strict'
import { test } from 'node:test'

import { InMemoryKeyProvider } from '@agent-commerce-trust/core/dev'
import {
	AlgorithmUnsupportedError,
	buildSigningInput,
	canonicalBytes,
	KeyNotFoundError,
	KeyPurposeMismatchError,
	KeyPurposePayloadTypeMismatchError,
} from '@agent-commerce-trust/core'

// === Identity + capability declaration ===

test('InMemoryKeyProvider constructs with a default providerId when none supplied', () => {
	const provider = new InMemoryKeyProvider()
	assert.equal(typeof provider.providerId, 'string')
	assert.ok(provider.providerId.length > 0)
})

test('InMemoryKeyProvider accepts an explicit providerId', () => {
	const provider = new InMemoryKeyProvider({ providerId: 'in-memory:test-rig' })
	assert.equal(provider.providerId, 'in-memory:test-rig')
})

test('InMemoryKeyProvider does not declare derive (optional KeyProvider method)', () => {
	const provider = new InMemoryKeyProvider()
	// §7.1: KeyProvider.derive? is optional. Providers that do not implement
	// HMAC-pepper derivation simply omit the method. Consumers reading
	// `provider.derive` get `undefined`.
	assert.equal(provider.derive, undefined)
})

test('returned SigningKeyRef is deep-frozen: mutating purposes via the returned reference cannot bypass sign()', async () => {
	// Threat model: a caller obtains the returned SigningKeyRef and mutates
	// its `purposes` array to inject a purpose that the key was not granted.
	// Without deep-freeze, that mutation aliases the provider's internal
	// state and sign() would happily accept the injected purpose.
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	// Strict mode: mutating a frozen array throws TypeError.
	assert.throws(() => {
		;/** @type {any} */ (ref.purposes).push('sign-cart-mandate')
	}, TypeError)
	assert.throws(() => {
		;/** @type {any} */ (ref).purposes = ['sign-cart-mandate']
	}, TypeError)
	assert.throws(() => {
		;/** @type {any} */ (ref).extra = 'mutated'
	}, TypeError)

	// And sign() still rejects an unauthorised purpose — even after the
	// (now-failed) mutation attempts above, the provider's view of purposes
	// is unchanged.
	await assert.rejects(
		() => provider.sign({
			keyId: ref.keyId,
			algorithm: 'Ed25519',
			payload: canonicalBytes({ x: 1 }),
			payloadType: 'ap2.CartMandate/v1',
			purpose: 'sign-cart-mandate',
		}),
		KeyPurposeMismatchError,
	)
})

// === Key generation + retrieval ===

test('generateSigningKey returns a SigningKeyRef carrying the requested algorithm + purposes (Ed25519)', async () => {
	const provider = new InMemoryKeyProvider()
	const keyRef = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate', 'sign-cart-mandate'],
	})
	assert.equal(keyRef.kind, 'signing')
	assert.equal(keyRef.algorithm, 'Ed25519')
	assert.deepEqual([...keyRef.purposes], ['sign-intent-mandate', 'sign-cart-mandate'])
	assert.equal(typeof keyRef.keyId, 'string')
	assert.ok(keyRef.notBefore instanceof Date)
	assert.equal(keyRef.publicKey.kty, 'OKP')
	assert.equal(keyRef.publicKey.algorithm, 'Ed25519')
	assert.ok(keyRef.publicKey.encoded instanceof Uint8Array)
})

test('generateSigningKey returns a SigningKeyRef carrying the requested algorithm + purposes (ECDSA_P256)', async () => {
	const provider = new InMemoryKeyProvider()
	const keyRef = await provider.generateSigningKey({
		algorithm: 'ECDSA_P256',
		purposes: ['sign-offer'],
	})
	assert.equal(keyRef.kind, 'signing')
	assert.equal(keyRef.algorithm, 'ECDSA_P256')
	assert.deepEqual([...keyRef.purposes], ['sign-offer'])
	assert.equal(keyRef.publicKey.kty, 'EC')
	assert.equal(keyRef.publicKey.algorithm, 'ECDSA_P256')
	assert.ok(keyRef.publicKey.encoded instanceof Uint8Array)
})

test('listSigningKeys returns every generated key when no scope is supplied', async () => {
	const provider = new InMemoryKeyProvider()
	const k1 = await provider.generateSigningKey({ algorithm: 'Ed25519', purposes: ['sign-intent-mandate'] })
	const k2 = await provider.generateSigningKey({ algorithm: 'ECDSA_P256', purposes: ['sign-offer'] })
	const all = await provider.listSigningKeys()
	const ids = new Set(all.map((k) => k.keyId))
	assert.ok(ids.has(k1.keyId))
	assert.ok(ids.has(k2.keyId))
	assert.equal(all.length, 2)
})

test('getSigningKey returns the key matching the keyId', async () => {
	const provider = new InMemoryKeyProvider()
	const created = await provider.generateSigningKey({ algorithm: 'Ed25519', purposes: ['sign-cart-mandate'] })
	const fetched = await provider.getSigningKey(created.keyId)
	assert.equal(fetched.keyId, created.keyId)
	assert.equal(fetched.algorithm, 'Ed25519')
})

test('getSigningKey throws KeyNotFoundError for an unknown keyId', async () => {
	const provider = new InMemoryKeyProvider()
	await assert.rejects(
		() => provider.getSigningKey('does-not-exist'),
		(err) => err instanceof KeyNotFoundError && err.code === 'key-not-found',
	)
})

test('getPublicKey returns the PublicKey for a generated signing key', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({ algorithm: 'Ed25519', purposes: ['sign-log-entry'] })
	const pub = await provider.getPublicKey(ref.keyId)
	assert.equal(pub.algorithm, 'Ed25519')
	assert.equal(pub.kty, 'OKP')
	assert.ok(pub.encoded instanceof Uint8Array)
	assert.equal(pub.encoded.byteLength, 32) // Ed25519 raw public key is 32 bytes
})

test('getPublicKey returns a frozen PublicKey object: mutating its field references throws', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({ algorithm: 'Ed25519', purposes: ['sign-log-entry'] })
	const pub = await provider.getPublicKey(ref.keyId)
	// Field-level immutability: cannot replace algorithm, encoded, version.
	assert.throws(() => {
		;/** @type {any} */ (pub).algorithm = 'ECDSA_P256'
	}, TypeError)
	assert.throws(() => {
		;/** @type {any} */ (pub).encoded = new Uint8Array([1, 2, 3])
	}, TypeError)
	assert.throws(() => {
		;/** @type {any} */ (pub).extra = 'x'
	}, TypeError)
	// (Byte-array element writes via pub.encoded[i] = X are NOT blocked —
	// documented design trade-off; element-freezing typed arrays is
	// engine-inconsistent.)
})

test('getPublicKey throws KeyNotFoundError for an unknown keyId', async () => {
	const provider = new InMemoryKeyProvider()
	await assert.rejects(
		() => provider.getPublicKey('does-not-exist'),
		KeyNotFoundError,
	)
})

test('supportedAlgorithms returns the key algorithm for a known keyId', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({ algorithm: 'ECDSA_P256', purposes: ['sign-offer'] })
	const algos = await provider.supportedAlgorithms(ref.keyId)
	assert.deepEqual(algos, ['ECDSA_P256'])
})

// === Sign + verify round trips ===
//
// Verification reconstructs the same domain-separated signing input
// via `buildSigningInput` and feeds it to `crypto.subtle.verify`. This
// mirrors the canonical §7.1 contract: payloadType is hashed into the
// signing context as a domain separator, so verifiers must combine
// (payloadType, context, payload) the same way the signer did.

test('sign + verify round trip succeeds for Ed25519', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const payload = canonicalBytes({
		issuer: 'did:web:example.com',
		nonce: '0123456789abcdef',
		amount: 12500,
	})
	const result = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	assert.equal(result.keyId, ref.keyId)
	assert.equal(result.algorithm, 'Ed25519')
	assert.ok(result.signature instanceof Uint8Array)
	assert.equal(result.signature.byteLength, 64) // Ed25519 signature is 64 bytes
	assert.equal(typeof result.keyVersion, 'string')

	// Independent verification: reconstruct the domain-separated signing input
	// from (payloadType, payload) and feed it to crypto.subtle.verify.
	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'Ed25519' },
		false,
		['verify'],
	)
	const signingInput = await buildSigningInput({
		payload,
		payloadType: 'ap2.IntentMandate/v1',
	})
	const ok = await globalThis.crypto.subtle.verify(
		{ name: 'Ed25519' },
		importedPublic,
		result.signature,
		signingInput,
	)
	assert.equal(ok, true)

	// And the raw payload (without the domain prefix) MUST NOT verify —
	// this is the domain-separation guarantee.
	const okOverRaw = await globalThis.crypto.subtle.verify(
		{ name: 'Ed25519' },
		importedPublic,
		result.signature,
		payload,
	)
	assert.equal(okOverRaw, false)
})

test('sign + verify round trip succeeds for ECDSA_P256', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'ECDSA_P256',
		purposes: ['sign-offer'],
	})
	const payload = canonicalBytes({
		offerId: 'offer-123',
		price: { amount: 19999, currency: 'USD' },
	})
	const result = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'ECDSA_P256',
		payload,
		payloadType: 'commerce.Offer/v1',
		purpose: 'sign-offer',
	})
	assert.equal(result.algorithm, 'ECDSA_P256')
	assert.ok(result.signature instanceof Uint8Array)
	assert.equal(result.signature.byteLength, 64) // ECDSA P-256 raw signature is 64 bytes (r||s)

	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify'],
	)
	const signingInput = await buildSigningInput({
		payload,
		payloadType: 'commerce.Offer/v1',
	})
	const ok = await globalThis.crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		importedPublic,
		result.signature,
		signingInput,
	)
	assert.equal(ok, true)
})

test('sign + verify round trip preserves the SignRequest.context binding', async () => {
	// Same payload + same payloadType + different `context` → different
	// signatures. The verifier MUST reconstruct the matching context to verify.
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const payload = canonicalBytes({ amount: 100 })
	const ctxA = { sessionId: 'session-A' }
	const ctxB = { sessionId: 'session-B' }
	const resultA = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
		context: ctxA,
	})
	const resultB = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
		context: ctxB,
	})
	assert.notDeepEqual(Array.from(resultA.signature), Array.from(resultB.signature))

	// Verify A under A's context succeeds; verify A under B's context fails.
	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'Ed25519' },
		false,
		['verify'],
	)
	const inputA = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1', context: ctxA })
	const inputB = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1', context: ctxB })
	assert.equal(
		await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, importedPublic, resultA.signature, inputA),
		true,
	)
	assert.equal(
		await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, importedPublic, resultA.signature, inputB),
		false,
	)
})

test('sign domain-separates across payloadType: same payload bytes + different payloadType → different signatures AND unverifiable cross-replay', async () => {
	// Provision a key authorised for BOTH purposes so the only thing changing
	// between the two sign calls is payloadType. Assert: (a) the two
	// signatures differ as byte sequences, and (b) the first signature does
	// not verify under the second payloadType's signing input.
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate', 'sign-cart-mandate'],
	})
	const payload = canonicalBytes({ commonField: 'colliding-bytes' })

	const intentResult = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	const cartResult = await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.CartMandate/v1',
		purpose: 'sign-cart-mandate',
	})

	// (a) Different payloadType → different signature bytes, even though the
	// underlying payload is identical.
	assert.notDeepEqual(
		Array.from(intentResult.signature),
		Array.from(cartResult.signature),
	)

	// (b) The Intent signature cannot be verified under the Cart payloadType's
	// signing input (cross-payloadType replay defence).
	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'Ed25519' },
		false,
		['verify'],
	)
	const cartInput = await buildSigningInput({ payload, payloadType: 'ap2.CartMandate/v1' })
	const replayOk = await globalThis.crypto.subtle.verify(
		{ name: 'Ed25519' },
		importedPublic,
		intentResult.signature,
		cartInput,
	)
	assert.equal(replayOk, false)
})

// === sign() error paths ===

test('sign throws KeyPurposeMismatchError when purpose is not in KeyRef.purposes', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'], // does NOT include sign-cart-mandate
	})
	await assert.rejects(
		() => provider.sign({
			keyId: ref.keyId,
			algorithm: 'Ed25519',
			payload: canonicalBytes({ foo: 'bar' }),
			payloadType: 'ap2.CartMandate/v1',
			purpose: 'sign-cart-mandate',
		}),
		(err) => err instanceof KeyPurposeMismatchError && err.code === 'key-purpose-mismatch',
	)
})

test('sign throws KeyPurposePayloadTypeMismatchError when payloadType is inconsistent with purpose', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	await assert.rejects(
		() => provider.sign({
			keyId: ref.keyId,
			algorithm: 'Ed25519',
			payload: canonicalBytes({ foo: 'bar' }),
			payloadType: 'ap2.CartMandate/v1', // maps to sign-cart-mandate, not sign-intent-mandate
			purpose: 'sign-intent-mandate',
		}),
		(err) => err instanceof KeyPurposePayloadTypeMismatchError && err.code === 'key-purpose-payload-type-mismatch',
	)
})

test('sign throws KeyNotFoundError for an unknown keyId', async () => {
	const provider = new InMemoryKeyProvider()
	await assert.rejects(
		() => provider.sign({
			keyId: 'does-not-exist',
			algorithm: 'Ed25519',
			payload: new Uint8Array([1, 2, 3]),
			payloadType: 'ap2.IntentMandate/v1',
			purpose: 'sign-intent-mandate',
		}),
		KeyNotFoundError,
	)
})

// === Audit hook ===

test('onSigningEvent fires sign-request + sign-result for a successful sign call', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const events = []
	const unsubscribe = provider.onSigningEvent((evt) => {
		events.push(evt)
	})
	await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload: canonicalBytes({ a: 1 }),
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	unsubscribe()
	assert.equal(events.length, 2)
	assert.equal(events[0].type, 'sign-request')
	assert.equal(events[0].keyId, ref.keyId)
	assert.equal(events[1].type, 'sign-result')
	assert.equal(events[1].keyId, ref.keyId)
	assert.equal(typeof events[1].keyVersion, 'string')
})

test('onSigningEvent fires sign-request then sign-error when post-lookup validation rejects', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const events = []
	provider.onSigningEvent((evt) => {
		events.push(evt)
	})
	await assert.rejects(() => provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload: canonicalBytes({ a: 1 }),
		payloadType: 'ap2.CartMandate/v1', // wrong payloadType → KeyPurposePayloadTypeMismatchError
		purpose: 'sign-intent-mandate',
	}))
	// Strict ordering: sign-request first (key found), then sign-error
	// (post-lookup validation rejected).
	assert.equal(events.length, 2)
	assert.equal(events[0].type, 'sign-request')
	assert.equal(events[0].keyId, ref.keyId)
	assert.equal(events[1].type, 'sign-error')
	assert.ok(events[1].error instanceof KeyPurposePayloadTypeMismatchError)
})

test('onSigningEvent fires only sign-error (no sign-request) when keyId is unknown', async () => {
	// Pre-lookup failure: the key doesn't exist, so there's no attested
	// operation to log as sign-request. Only sign-error fires.
	const provider = new InMemoryKeyProvider()
	const events = []
	provider.onSigningEvent((evt) => {
		events.push(evt)
	})
	await assert.rejects(() => provider.sign({
		keyId: 'does-not-exist',
		algorithm: 'Ed25519',
		payload: new Uint8Array([1, 2, 3]),
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	}))
	assert.equal(events.length, 1)
	assert.equal(events[0].type, 'sign-error')
	assert.ok(events[0].error instanceof KeyNotFoundError)
})

test('sign throws AlgorithmUnsupportedError when SignRequest.algorithm does not match the key', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	await assert.rejects(
		() => provider.sign({
			keyId: ref.keyId,
			algorithm: 'ECDSA_P256', // mismatched
			payload: canonicalBytes({ a: 1 }),
			payloadType: 'ap2.IntentMandate/v1',
			purpose: 'sign-intent-mandate',
		}),
		(err) => err instanceof AlgorithmUnsupportedError && err.code === 'algorithm-unsupported',
	)
})

test('onSigningEvent returns an Unsubscribe that detaches the callback', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const events = []
	const unsubscribe = provider.onSigningEvent((evt) => events.push(evt))
	unsubscribe()
	await provider.sign({
		keyId: ref.keyId,
		algorithm: 'Ed25519',
		payload: canonicalBytes({ a: 1 }),
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	assert.equal(events.length, 0)
})

// === Version metadata ===

test('currentVersion + historicalVersions agree on the active version', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const current = await provider.currentVersion(ref.keyId)
	const history = await provider.historicalVersions(ref.keyId)
	assert.equal(typeof current, 'string')
	assert.ok(current.length > 0)
	assert.ok(history.length >= 1)
	assert.equal(history[0].version, current)
	assert.ok(history[0].createdAt instanceof Date)
})
