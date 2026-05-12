/**
 * `KeyProvider` contract per §7.1 of the canonical trust-layer SDK doc at
 * `docs/domains/auth/trust-layer-sdk.md`. The SDK accepts keys via an
 * abstract `KeyProvider` interface and does not manage keys itself. All
 * packages that sign or verify MUST accept any conforming `KeyProvider`.
 *
 * No runtime in this module — only the type and interface contract that
 * binds external implementers. Production implementations (Aws KMS, GCP KMS,
 * Azure Key Vault, PKCS#11, FIDO2, RemoteSigner) ship at
 * `@agent-commerce-trust/core/providers`; the test-only `InMemoryKeyProvider`
 * ships at `@agent-commerce-trust/core/dev`.
 */
import type { Algorithm } from '../types/algorithm.js'
import type {
  KeyPurpose,
  SigningKeyPurpose,
  DeriveKeyPurpose,
} from '../types/key-purpose.js'
import type { KeyScope } from '../types/key-scope.js'
import type { KeyVersion } from '../types/key-version.js'
import type { PublicKey } from '../types/public-key.js'
import type { PublicKeyRef } from '../types/public-key-ref.js'
import type { RotationPolicy } from '../types/rotation-policy.js'
import type { SigningEvent } from './signing-event.js'
import type { Unsubscribe } from '../types/unsubscribe.js'

export interface KeyProvider {
  // Identity
  readonly providerId: string                          // stable identifier (e.g. 'aws-kms:us-west-2')

  // Key lookup
  listSigningKeys(scope?: KeyScope): Promise<KeyRef[]>
  getSigningKey(keyId: string): Promise<KeyRef>        // throws KeyNotFoundError
  getPublicKey(keyId: string, version?: string): Promise<PublicKey>

  // Signing
  sign(req: SignRequest): Promise<SignResult>
  supportedAlgorithms(keyId: string): Promise<Algorithm[]>

  // Secret derivation (only for 'derive-principal-pepper'; §7.10.3 fallback).
  // Optional capability; KeyProviders that don't implement it reject
  // HMAC-pepper principal derivation by simply not declaring the method.
  derive?(req: DeriveRequest): Promise<DeriveResult>

  // Lifecycle
  currentVersion(keyId: string): Promise<string>
  historicalVersions(keyId: string): Promise<KeyVersion[]>        // for verifying old receipts
  rotationPolicy?(keyId: string): Promise<RotationPolicy>          // optional hint

  // Audit
  onSigningEvent?(cb: (evt: SigningEvent) => void): Unsubscribe
}

export type KeyRef = SigningKeyRef | DeriveKeyRef

export interface SigningKeyRef {
  readonly kind: 'signing'
  readonly keyId: string                           // opaque to SDK; interpreted by provider
  readonly algorithm: Algorithm                    // 'Ed25519' | 'ECDSA_P256'
  readonly publicKey: PublicKey                    // includes version + did fragment
  readonly purposes: readonly SigningKeyPurpose[]  // signing purposes only
  readonly notBefore: Date
  readonly notAfter?: Date
  readonly kmsMetadata?: Readonly<Record<string, string>>
}

export interface DeriveKeyRef {
  readonly kind: 'derive'
  readonly keyId: string
  readonly algorithm: 'HMAC-SHA-256'
  readonly purposes: readonly DeriveKeyPurpose[]   // MUST equal ['derive-principal-pepper'] for §7.10.3
  readonly notBefore: Date
  readonly notAfter?: Date
  readonly kmsMetadata?: Readonly<Record<string, string>>
  // No publicKey; peppers have none and must not be exported.
}

export interface SignRequest {
  readonly keyId: string
  readonly algorithm: Algorithm
  readonly payload: Uint8Array                     // canonical bytes — never raw object
  readonly payloadType: string                     // e.g. 'ap2.IntentMandate/v1'
  readonly purpose: SigningKeyPurpose              // signing-only purpose; derive purposes go through DeriveRequest
  readonly context?: Readonly<Record<string, string>>
}

export interface SignResult {
  readonly keyId: string
  readonly keyVersion: string                      // explicit version for historical verification
  readonly algorithm: Algorithm
  readonly signature: Uint8Array
  readonly publicKeyRef: PublicKeyRef              // how verifiers discover the verifying key
  readonly signedAt?: Date                         // optional provider-side timestamp for audit
}

export interface DeriveRequest {
  readonly keyId: string
  readonly algorithm: 'HMAC-SHA-256'
  readonly purpose: DeriveKeyPurpose
  readonly info: Uint8Array                        // caller-supplied input (e.g. canonical({iss, sub}))
  readonly outputLengthBytes?: number              // default 32
}

export interface DeriveResult {
  readonly keyId: string
  readonly keyVersion: string
  readonly output: Uint8Array
  readonly algorithm: 'HMAC-SHA-256'
}

// Re-export the foundational KeyPurpose union so consumers importing the
// KeyProvider contract from `@agent-commerce-trust/core` can also pull the
// purpose enum from the same place.
export type { KeyPurpose, SigningKeyPurpose, DeriveKeyPurpose }
