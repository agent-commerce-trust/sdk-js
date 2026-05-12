import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	createIntentMandate,
	validateIntentMandate,
	createCartMandate,
	validateCartMandate,
	createPaymentMandate,
	validatePaymentMandate,
	MandateError,
} from '@agent-commerce-trust/core'

// Profile-neutral payloads — these helpers are owned by @agent-commerce-trust/core
// and MUST work without any AP2-Travel (or any other profile) import. The
// payload shapes below are deliberately generic to demonstrate this.
const futureDate = (msFromNow) => new Date(Date.now() + msFromNow)

const baseIntentOpts = () => ({
	expiresAt: futureDate(15 * 60 * 1000),
	issuer: 'did:web:agent.example.com',
	principal: 'did:web:user.example.com',
})

// === IntentMandate ===

test('createIntentMandate populates required AP2 envelope fields', () => {
	const intent = createIntentMandate({ goal: 'buy widget' }, baseIntentOpts())
	assert.equal(intent.payloadType, 'ap2.IntentMandate/v1')
	assert.equal(typeof intent.nonce, 'string')
	assert.ok(intent.nonce.length > 0)
	assert.equal(typeof intent.issuedAt, 'string')
	assert.equal(typeof intent.expiresAt, 'string')
	assert.equal(intent.issuer, 'did:web:agent.example.com')
	assert.equal(intent.principal, 'did:web:user.example.com')
	assert.equal(typeof intent.correlationID, 'string')
	assert.deepEqual(intent.intent, { goal: 'buy widget' })
})

test('createIntentMandate auto-generates a nonce when none supplied', () => {
	const a = createIntentMandate({}, baseIntentOpts())
	const b = createIntentMandate({}, baseIntentOpts())
	assert.notEqual(a.nonce, b.nonce)
})

test('createIntentMandate accepts an explicit nonce + issuedAt + correlationID', () => {
	const issuedAt = new Date('2026-01-01T00:00:00.000Z')
	const intent = createIntentMandate(
		{ goal: 'buy widget' },
		{
			...baseIntentOpts(),
			nonce: 'explicit-nonce-001',
			issuedAt,
			correlationID: 'explicit-correlation-001',
		},
	)
	assert.equal(intent.nonce, 'explicit-nonce-001')
	assert.equal(intent.issuedAt, issuedAt.toISOString())
	assert.equal(intent.correlationID, 'explicit-correlation-001')
})

test('createIntentMandate defaults correlationID to the nonce (Intent is the chain root)', () => {
	const intent = createIntentMandate({}, { ...baseIntentOpts(), nonce: 'root-nonce' })
	assert.equal(intent.correlationID, 'root-nonce')
})

test('validateIntentMandate accepts a freshly created IntentMandate', () => {
	const intent = createIntentMandate({ goal: 'x' }, baseIntentOpts())
	// asserts that no throw — type-narrows the value for downstream code
	validateIntentMandate(intent)
})

test('validateIntentMandate throws MandateError for null + undefined + non-object', () => {
	for (const bad of [null, undefined, 42, 'string', true, []]) {
		assert.throws(() => validateIntentMandate(bad), MandateError)
	}
})

test('validateIntentMandate throws MandateError for wrong payloadType', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const tampered = { ...intent, payloadType: 'ap2.CartMandate/v1' }
	assert.throws(() => validateIntentMandate(tampered), MandateError)
})

test('validateIntentMandate throws MandateError when expiresAt is at or before issuedAt', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const sameInstant = { ...intent, expiresAt: intent.issuedAt }
	assert.throws(() => validateIntentMandate(sameInstant), MandateError)

	const earlier = {
		...intent,
		expiresAt: new Date(new Date(intent.issuedAt).getTime() - 1000).toISOString(),
	}
	assert.throws(() => validateIntentMandate(earlier), MandateError)
})

test('validateIntentMandate throws MandateError for non-strict-ISO-8601 timestamps', () => {
	// Date.parse accepts many permissive forms; the validator must reject
	// anything that isn't the strict YYYY-MM-DDTHH:MM:SS[.fff]{Z|±HH:MM}
	// instant form. Lock this down so canonical-JSON serialisation stays
	// byte-identical across producers.
	const intent = createIntentMandate({}, baseIntentOpts())
	const malformed = [
		'2026/01/01 00:00:00', // slash separators + space
		'2026-01-01 00:00:00Z', // space instead of T
		'2026-01-01', // date only
		'Jan 1, 2026', // locale string
		'2026-01-01T00:00:00', // missing timezone
		'not-a-date',
		'',
	]
	for (const bad of malformed) {
		assert.throws(
			() => validateIntentMandate({ ...intent, issuedAt: bad }),
			MandateError,
			`expected validateIntentMandate to reject issuedAt='${bad}'`,
		)
		assert.throws(
			() => validateIntentMandate({ ...intent, expiresAt: bad }),
			MandateError,
			`expected validateIntentMandate to reject expiresAt='${bad}'`,
		)
	}
})

test('validateIntentMandate accepts strict ISO 8601 with numeric offset (+HH:MM)', () => {
	// Negative regression for the regex: the same instant in a non-Z offset
	// form must still validate.
	const intent = createIntentMandate({}, baseIntentOpts())
	const offsetForm = {
		...intent,
		issuedAt: '2026-01-01T00:00:00+05:30',
		expiresAt: '2026-01-01T00:15:00+05:30',
	}
	validateIntentMandate(offsetForm)
})

