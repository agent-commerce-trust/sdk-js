/**
 * `SigningEvent` discriminated union per §7.1 of the canonical trust-layer
 * SDK doc at `docs/domains/auth/trust-layer-sdk.md`. Emitted by
 * `KeyProvider.onSigningEvent` (optional audit hook) so regulated
 * deployments can stream every signing event to an audit log. Six variants
 * cover the full sign + derive request/result/error lifecycle.
 *
 * Depends on `KeyProviderError` from the error hierarchy, which is why this
 * type lives in the `keys/` module alongside the contract types rather than
 * in the standalone foundational `types/` directory.
 */
import type { KeyProviderError } from '../errors.js'
import type {
  SigningKeyPurpose,
  DeriveKeyPurpose,
} from '../types/key-purpose.js'

export type SigningEvent =
  | {
      readonly type: 'sign-request'
      readonly keyId: string
      readonly purpose: SigningKeyPurpose
      readonly at: Date
    }
  | {
      readonly type: 'sign-result'
      readonly keyId: string
      readonly keyVersion: string
      readonly at: Date
    }
  | {
      readonly type: 'sign-error'
      readonly keyId: string
      readonly error: KeyProviderError
      readonly at: Date
    }
  | {
      readonly type: 'derive-request'
      readonly keyId: string
      readonly purpose: DeriveKeyPurpose
      readonly at: Date
    }
  | {
      readonly type: 'derive-result'
      readonly keyId: string
      readonly keyVersion: string
      readonly at: Date
    }
  | {
      readonly type: 'derive-error'
      readonly keyId: string
      readonly error: KeyProviderError
      readonly at: Date
    }
