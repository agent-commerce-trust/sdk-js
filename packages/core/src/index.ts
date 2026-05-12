export {
  canonicalize,
  canonicalBytes,
  sha256Hex,
  sha384Hex,
} from './canonical.js'

export type * from './types/index.js'
export type * from './keys/index.js'

export {
  PAYLOAD_TYPE_PURPOSE_MAP,
  validatePayloadTypePurpose,
} from './keys/payload-type-mapping.js'

export { buildSigningInput } from './keys/signing-input.js'

export type * from './mandates/index.js'
export {
  createIntentMandate,
  validateIntentMandate,
  createCartMandate,
  validateCartMandate,
  createPaymentMandate,
  validatePaymentMandate,
} from './mandates/index.js'

export {
  TrustLayerError,
  CanonicalizationError,
  MandateError,
  VerificationError,
  KeyProviderError,
  KeyNotFoundError,
  KeyPurposeMismatchError,
  KeyPurposePayloadTypeMismatchError,
  KeyExpiredError,
  KeyRevokedError,
  KmsUnavailableError,
  AlgorithmUnsupportedError,
  RateLimitExceededError,
} from './errors.js'
export type { TrustLayerErrorOptions } from './errors.js'
