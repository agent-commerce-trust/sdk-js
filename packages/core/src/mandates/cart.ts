import { MandateError } from '../errors.js'
import { assertEnvelopeShape } from './intent.js'
import type { CartMandate, IntentMandate } from './types.js'

export interface CreateCartMandateOptions {
	/** Optional explicit nonce. Defaults to `crypto.randomUUID()`. */
	readonly nonce?: string
	/** Optional issuance time. Defaults to `new Date()`. */
	readonly issuedAt?: Date
	/** Required expiry. */
	readonly expiresAt: Date
	/** Issuer DID (typically the supplier). */
	readonly issuer: string
	/** Optional principal DID. */
	readonly principal?: string
	/** Parent IntentMandate; the CartMandate inherits its correlationID and references its nonce. */
	readonly intent: IntentMandate
	/** Optional explicit correlationID. Defaults to `intent.correlationID`. */
	readonly correlationID?: string
}

export function createCartMandate<TPayload>(
	payload: TPayload,
	options: CreateCartMandateOptions,
): CartMandate<TPayload> {
	const nonce = options.nonce ?? globalThis.crypto.randomUUID()
	const issuedAt = options.issuedAt ?? new Date()
	const correlationID = options.correlationID ?? options.intent.correlationID

	const mandate: CartMandate<TPayload> = {
		payloadType: 'ap2.CartMandate/v1',
		nonce,
		issuedAt: issuedAt.toISOString(),
		expiresAt: options.expiresAt.toISOString(),
		issuer: options.issuer,
		correlationID,
		intentRef: { nonce: options.intent.nonce },
		cart: payload,
		...(options.principal !== undefined ? { principal: options.principal } : {}),
	}

	return mandate
}

export function validateCartMandate(value: unknown): asserts value is CartMandate {
	assertEnvelopeShape(value, 'ap2.CartMandate/v1')
	const v = value as Record<string, unknown>
	if (!('cart' in v)) {
		throw new MandateError('CartMandate is missing the `cart` payload field')
	}
	const ref = v.intentRef
	if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
		throw new MandateError('CartMandate `intentRef` must be a non-null object with `nonce`')
	}
	const refNonce = (ref as Record<string, unknown>).nonce
	if (typeof refNonce !== 'string' || refNonce === '') {
		throw new MandateError('CartMandate `intentRef.nonce` must be a non-empty string')
	}
}
