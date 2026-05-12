import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	PAYLOAD_TYPE_PURPOSE_MAP,
	validatePayloadTypePurpose,
	KeyPurposePayloadTypeMismatchError,
	KeyProviderError,
	TrustLayerError,
} from '@agent-commerce-trust/core'

// Normative payloadType → purpose mapping per the canonical doc
// docs/domains/auth/trust-layer-sdk.md §7.1 (mapping table lines 879–901).
// 21 rows; `display.Attestation/v1` and `display.RenderAttestation/v1`
// both map to `sign-display-attestation` (the mapping is one-way, not
// bijective).
const NORMATIVE_PAIRS = [
	['ap2.IntentMandate/v1', 'sign-intent-mandate'],
	['ap2.CartMandate/v1', 'sign-cart-mandate'],
	['ap2.PaymentMandate/v1', 'sign-payment-mandate'],
	['commerce.Offer/v1', 'sign-offer'],
	['commerce.Confirmation/v1', 'sign-confirmation'],
	['commerce.CancellationProof/v1', 'sign-cancellation-proof'],
	['commerce.ToolResponse/v1', 'sign-commerce-response'],
	['display.Attestation/v1', 'sign-display-attestation'],
	['display.RenderAttestation/v1', 'sign-display-attestation'],
	['log.Entry/v1', 'sign-log-entry'],
	['log.STH/v1', 'sign-log-sth'],
	['witness.Observation/v1', 'sign-witness-sth'],
	['takeover.AuthorizationMandate/v1', 'sign-takeover-authorization-mandate'],
	['takeover.InterventionMandate/v1', 'sign-takeover-intervention-mandate'],
	['permissions.DocumentAccessGrant/v1', 'sign-document-access-grant'],
	['permissions.DeletionRequest/v1', 'sign-deletion-request'],
	['permissions.DeletionRequestCompletion/v1', 'sign-deletion-request-completion'],
	['commerce.Invoice/v1', 'sign-commerce-invoice'],
	['commerce.InvoiceStateChange/v1', 'sign-commerce-invoice-state-change'],
	['safety.PostureAttestation/v1', 'sign-safety-posture-attestation'],
	['trust-root.Update/v1', 'sign-trust-root-update'],
]

test('PAYLOAD_TYPE_PURPOSE_MAP exists and contains exactly 21 normative rows', () => {
	assert.ok(PAYLOAD_TYPE_PURPOSE_MAP instanceof Map)
	assert.equal(PAYLOAD_TYPE_PURPOSE_MAP.size, 21)
	assert.equal(NORMATIVE_PAIRS.length, 21)
})

test('PAYLOAD_TYPE_PURPOSE_MAP resolves every normative payloadType to its mapped purpose', () => {
	for (const [payloadType, expected] of NORMATIVE_PAIRS) {
		assert.equal(
			PAYLOAD_TYPE_PURPOSE_MAP.get(payloadType),
			expected,
			`PAYLOAD_TYPE_PURPOSE_MAP.get('${payloadType}') mismatch`,
		)
	}
})

test('PAYLOAD_TYPE_PURPOSE_MAP keys are exactly the normative payload-type set (no stale, no extra)', () => {
	const mapKeys = [...PAYLOAD_TYPE_PURPOSE_MAP.keys()].sort()
	const expectedKeys = NORMATIVE_PAIRS.map(([k]) => k).sort()
	assert.deepEqual(mapKeys, expectedKeys)
})

test('validatePayloadTypePurpose returns void for every normative (payloadType, purpose) pair', () => {
	for (const [payloadType, purpose] of NORMATIVE_PAIRS) {
		assert.equal(
			validatePayloadTypePurpose(payloadType, purpose),
			undefined,
			`validatePayloadTypePurpose threw or returned non-undefined for ('${payloadType}', '${purpose}')`,
		)
	}
})

test('validatePayloadTypePurpose throws KeyPurposePayloadTypeMismatchError for unknown payloadType', () => {
	assert.throws(
		() => validatePayloadTypePurpose('unknown.Type/v1', 'sign-intent-mandate'),
		(err) => {
			assert.ok(err instanceof KeyPurposePayloadTypeMismatchError)
			assert.ok(err instanceof KeyProviderError)
			assert.ok(err instanceof TrustLayerError)
			assert.equal(err.code, 'key-purpose-payload-type-mismatch')
			assert.match(err.message, /unknown\.Type\/v1/)
			return true
		},
	)
})

