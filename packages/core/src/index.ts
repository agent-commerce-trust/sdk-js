export const packageRole = 'shared primitives'

export const packageRoles = Object.freeze({
  core: 'shared primitives',
  agent: 'agent mandate-chain plumbing',
  commerceMcp: 'supplier MCP server kit',
  supplier: 'supplier primitives',
  verifier: 'receipt verifier',
} as const)

export {
  canonicalize,
  canonicalBytes,
  sha256Hex,
  sha384Hex,
} from './canonical.js'

export type * from './types/index.js'

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
