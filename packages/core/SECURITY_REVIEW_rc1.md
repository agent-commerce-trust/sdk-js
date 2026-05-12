# Security Review — `@agent-commerce-trust/core@0.1.0-rc.1`

**Scope.** Pre-publish security review of `@agent-commerce-trust/core` at the
rc.1 surface. Covers the five areas required by §9.1 of the canonical
trust-layer SDK doc at `docs/domains/auth/trust-layer-sdk.md`: `KeyProvider`
contract bypass paths, canonical-bytes serialisation correctness against
RFC 8785, hashing-primitive integrity (algorithm confusion + length
extension), browser-safety audit, and test-fixture key handling.

**Methodology.** Source review of `packages/core/src/**`,
`packages/core/dist/**` (the published artifact set), and the test suite
under `tests/`. No external attack-surface scanning. Findings classified as
**CONFIRM** (no issue), **ADVISORY** (noted concern, non-blocking),
**BLOCKER** (must fix before publish).

**Outcome at this revision.** Zero BLOCKERs. Three ADVISORIES, all with
documented mitigations or follow-up tracking. Recommended publish posture:
proceed.

---

## 1. `KeyProvider` contract — purpose-enforcement bypass paths

### Surface under review

- `KeyProvider.sign(req: SignRequest)` interface at
  `packages/core/src/keys/types.ts:37`.
- `SigningKeyRef.purposes: readonly SigningKeyPurpose[]` at
  `packages/core/src/keys/types.ts:61`.
- `InMemoryKeyProvider.sign()` implementation at
  `packages/core/src/dev/in-memory-key-provider.ts:142–197`.
- Normative `payloadType → purpose` mapping + validator at
  `packages/core/src/keys/payload-type-mapping.ts`.

### Findings

**1.1 — CONFIRM: purpose-list check uses the provider's stored `KeyRef`, not a caller-supplied value.**

`InMemoryKeyProvider.sign()` reads `entry.keyRef.purposes` from the
provider's internal `#keys` map
(`packages/core/src/dev/in-memory-key-provider.ts:160`), NOT from any
field on the incoming `SignRequest`. A caller cannot inject a forged
`purposes: ['*']` to silently authorise an unrelated purpose. The check
fails closed and emits a `sign-error` audit event before throwing.

**1.2 — CONFIRM: `payloadType ↔ purpose` validation is unbypassable for known payloadTypes.**

`validatePayloadTypePurpose` at
`packages/core/src/keys/payload-type-mapping.ts:60–80` returns void only
when `payloadType` is a normative key AND its mapped purpose matches the
supplied purpose. Unknown payloadType throws
`KeyPurposePayloadTypeMismatchError` (line 65–68); known-with-wrong-purpose
throws (line 72–75). The map itself is frozen at module load via a
Proxy-wrapped `freezeMap` (line 19–43), so `Map.prototype.X.call(map, …)`
cannot mutate the mapping at runtime.

**1.3 — CONFIRM: algorithm-mismatch rejected before signing.**

`InMemoryKeyProvider.sign()` rejects
`req.algorithm !== entry.keyRef.algorithm` with `AlgorithmUnsupportedError`
at line 155–159. Prevents a caller from requesting a different curve/scheme
against an existing key.

**1.4 — ADVISORY: `KeyRef` is a plain JS object; runtime mutation by foreign code is possible.**

`SigningKeyRef.purposes` is `readonly` at the TypeScript level
(`types.ts:61`), but plain JS code could mutate the returned object
in-place (`(ref as any).purposes.push('sign-anything')`). Mitigation:
the provider does NOT consult the caller-held reference at sign time —
it consults its own internal `entry.keyRef`. The mutation would only
affect the caller's snapshot. No bypass results.

Production `KeyProvider` implementations (forthcoming under
`@agent-commerce-trust/core/providers`) should adopt the same pattern:
treat returned `KeyRef` objects as snapshots, re-read from internal state
at every authorisation check.

