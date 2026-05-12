/**
 * Conformance — AP2 base mandate construction + validation.
 *
 * Asserts the rc.1 mandate surface as an integrated conformance check:
 *
 *   - Full IntentMandate → CartMandate → PaymentMandate chain assembles
 *     with correct correlationID propagation and ref binding.
 *   - Every create-output validates via its companion validator.
 *   - JSON round-trip preserves every field (the envelope is canonical-
 *     JSON friendly out of the box).
 *   - The chain envelope is profile-neutral: substituting an
 *     AP2-Travel-shaped payload for the inner content does not affect
 *     envelope-shape validation, only the inner payload structure
 *     (which is the profile's concern).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	createIntentMandate,
	validateIntentMandate,
	createCartMandate,
	validateCartMandate,
	createPaymentMandate,
	validatePaymentMandate,
} from '@agent-commerce-trust/core'

const futureDate = (ms) => new Date(Date.now() + ms)

test('Full Intent → Cart → Payment chain assembles, validates, and propagates correlationID', () => {
	const intent = createIntentMandate(
		{ goal: 'buy widget', amountUsdCents: 12500 },
		{
			expiresAt: futureDate(15 * 60 * 1000),
			issuer: 'did:web:agent.example.com',
			principal: 'did:web:user.example.com',
		},
	)
	const cart = createCartMandate(
		{ items: [{ sku: 'widget-1', qty: 1 }], totalUsdCents: 12500 },
		{
			expiresAt: futureDate(10 * 60 * 1000),
			issuer: 'did:web:supplier.example.com',
			intent,
		},
	)
	const payment = createPaymentMandate(
		{ method: 'card', last4: '4242', amountUsdCents: 12500 },
		{
			expiresAt: futureDate(5 * 60 * 1000),
			issuer: 'did:web:user.example.com',
			cart,
		},
	)

	validateIntentMandate(intent)
	validateCartMandate(cart)
	validatePaymentMandate(payment)

	// Correlation ID propagates from Intent through Cart through Payment.
	assert.equal(intent.correlationID, cart.correlationID)
	assert.equal(cart.correlationID, payment.correlationID)

	// Chain binding: each child references its parent's nonce.
	assert.equal(cart.intentRef.nonce, intent.nonce)
	assert.equal(payment.cartRef.nonce, cart.nonce)
})

test('Every freshly-created mandate JSON-round-trips losslessly', () => {
	const intent = createIntentMandate({ goal: 'x' }, {
		expiresAt: futureDate(15 * 60 * 1000),
		issuer: 'did:web:agent.example.com',
	})
	const cart = createCartMandate({ items: ['x'] }, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate({ method: 'card' }, {
		expiresAt: futureDate(5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	})
	for (const mandate of [intent, cart, payment]) {
		const roundTripped = JSON.parse(JSON.stringify(mandate))
		assert.deepEqual(roundTripped, mandate)
	}
})

test('Mandate envelope shape is profile-neutral: AP2-Travel-shaped vs generic inner payloads validate identically', () => {
	// The envelope check should pass regardless of inner payload shape —
	// core validators only inspect the AP2 metadata fields (nonce,
	// issuedAt, expiresAt, issuer, correlationID, payloadType, refs).
	const apt2TravelShape = {
		profile: 'ap2-travel',
		tripID: 'trip-123',
		segments: [{ origin: 'JFK', destination: 'SFO' }],
	}
	const genericShape = { random: { fields: [1, 2, 3] }, n: 0 }

	const intentApt2 = createIntentMandate(apt2TravelShape, {
		expiresAt: futureDate(15 * 60 * 1000),
		issuer: 'did:web:agent.example.com',
	})
	const intentGeneric = createIntentMandate(genericShape, {
		expiresAt: futureDate(15 * 60 * 1000),
		issuer: 'did:web:agent.example.com',
	})

	validateIntentMandate(intentApt2)
	validateIntentMandate(intentGeneric)

	assert.equal(intentApt2.payloadType, 'ap2.IntentMandate/v1')
	assert.equal(intentGeneric.payloadType, 'ap2.IntentMandate/v1')
	// Inner payloads are passed through unchanged.
	assert.deepEqual(intentApt2.intent, apt2TravelShape)
	assert.deepEqual(intentGeneric.intent, genericShape)
})
