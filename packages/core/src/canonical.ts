/**
 * Canonical JSON serialization + SHA-256/SHA-384 digests.
 *
 * The canonical encoding follows RFC 8785 "JSON Canonicalization Scheme":
 *   - object keys sorted lexicographically by UTF-16 code unit (per RFC §3.2.3),
 *   - `undefined` properties dropped,
 *   - arrays preserve order,
 *   - primitives stringified via JSON.stringify (ECMAScript number form is the
 *     RFC 8785 normative number representation),
 *   - non-finite numbers rejected,
 *   - strings containing lone (unpaired) surrogates rejected (per RFC §3.2.2.2
 *     — strings must be valid UTF-16),
 *   - only plain JSON objects (prototype `Object.prototype` or `null`) accepted
 *     as records; class instances, `Map`, `Date`, `Set`, etc. are rejected.
 *
 * Hashing uses the WebCrypto `globalThis.crypto.subtle.digest` API exclusively
 * (no `node:crypto` import). Node 20+ exposes `globalThis.crypto.subtle`
 * natively (matching `package.json` `engines.node: ">=20"`); browsers expose
 * it via the same global. Consequently `sha256Hex` / `sha384Hex` return
 * `Promise<string>` — callers must `await`.
 */

const textEncoder = new TextEncoder()

export function canonicalize(value: unknown): string {
  return stringifyCanonical(value)
}

export function canonicalBytes(value: unknown): Uint8Array {
  return textEncoder.encode(canonicalize(value))
}

export async function sha256Hex(value: unknown): Promise<string> {
  return digestHex('SHA-256', canonicalBytes(value))
}

export async function sha384Hex(value: unknown): Promise<string> {
  return digestHex('SHA-384', canonicalBytes(value))
}

async function digestHex(
  algorithm: 'SHA-256' | 'SHA-384',
  data: Uint8Array,
): Promise<string> {
  // Cast to BufferSource: TypeScript 5.7+ narrowed `Uint8Array` to
  // `Uint8Array<TBuffer extends ArrayBufferLike = ArrayBufferLike>`, while the
  // WebCrypto digest signature still accepts the looser `BufferSource`. The
  // runtime contract is unchanged.
  const hash = await globalThis.crypto.subtle.digest(algorithm, data as BufferSource)
  const bytes = new Uint8Array(hash)
  let out = ''
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}

function stringifyCanonical(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) {
      throw new TypeError(
        'Canonical JSON does not support strings containing lone (unpaired) surrogates',
      )
    }
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers')
    }
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(',')}]`
  }

  if (isPlainJsonObject(value)) {
    // Sort object keys by UTF-16 code unit, which is what the JavaScript `<`
    // / `>` operators do natively on strings — and what RFC 8785 §3.2.3
    // requires. Lone-surrogate keys are caught by the per-key
    // hasLoneSurrogate check below before sort, mirroring the value-side
    // string check above.
    for (const key of Object.keys(value)) {
      if (hasLoneSurrogate(key)) {
        throw new TypeError(
          `Canonical JSON does not support object keys containing lone surrogates; offending key: ${JSON.stringify(key)}`,
        )
      }
    }
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right))

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stringifyCanonical(entryValue)}`)
      .join(',')}}`
  }

  throw new TypeError(
    `Canonical JSON does not support values of type ${describeValue(value)}`,
  )
}

/**
 * Accepts only "plain" JSON-shaped objects: prototype is either
 * `Object.prototype` (object literals, `{ ...spread }`, `Object.assign(...)`)
 * or `null` (`Object.create(null)`). Rejects `Map`, `Set`, `Date`, `RegExp`,
 * `Error`, and class instances — those have non-Object prototypes and would
 * silently canonicalize as `{}` if passed through to `Object.entries`.
 */
function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function describeValue(value: unknown): string {
  if (value === null) return 'null'
  const type = typeof value
  if (type !== 'object') return type
  const proto = Object.getPrototypeOf(value)
  if (proto === null) return 'object (null-prototype)'
  if (proto === Object.prototype) return 'object'
  const ctorName = (proto as { constructor?: { name?: string } }).constructor?.name
  return `non-plain object (${ctorName ?? 'unknown class'})`
}

/**
 * Lexicographic comparison of two strings by UTF-16 code unit, matching
 * RFC 8785 §3.2.3 normative ordering. JavaScript's native `<` / `>` operators
 * on strings already perform code-unit comparison; we use them directly.
 */
function compareUtf16CodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Returns true if the string contains an unpaired surrogate (a high surrogate
 * U+D800–U+DBFF not followed by a low surrogate U+DC00–U+DFFF, or any low
 * surrogate not preceded by a high surrogate). RFC 8785 strings must be valid
 * UTF-16; lone surrogates have no UTF-8 representation and would round-trip
 * inconsistently across implementations.
 */
function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate — must be followed by a low surrogate.
      const next = value.charCodeAt(i + 1)
      if (Number.isNaN(next) || next < 0xDC00 || next > 0xDFFF) {
        return true
      }
      i += 1 // skip the validated low surrogate
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // Lone low surrogate (not preceded by a high surrogate in the same iteration).
      return true
    }
  }
  return false
}
