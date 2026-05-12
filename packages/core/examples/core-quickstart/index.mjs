#!/usr/bin/env node
/**
 * core-quickstart — end-to-end walkthrough of the rc.1 surface.
 *
 * Five steps: provision a key, build a mandate chain, sign each
 * mandate, verify independently, then prove cross-payloadType replay
 * fails. Exit code 0 = all five steps green; non-zero = a verification
 * gate broke.
 */
import {
	buildSigningInput,
	canonicalBytes,
	createIntentMandate,
	createCartMandate,
	createPaymentMandate,
} from '@agent-commerce-trust/core'
import { InMemoryKeyProvider } from '@agent-commerce-trust/core/dev'

const assert = (cond, message) => {
	if (!cond) {
		console.error(`✗ ${message}`)
		process.exit(1)
	}
}

// === Step 1 — provision a test key ===
const provider = new InMemoryKeyProvider({ providerId: 'demo' })
const key = await provider.generateSigningKey({
	algorithm: 'Ed25519',
	purposes: [
		'sign-intent-mandate',
		'sign-cart-mandate',
		'sign-payment-mandate',
	],
})
console.log(`[step 1] in-memory provider ready (providerId=${provider.providerId})`)

// === Step 2 — assemble an Intent → Cart → Payment chain ===
const intent = createIntentMandate(
	{ goal: 'buy widget', amountUsdCents: 12500 },
	{
		expiresAt: new Date(Date.now() + 15 * 60 * 1000),
		issuer: 'did:web:agent.example.com',
		principal: 'did:web:user.example.com',
	},
)
const cart = createCartMandate(
	{ items: [{ sku: 'widget-1', qty: 1 }], totalUsdCents: 12500 },
	{
		expiresAt: new Date(Date.now() + 10 * 60 * 1000),
		issuer: 'did:web:supplier.example.com',
		intent,
	},
)
const payment = createPaymentMandate(
	{ method: 'card', last4: '4242', amountUsdCents: 12500 },
	{
		expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		issuer: 'did:web:user.example.com',
		cart,
	},
)
console.log(`[step 2] intent / cart / payment chain assembled (correlationID=${intent.correlationID})`)

// === Step 3 — sign each mandate with the correct payloadType + purpose ===
const sign = async (mandate, payloadType, purpose) => {
	return provider.sign({
		keyId: key.keyId,
		algorithm: 'Ed25519',
		payload: canonicalBytes(mandate),
		payloadType,
		purpose,
	})
}
const intentSig = await sign(intent, 'ap2.IntentMandate/v1', 'sign-intent-mandate')
const cartSig = await sign(cart, 'ap2.CartMandate/v1', 'sign-cart-mandate')
const paymentSig = await sign(payment, 'ap2.PaymentMandate/v1', 'sign-payment-mandate')
console.log('[step 3] all three mandates signed')

// === Step 4 — verify each signature independently ===
const pub = await provider.getPublicKey(key.keyId)
const importedPublic = await globalThis.crypto.subtle.importKey(
	'raw',
	pub.encoded,
	{ name: 'Ed25519' },
	false,
	['verify'],
)
const verify = async (mandate, payloadType, signature) => {
	const signingInput = await buildSigningInput({
		payload: canonicalBytes(mandate),
		payloadType,
	})
	return globalThis.crypto.subtle.verify(
		{ name: 'Ed25519' },
		importedPublic,
		signature,
		signingInput,
	)
}
assert(await verify(intent, 'ap2.IntentMandate/v1', intentSig.signature), 'intent signature must verify')
assert(await verify(cart, 'ap2.CartMandate/v1', cartSig.signature), 'cart signature must verify')
assert(await verify(payment, 'ap2.PaymentMandate/v1', paymentSig.signature), 'payment signature must verify')
console.log('[step 4] all three signatures verify independently against the public keys')

// === Step 5 — cross-payloadType replay must fail ===
// The intent signature, verified against the cart's signing input, MUST
// return false. SHA-256-prefix domain separation prevents the replay.
const crossReplay = await verify(intent, 'ap2.CartMandate/v1', intentSig.signature)
assert(crossReplay === false, 'cross-payloadType replay must fail (domain separation)')
console.log('[step 5] cross-payloadType replay attempt failed as expected')

console.log('✓ core-quickstart: 5 / 5 steps green')
