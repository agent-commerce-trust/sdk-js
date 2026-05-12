import assert from 'node:assert/strict'
import { test } from 'node:test'

import { InMemoryKeyProvider } from '@agent-commerce-trust/core/dev'
import {
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

// === Sign + verify round trips (the PR 6 exit-gate test) ===

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

	// Independent verification against the PublicKey
	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'Ed25519' },
		false,
		['verify'],
	)
	const ok = await globalThis.crypto.subtle.verify(
		{ name: 'Ed25519' },
		importedPublic,
		result.signature,
		payload,
	)
	assert.equal(ok, true)
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

	// Independent verification
	const pub = await provider.getPublicKey(ref.keyId)
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		pub.encoded,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify'],
	)
	const ok = await globalThis.crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		importedPublic,
		result.signature,
		payload,
	)
	assert.equal(ok, true)
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

test('onSigningEvent fires sign-error when sign rejects', async () => {
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
	// At least one sign-error event was emitted; sign-request may also be
	// emitted depending on where validation kicks in.
	const errorEvents = events.filter((e) => e.type === 'sign-error')
	assert.equal(errorEvents.length, 1)
	assert.ok(errorEvents[0].error instanceof KeyPurposePayloadTypeMismatchError)
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
