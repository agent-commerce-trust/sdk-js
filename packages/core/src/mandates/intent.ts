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
 * Strict ISO 8601 pattern. Matches `Date.prototype.toISOString()` output —
 * `YYYY-MM-DDTHH:MM:SS[.fff…]Z` — and the equivalent shape with a numeric
 * timezone offset `±HH:MM`. Permissive forms accepted by `Date.parse` but
 * NOT by this pattern: slash separators (`2026/01/01`), space-separated
 * date+time (`2026-01-01 00:00:00`), date-only (`2026-01-01`), unanchored
 * input, and locale strings like `Jan 1, 2026`.
 */
const ISO_8601_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/

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
	const issuedAtStr = v.issuedAt as string
	const expiresAtStr = v.expiresAt as string
	if (!ISO_8601_INSTANT.test(issuedAtStr)) {
		throw new MandateError(
			`mandate field 'issuedAt' must be a strict ISO 8601 instant (YYYY-MM-DDTHH:MM:SS[.fff]{Z|±HH:MM}), got '${issuedAtStr}'`,
		)
	}
	if (!ISO_8601_INSTANT.test(expiresAtStr)) {
		throw new MandateError(
			`mandate field 'expiresAt' must be a strict ISO 8601 instant (YYYY-MM-DDTHH:MM:SS[.fff]{Z|±HH:MM}), got '${expiresAtStr}'`,
		)
	}
	const issuedAt = Date.parse(issuedAtStr)
	const expiresAt = Date.parse(expiresAtStr)
	if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
		// Shouldn't reach: the regex above accepts a superset of parseable
		// instants, so any string that passed the regex must also parse.
		throw new MandateError(`mandate timestamps failed Date.parse after ISO 8601 regex acceptance`)
	}
	if (expiresAt <= issuedAt) {
		throw new MandateError(
			`mandate field 'expiresAt' (${expiresAtStr}) must be strictly after 'issuedAt' (${issuedAtStr})`,
		)
	}
}
