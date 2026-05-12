import { MandateError } from '../errors.js'
import { assertEnvelopeShape } from './intent.js'
import type { CartMandate, PaymentMandate } from './types.js'

export interface CreatePaymentMandateOptions {
	/** Optional explicit nonce. Defaults to `crypto.randomUUID()`. */
	readonly nonce?: string
	/** Optional issuance time. Defaults to `new Date()`. */
	readonly issuedAt?: Date
	/** Required expiry. Payment TTL is the tightest in the chain. */
	readonly expiresAt: Date
	/** Issuer DID (typically the principal authorising payment). */
	readonly issuer: string
	/** Optional principal DID (when issuer != principal). */
	readonly principal?: string
	/** Parent CartMandate; the PaymentMandate inherits its correlationID and references its nonce. */
	readonly cart: CartMandate
	/** Optional explicit correlationID. Defaults to `cart.correlationID`. */
	readonly correlationID?: string
}

export function createPaymentMandate<TPayload>(
	payload: TPayload,
	options: CreatePaymentMandateOptions,
): PaymentMandate<TPayload> {
	const nonce = options.nonce ?? globalThis.crypto.randomUUID()
	const issuedAt = options.issuedAt ?? new Date()
	const correlationID = options.correlationID ?? options.cart.correlationID

	const mandate: PaymentMandate<TPayload> = {
		payloadType: 'ap2.PaymentMandate/v1',
		nonce,
		issuedAt: issuedAt.toISOString(),
		expiresAt: options.expiresAt.toISOString(),
		issuer: options.issuer,
		correlationID,
		cartRef: { nonce: options.cart.nonce },
		payment: payload,
		...(options.principal !== undefined ? { principal: options.principal } : {}),
	}

	return mandate
}

export function validatePaymentMandate(value: unknown): asserts value is PaymentMandate {
	assertEnvelopeShape(value, 'ap2.PaymentMandate/v1')
	const v = value as Record<string, unknown>
	if (!('payment' in v)) {
		throw new MandateError('PaymentMandate is missing the `payment` payload field')
	}
	const ref = v.cartRef
	if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
		throw new MandateError('PaymentMandate `cartRef` must be a non-null object with `nonce`')
	}
	const refNonce = (ref as Record<string, unknown>).nonce
	if (typeof refNonce !== 'string' || refNonce === '') {
		throw new MandateError('PaymentMandate `cartRef.nonce` must be a non-empty string')
	}
}
