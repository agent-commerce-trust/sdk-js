/**
 * Conformance — signature stability + verifiability with InMemoryKeyProvider.
 *
 * The signing helper interfaces ship at rc.1 with a fixture provider
 * (InMemoryKeyProvider at `@agent-commerce-trust/core/dev`). This file
 * exercises the signing surface as an integrated rc.1 conformance check:
 *
 *   - sign/verify round trip for both supported algorithms (Ed25519, ECDSA_P256)
 *   - canonical-bytes-stable signature: signing the same payload twice with
 *     the same key produces a verifiable signature each time
 *   - signature ↔ verifier independence: the public key returned by the
 *     provider can be imported standalone and used to verify the signature
 *     without further provider state
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { InMemoryKeyProvider } from '@agent-commerce-trust/core/dev'
import { buildSigningInput, canonicalBytes } from '@agent-commerce-trust/core'

const ed25519Verify = async (publicEncoded, signature, signingInput) => {
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		publicEncoded,
		{ name: 'Ed25519' },
		false,
		['verify'],
	)
	return globalThis.crypto.subtle.verify({ name: 'Ed25519' }, importedPublic, signature, signingInput)
}

const ecdsaP256Verify = async (publicEncoded, signature, signingInput) => {
	const importedPublic = await globalThis.crypto.subtle.importKey(
		'raw',
		publicEncoded,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify'],
	)
	return globalThis.crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		importedPublic,
		signature,
		signingInput,
	)
}

test('Ed25519 sign/verify conformance: every signed payload verifies', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate', 'sign-cart-mandate', 'sign-payment-mandate'],
	})
	const pub = await provider.getPublicKey(ref.keyId)
	const payloads = [
		canonicalBytes({}),
		canonicalBytes({ a: 1 }),
		canonicalBytes({ nested: { z: 'last', a: 'first' }, n: 0 }),
	]
	for (const payload of payloads) {
		const result = await provider.sign({
			keyId: ref.keyId,
			algorithm: 'Ed25519',
			payload,
			payloadType: 'ap2.IntentMandate/v1',
			purpose: 'sign-intent-mandate',
		})
		const signingInput = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
		const ok = await ed25519Verify(pub.encoded, result.signature, signingInput)
		assert.equal(ok, true, 'Ed25519 round trip failed for a conformance payload')
	}
})

test('ECDSA_P256 sign/verify conformance: every signed payload verifies', async () => {
	const provider = new InMemoryKeyProvider()
	const ref = await provider.generateSigningKey({
		algorithm: 'ECDSA_P256',
		purposes: ['sign-offer'],
	})
	const pub = await provider.getPublicKey(ref.keyId)
	const payloads = [
		canonicalBytes({}),
		canonicalBytes({ offerId: 'a' }),
		canonicalBytes({ offerId: 'b', price: { amount: 100, currency: 'USD' } }),
	]
	for (const payload of payloads) {
		const result = await provider.sign({
			keyId: ref.keyId,
			algorithm: 'ECDSA_P256',
			payload,
			payloadType: 'commerce.Offer/v1',
			purpose: 'sign-offer',
		})
		const signingInput = await buildSigningInput({ payload, payloadType: 'commerce.Offer/v1' })
		const ok = await ecdsaP256Verify(pub.encoded, result.signature, signingInput)
		assert.equal(ok, true, 'ECDSA_P256 round trip failed for a conformance payload')
	}
})

test('Signing the same payload twice yields independently-verifiable signatures', async () => {
	// Ed25519 is deterministic — two signs of the same input produce the SAME
	// signature. ECDSA is non-deterministic — two signs produce DIFFERENT
	// signatures. Both must independently verify.
	const provider = new InMemoryKeyProvider()
	const edRef = await provider.generateSigningKey({
		algorithm: 'Ed25519',
		purposes: ['sign-intent-mandate'],
	})
	const ecRef = await provider.generateSigningKey({
		algorithm: 'ECDSA_P256',
		purposes: ['sign-offer'],
	})
	const payload = canonicalBytes({ shared: 'input' })

	const edResultA = await provider.sign({
		keyId: edRef.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	const edResultB = await provider.sign({
		keyId: edRef.keyId,
		algorithm: 'Ed25519',
		payload,
		payloadType: 'ap2.IntentMandate/v1',
		purpose: 'sign-intent-mandate',
	})
	// Determinism: same inputs → byte-identical Ed25519 signature.
	assert.deepEqual(Array.from(edResultA.signature), Array.from(edResultB.signature))

	const ecResultA = await provider.sign({
		keyId: ecRef.keyId,
		algorithm: 'ECDSA_P256',
		payload,
		payloadType: 'commerce.Offer/v1',
		purpose: 'sign-offer',
	})
	const ecResultB = await provider.sign({
		keyId: ecRef.keyId,
		algorithm: 'ECDSA_P256',
		payload,
		payloadType: 'commerce.Offer/v1',
		purpose: 'sign-offer',
	})
	// Non-determinism: standard WebCrypto ECDSA generates fresh randomness
	// per sign (RFC 6979 nonces are NOT used by the WebCrypto spec), so the
	// same inputs MUST produce different signature bytes on a conforming
	// implementation. A CSPRNG collision would also fail this — practical
	// odds are negligible. NOTE: a deterministic-ECDSA fork (FIPS profile
	// pinning to RFC 6979, or a hardened-RNG mock) would legitimately
	// collide here; if a target environment ever lands one, relax this
	// assertion to require signatures verify, not that they differ.
	assert.notDeepEqual(
		Array.from(ecResultA.signature),
		Array.from(ecResultB.signature),
		'ECDSA_P256 signatures of identical inputs must differ on a non-deterministic WebCrypto implementation',
	)
	// Both ECDSA signatures must verify even though the bytes differ.
	const edPub = await provider.getPublicKey(edRef.keyId)
	const ecPub = await provider.getPublicKey(ecRef.keyId)
	const edInput = await buildSigningInput({ payload, payloadType: 'ap2.IntentMandate/v1' })
	const ecInput = await buildSigningInput({ payload, payloadType: 'commerce.Offer/v1' })
	assert.equal(await ed25519Verify(edPub.encoded, edResultA.signature, edInput), true)
	assert.equal(await ed25519Verify(edPub.encoded, edResultB.signature, edInput), true)
	assert.equal(await ecdsaP256Verify(ecPub.encoded, ecResultA.signature, ecInput), true)
	assert.equal(await ecdsaP256Verify(ecPub.encoded, ecResultB.signature, ecInput), true)
})