test('validatePayloadTypePurpose throws KeyPurposePayloadTypeMismatchError for known payloadType with wrong purpose', () => {
	assert.throws(
		() => validatePayloadTypePurpose('ap2.IntentMandate/v1', 'sign-cart-mandate'),
		(err) => {
			assert.ok(err instanceof KeyPurposePayloadTypeMismatchError)
			assert.equal(err.code, 'key-purpose-payload-type-mismatch')
			assert.match(err.message, /ap2\.IntentMandate\/v1/)
			assert.match(err.message, /sign-intent-mandate/)
			assert.match(err.message, /sign-cart-mandate/)
			return true
		},
	)
})

test('validatePayloadTypePurpose throws when called with a derive purpose against a signing payloadType', () => {
	// derive-principal-pepper has no payloadType row — the mapping is for
	// the SignRequest path only. Passing a derive purpose against any
	// signing payloadType must reject.
	assert.throws(
		() => validatePayloadTypePurpose('ap2.IntentMandate/v1', 'derive-principal-pepper'),
		KeyPurposePayloadTypeMismatchError,
	)
})

test('validatePayloadTypePurpose error message names the expected purpose so callers can correct', () => {
	// Failure mode for a misconfigured signer: the validator's error message
	// must reveal which purpose the payloadType is normatively mapped to so
	// the caller can correct the SignRequest without consulting the spec.
	try {
		validatePayloadTypePurpose('commerce.Offer/v1', 'sign-confirmation')
		assert.fail('expected validatePayloadTypePurpose to throw')
	} catch (err) {
		assert.ok(err instanceof KeyPurposePayloadTypeMismatchError)
		assert.match(err.message, /sign-offer/) // the correct purpose
		assert.match(err.message, /sign-confirmation/) // the wrong purpose actually supplied
	}
})

test('PAYLOAD_TYPE_PURPOSE_MAP entries iterate in the same order as the canonical-doc table', () => {
	// Full-order check (not just the first row): any middle/end reordering or
	// drop must fail this test. Downstream tooling (doc generators,
	// conformance suites) relies on deterministic walk order without
	// alphabetising or re-sorting.
	const actualOrder = [...PAYLOAD_TYPE_PURPOSE_MAP.entries()]
	assert.deepEqual(actualOrder, NORMATIVE_PAIRS)
})

test('PAYLOAD_TYPE_PURPOSE_MAP is runtime-immutable: set/delete/clear all throw', () => {
	// The declared type ReadonlyMap hides mutation methods at compile time;
	// these checks lock the mutation methods at runtime so a consumer
	// reaching for `.set()` via a type cast or pure-JS use can't corrupt
	// the normative mapping.
	assert.throws(
		() => /** @type {any} */ (PAYLOAD_TYPE_PURPOSE_MAP).set('extra.Type/v1', 'sign-offer'),
		TypeError,
	)
	assert.throws(
		() => /** @type {any} */ (PAYLOAD_TYPE_PURPOSE_MAP).delete('ap2.IntentMandate/v1'),
		TypeError,
	)
	assert.throws(
		() => /** @type {any} */ (PAYLOAD_TYPE_PURPOSE_MAP).clear(),
		TypeError,
	)
	// Attempting to reassign the methods on the proxy is also blocked.
	assert.throws(() => {
		;/** @type {any} */ (PAYLOAD_TYPE_PURPOSE_MAP).set = () => undefined
	})
})

test('PAYLOAD_TYPE_PURPOSE_MAP also blocks the Map.prototype.* call-bypass path', () => {
	// `Map.prototype.set.call(theMap, ...)` historically bypassed instance-
	// method overrides. With the Proxy wrapping, the prototype method runs
	// with `this = proxy`, which lacks the `[[MapData]]` internal slot, so
	// V8 raises a TypeError ("incompatible receiver"). The result is
	// equivalent: no mutation reaches the underlying Map.
	assert.throws(
		() => Map.prototype.set.call(PAYLOAD_TYPE_PURPOSE_MAP, 'extra.Type/v1', 'sign-offer'),
		TypeError,
	)
	assert.throws(
		() => Map.prototype.delete.call(PAYLOAD_TYPE_PURPOSE_MAP, 'ap2.IntentMandate/v1'),
		TypeError,
	)
	assert.throws(
		() => Map.prototype.clear.call(PAYLOAD_TYPE_PURPOSE_MAP),
		TypeError,
	)
	// And the map is still the same size — no mutation succeeded.
	assert.equal(PAYLOAD_TYPE_PURPOSE_MAP.size, 21)
	assert.equal(
		PAYLOAD_TYPE_PURPOSE_MAP.get('ap2.IntentMandate/v1'),
		'sign-intent-mandate',
	)
})
