/**
 * Trust layer error hierarchy per §7.1 of the canonical SDK doc at
 * `docs/domains/auth/trust-layer-sdk.md`. All errors carry a stable
 * `code` string for telemetry +
 * cross-language verification audit logs; consumers discriminate via
 * `instanceof` and never via string matching on `message` or `code`.
 *
 * Hierarchy:
 *
 *   TrustLayerError
 *   ├── CanonicalizationError       (code: 'canonicalization')
 *   ├── MandateError                (code: 'mandate')
 *   ├── VerificationError           (code: 'verification')
 *   └── KeyProviderError            (code: caller-supplied or fixed by child)
 *       ├── KeyNotFoundError                     (code: 'key-not-found')
 *       ├── KeyPurposeMismatchError              (code: 'key-purpose-mismatch')
 *       ├── KeyPurposePayloadTypeMismatchError   (code: 'key-purpose-payload-type-mismatch')
 *       ├── KeyExpiredError                      (code: 'key-expired')
 *       ├── KeyRevokedError                      (code: 'key-revoked')
 *       ├── KmsUnavailableError                  (code: 'kms-unavailable')
 *       ├── AlgorithmUnsupportedError            (code: 'algorithm-unsupported')
 *       └── RateLimitExceededError               (code: 'rate-limit-exceeded')
 */

export interface TrustLayerErrorOptions {
  readonly cause?: unknown
}

export class TrustLayerError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: TrustLayerErrorOptions) {
    super(message, options as ErrorOptions)
    this.code = code
    this.name = new.target.name
  }
}

export class CanonicalizationError extends TrustLayerError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('canonicalization', message, options)
  }
}

export class MandateError extends TrustLayerError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('mandate', message, options)
  }
}

export class VerificationError extends TrustLayerError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('verification', message, options)
  }
}

export class KeyProviderError extends TrustLayerError {
  constructor(code: string, message: string, options?: TrustLayerErrorOptions) {
    super(code, message, options)
  }
}

export class KeyNotFoundError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('key-not-found', message, options)
  }
}

export class KeyPurposeMismatchError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('key-purpose-mismatch', message, options)
  }
}

export class KeyPurposePayloadTypeMismatchError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('key-purpose-payload-type-mismatch', message, options)
  }
}

export class KeyExpiredError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('key-expired', message, options)
  }
}

export class KeyRevokedError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('key-revoked', message, options)
  }
}

export class KmsUnavailableError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('kms-unavailable', message, options)
  }
}

export class AlgorithmUnsupportedError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('algorithm-unsupported', message, options)
  }
}

export class RateLimitExceededError extends KeyProviderError {
  constructor(message: string, options?: TrustLayerErrorOptions) {
    super('rate-limit-exceeded', message, options)
  }
}
