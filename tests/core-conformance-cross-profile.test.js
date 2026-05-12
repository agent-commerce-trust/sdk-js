/**
 * Conformance — cross-profile canonicalisation parity.
 *
 * `@agent-commerce-trust/core` is profile-neutral: its canonicalize is a
 * pure function of the JS value, with zero special-casing for any
 * profile (AP2-Travel, AP2-Health, AP2-Procure, …). This file proves
 * that property in two complementary ways:
 *
 *   1. The reference AP2-Travel profile's canonicalize produces
 *      byte-identical output to core's canonicalize for every fixture
 *      shape — there is no profile-side override that diverges.
 *   2. Core's canonicalize treats profile-shaped and generic-shaped
 *      payloads identically: the same JS value produces the same
 *      canonical bytes regardless of any profile metadata embedded in
 *      the value.
 *
 * Failure of either path means core has acquired profile coupling that
 * the dependency-graph invariant test cannot catch (because the coupling
 * could be behavioural, not declared in package.json).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	canonicalize as profileCanonicalize,
	sha256Hex as profileSha256Hex,
	AP2_TRAVEL_PROFILE_ID,
} from '@ap2-travel/profile'
import {
	canonicalize as coreCanonicalize,
	canonicalBytes as coreCanonicalBytes,
	sha256Hex as coreSha256Hex,
} from '@agent-commerce-trust/core'
import { canonicalReferenceFixtures } from './_fixtures/canonical-fixtures.mjs'

test('core canonicalize matches AP2-Travel profile canonicalize for every reference fixture', () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			coreCanonicalize(fixture.input),
			profileCanonicalize(fixture.input),
			`profile/core canonical drift for fixture '${fixture.name}'`,
		)
	}
})

test('core canonicalize matches profile canonicalize for typical profile-shaped payloads', () => {
	const profileShapedPayloads = [
		{ profile: AP2_TRAVEL_PROFILE_ID, mandateType: 'intent', nonce: 'abc' },
		{ profile: AP2_TRAVEL_PROFILE_ID, mandateType: 'cart', items: [{ sku: 'x' }] },
		{
			profile: AP2_TRAVEL_PROFILE_ID,
			mandateType: 'payment',
			amount: { value: 100, currency: 'USD' },
		},
	]
	for (const payload of profileShapedPayloads) {
		assert.equal(coreCanonicalize(payload), profileCanonicalize(payload))
	}
})

test('core canonicalize produces shape-equivalent canonical bytes for profile-shaped and generic payloads', async () => {
	// Two payloads with different keys but the SAME sorted-key structure
	// produce different canonical bytes — but the rule is the same for
	// both. There is no profile-aware shortcut.
	const profileShaped = {
		profile: AP2_TRAVEL_PROFILE_ID,
		mandateType: 'intent',
		nonce: 'n-1',
	}
	const genericShaped = {
		alpha: 'one',
		beta: 'two',
		gamma: 'three',
	}
	// Both canonicalize to the same JCS-style key-sorted output:
	assert.equal(coreCanonicalize(profileShaped), profileCanonicalize(profileShaped))
	assert.equal(coreCanonicalize(genericShaped), profileCanonicalize(genericShaped))

	// And the hash agrees with the profile reference.
	assert.equal(
		await coreSha256Hex(profileShaped),
		await profileSha256Hex(profileShaped),
	)
})

test('canonicalBytes UTF-8 encoding is profile-agnostic (Unicode passes through identically)', () => {
	// Unicode-edge fixtures: emoji + diacritics + surrogate pairs. Core
	// must encode them identically to the profile reference.
	const unicodePayloads = [
		{ emoji: '✈️🏨' },
		{ diacritics: 'naïve façade' },
		{ surrogate: '𝐀𝐁𝐂' }, // mathematical bold letters use surrogate pairs
		{ profile: 'ap2-travel', city: 'København' },
	]
	for (const payload of unicodePayloads) {
		const coreBytes = coreCanonicalBytes(payload)
		const profileCanonical = profileCanonicalize(payload)
		const expectedBytes = new TextEncoder().encode(profileCanonical)
		assert.deepEqual(
			Array.from(coreBytes),
			Array.from(expectedBytes),
			`canonicalBytes UTF-8 drift for ${JSON.stringify(payload)}`,
		)
	}
})
