import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	TrustLayerError,
	CanonicalizationError,
	MandateError,
	VerificationError,
	KeyProviderError,
	KeyNotFoundError,
	KeyPurposeMismatchError,
	KeyPurposePayloadTypeMismatchError,
	KeyExpiredError,
	KeyRevokedError,
	KmsUnavailableError,
	AlgorithmUnsupportedError,
	RateLimitExceededError,
} from '@agent-commerce-trust/core'

test('TrustLayerError sets code, name=class, message, and propagates cause', () => {
	const cause = new Error('underlying')
	const err = new TrustLayerError('test-code', 'boom', { cause })
	assert.equal(err.code, 'test-code')
	assert.equal(err.name, 'TrustLayerError')
	assert.equal(err.message, 'boom')
	assert.equal(err.cause, cause)
	assert.ok(err instanceof Error)
})

test('CanonicalizationError, MandateError, VerificationError carry fixed codes', () => {
	const cases = [
		[CanonicalizationError, 'canonicalization'],
		[MandateError, 'mandate'],
		[VerificationError, 'verification'],
	]
	for (const [Cls, code] of cases) {
		const err = new Cls('msg')
		assert.equal(err.code, code, `${Cls.name} should carry code=${code}`)
		assert.equal(err.name, Cls.name, `${Cls.name}.name should equal '${Cls.name}'`)
		assert.equal(err.message, 'msg')
		assert.ok(err instanceof TrustLayerError, `${Cls.name} should extend TrustLayerError`)
	}
})

test('KeyProviderError subclasses carry fixed codes and chain through both bases', () => {
	const cases = [
		[KeyNotFoundError, 'key-not-found'],
		[KeyPurposeMismatchError, 'key-purpose-mismatch'],
		[KeyPurposePayloadTypeMismatchError, 'key-purpose-payload-type-mismatch'],
		[KeyExpiredError, 'key-expired'],
		[KeyRevokedError, 'key-revoked'],
		[KmsUnavailableError, 'kms-unavailable'],
		[AlgorithmUnsupportedError, 'algorithm-unsupported'],
		[RateLimitExceededError, 'rate-limit-exceeded'],
	]
	for (const [Cls, code] of cases) {
		const err = new Cls('msg')
		assert.equal(err.code, code, `${Cls.name} should carry code=${code}`)
		assert.equal(err.name, Cls.name)
		assert.ok(err instanceof KeyProviderError, `${Cls.name} should extend KeyProviderError`)
		assert.ok(err instanceof TrustLayerError, `${Cls.name} should extend TrustLayerError`)
	}
})

test('KeyProviderError direct construction accepts a caller-supplied code', () => {
	const err = new KeyProviderError('custom-kms-failure', 'something')
	assert.equal(err.code, 'custom-kms-failure')
	assert.equal(err.name, 'KeyProviderError')
})

test('cause option propagates through KeyProvider subclass chain', () => {
	const cause = new Error('kms 500')
	const err = new KmsUnavailableError('aws-kms timeout', { cause })
	assert.equal(err.cause, cause)
	assert.equal(err.code, 'kms-unavailable')
})

test('instanceof discrimination — no string matching needed', () => {
	function classify(err) {
		if (err instanceof KeyPurposePayloadTypeMismatchError) return 'purpose-payload-mismatch'
		if (err instanceof KeyProviderError) return 'key-provider'
		if (err instanceof CanonicalizationError) return 'canonicalization'
		if (err instanceof TrustLayerError) return 'trust-layer'
		return 'other'
	}
	assert.equal(classify(new KeyPurposePayloadTypeMismatchError('x')), 'purpose-payload-mismatch')
	assert.equal(classify(new KeyExpiredError('x')), 'key-provider')
	assert.equal(classify(new CanonicalizationError('x')), 'canonicalization')
	assert.equal(classify(new MandateError('x')), 'trust-layer')
	assert.equal(classify(new Error('x')), 'other')
})

test('errors are throwable and catchable with the right instanceof', () => {
	try {
		throw new KeyPurposePayloadTypeMismatchError(
			'purpose sign-offer cannot sign payloadType ap2.IntentMandate/v1',
		)
	} catch (e) {
		assert.ok(e instanceof KeyPurposePayloadTypeMismatchError)
		assert.ok(e instanceof KeyProviderError)
		assert.equal(e.code, 'key-purpose-payload-type-mismatch')
	}
})
