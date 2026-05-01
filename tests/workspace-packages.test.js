import assert from 'node:assert/strict'
import { test } from 'node:test'

import { packageRole as agentRole } from '@agent-commerce-trust/agent'
import { __namespace_reserved as agentMcpReserved } from '@agent-commerce-trust/agent-mcp'
import { packageRole as commerceMcpRole } from '@agent-commerce-trust/commerce-mcp'
import { packageRoles } from '@agent-commerce-trust/core'
import { packageRole as supplierRole } from '@agent-commerce-trust/supplier'
import { packageRole as verifierRole } from '@agent-commerce-trust/verifier'
import { __namespace_reserved as witnessReserved } from '@agent-commerce-trust/witness'

test('phase-1 packages expose package roles', () => {
  assert.equal(packageRoles.core, 'shared primitives')
  assert.equal(commerceMcpRole, 'supplier MCP server kit')
  assert.equal(supplierRole, 'supplier primitives')
  assert.equal(verifierRole, 'receipt verifier')
  assert.equal(agentRole, 'agent mandate-chain plumbing')
})

test('deferred namespace packages expose reservation stubs', () => {
  assert.equal(agentMcpReserved, true)
  assert.equal(witnessReserved, true)
})
