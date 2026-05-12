export type {
  KeyProvider,
  KeyRef,
  SigningKeyRef,
  DeriveKeyRef,
  SignRequest,
  SignResult,
  DeriveRequest,
  DeriveResult,
} from './types.js'

export type { SigningEvent } from './signing-event.js'

export {
  PAYLOAD_TYPE_PURPOSE_MAP,
  validatePayloadTypePurpose,
} from './payload-type-mapping.js'
