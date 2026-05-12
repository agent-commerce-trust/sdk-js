/**
 * Conformance — canonical-bytes byte-stability.
 *
 * Walks every row of the shared reference fixture table and asserts:
 *   - canonicalize(input)  === canonical string (byte-stable across runs)
 *   - canonicalBytes(input).length matches the UTF-8-encoded canonical string length
 *   - sha256Hex(input) === reference SHA-256 hex
 *   - sha384Hex(input) === reference SHA-384 hex
 *
 * The base assertions also live in `tests/core-canonical.test.js`; this
 * file packages them as part of the rc.1 conformance suite so a single
 * `node --test tests/core-conformance-*.test.js` invocation can attest
 * the package's conformance posture.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	canonicalize,
	canonicalBytes,
	sha256Hex,
	sha384Hex,
} from '@agent-commerce-trust/core'
import { canonicalReferenceFixtures } from './_fixtures/canonical-fixtures.mjs'

const textEncoder = new TextEncoder()

test('canonicalize is byte-stable across every reference fixture', () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			canonicalize(fixture.input),
			fixture.canonical,
			`canonicalize mismatch for fixture '${fixture.name}'`,
		)
	}
})

test('canonicalize is idempotent: re-canonicalising parsed canonical bytes yields identical bytes', () => {
	for (const fixture of canonicalReferenceFixtures) {
		const first = canonicalize(fixture.input)
		const reparsed = JSON.parse(first)
		const second = canonicalize(reparsed)
		assert.equal(
			second,
			first,
			`re-canonicalise drift for fixture '${fixture.name}': '${first}' → JSON.parse → canonicalize → '${second}'`,
		)
	}
})

test('canonicalBytes returns the UTF-8 encoding of canonicalize output', () => {
	for (const fixture of canonicalReferenceFixtures) {
		const bytes = canonicalBytes(fixture.input)
		const expected = textEncoder.encode(fixture.canonical)
		assert.deepEqual(
			Array.from(bytes),
			Array.from(expected),
			`canonicalBytes drift for fixture '${fixture.name}'`,
		)
	}
})

test('sha256Hex matches the reference table for every fixture', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		const digest = await sha256Hex(fixture.input)
		assert.equal(digest, fixture.sha256, `sha256Hex drift for '${fixture.name}'`)
		assert.equal(digest.length, 64, 'sha256Hex must be 64 hex chars (32 bytes)')
	}
})

test('sha384Hex matches the reference table for every fixture', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		const digest = await sha384Hex(fixture.input)
		assert.equal(digest, fixture.sha384, `sha384Hex drift for '${fixture.name}'`)
		assert.equal(digest.length, 96, 'sha384Hex must be 96 hex chars (48 bytes)')
	}
})
