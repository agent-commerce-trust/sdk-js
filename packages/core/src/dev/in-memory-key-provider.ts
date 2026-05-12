/**
 * `InMemoryKeyProvider` — a `KeyProvider` implementation backed by
 * ephemeral WebCrypto `CryptoKey` material held in process memory.
 *
 * ⚠️  Test + development use only. Never use this provider in production:
 *
 *   - Private keys live in JS heap as `CryptoKey` objects; any code that
 *     can read the provider instance can extract them via WebCrypto's
 *     `exportKey()` if the key was generated with `extractable: true`
 *     (which this provider does, because round-trip tests need it).
 *   - There is no KMS, HSM, or any audit boundary between the application
 *     and the signing key.
 *
 * Production deployments must use one of the `@agent-commerce-trust/core/providers`
 * implementations (Aws/Gcp/Azure KMS, PKCS#11, FIDO2, RemoteSigner). The
 * `/providers` subpath in `package.json` is reserved (null-exports) at this
 * release; concrete production providers are published under that subpath in
 * a future release.
 *
 * The provider implements the `KeyProvider` interface from
 * `docs/domains/auth/trust-layer-sdk.md` §7.1 plus a provisioning
 * `generateSigningKey()` method that is **not** part of the consumer
 * surface (only the test/dev rig calls it). `derive()` is omitted entirely
 * per the §7.1 contract: providers that don't support HMAC-pepper
 * derivation simply do not declare the method.
 */
import {
	AlgorithmUnsupportedError,
	KeyNotFoundError,
	KeyProviderError,
	KeyPurposeMismatchError,
} from '../errors.js'
import type { KeyProvider, KeyRef, SignRequest, SignResult, SigningKeyRef } from '../keys/types.js'
import type { SigningEvent } from '../keys/signing-event.js'
import { validatePayloadTypePurpose } from '../keys/payload-type-mapping.js'
import { buildSigningInput } from '../keys/signing-input.js'
import type { Algorithm } from '../types/algorithm.js'
import type { SigningKeyPurpose } from '../types/key-purpose.js'
import type { KeyScope } from '../types/key-scope.js'
import type { KeyVersion } from '../types/key-version.js'
import type { PublicKey } from '../types/public-key.js'
import type { Unsubscribe } from '../types/unsubscribe.js'

export interface InMemoryKeyProviderOptions {
	readonly providerId?: string
}

export interface GenerateSigningKeyOptions {
	readonly algorithm: Algorithm
	readonly purposes: readonly SigningKeyPurpose[]
	readonly notBefore?: Date
	readonly notAfter?: Date
}

interface InternalKeyEntry {
	readonly keyRef: SigningKeyRef
	readonly privateKey: CryptoKey
	readonly publicCryptoKey: CryptoKey
	readonly publicKey: PublicKey
	readonly version: string
	readonly versions: KeyVersion[]
}

const DEFAULT_PROVIDER_ID = 'in-memory:default'

export class InMemoryKeyProvider implements KeyProvider {
	readonly providerId: string

	#keys = new Map<string, InternalKeyEntry>()
	#listeners = new Set<(evt: SigningEvent) => void>()

	constructor(options: InMemoryKeyProviderOptions = {}) {
		this.providerId = options.providerId ?? DEFAULT_PROVIDER_ID
	}

	async generateSigningKey(options: GenerateSigningKeyOptions): Promise<SigningKeyRef> {
		const keyPair = await this.#generateCryptoKeyPair(options.algorithm)
		const rawPublic = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey)
		const encodedPublic = new Uint8Array(rawPublic as ArrayBuffer)
		const keyId = globalThis.crypto.randomUUID()
		const version = '1'
		const createdAt = new Date()

