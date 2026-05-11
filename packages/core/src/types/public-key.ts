import type { Algorithm } from './algorithm.js'

export interface PublicKey {
  readonly kty: 'OKP' | 'EC'
  readonly algorithm: Algorithm
  readonly encoded: Uint8Array
  readonly version: string
  readonly did?: string
}
