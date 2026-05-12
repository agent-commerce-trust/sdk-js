import assert from 'node:assert/strict'
import { test } from 'node:test'

import { packageRole as agentRole } from '@agent-commerce-trust/agent'
import { __namespace_reserved as agentMcpReserved } from '@agent-commerce-trust/agent-mcp'
import { packageRole as commerceMcpRole } from '@agent-commerce-trust/commerce-mcp'
import {
  canonicalize as coreCanonicalize,
  sha256Hex as coreSha256Hex,
  TrustLayerError,
  KeyProviderError,
  KeyNotFoundError,
} from '@agent-commerce-trust/core'
import { packageRole as supplierRole } from '@agent-commerce-trust/supplier'
import { packageRole as verifierRole } from '@agent-commerce-trust/verifier'
import { __namespace_reserved as witnessReserved } from '@agent-commerce-trust/witness'

test('core exposes the rc.1 public surface (canonical helpers + error hierarchy)', async () => {
  // Every public export on core at rc.1 traces to §5.1 (package entry
  // criteria) or §7 (normative contract) of the canonical SDK doc at
  // `docs/domains/auth/trust-layer-sdk.md`. Scaffold
  // `packageRole`/`packageRoles` metadata is intentionally absent here;
  // it stays only on the not-yet-published Phase-1 stubs.
  assert.equal(coreCanonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
  assert.equal((await coreSha256Hex({ a: 1, b: 2 })).length, 64)
  const err = new KeyNotFoundError('test')
  assert.equal(err.code, 'key-not-found')
  assert.ok(err instanceof KeyProviderError)
  assert.ok(err instanceof TrustLayerError)
})

test('non-core phase-1 packages expose package roles (scaffold metadata; pre-rc.1)', () => {
  assert.equal(commerceMcpRole, 'supplier MCP server kit')
  assert.equal(supplierRole, 'supplier primitives')
  assert.equal(verifierRole, 'receipt verifier')
  assert.equal(agentRole, 'agent mandate-chain plumbing')
})

test('deferred namespace packages expose reservation stubs', () => {
  assert.equal(agentMcpReserved, true)
  assert.equal(witnessReserved, true)
})