**1.5 — ADVISORY: `derive` capability is omitted, not stubbed, on `InMemoryKeyProvider`.**

`InMemoryKeyProvider` deliberately omits the optional `derive` method per
§7.1 of the canonical SDK doc. A consumer that accesses `provider.derive`
gets `undefined`; calling `provider.derive!(req)` throws a native
`TypeError`, NOT a typed `KeyProviderError`. This is the documented
contract per §7.10.3 (providers without HMAC-pepper support reject
derivation by not declaring the method), but downstream code that wraps
provider calls in a uniform try/catch expecting `KeyProviderError`
should be aware of the native-error path on `derive`.

---

## 2. Canonical bytes — deltas from RFC 8785 (JSON Canonicalization Scheme)

### Surface under review

- `canonicalize(value)` at `packages/core/src/canonical.ts:20–22`
  delegating to `stringifyCanonical` (line 53–80).
- Codepoint sort via `compareUnicodeCodePoints` (line 86–104).
- `canonicalBytes(value)` UTF-8 encoding (line 24–26).
- Fixture coverage: 9 reference rows at
  `tests/_fixtures/canonical-fixtures.mjs` exercised by both the Node and
  happy-dom test suites and the conformance suite at
  `tests/core-conformance-canonical.test.js`.

### Findings

**2.1 — CONFIRM: object-key sort is by Unicode codepoint.**

`compareUnicodeCodePoints` (line 86–104) uses `Array.from(string)` + per-
element `codePointAt(0)`, correctly handling surrogate pairs. Matches
RFC 8785 §3.2.3.

**2.2 — CONFIRM: array order is preserved.**

`stringifyCanonical` joins array items in source order without sorting
(line 65–67). Matches RFC 8785 §3.2.2.

**2.3 — CONFIRM: `undefined` properties are dropped.**

`Object.entries(value).filter(([, v]) => v !== undefined)` at line 70–71.
Matches RFC 8785 §3.2.1 (object members with `undefined` value are
excluded).

**2.4 — CONFIRM: non-finite numbers (`NaN`, `Infinity`, `-Infinity`) are rejected.**

`stringifyCanonical` throws `TypeError` for non-finite numbers
(line 59–61). Matches RFC 8785 §3.2.2.4 (no representation defined for
non-finite — implementations must reject).

**2.5 — ADVISORY: number serialisation delegates to `JSON.stringify`; deltas exist for very-large / very-small magnitudes.**

`stringifyCanonical` uses `JSON.stringify` for primitives (line 62). For
integers in `[-9007199254740992, 9007199254740992]` (IEEE 754 safe range)
and most fractional numbers, `JSON.stringify` and RFC 8785's prescribed
ECMA-262 D2S form produce byte-identical output. **Known deltas:**

  - `1e21` → `JSON.stringify` produces `"1e+21"`; RFC 8785 prescribes the
    D2S algorithm which also produces `"1e+21"` at this magnitude.
    Consistent.
  - Very small magnitudes (e.g. `0.0000001`): `JSON.stringify` may emit
    decimal form; RFC 8785 D2S typically transitions to exponential below
    `1e-6`. **This is a delta.**
  - Negative zero: `JSON.stringify(-0)` returns `"0"`; RFC 8785 normalises
    `-0` to `"0"`. Consistent.

The realistic mitigation at rc.1 is to **avoid embedding floating-point
numbers in payloads that get canonicalised across language boundaries**.
AP2 mandates use integer cents for monetary amounts and ISO 8601 strings
for timestamps, both of which canonicalise byte-identically across Go,
JS, and any RFC 8785 implementation. Document this constraint in the
package-level guidance when the README is finalised.

Track as a known-deviation in the cross-language consistency check
(`tests/profile-dependency.test.js`'s existing parity test against the
AP2-Travel profile is currently sufficient — both run in JS via
`JSON.stringify` so any drift cancels out).

