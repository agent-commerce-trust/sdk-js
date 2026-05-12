/**
 * Conformance — every public export resolves through ESM, CJS, and
 * type-only barrels at both `@agent-commerce-trust/core` and
 * `@agent-commerce-trust/core/dev`.
 *
 * The dynamic `require()` half of this file exercises the CJS subpath
 * resolver via a Node-bootstrapped `createRequire`, so the test does
 * not depend on the file's own module format. (Other tests still use
 * a `.cjs` extension where appropriate — this file deliberately runs
 * under ESM so the same import names are checked once each way.)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'

import * as coreEsm from '@agent-commerce-trust/core'
import * as coreDevEsm from '@agent-commerce-trust/core/dev'

const require = createRequire(import.meta.url)

const CORE_RUNTIME_NAMES = [
	'canonicalize',
	'canonicalBytes',
	'sha256Hex',
	'sha384Hex',
	'TrustLayerError',
	'CanonicalizationError',
	'MandateError',
	'VerificationError',
	'KeyProviderError',
	'KeyNotFoundError',
	'KeyPurposeMismatchError',
	'KeyPurposePayloadTypeMismatchError',
	'KeyExpiredError',
	'KeyRevokedError',
	'KmsUnavailableError',
	'AlgorithmUnsupportedError',
	'RateLimitExceededError',
	'PAYLOAD_TYPE_PURPOSE_MAP',
	'validatePayloadTypePurpose',
	'buildSigningInput',
	'createIntentMandate',
	'validateIntentMandate',
	'createCartMandate',
	'validateCartMandate',
	'createPaymentMandate',
	'validatePaymentMandate',
]

const CORE_DEV_RUNTIME_NAMES = ['InMemoryKeyProvider']

test('@agent-commerce-trust/core: every documented runtime export is reachable via ESM import', () => {
	for (const name of CORE_RUNTIME_NAMES) {
		assert.ok(
			Object.prototype.hasOwnProperty.call(coreEsm, name),
			`ESM core export missing: '${name}'`,
		)
		assert.notEqual(coreEsm[name], undefined, `ESM core export is undefined: '${name}'`)
	}
})

test('@agent-commerce-trust/core: every documented runtime export is reachable via CJS require', () => {
	const coreCjs = require('@agent-commerce-trust/core')
	for (const name of CORE_RUNTIME_NAMES) {
		assert.ok(
			Object.prototype.hasOwnProperty.call(coreCjs, name),
			`CJS core export missing: '${name}'`,
		)
		assert.notEqual(coreCjs[name], undefined, `CJS core export is undefined: '${name}'`)
	}
})

test('@agent-commerce-trust/core/dev: InMemoryKeyProvider resolves via ESM AND CJS', () => {
	for (const name of CORE_DEV_RUNTIME_NAMES) {
		assert.ok(Object.prototype.hasOwnProperty.call(coreDevEsm, name), `ESM /dev export missing: '${name}'`)
	}
	const coreDevCjs = require('@agent-commerce-trust/core/dev')
	for (const name of CORE_DEV_RUNTIME_NAMES) {
		assert.ok(Object.prototype.hasOwnProperty.call(coreDevCjs, name), `CJS /dev export missing: '${name}'`)
	}
})

test('@agent-commerce-trust/core/dev: ESM and CJS expose the same runtime symbol set', () => {
	// Symmetric with the equivalent check on the package root above — guards
	// /dev against future ESM/CJS drift the same way.
	const coreDevCjs = require('@agent-commerce-trust/core/dev')
	const esmRuntimeNames = Object.keys(coreDevEsm)
		.filter((k) => typeof coreDevEsm[k] !== 'undefined')
		.sort()
	const cjsRuntimeNames = Object.keys(coreDevCjs)
		.filter((k) => typeof coreDevCjs[k] !== 'undefined' && k !== 'default' && k !== '__esModule')
		.sort()
	assert.deepEqual(
		esmRuntimeNames,
		cjsRuntimeNames,
		'ESM and CJS /dev runtime symbol sets must be identical',
	)
})

test('@agent-commerce-trust/core: type declarations exist at the declared paths', async () => {
	// The package.json `exports['.']?.types` and `exports['./dev']?.types`
	// declare type-file paths. Conformance: those files must exist on disk
	// in the built artifact. The dependency-graph invariant test asserts
	// the package.json shape; here we confirm the files actually exist.
	const { readFile, access } = await import('node:fs/promises')
	const manifest = JSON.parse(
		await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
	)
	for (const subpath of ['.', './dev']) {
		const typesPath = manifest.exports?.[subpath]?.types
		assert.equal(typeof typesPath, 'string', `manifest.exports['${subpath}'].types must be a string`)
		const absolute = new URL(`../packages/core/${typesPath}`, import.meta.url)
		await access(absolute) // throws if missing
	}
})

test('@agent-commerce-trust/core: ESM and CJS expose the same runtime symbol set', () => {
	const coreCjs = require('@agent-commerce-trust/core')
	const esmRuntimeNames = Object.keys(coreEsm).filter((k) => typeof coreEsm[k] !== 'undefined').sort()
	const cjsRuntimeNames = Object.keys(coreCjs)
		.filter((k) => typeof coreCjs[k] !== 'undefined' && k !== 'default' && k !== '__esModule')
		.sort()
	assert.deepEqual(
		esmRuntimeNames,
		cjsRuntimeNames,
		'ESM and CJS runtime symbol sets must be identical',
	)
})
