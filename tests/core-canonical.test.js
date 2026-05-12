import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	canonicalize,
	canonicalBytes,
	sha256Hex,
	sha384Hex,
} from '@agent-commerce-trust/core'
import { canonicalReferenceFixtures } from './_fixtures/canonical-fixtures.mjs'

test('canonicalize sorts object keys lexicographically by UTF-16 code unit (RFC 8785 §3.2.3)', () => {
	assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}')
	assert.equal(canonicalize({ z: 1, a: 2, m: 3 }), '{"a":2,"m":3,"z":1}')
})

test('canonicalize sorts surrogate-pair keys by UTF-16 code unit, not codepoint', () => {
	// Math bold A is codepoint U+1D400 but UTF-16 encodes it as the surrogate
	// pair [0xD835, 0xDC00]. A codepoint sort would place it AFTER any BMP
	// character ≤ U+1D3FF; UTF-16 code-unit sort places 0xD835 BEFORE any
	// BMP code point ≥ 0xD836 (which includes the private-use area at U+E000).
	// RFC 8785 §3.2.3 requires the UTF-16 ordering.
	const bmpHigh = ''
	const surrogatePair = '\u{1D400}'
	const result = canonicalize({ [bmpHigh]: 1, [surrogatePair]: 2 })
	const surrogateIdx = result.indexOf(JSON.stringify(surrogatePair))
	const bmpIdx = result.indexOf(JSON.stringify(bmpHigh))
	assert.ok(
		surrogateIdx >= 0 && bmpIdx >= 0 && surrogateIdx < bmpIdx,
		`UTF-16 code-unit sort requires the surrogate-pair key (UTF-16 starts 0xD835) to sort before the BMP private-use key 0xE000; canonical was: ${result}`,
	)
})

test('canonicalize accepts strings composed of valid surrogate pairs', () => {
	const out = canonicalize({ math: '𝐀𝐁𝐂' })
	assert.match(out, /𝐀𝐁𝐂/)
})

test('canonicalize rejects strings containing a lone high surrogate (RFC 8785 §3.2.2.2)', () => {
	const lonely = '\uD835X'
	assert.throws(() => canonicalize({ k: lonely }), TypeError)
})

test('canonicalize rejects strings containing a lone low surrogate', () => {
	const lonely = 'X\uDC00'
	assert.throws(() => canonicalize({ k: lonely }), TypeError)
})

test('canonicalize rejects strings containing a reversed surrogate pair (low then high)', () => {
	// Reversed pair: 0xDC00 followed by 0xD835. Both are surrogates but the
	// ordering is invalid — the low precedes the high. Each surrogate is
	// effectively lone in this sequence; the leading low triggers the
	// rejection on first scan.
	const reversed = '\uDC00\uD835'
	assert.throws(() => canonicalize({ k: reversed }), TypeError)
})

test('canonicalize rejects object keys containing a lone surrogate', () => {
	const obj = { '\uD835key': 1 }
	assert.throws(() => canonicalize(obj), TypeError)
})

test('canonicalize rejects Map (would otherwise silently canonicalize as {})', () => {
	const m = new Map()
	m.set('a', 1)
	m.set('b', 2)
	assert.throws(() => canonicalize(m), TypeError)
})

test('canonicalize rejects Date / Set / RegExp / class instances', () => {
	assert.throws(() => canonicalize(new Date('2026-01-01T00:00:00Z')), TypeError)
	assert.throws(() => canonicalize(new Set([1, 2])), TypeError)
	assert.throws(() => canonicalize(/foo/), TypeError)
	class MyClass {
		constructor(x) { this.x = x }
	}
	assert.throws(() => canonicalize(new MyClass(1)), TypeError)
})

test('canonicalize accepts a null-prototype object (Object.create(null))', () => {
	const obj = Object.create(null)
	obj.a = 1
	obj.b = 2
	assert.equal(canonicalize(obj), '{"a":1,"b":2}')
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