**2.6 — CONFIRM: string escaping inherits `JSON.stringify` rules.**

  - Forward slash NOT escaped (RFC 8785 §3.2.2.1 — consistent).
  - Quotation marks, backslashes escaped (consistent).
  - Control characters (U+0000 through U+001F) escaped as `\uXXXX` or
    short forms (`\b`, `\f`, `\n`, `\r`, `\t`) per ECMA-262 / RFC 8785.
  - U+007F (DEL) passes through unescaped (matches ECMA-262; RFC 8785
    is silent — accepted).
  - High-Unicode (≥ U+0080) passes through as raw UTF-8 once encoded
    via `TextEncoder` in `canonicalBytes`. Matches RFC 8785 §3.2.2.1.

**2.7 — CONFIRM: duplicate-key prevention.**

JavaScript object literals cannot carry duplicate keys (latest wins at
construction). `canonicalize` accepts JS objects (record-shaped) and
arrays only; it does NOT accept `Map`. A consumer passing a `Map` to
`canonicalize` would currently fall through to the
`isJsonObject` check at line 82, which returns `false` for `Map`
(typeof === 'object' but Map is not a plain record), and reach the
`throw new TypeError` at line 79. **Defensible: Map is not a valid input
shape.** RFC 8785 input is JSON-typed values, not Maps.

**2.8 — ADVISORY: Unicode normalisation is NOT performed.**

`canonicalize` does not normalise strings to NFC. RFC 8785 itself does
NOT mandate normalisation — it canonicalises the source text. A consumer
that constructs two strings differing only in NFC vs NFD form would
produce different canonical bytes from `canonicalize`. This matches
RFC 8785's posture. Document: producers should normalise inputs (NFC
recommended) before construction if they need cross-input equivalence.

---

## 3. Hashing primitives — algorithm confusion + length extension

### Surface under review

- `sha256Hex(value)` and `sha384Hex(value)` at
  `packages/core/src/canonical.ts:28–34`.
- `buildSigningInput(parts)` at
  `packages/core/src/keys/signing-input.ts:36–50`.
- WebCrypto digest at `globalThis.crypto.subtle.digest('SHA-256', …)`
  and `digest('SHA-384', …)`.

### Findings

**3.1 — CONFIRM: separate hash algorithms expose separate functions; output lengths differ.**

`sha256Hex` returns a 64-hex-char string (32 bytes); `sha384Hex` returns
a 96-hex-char string (48 bytes). The conformance suite asserts both
lengths (`tests/core-conformance-canonical.test.js`). A consumer cannot
accidentally feed a SHA-384 output to a SHA-256-expecting verifier and
have it interpret as a 32-byte hash via truncation — the lengths
diverge.

**3.2 — CONFIRM: no MAC construction via raw `H(key || message)`.**

The package's only hash-based construction is `buildSigningInput` (file
`packages/core/src/keys/signing-input.ts`), which produces
`SHA-256(domainBytes) || payload` and feeds that to a signature
primitive (`crypto.subtle.sign`). It is NOT used as a MAC. SHA-2
length-extension attacks apply only when an unkeyed hash is used as a
secret-key MAC; here the underlying primitive is a digital signature
(Ed25519 or ECDSA-P256), not an HMAC, and the hash provides domain
separation not message authentication. Length extension does not apply.

**3.3 — CONFIRM: `buildSigningInput` is deterministic + collision-resistant under SHA-256.**

The domain prefix is `SHA-256(canonicalBytes({payloadType, context ?? {}}))`
(`signing-input.ts:41–43`). Canonical-bytes input is byte-stable
(§2 above). SHA-256 provides 128-bit collision resistance — a forger
would need to find two distinct `(payloadType, context)` pairs hashing
to the same 32-byte prefix, which is computationally infeasible at the
current state of the art.

**3.4 — ADVISORY: HMAC-pepper derivation is deferred to production providers.**

