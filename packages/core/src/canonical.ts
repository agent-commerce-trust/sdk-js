/**
 * Canonical JSON serialization + SHA-256/SHA-384 digests.
 *
 * The canonical encoding is RFC 8785 "JSON Canonicalization Scheme" shaped:
 *   - object keys sorted lexicographically by Unicode code point,
 *   - `undefined` properties dropped,
 *   - arrays preserve order,
 *   - primitives stringified via JSON.stringify,
 *   - non-finite numbers rejected.
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

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers')
    }
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(',')}]`
  }

  if (isJsonObject(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => compareUnicodeCodePoints(left, right))

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stringifyCanonical(entryValue)}`)
      .join(',')}}`
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}`)
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left)
  const rightPoints = Array.from(right)
  const length = Math.min(leftPoints.length, rightPoints.length)

  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftPoints[index]?.codePointAt(0)
    const rightPoint = rightPoints[index]?.codePointAt(0)

    if (leftPoint === undefined || rightPoint === undefined) {
      break
    }
    if (leftPoint !== rightPoint) {
      return leftPoint - rightPoint
    }
  }

  return leftPoints.length - rightPoints.length
}
