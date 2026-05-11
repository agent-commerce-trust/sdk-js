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

// Phase-1 packages that depend on @ap2-travel/profile as a vertical-profile
// extension. `core` is intentionally excluded — per `Invariant A` of the
// TRUST_LAYER_SDK_PUBLIC_BUILDOUT spec (and §7.1 of the canonical SDK doc),
// `@agent-commerce-trust/core` is profile-neutral: profiles depend on core,
// never the reverse.
const profileConsumingPhaseOnePackages = ['agent', 'commerce-mcp', 'supplier', 'verifier']

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

test('core canonical helpers produce identical bytes to the AP2 Travel profile reference', async () => {
	const sample = { b: 2, a: 1, nested: { z: 'last', a: 'first' } }
	assert.equal(coreCanonicalize(sample), canonicalize(sample))
	assert.equal(
		await coreSha256Hex({ mandateType: 'receipt', profile: AP2_TRAVEL_PROFILE_ID }),
		sha256Hex({ mandateType: 'receipt', profile: AP2_TRAVEL_PROFILE_ID }),
	)
})

test('core is profile-neutral — no @ap2-travel/* in runtime deps (Invariant A)', async () => {
	const manifest = JSON.parse(
		await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
	)
	for (const depMap of [manifest.dependencies, manifest.peerDependencies, manifest.optionalDependencies]) {
		for (const dep of Object.keys(depMap ?? {})) {
			assert.equal(
				dep.startsWith('@ap2-travel/'),
				false,
				`@agent-commerce-trust/core must not depend on ${dep} (Invariant A — profile-neutral core)`,
			)
		}
	}
})

test('profile-consuming phase-1 packages declare the AP2 Travel profile prerequisite', async () => {
	for (const packageDir of profileConsumingPhaseOnePackages) {
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