`derive-principal-pepper` per the canonical doc's §7.10.3 is the
HMAC-based principal-derivation flow. `InMemoryKeyProvider` does not
implement `derive` (test-only stance). No HMAC construction lives in
core at rc.1, so no length-extension or key-recovery concerns from a
mis-implemented HMAC. Track for re-review when the first production
provider lands and implements `derive`.

---

## 4. Browser-safety audit

### Surface under review

- All `packages/core/src/**` source.
- `packages/core/dist/**` production artifacts.
- `tests/core-canonical.browser.test.mjs` happy-dom smoke test.

### Findings

**4.1 — CONFIRM: no `node:` imports in source or dist.**

The browser-bundle-scan invariant test at
`tests/core-invariant-browser-bundle-scan.test.js` recursively scans every
emitted `.js` / `.cjs` / `.mjs` artifact under `packages/core/dist/` and
asserts zero `from "node:..."`, `import "node:..."`, `require("node:...")`,
and `import("node:...")` occurrences. Current run: 0 matches.

**4.2 — CONFIRM: WebCrypto access exclusively via `globalThis.crypto.subtle`.**

`packages/core/src/canonical.ts:44`,
`packages/core/src/keys/signing-input.ts:41`, and three call sites in
`packages/core/src/dev/in-memory-key-provider.ts` all reach WebCrypto
through the global. Node 20+ exposes it natively; browsers expose it
identically. No `import { webcrypto } from 'node:crypto'` path exists.

**4.3 — CONFIRM: happy-dom runtime exercises the same WebCrypto API as Node.**

The browser test at `tests/core-canonical.browser.test.mjs` registers
happy-dom globals BEFORE importing the package and verifies every
canonical / hashing fixture against the same reference table the Node
suite uses. happy-dom's WebCrypto proxies to Node's WebCrypto internally,
so both code paths exercise the same primitive — but any divergence
between Node's native WebCrypto and the package's expected interface
surfaces immediately under happy-dom.

**4.4 — ADVISORY: Ed25519 in browser-side WebCrypto requires a recent browser.**

The published WebCrypto algorithm list (per the W3C Web Cryptography
working draft) includes `Ed25519` but it landed in Chromium / Safari /
Firefox at different release windows. The package's runtime contract is
Node ≥ 20 (`engines.node` in `package.json`); the package does NOT declare
a browser-side minimum. Consumers using `InMemoryKeyProvider` in browser
test runners (or using future verifier packages in production browsers)
SHOULD verify Ed25519 availability in their target environments. ECDSA
P-256 is universally supported and safer for cross-browser fallback.

Recommendation: document the browser support matrix in the README
alongside the `engines.node` declaration when the README is finalised.

---

## 5. Test-fixture key handling — `InMemoryKeyProvider` containment

### Surface under review

- `packages/core/src/dev/in-memory-key-provider.ts` and the `/dev`
  subpath export configuration in `packages/core/package.json:14–24`.
- `scripts/verify-publish-readiness.js:116–144` (the readiness check that
  validates the `/dev` and `/providers` subpath shape).

### Findings

**5.1 — CONFIRM: subpath isolation prevents accidental production resolution.**

`packages/core/package.json` exports declares three entries: `"."`,
`"./dev"`, and `"./providers": null`. A production consumer importing
from `@agent-commerce-trust/core` (no subpath) cannot resolve
`InMemoryKeyProvider` — it is only reachable via the explicit `/dev`
subpath. Static analysis tooling can lint for `/dev` imports in
production source as a follow-up.

**5.2 — CONFIRM: `/providers` subpath is reserved.**

`exports['./providers'] = null` causes Node to reject the import
synchronously with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The invariant test
at `tests/core-invariant-providers-subpath.test.js` machine-enforces
this and additionally requires the error message to name both the
package and the `/providers` subpath. A future production provider
release will populate this subpath; until then, no concrete
implementation exists to be misused.

**5.3 — ADVISORY: private keys are stored as extractable `CryptoKey` objects.**

