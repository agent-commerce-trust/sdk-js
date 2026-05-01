export declare const packageRole: 'shared primitives'

export declare const packageRoles: Readonly<{
  core: 'shared primitives'
  agent: 'agent mandate-chain plumbing'
  commerceMcp: 'supplier MCP server kit'
  supplier: 'supplier primitives'
  verifier: 'receipt verifier'
}>

export { canonicalize, canonicalBytes, sha256Hex } from '@ap2-travel/profile'