		// Deep-freeze the publicKey + purposes so the returned SigningKeyRef
		// (which is the same object stored internally) cannot be mutated by a
		// caller to inject a new purpose or swap the public key. Without this,
		// `(returnedRef as any).purposes.push('any-purpose')` would alias
		// `entry.keyRef.purposes` and bypass sign()'s purpose-list check.
		const publicKey: PublicKey = Object.freeze({
			kty: options.algorithm === 'Ed25519' ? 'OKP' : 'EC',
			algorithm: options.algorithm,
			encoded: encodedPublic,
			version,
		})

		const keyRef: SigningKeyRef = Object.freeze({
			kind: 'signing',
			keyId,
			algorithm: options.algorithm,
			publicKey,
			purposes: Object.freeze([...options.purposes]) as readonly SigningKeyPurpose[],
			notBefore: options.notBefore ?? createdAt,
			...(options.notAfter !== undefined ? { notAfter: options.notAfter } : {}),
		}) as SigningKeyRef

		this.#keys.set(keyId, {
			keyRef,
			privateKey: keyPair.privateKey,
			publicCryptoKey: keyPair.publicKey,
			publicKey,
			version,
			versions: [{ version, createdAt }],
		})

		return keyRef
	}

	async listSigningKeys(scope?: KeyScope): Promise<KeyRef[]> {
		const out: KeyRef[] = []
		for (const entry of this.#keys.values()) {
			if (scope) {
				if (scope.algorithm !== undefined && entry.keyRef.algorithm !== scope.algorithm) continue
				if (scope.purpose !== undefined && !entry.keyRef.purposes.includes(scope.purpose as SigningKeyPurpose)) continue
				// `scope.subject` filter is not modelled by this provider (no subject metadata is
				// tracked on InMemory signing keys); supplying it yields the unfiltered set.
			}
			out.push(entry.keyRef)
		}
		return out
	}

	async getSigningKey(keyId: string): Promise<KeyRef> {
		const entry = this.#keys.get(keyId)
		if (entry === undefined) {
			throw new KeyNotFoundError(`No signing key with id '${keyId}' in provider '${this.providerId}'`)
		}
		return entry.keyRef
	}

	async getPublicKey(keyId: string, _version?: string): Promise<PublicKey> {
		const entry = this.#keys.get(keyId)
		if (entry === undefined) {
			throw new KeyNotFoundError(`No public key for keyId '${keyId}' in provider '${this.providerId}'`)
		}
		return entry.publicKey
	}

	async sign(req: SignRequest): Promise<SignResult> {
		const entry = this.#keys.get(req.keyId)
		if (entry === undefined) {
			const err = new KeyNotFoundError(`No signing key with id '${req.keyId}' in provider '${this.providerId}'`)
			this.#emit({ type: 'sign-error', keyId: req.keyId, error: err, at: new Date() })
			throw err
		}

		// Emit sign-request before any post-key-lookup validation so audit logs
		// see every attempted operation against a known key, including those
		// that subsequently fail validation.
		this.#emit({ type: 'sign-request', keyId: req.keyId, purpose: req.purpose, at: new Date() })

		if (req.algorithm !== entry.keyRef.algorithm) {
			const err = new AlgorithmUnsupportedError(
				`key '${req.keyId}' is bound to algorithm '${entry.keyRef.algorithm}' but the request specified '${req.algorithm}'`,
			)
			this.#emit({ type: 'sign-error', keyId: req.keyId, error: err, at: new Date() })
			throw err
		}

		if (!entry.keyRef.purposes.includes(req.purpose)) {
			const err = new KeyPurposeMismatchError(
				`key '${req.keyId}' (purposes: [${entry.keyRef.purposes.join(', ')}]) is not authorised for purpose '${req.purpose}'`,
			)
			this.#emit({ type: 'sign-error', keyId: req.keyId, error: err, at: new Date() })
			throw err
		}

		try {
			validatePayloadTypePurpose(req.payloadType, req.purpose)
		} catch (err) {
			// validatePayloadTypePurpose only throws KeyPurposePayloadTypeMismatchError,
			// which extends KeyProviderError — narrow + rethrow.
			const providerErr = err as KeyProviderError
			this.#emit({ type: 'sign-error', keyId: req.keyId, error: providerErr, at: new Date() })
			throw err
		}

		// Domain-separated signing input: SHA-256(canonicalBytes({payloadType, context}))
		// is prepended to the payload before signing, so a signature over an
		// `ap2.IntentMandate/v1` payload cannot be replayed against
		// `ap2.CartMandate/v1` even if the inner canonical bytes coincide.
		const signingInput = await buildSigningInput({
			payload: req.payload,
			payloadType: req.payloadType,
			...(req.context !== undefined ? { context: req.context } : {}),
		})
		const signature = await this.#sign(entry.privateKey, entry.keyRef.algorithm, signingInput)
		const publicJwk = await this.#exportJwk(entry.publicCryptoKey)

		const result: SignResult = {
			keyId: req.keyId,
			keyVersion: entry.version,
			algorithm: entry.keyRef.algorithm,
			signature,
			publicKeyRef: { kind: 'jwk', jwk: publicJwk },
			signedAt: new Date(),
		}

		this.#emit({ type: 'sign-result', keyId: req.keyId, keyVersion: entry.version, at: new Date() })

		return result
	}

	async supportedAlgorithms(keyId: string): Promise<Algorithm[]> {
		const entry = this.#keys.get(keyId)
		if (entry === undefined) {
			throw new KeyNotFoundError(`No key with id '${keyId}' in provider '${this.providerId}'`)
		}
		return [entry.keyRef.algorithm]
	}

	async currentVersion(keyId: string): Promise<string> {
		const entry = this.#keys.get(keyId)
		if (entry === undefined) {
			throw new KeyNotFoundError(`No key with id '${keyId}' in provider '${this.providerId}'`)
		}
		return entry.version
	}

	async historicalVersions(keyId: string): Promise<KeyVersion[]> {
		const entry = this.#keys.get(keyId)
		if (entry === undefined) {
			throw new KeyNotFoundError(`No key with id '${keyId}' in provider '${this.providerId}'`)
		}
		return [...entry.versions]
	}

	onSigningEvent(cb: (evt: SigningEvent) => void): Unsubscribe {
		this.#listeners.add(cb)
		return () => {
			this.#listeners.delete(cb)
		}
	}

	// === Private helpers ===

	async #generateCryptoKeyPair(algorithm: Algorithm): Promise<CryptoKeyPair> {
		if (algorithm === 'Ed25519') {
			return (await globalThis.crypto.subtle.generateKey(
				{ name: 'Ed25519' },
				true,
				['sign', 'verify'],
			)) as CryptoKeyPair
		}
		if (algorithm === 'ECDSA_P256') {
			return (await globalThis.crypto.subtle.generateKey(
				{ name: 'ECDSA', namedCurve: 'P-256' },
				true,
				['sign', 'verify'],
			)) as CryptoKeyPair
		}
		const exhaustive: never = algorithm
		throw new TypeError(`Unsupported algorithm: ${exhaustive as string}`)
	}

	async #sign(privateKey: CryptoKey, algorithm: Algorithm, payload: Uint8Array): Promise<Uint8Array> {
		const params: AlgorithmIdentifier | EcdsaParams =
			algorithm === 'Ed25519'
				? { name: 'Ed25519' }
				: { name: 'ECDSA', hash: 'SHA-256' }
		const sig = await globalThis.crypto.subtle.sign(params, privateKey, payload as BufferSource)
		return new Uint8Array(sig)
	}

	async #exportJwk(key: CryptoKey): Promise<Readonly<Record<string, unknown>>> {
		const jwk = (await globalThis.crypto.subtle.exportKey('jwk', key)) as Record<string, unknown>
		return Object.freeze(jwk)
	}

	#emit(evt: SigningEvent): void {
		for (const cb of this.#listeners) {
			try {
				cb(evt)
			} catch {
				// Listeners must not propagate exceptions out of the emitter; swallow.
			}
		}
	}
}