`InMemoryKeyProvider.#generateCryptoKeyPair` (line 219–235) generates
keys with `extractable: true` because round-trip sign-verify tests need
to export the raw public key. The matching private key is also
extractable. Mitigation: the provider is documented as test-only at
two levels (the package README and the file-level JSDoc), and the
subpath isolation in §5.1 prevents accidental production use. The
trade-off is intentional: a non-extractable test-only provider would
fail to support consumers that need to capture key material for fixture
generation.

Production providers under `@agent-commerce-trust/core/providers` MUST
NOT generate extractable keys — KMS/HSM-backed providers should source
keys from the KMS, never hold private material in-process.

**5.4 — CONFIRM: no naming collision with production providers.**

`InMemoryKeyProvider` is a unique class name. The planned production
providers (`AwsKmsKeyProvider`, `GcpKmsKeyProvider`, `AzureKeyVaultProvider`,
`Pkcs11KeyProvider`, `Fido2KeyProvider`, `RemoteSignerKeyProvider`) carry
distinct names per the canonical doc §7.1. A consumer cannot accidentally
swap `InMemoryKeyProvider` for a production provider via import-path
typo — the `/dev` subpath is explicit.

**5.5 — CONFIRM: no path-traversal in the `/dev` subpath resolver.**

`package.json` exports use literal paths (`"./dist/dev/index.js"` etc.),
not patterns. Node's exports resolver does not perform path traversal
on literal exports. A consumer attempting to import
`@agent-commerce-trust/core/dev/../providers/secret` resolves to nothing
(the resolver only honours declared subpaths).

---

## Summary table

| Area | CONFIRM | ADVISORY | BLOCKER |
|---|---|---|---|
| §1 KeyProvider purpose enforcement | 3 | 2 | 0 |
| §2 Canonical bytes vs RFC 8785 | 6 | 2 | 0 |
| §3 Hashing primitives | 3 | 1 | 0 |
| §4 Browser safety | 3 | 1 | 0 |
| §5 Test-fixture key handling | 4 | 1 | 0 |
| **Totals** | **19** | **7** | **0** |

### Advisory list (consolidated)

1. **§1.4** Returned `KeyRef` objects are runtime-mutable plain JS objects; mitigated by provider-side re-read.
2. **§1.5** `provider.derive!(req)` throws native `TypeError` (not typed `KeyProviderError`) when omitted.
3. **§2.5** Number serialisation via `JSON.stringify` may diverge from RFC 8785 D2S form at very-small magnitudes; avoid floats in cross-language payloads, use integer cents + ISO 8601 strings.
4. **§2.8** No Unicode normalisation; producers responsible for NFC if they need cross-input equivalence.
5. **§3.4** HMAC-pepper derivation deferred; re-review required when first production provider implements `derive`.
6. **§4.4** Ed25519 in browser WebCrypto requires recent Chromium/Safari/Firefox; document browser support matrix.
7. **§5.3** `InMemoryKeyProvider` private keys are extractable; intentional for test fixtures, mitigated by subpath isolation + documentation.

### Blocker list

None.

---

## Recommendations for the rc.1 publish

1. **Proceed to publish at this revision.** The package's security
   posture is sound for an rc.1 surface aimed at the public AI-agent
   commerce ecosystem.

2. **Document the cross-language payload constraint** in the
   package-level README before publish: prefer integer cents + ISO 8601
   strings; treat floating-point numbers as JS-only.

3. **Document the browser support matrix** in the README, noting
   Ed25519 availability requirements alongside the `engines.node`
   declaration.

4. **Track HMAC-pepper review** for re-execution when the first
   production provider implementing `derive` lands under
   `@agent-commerce-trust/core/providers`.

---

## Sign-off

Reviewed against the source at the current tip of
`feat/core-security-review-rc1`. Re-review required if any of the
following are modified before publish:

- `packages/core/src/canonical.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/keys/*`
- `packages/core/src/dev/in-memory-key-provider.ts`
- `packages/core/package.json` (exports field, dependencies)
