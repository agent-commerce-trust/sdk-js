import { MandateError } from '../errors.js'
import type { IntentMandate } from './types.js'

export interface CreateIntentMandateOptions {
	/** Optional explicit nonce. Defaults to `crypto.randomUUID()`. */
	readonly nonce?: string
	/** Optional issuance time. Defaults to `new Date()`. */
	readonly issuedAt?: Date
	/** Required expiry. Caller chooses the TTL appropriate to the flow. */
	readonly expiresAt: Date
	/** Issuer DID. */
	readonly issuer: string
	/** Optional principal DID. */
	readonly principal?: string
	/** Optional explicit correlationID. Defaults to the mandate's nonce (chain root). */
	readonly correlationID?: string
}

export function createIntentMandate<TPayload>(
	payload: TPayload,
	options: CreateIntentMandateOptions,
): IntentMandate<TPayload> {
	const nonce = options.nonce ?? globalThis.crypto.randomUUID()
	const issuedAt = options.issuedAt ?? new Date()
	const correlationID = options.correlationID ?? nonce

	const mandate: IntentMandate<TPayload> = {
		payloadType: 'ap2.IntentMandate/v1',
		nonce,
		issuedAt: issuedAt.toISOString(),
		expiresAt: options.expiresAt.toISOString(),
		issuer: options.issuer,
		correlationID,
		intent: payload,
		...(options.principal !== undefined ? { principal: options.principal } : {}),
	}

	return mandate
}

export function validateIntentMandate(value: unknown): asserts value is IntentMandate {
	assertEnvelopeShape(value, 'ap2.IntentMandate/v1')
	if (!('intent' in (value as object))) {
		throw new MandateError('IntentMandate is missing the `intent` payload field')
	}
}

/**
 * Shared shape check for any mandate envelope. Verifies presence + types of
 * the AP2 metadata fields and the payloadType discriminator. Throws
 * MandateError on any failure. Specific validators (intent/cart/payment)
 * call this first and then check their own payload-specific fields.
 */
export function assertEnvelopeShape(value: unknown, expectedPayloadType: string): void {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new MandateError(
			`mandate must be a non-null object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
		)
	}
	const v = value as Record<string, unknown>
	if (v.payloadType !== expectedPayloadType) {
		throw new MandateError(
			`mandate payloadType must be '${expectedPayloadType}', got '${String(v.payloadType)}'`,
		)
	}
	for (const field of ['nonce', 'issuedAt', 'expiresAt', 'issuer', 'correlationID']) {
		if (typeof v[field] !== 'string' || v[field] === '') {
			throw new MandateError(
				`mandate field '${field}' must be a non-empty string`,
			)
		}
	}
	if (v.principal !== undefined && typeof v.principal !== 'string') {
		throw new MandateError(`mandate field 'principal' must be a string when present`)
	}
	const issuedAt = Date.parse(v.issuedAt as string)
	const expiresAt = Date.parse(v.expiresAt as string)
	if (Number.isNaN(issuedAt)) {
		throw new MandateError(`mandate field 'issuedAt' is not a parseable ISO 8601 timestamp`)
	}
	if (Number.isNaN(expiresAt)) {
		throw new MandateError(`mandate field 'expiresAt' is not a parseable ISO 8601 timestamp`)
	}
	if (expiresAt <= issuedAt) {
		throw new MandateError(
			`mandate field 'expiresAt' (${v.expiresAt}) must be strictly after 'issuedAt' (${v.issuedAt})`,
		)
	}
}
