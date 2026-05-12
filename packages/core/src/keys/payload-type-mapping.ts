/**
 * Normative `payloadType → purpose` mapping per §7.1 of the canonical
 * trust-layer SDK doc at `docs/domains/auth/trust-layer-sdk.md`. The
 * mapping table is the single source of truth that coordinates a
 * `SignRequest`'s `payloadType` (a serialization-schema identifier such
 * as `ap2.IntentMandate/v1`) with its `purpose` (the enum-typed
 * key-usage such as `sign-intent-mandate`). 21 rows; the mapping is
 * one-way — `display.Attestation/v1` and `display.RenderAttestation/v1`
 * both map to `sign-display-attestation`.
 *
 * Callers MUST supply both fields; a `SignRequest` whose `purpose` is
 * inconsistent with the `payloadType`'s mapped purpose is rejected with
 * `KeyPurposePayloadTypeMismatchError`. Unknown `payloadType` is also
 * rejected: every value signed under this contract must trace to a
 * normative row.
 */
import { KeyPurposePayloadTypeMismatchError } from '../errors.js'
import type { KeyPurpose } from '../types/key-purpose.js'

function freezeMap<K, V>(inner: Map<K, V>): ReadonlyMap<K, V> {
	const throwReadonly = (): never => {
		throw new TypeError('PAYLOAD_TYPE_PURPOSE_MAP is read-only; the normative mapping is frozen at module load')
	}
	// Wrap the Map in a Proxy whose `get` trap returns a throwing stub for
	// every mutation method. This covers the obvious `m.set(...)` path AND
	// the prototype-bypass path `Map.prototype.set.call(m, ...)`:
	// the latter executes `Map.prototype.set` with `this` pointing at the
	// Proxy, which has no `[[MapData]]` internal slot, so V8 raises
	// `TypeError: Method Map.prototype.set called on incompatible receiver`.
	// Non-mutation methods (`get`, `has`, `size`, iterators) reach the inner
	// Map through the `get` trap's function-binding fallback, so reads work
	// transparently.
	return new Proxy(inner, {
		get(target, prop) {
			if (prop === 'set' || prop === 'delete' || prop === 'clear') {
				return throwReadonly
			}
			const value = Reflect.get(target, prop, target)
			return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
		},
		set: throwReadonly,
		deleteProperty: throwReadonly,
		defineProperty: throwReadonly,
		setPrototypeOf: throwReadonly,
	}) as ReadonlyMap<K, V>
}

export const PAYLOAD_TYPE_PURPOSE_MAP: ReadonlyMap<string, KeyPurpose> = freezeMap(
	new Map<string, KeyPurpose>([
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
	]),
)

/**
 * Validate that a `payloadType` and a `purpose` are coordinated per the
 * normative mapping. Returns void on success; throws
 * `KeyPurposePayloadTypeMismatchError` if:
 *
 *   - `payloadType` is not a normative key (no row in the table), OR
 *   - `payloadType` maps to a purpose other than the one supplied.
 *
 * The error message includes both the supplied purpose and the
 * normatively-mapped purpose so a misconfigured caller can correct the
 * `SignRequest` without consulting the spec.
 */
export function validatePayloadTypePurpose(
	payloadType: string,
	purpose: KeyPurpose,
): void {
	const expected = PAYLOAD_TYPE_PURPOSE_MAP.get(payloadType)
	if (expected === undefined) {
		throw new KeyPurposePayloadTypeMismatchError(
			`Unknown payloadType '${payloadType}'; no normative purpose mapping exists for this payload type. Supplied purpose was '${purpose}'.`,
		)
	}
	if (expected !== purpose) {
		throw new KeyPurposePayloadTypeMismatchError(
			`payloadType '${payloadType}' is normatively mapped to purpose '${expected}', but the supplied purpose was '${purpose}'.`,
		)
	}
}
