/**
 * Domain-separated signing input construction per §7.1 of the canonical
 * trust-layer SDK doc at `docs/domains/auth/trust-layer-sdk.md`:
 *
 *   "payloadType is hashed into the signing context (domain separator)"
 *
 * The signing input is the byte sequence fed to a `KeyProvider.sign()`
 * call's underlying crypto primitive. Every conforming KeyProvider
 * implementation MUST construct it via this helper (or an equivalent
 * byte-identical construction) so that:
 *
 *   1. A signature over an `ap2.IntentMandate/v1` payload cannot be
 *      replayed against an `ap2.CartMandate/v1` payload that happens to
 *      share the same canonical bytes.
 *   2. A signature with an additional `context` field cannot be replayed
 *      in a different context.
 *
 * Construction:
 *
 *   domainBytes  = canonicalBytes({ payloadType, context: context ?? {} })
 *   domainHash   = SHA-256(domainBytes)            // 32 bytes
 *   signingInput = domainHash || payload           // concatenation
 *
 * Verifiers MUST reconstruct the same `signingInput` from the verified
 * `payloadType` + `context` + `payload` before calling the underlying
 * crypto-verify primitive.
 */
import { canonicalBytes } from '../canonical.js'

export interface SigningInputParts {
	readonly payload: Uint8Array
	readonly payloadType: string
	readonly context?: Readonly<Record<string, string>>
}

export async function buildSigningInput(parts: SigningInputParts): Promise<Uint8Array> {
	const domainBytes = canonicalBytes({
		payloadType: parts.payloadType,
		context: parts.context ?? {},
	})
	const domainHashBuffer = await globalThis.crypto.subtle.digest(
		'SHA-256',
		domainBytes as BufferSource,
	)
	const domainHash = new Uint8Array(domainHashBuffer)

	const out = new Uint8Array(domainHash.byteLength + parts.payload.byteLength)
	out.set(domainHash, 0)
	out.set(parts.payload, domainHash.byteLength)
	return out
}
