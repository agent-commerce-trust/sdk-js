import type { Algorithm } from './algorithm.js'
import type { KeyPurpose } from './key-purpose.js'

export interface KeyScope {
  readonly purpose?: KeyPurpose
  readonly subject?: string
  readonly algorithm?: Algorithm
}
