const assert = require('node:assert/strict')
const { test } = require('node:test')

const agent = require('@agent-commerce-trust/agent')
const agentMcp = require('@agent-commerce-trust/agent-mcp')
const commerceMcp = require('@agent-commerce-trust/commerce-mcp')
const core = require('@agent-commerce-trust/core')
const coreDev = require('@agent-commerce-trust/core/dev')
const supplier = require('@agent-commerce-trust/supplier')
const verifier = require('@agent-commerce-trust/verifier')
const witness = require('@agent-commerce-trust/witness')

test('CommonJS entrypoint for core exposes the real rc.1 public surface', async () => {
  // Canonical + hashing helpers (PR 3 surface)
  assert.equal(typeof core.canonicalize, 'function')
  assert.equal(typeof core.canonicalBytes, 'function')
  assert.equal(typeof core.sha256Hex, 'function')
  assert.equal(typeof core.sha384Hex, 'function')
  assert.equal(core.canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')

  // Error hierarchy (PR 2 surface) — discriminate via instanceof per §7.1 rule
  assert.equal(typeof core.TrustLayerError, 'function')
  assert.equal(typeof core.KeyProviderError, 'function')
  assert.equal(typeof core.KeyPurposePayloadTypeMismatchError, 'function')
  const err = new core.KeyNotFoundError('test key')
  assert.equal(err.code, 'key-not-found')
  assert.ok(err instanceof core.KeyProviderError)
  assert.ok(err instanceof core.TrustLayerError)

  // payloadType → purpose mapping (the prior PR 5 runtime surface)
  assert.ok(core.PAYLOAD_TYPE_PURPOSE_MAP instanceof Map)
  assert.equal(typeof core.validatePayloadTypePurpose, 'function')
  assert.equal(
    core.PAYLOAD_TYPE_PURPOSE_MAP.get('ap2.IntentMandate/v1'),
    'sign-intent-mandate',
  )

  // AP2 mandate helpers (the prior PR 7 runtime surface)
  assert.equal(typeof core.createIntentMandate, 'function')
  assert.equal(typeof core.validateIntentMandate, 'function')
  assert.equal(typeof core.createCartMandate, 'function')
  assert.equal(typeof core.validateCartMandate, 'function')
  assert.equal(typeof core.createPaymentMandate, 'function')
  assert.equal(typeof core.validatePaymentMandate, 'function')
  const intent = core.createIntentMandate({ goal: 'cjs' }, {
    expiresAt: new Date(Date.now() + 60_000),
    issuer: 'did:web:cjs.example.com',
  })
  assert.equal(intent.payloadType, 'ap2.IntentMandate/v1')
  core.validateIntentMandate(intent)
})

test('CommonJS entrypoint for @agent-commerce-trust/core/dev resolves and exposes InMemoryKeyProvider', async () => {
  // /dev subpath resolution check (PR 6 exit gate: ESM + CJS coverage).
  assert.equal(typeof coreDev.InMemoryKeyProvider, 'function')
  const provider = new coreDev.InMemoryKeyProvider({ providerId: 'cjs-test' })
  assert.equal(provider.providerId, 'cjs-test')
  // derive is intentionally omitted (optional KeyProvider method)
  assert.equal(provider.derive, undefined)
})

test('CommonJS entrypoints for non-core Phase-1 packages expose package roles (scaffold metadata)', () => {
  // These packages are still at 0.1.0-rc.0 stub state per LANE_PROGRESS B7.
  // packageRole metadata stays on them until each package's own rc.1
  // buildout lands (Track 4 PR 4+, then Track 5 per the spec).
  assert.equal(agent.packageRole, 'agent mandate-chain plumbing')
  assert.equal(commerceMcp.packageRole, 'supplier MCP server kit')
  assert.equal(supplier.packageRole, 'supplier primitives')
  assert.equal(verifier.packageRole, 'receipt verifier')
})

test('CommonJS entrypoints for deferred namespace packages expose reservation stubs', () => {
  assert.equal(agentMcp.__namespace_reserved, true)
  assert.equal(witness.__namespace_reserved, true)
})
