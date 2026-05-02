import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  AP2_TRAVEL_PROFILE_ID,
  assertTravelMandateType,
  canonicalize,
  sha256Hex,
} from '@ap2-travel/profile'
import {
	canonicalize as coreCanonicalize,
	packageRole as corePackageRole,
	packageRoles,
	sha256Hex as coreSha256Hex,
} from '@agent-commerce-trust/core'

const phaseOnePackages = ['core', 'agent', 'commerce-mcp', 'supplier', 'verifier']

test('sdk-js consumes @ap2-travel/profile as a package dependency', () => {
	assert.equal(AP2_TRAVEL_PROFILE_ID, 'ap2-travel')
	assert.equal(assertTravelMandateType('cart'), 'cart')
	assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
	assert.equal(sha256Hex({ mandateType: 'receipt', profile: AP2_TRAVEL_PROFILE_ID }).length, 64)
})

test('workspace package stub is importable alongside profile dependency', () => {
	assert.equal(corePackageRole, 'shared primitives')
	assert.equal(packageRoles.core, 'shared primitives')
})

test('core re-exports canonical serialization helpers from the AP2 Travel profile', () => {
	assert.equal(coreCanonicalize({ b: 2, a: 1 }), canonicalize({ b: 2, a: 1 }))
	assert.equal(
		coreSha256Hex({ mandateType: 'receipt', profile: AP2_TRAVEL_PROFILE_ID }),
		sha256Hex({ mandateType: 'receipt', profile: AP2_TRAVEL_PROFILE_ID }),
	)
})

test('phase-1 packages declare the AP2 Travel profile prerequisite', async () => {
	for (const packageDir of phaseOnePackages) {
		const manifest = JSON.parse(
			await readFile(new URL(`../packages/${packageDir}/package.json`, import.meta.url), 'utf8'),
		)

		assert.equal(
			manifest.dependencies?.['@ap2-travel/profile'],
			'^0.1.0-rc.1',
			`${manifest.name} must declare @ap2-travel/profile`,
		)
	}
})

test('workspace lockfile tracks the canonical AP2 Travel profile scaffold version', async () => {
	const [lockfile, profileManifest] = await Promise.all([
		readJson(new URL('../package-lock.json', import.meta.url)),
		readJson(new URL('../../ap2-travel/packages/profile/package.json', import.meta.url)),
	])

	assert.equal(
		lockfile.packages?.['../ap2-travel/packages/profile']?.version,
		profileManifest.version,
		'local file dependency lock entry must match canonical @ap2-travel/profile',
	)
})

async function readJson(url) {
	return JSON.parse(await readFile(url, 'utf8'))
}
