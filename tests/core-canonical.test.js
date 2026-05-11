import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	canonicalize,
	canonicalBytes,
	sha256Hex,
	sha384Hex,
} from '@agent-commerce-trust/core'
import { canonicalReferenceFixtures } from './_fixtures/canonical-fixtures.mjs'

test('canonicalize sorts object keys lexicographically by Unicode code point', () => {
	assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
	assert.equal(canonicalize({ z: 1, a: 2, m: 3 }), '{"a":2,"m":3,"z":1}')
})

test('canonicalize recurses into nested objects and arrays', () => {
	const sample = { outer: { z: 'last', a: 'first' }, list: [{ k: 2, j: 1 }, 'x'] }
	assert.equal(
		canonicalize(sample),
		'{"list":[{"j":1,"k":2},"x"],"outer":{"a":"first","z":"last"}}',
	)
})

test('canonicalize handles primitives and null', () => {
	assert.equal(canonicalize(null), 'null')
	assert.equal(canonicalize(true), 'true')
	assert.equal(canonicalize(42), '42')
	assert.equal(canonicalize('hello'), '"hello"')
})

test('canonicalize drops undefined object properties', () => {
	assert.equal(canonicalize({ a: 1, b: undefined, c: 2 }), '{"a":1,"c":2}')
})

test('canonicalize rejects non-finite numbers', () => {
	assert.throws(() => canonicalize(Number.NaN), TypeError)
	assert.throws(() => canonicalize(Number.POSITIVE_INFINITY), TypeError)
	assert.throws(() => canonicalize(Number.NEGATIVE_INFINITY), TypeError)
})

test('canonicalBytes produces UTF-8 bytes matching canonicalize output', () => {
	const sample = { b: 2, a: 1 }
	const bytes = canonicalBytes(sample)
	const text = new TextDecoder().decode(bytes)
	assert.equal(text, canonicalize(sample))
})

test('sha256Hex returns Promise<string> of 64 hex characters', async () => {
	const hash = await sha256Hex({ b: 2, a: 1 })
	assert.equal(hash.length, 64)
	assert.match(hash, /^[0-9a-f]{64}$/)
})

test('sha384Hex returns Promise<string> of 96 hex characters', async () => {
	const hash = await sha384Hex({ b: 2, a: 1 })
	assert.equal(hash.length, 96)
	assert.match(hash, /^[0-9a-f]{96}$/)
})

test('sha256Hex is deterministic — same input produces same output', async () => {
	const value = { mandateType: 'receipt', amounts: [1, 2, 3] }
	const a = await sha256Hex(value)
	const b = await sha256Hex(value)
	assert.equal(a, b)
})

test('sha384Hex is deterministic — same input produces same output', async () => {
	const value = { mandateType: 'receipt', amounts: [1, 2, 3] }
	const a = await sha384Hex(value)
	const b = await sha384Hex(value)
	assert.equal(a, b)
})

test('sha256Hex is sensitive to key-value changes', async () => {
	const a = await sha256Hex({ a: 1, b: 2 })
	const b = await sha256Hex({ a: 1, b: 3 })
	assert.notEqual(a, b)
})

test('sha256Hex and sha384Hex agree on canonical-bytes input, disagree on hash output', async () => {
	const value = { a: 1, b: 2 }
	const h256 = await sha256Hex(value)
	const h384 = await sha384Hex(value)
	assert.equal(h256.length, 64)
	assert.equal(h384.length, 96)
	assert.notEqual(h256, h384.slice(0, 64))
})

test('canonicalize matches hardcoded reference fixtures', () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			canonicalize(fixture.input),
			fixture.canonical,
			`canonicalize mismatch for fixture '${fixture.name}'`,
		)
	}
})

test('sha256Hex matches hardcoded reference fixtures', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			await sha256Hex(fixture.input),
			fixture.sha256,
			`sha256Hex mismatch for fixture '${fixture.name}'`,
		)
	}
})

test('sha384Hex matches hardcoded reference fixtures', async () => {
	for (const fixture of canonicalReferenceFixtures) {
		assert.equal(
			await sha384Hex(fixture.input),
			fixture.sha384,
			`sha384Hex mismatch for fixture '${fixture.name}'`,
		)
	}
})
