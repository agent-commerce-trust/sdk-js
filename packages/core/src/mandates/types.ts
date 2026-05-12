/**
 * AP2 base mandate shapes. These are the profile-neutral envelope types
 * shared by every vertical profile. Vertical profiles (AP2-Travel,
 * AP2-Health, AP2-Procure, …) wrap these with profile-specific payload
 * shapes and type assertions; the core envelope is the durable contract.
 *
 * Chain semantics:
 *   IntentMandate (chain root)
 *     → CartMandate (references intent.nonce; same correlationID)
 *       → PaymentMandate (references cart.nonce; same correlationID)
 *
 * Validators in this package only check envelope shape — chain integrity,
 * signature verification, and revocation checks are the verifier package's
 * responsibility.
 */

/** Fields shared by every AP2 mandate envelope. */
export interface MandateMetadata {
	/** Unique nonce for this mandate. 128-bit-equivalent uniqueness expected. */
	readonly nonce: string
	/** ISO 8601 timestamp at which the mandate was issued. */
	readonly issuedAt: string
	/** ISO 8601 timestamp after which the mandate is no longer accepted. */
	readonly expiresAt: string
	/** DID of the issuing party (agent, supplier, or principal). */
	readonly issuer: string
	/** DID of the principal on whose behalf the mandate is issued. Optional. */
	readonly principal?: string
	/** Chain-wide correlation identifier. Inherited from the Intent (chain root). */
	readonly correlationID: string
}

/** Reference to a prior mandate's nonce for chain binding. */
export interface MandateRef {
	readonly nonce: string
}

export interface IntentMandate<TPayload = unknown> extends MandateMetadata {
	readonly payloadType: 'ap2.IntentMandate/v1'
	readonly intent: TPayload
}

export interface CartMandate<TPayload = unknown> extends MandateMetadata {
	readonly payloadType: 'ap2.CartMandate/v1'
	readonly intentRef: MandateRef
	readonly cart: TPayload
}

export interface PaymentMandate<TPayload = unknown> extends MandateMetadata {
	readonly payloadType: 'ap2.PaymentMandate/v1'
	readonly cartRef: MandateRef
	readonly payment: TPayload
}

export type AnyMandate<TPayload = unknown> =
	| IntentMandate<TPayload>
	| CartMandate<TPayload>
	| PaymentMandate<TPayload>