test('validateIntentMandate throws MandateError when a required field is missing', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	for (const field of ['nonce', 'issuedAt', 'expiresAt', 'issuer', 'correlationID']) {
		const stripped = { ...intent }
		delete stripped[field]
		assert.throws(
			() => validateIntentMandate(stripped),
			MandateError,
			`expected validateIntentMandate to throw when '${field}' is missing`,
		)
	}
})

// === CartMandate ===

test('createCartMandate references the intent nonce + inherits correlationID', () => {
	const intent = createIntentMandate({ goal: 'x' }, baseIntentOpts())
	const cart = createCartMandate(
		{ items: ['widget'], total: 100 },
		{
			expiresAt: futureDate(10 * 60 * 1000),
			issuer: 'did:web:supplier.example.com',
			intent,
		},
	)
	assert.equal(cart.payloadType, 'ap2.CartMandate/v1')
	assert.equal(cart.intentRef.nonce, intent.nonce)
	assert.equal(cart.correlationID, intent.correlationID)
	assert.deepEqual(cart.cart, { items: ['widget'], total: 100 })
})

test('createCartMandate allows overriding the inherited correlationID', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate(
		{},
		{
			expiresAt: futureDate(10 * 60 * 1000),
			issuer: 'did:web:supplier.example.com',
			intent,
			correlationID: 'override-correlation',
		},
	)
	assert.equal(cart.correlationID, 'override-correlation')
})

test('validateCartMandate accepts a freshly created CartMandate', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate(
		{},
		{
			expiresAt: futureDate(10 * 60 * 1000),
			issuer: 'did:web:supplier.example.com',
			intent,
		},
	)
	validateCartMandate(cart)
})

test('validateCartMandate throws MandateError when intentRef is missing or malformed', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})

	const noRef = { ...cart }
	delete noRef.intentRef
	assert.throws(() => validateCartMandate(noRef), MandateError)

	const noNonce = { ...cart, intentRef: {} }
	assert.throws(() => validateCartMandate(noNonce), MandateError)
})

test('validateCartMandate throws MandateError for wrong payloadType', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	assert.throws(
		() => validateCartMandate({ ...cart, payloadType: 'ap2.IntentMandate/v1' }),
		MandateError,
	)
})

// === PaymentMandate ===

test('createPaymentMandate references the cart nonce + inherits correlationID', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate(
		{ method: 'card', amount: 100 },
		{
			expiresAt: futureDate(5 * 60 * 1000),
			issuer: 'did:web:user.example.com',
			cart,
		},
	)
	assert.equal(payment.payloadType, 'ap2.PaymentMandate/v1')
	assert.equal(payment.cartRef.nonce, cart.nonce)
	assert.equal(payment.correlationID, intent.correlationID)
	assert.deepEqual(payment.payment, { method: 'card', amount: 100 })
})

test('validatePaymentMandate accepts a freshly created PaymentMandate', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate({}, {
		expiresAt: futureDate(5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	})
	validatePaymentMandate(payment)
})

test('validatePaymentMandate throws MandateError when cartRef is missing or malformed', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate({}, {
		expiresAt: futureDate(5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	})

	const noRef = { ...payment }
	delete noRef.cartRef
	assert.throws(() => validatePaymentMandate(noRef), MandateError)

	const noNonce = { ...payment, cartRef: {} }
	assert.throws(() => validatePaymentMandate(noNonce), MandateError)
})

// === Chain construction + correlation preservation ===

test('Intent → Cart → Payment chain preserves correlationID across all three mandates', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate({}, {
		expiresAt: futureDate(5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	})
	assert.equal(intent.correlationID, cart.correlationID)
	assert.equal(cart.correlationID, payment.correlationID)
	assert.equal(cart.intentRef.nonce, intent.nonce)
	assert.equal(payment.cartRef.nonce, cart.nonce)
})

// === JSON round-trip ===

test('IntentMandate JSON round-trip: serialize → parse → validate succeeds', () => {
	const intent = createIntentMandate({ goal: 'x' }, baseIntentOpts())
	const roundTripped = JSON.parse(JSON.stringify(intent))
	validateIntentMandate(roundTripped)
	assert.deepEqual(roundTripped, intent)
})

test('CartMandate JSON round-trip', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({ items: ['x'] }, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const roundTripped = JSON.parse(JSON.stringify(cart))
	validateCartMandate(roundTripped)
	assert.deepEqual(roundTripped, cart)
})

test('PaymentMandate JSON round-trip', () => {
	const intent = createIntentMandate({}, baseIntentOpts())
	const cart = createCartMandate({}, {
		expiresAt: futureDate(10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	})
	const payment = createPaymentMandate({ method: 'card' }, {
		expiresAt: futureDate(5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	})
	const roundTripped = JSON.parse(JSON.stringify(payment))
	validatePaymentMandate(roundTripped)
	assert.deepEqual(roundTripped, payment)
})

// === Optional principal ===

test('createIntentMandate omits principal from the envelope when none supplied', () => {
	const opts = baseIntentOpts()
	delete opts.principal
	const intent = createIntentMandate({}, opts)
	assert.equal(intent.principal, undefined)
	// validate should still accept (principal is optional)
	validateIntentMandate(intent)
})
