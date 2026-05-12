/**
 * Surface-traceability invariant for `@agent-commerce-trust/core` and
 * `@agent-commerce-trust/core/dev`. Every public export at rc.1 must
 * trace to either:
 *
 *   - §5.1 of the canonical SDK doc (rc.1 entry criteria), or
 *   - §7   of the canonical SDK doc (normative contract).
 *
 * Both anchors live at `docs/domains/auth/trust-layer-sdk.md`. This test
 * machine-enforces the surface allowlist: any unexpected runtime export
 * fails the test (prevents surface creep), and any missing expected
 * export also fails (prevents accidental surface shrinkage).
 *
 * Type-only exports are not enumerated here — TypeScript itself enforces
 * their existence at compile time and they have no runtime presence.
 *
 * The allowlist is a hand-maintained ledger. Adding a new public runtime
 * export requires editing this file at the same time, which is the
 * intended design: changes to the rc.1 surface should be explicit,
 * reviewable, and anchored to a doc section. If the allowlist diverges
 * from intent, a future generation step (e.g. parsing the canonical
 * doc's §5.1 / §7 enumeration into a manifest) can replace this manual
 * ledger; for rc.1 the manual ledger is the trade-off we accept.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as core from '@agent-commerce-trust/core'
import * as coreDev from '@agent-commerce-trust/core/dev'

const CORE_RUNTIME_ALLOWLIST = {
	// §5.1 — canonical helpers
	canonicalize: '§5.1',
	canonicalBytes: '§5.1',
	sha256Hex: '§5.1',
	sha384Hex: '§5.1',
	// §7.1 — typed error hierarchy
	TrustLayerError: '§7.1',
	CanonicalizationError: '§7.1',
	MandateError: '§7.1',
	VerificationError: '§7.1',
	KeyProviderError: '§7.1',
	KeyNotFoundError: '§7.1',
	KeyPurposeMismatchError: '§7.1',
	KeyPurposePayloadTypeMismatchError: '§7.1',
	KeyExpiredError: '§7.1',
	KeyRevokedError: '§7.1',
	KmsUnavailableError: '§7.1',
	AlgorithmUnsupportedError: '§7.1',
	RateLimitExceededError: '§7.1',
	// §7.1 — payloadType ↔ purpose coordination
	PAYLOAD_TYPE_PURPOSE_MAP: '§7.1',
	validatePayloadTypePurpose: '§7.1',
	// §7.1 — domain-separated signing input construction
	buildSigningInput: '§7.1',
	// §5.1 — AP2 base mandate construction + validation
	createIntentMandate: '§5.1',
	validateIntentMandate: '§5.1',
	createCartMandate: '§5.1',
	validateCartMandate: '§5.1',
	createPaymentMandate: '§5.1',
	validatePaymentMandate: '§5.1',
}

const CORE_DEV_RUNTIME_ALLOWLIST = {
	// §5.1 — "signature helper interfaces with fixture key providers"
	InMemoryKeyProvider: '§5.1',
}

function actualRuntimeExports(namespace) {
	return Object.keys(namespace).filter((k) => typeof namespace[k] !== 'undefined')
}

test('every runtime export of @agent-commerce-trust/core traces to §5.1 or §7', () => {
	const allowed = new Set(Object.keys(CORE_RUNTIME_ALLOWLIST))
	const actual = new Set(actualRuntimeExports(core))

	const unexpected = [...actual].filter((k) => !allowed.has(k))
	assert.deepEqual(
		unexpected,
		[],
		`Unexpected runtime exports on @agent-commerce-trust/core — every export must trace to §5.1 or §7 of trust-layer-sdk.md: ${unexpected.join(', ')}`,
	)

	const missing = [...allowed].filter((k) => !actual.has(k))
	assert.deepEqual(
		missing,
		[],
		`Expected exports are missing from @agent-commerce-trust/core: ${missing.join(', ')}`,
	)
})

test('every runtime export of @agent-commerce-trust/core/dev traces to §5.1', () => {
	const allowed = new Set(Object.keys(CORE_DEV_RUNTIME_ALLOWLIST))
	const actual = new Set(actualRuntimeExports(coreDev))

	const unexpected = [...actual].filter((k) => !allowed.has(k))
	assert.deepEqual(
		unexpected,
		[],
		`Unexpected runtime exports on @agent-commerce-trust/core/dev: ${unexpected.join(', ')}`,
	)

	const missing = [...allowed].filter((k) => !actual.has(k))
	assert.deepEqual(
		missing,
		[],
		`Expected exports missing from @agent-commerce-trust/core/dev: ${missing.join(', ')}`,
	)
})

test('the allowlist itself is internally consistent', () => {
	// Every value must be one of the two anchors we accept; guards against
	// typos and future allowlist expansions that drift away from the contract.
	for (const [name, anchor] of Object.entries(CORE_RUNTIME_ALLOWLIST)) {
		assert.match(
			anchor,
			/^§(?:5\.1|7(?:\.\d+)?)$/,
			`allowlist anchor for '${name}' must be §5.1 or §7.X, got '${anchor}'`,
		)
	}
	for (const [name, anchor] of Object.entries(CORE_DEV_RUNTIME_ALLOWLIST)) {
		assert.match(
			anchor,
			/^§(?:5\.1|7(?:\.\d+)?)$/,
			`/dev allowlist anchor for '${name}' must be §5.1 or §7.X, got '${anchor}'`,
		)
	}
})
