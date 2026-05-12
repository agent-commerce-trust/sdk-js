# Security Review — `@agent-commerce-trust/core` rc.1 candidate

**Scope.** Pre-publish security review of the rc.1 candidate at the current
tip of `feat/core-security-review-rc1`. The package manifest currently
declares `version: 0.1.0-rc.0`; the version bump to `0.1.0-rc.1` lands as
part of the publish gate (the next PR in the sequence) and is intentionally
held out of this branch so the review covers the unbumped artifact.

Five required areas per §9.1 of the canonical trust-layer SDK doc at
`docs/domains/auth/trust-layer-sdk.md`: `KeyProvider` contract bypass
paths, canonical-bytes serialisation correctness against RFC 8785,
hashing-primitive integrity (algorithm confusion + length extension),
browser-safety audit, and test-fixture key handling.

**Methodology.** Source review of `packages/core/src/**`,
`packages/core/dist/**` (published artifact set), and the test suite under
`tests/`. Findings classified **CONFIRM** (no issue), **ADVISORY** (noted
concern, non-blocking with mitigation/follow-up), or
**CLOSED-BY-FIX** (issue identified during this review and resolved in
the same commit).

**Revision history.**

- Initial draft enumerated CONFIRMs across the five areas based on a
  source read of the rc.1 candidate.
- Independent Codex re-review (task `task-mp2tj02i-55xd41`) caught three
  factual errors in the initial draft (§1.4 false mitigation claim,
  §2.1 codepoint-vs-UTF-16 sort, §2.7 silent Map canonicalisation),
  plus a missing RFC 8785 §3.2.2.2 lone-surrogate rejection check and
  several missing ADVISORY-class concerns (audit-event forensic gap,
  error-message info leakage, no DoS/depth/cycle guards in canonical
  recursion). All three factual errors were rooted in the source, not
  the doc — fixed in `packages/core/src/canonical.ts` and
  `packages/core/src/dev/in-memory-key-provider.ts` in the same commit
  as this revision.
- Final outcome (this revision): 0 unresolved BLOCKERs. 4 CLOSED-BY-FIX
  findings (with regression tests). 9 ADVISORIES, all with documented
  mitigations or follow-up tracking. Recommended publish posture:
  proceed.

---

## 1. `KeyProvider` contract — purpose-enforcement bypass paths

### Surface under review

- `KeyProvider.sign(req: SignRequest)` interface at
  `packages/core/src/keys/types.ts:37`.
- `SigningKeyRef.purposes: readonly SigningKeyPurpose[]` at
  `packages/core/src/keys/types.ts:61`.
- `InMemoryKeyProvider.sign()` at
  `packages/core/src/dev/in-memory-key-provider.ts:143`.
- Normative `payloadType → purpose` mapping + validator at
  `packages/core/src/keys/payload-type-mapping.ts`.

### Findings

**1.1 — CONFIRM: purpose-list check uses the provider's stored `KeyRef`, not a `SignRequest` field.**

`SignRequest` has no `purposes` field
(`packages/core/src/keys/types.ts:78`). `InMemoryKeyProvider.sign()`
reads `entry.keyRef.purposes` from the provider's internal `#keys` map
(`packages/core/src/dev/in-memory-key-provider.ts:164`). The check is
performed AFTER key lookup. A caller cannot inject a forged purposes
field; the provider only consults its own state.

**1.2 — CONFIRM: `payloadType ↔ purpose` validation is unbypassable for known payloadTypes.**

`validatePayloadTypePurpose`
(`packages/core/src/keys/payload-type-mapping.ts:60`) returns void only
when `payloadType` is a normative key AND its mapped purpose matches the
supplied purpose. Unknown payloadType throws
`KeyPurposePayloadTypeMismatchError`; known-with-wrong-purpose throws.
The map itself is Proxy-frozen at module load via `freezeMap`
(`packages/core/src/keys/payload-type-mapping.ts:33`), so
`Map.prototype.X.call(map, …)` cannot mutate the mapping at runtime.

**1.3 — CONFIRM: algorithm-mismatch rejected before signing.**

`InMemoryKeyProvider.sign()` at
`packages/core/src/dev/in-memory-key-provider.ts:156` rejects
`req.algorithm !== entry.keyRef.algorithm` with
`AlgorithmUnsupportedError`. The check fires BEFORE
`buildSigningInput` is constructed and BEFORE any signing primitive
runs.

**1.4 — CLOSED-BY-FIX: returned `SigningKeyRef` is now deep-frozen.**

Pre-fix the initial draft of this doc claimed that returning a
`SigningKeyRef` to a caller was safe because the provider "re-reads
from internal state at every authorisation check". This was FALSE: the
provider stored the SAME `keyRef` object it returned, and `sign()`
later checked `entry.keyRef.purposes` — which aliased the caller's
reference. A caller could mutate `returnedRef.purposes` and bypass the
authorisation check at the next `sign()` call.

Fix (`packages/core/src/dev/in-memory-key-provider.ts:80–105`):
`generateSigningKey()` now constructs the `keyRef` with
`Object.freeze` wrapping both the outer object AND the `purposes`
array. Mutation attempts throw `TypeError` under strict mode.

Regression test
(`tests/core-in-memory-key-provider.test.js`): asserts that
`(ref.purposes as any).push(...)`, `(ref as any).purposes = [...]`,
and `(ref as any).extra = 'x'` all throw; then verifies that a sign
attempt with a non-granted purpose still rejects with
`KeyPurposeMismatchError` after the attempted mutations.

**1.5 — ADVISORY: `KeyRef.publicKey.encoded` is a `Uint8Array`; its bytes remain mutable.**

`Object.freeze` on a typed array does not block element writes
(`bytes[0] = 0xFF` still succeeds). The `publicKey` object is frozen at
the field level (so `keyRef.publicKey = X` throws), but a caller can
mutate the underlying bytes. This does not affect authorisation
(`sign()` does not consult `publicKey.encoded`), and the matching
public key used at sign time comes from
`entry.publicCryptoKey` (a `CryptoKey` handle, not the byte array).
Document: production providers should treat returned `Uint8Array`
fields as immutable and consumers should defensive-copy before
external publication.

**1.6 — ADVISORY: error messages disclose key IDs, allowed purposes, and payload types.**

`KeyNotFoundError`, `KeyPurposeMismatchError`, `AlgorithmUnsupportedError`,
and `KeyPurposePayloadTypeMismatchError` all carry the supplied keyId,
provider ID, allowed-purpose list, supplied algorithm, etc. in their
`message` field. Useful for developer correction but trades
information for diagnostic clarity. In production deployments where
the verifier surface is exposed to untrusted callers, this enables
enumeration of valid key IDs and key capabilities by probing.

Mitigation: production `KeyProvider` implementations under
`@agent-commerce-trust/core/providers` should adopt a "production
mode" where error messages collapse to a generic shape (e.g. just
the `code` and a request ID) while detailed messages are emitted
through the audit hook to operator-controlled logs.

**1.7 — ADVISORY: `SigningEvent` audit hook omits payload, payloadType, and context.**

`SigningEvent` carries `{ type, keyId, purpose, at }` (sign-request) or
`{ type, keyId, keyVersion, at }` (sign-result) or `{ type, keyId,
error, at }` (sign-error). It does NOT carry `payloadType`,
`context`, payload bytes, or a payload digest.

The omission AVOIDS audit-log injection (a malicious payload cannot
embed log-formatting markers into the audit stream) and AVOIDS
storing sensitive payload material in logs by default. But the
omission creates a forensic-reconstruction gap: an audit log alone
cannot reconstruct what was signed, only THAT something was signed
with a given keyId+purpose at a given time.

Mitigation: deployments requiring forensic completeness should attach
a separate "what was signed" log emitted alongside the audit event
(e.g. emit a `(correlationID, payloadType, payloadDigest)` tuple
through a different channel keyed to the same `at` timestamp). This
is the production-deployment integration's responsibility, not the
SDK's.

**1.8 — ADVISORY: `KeyProvider` interface does not specify authorisation for `listSigningKeys` / `getSigningKey`.**

`listSigningKeys(scope?)` and `getSigningKey(keyId)` are unauthenticated
at the interface level
(`packages/core/src/keys/types.ts:32–34`). A caller that holds a
`KeyProvider` reference can enumerate all keys and probe any keyId.

For `InMemoryKeyProvider` this is acceptable: the provider is
in-process and the consumer is the test rig. For production providers
this surface MUST be wrapped with authentication / authorisation
(typically: the production provider's internal KMS client enforces
IAM, and the JS-side `KeyProvider` exposes only those keys the
calling principal is authorised to use). Document in the
`@agent-commerce-trust/core/providers` package authoring guide when
that work begins.

**1.9 — ADVISORY: `provider.derive!(req)` throws native `TypeError` when omitted, not a typed `KeyProviderError`.**

The optional-method semantics of `KeyProvider.derive?` mean a provider
omitting derivation surfaces as `provider.derive === undefined`. A
consumer calling `provider.derive!(req)` gets a native `TypeError`
(typically "provider.derive is not a function") rather than a typed
`KeyProviderError`. Downstream code that wraps provider calls in a
uniform `try { … } catch (KeyProviderError) { … }` will fall through to
the catch-all path for native errors. Documented contract; consumers
must check `provider.derive !== undefined` before calling.

---

## 2. Canonical bytes — RFC 8785 (JSON Canonicalization Scheme)

### Surface under review

- `canonicalize(value)` at `packages/core/src/canonical.ts:25`
  delegating to `stringifyCanonical`.
- UTF-16 code-unit sort via `compareUtf16CodeUnits` at
  `packages/core/src/canonical.ts:135`.
- Plain-object discriminator `isPlainJsonObject` at
  `packages/core/src/canonical.ts:113`.
- Lone-surrogate rejection `hasLoneSurrogate` at
  `packages/core/src/canonical.ts:147`.
- `canonicalBytes(value)` UTF-8 encoding at line 29.
- Fixture coverage: 9 reference rows at
  `tests/_fixtures/canonical-fixtures.mjs`; 19 RFC-conformance tests
  at `tests/core-canonical.test.js`.

### Findings

**2.1 — CLOSED-BY-FIX: object-key sort is by UTF-16 code unit, not Unicode codepoint.**

Pre-fix `compareUnicodeCodePoints` used `Array.from(string)` +
`codePointAt(0)` to compare strings codepoint-by-codepoint. RFC 8785
§3.2.3 instead requires UTF-16 code-unit ordering — the two diverge
for strings containing surrogate-pair characters (math bold A is
codepoint U+1D400 but UTF-16 [0xD835, 0xDC00], so under codepoint sort
it places after BMP private-use U+E000; under UTF-16 sort it places
before).

Fix (`packages/core/src/canonical.ts:135`): `compareUtf16CodeUnits`
uses JavaScript's native `<` / `>` string operators, which perform
UTF-16 code-unit comparison by spec.

Regression test
(`tests/core-canonical.test.js`): constructs an object with one
BMP-private-use key and one math-bold key, asserts the math-bold key
sorts first in canonical output (UTF-16 0xD835 < 0xE000).

**2.2 — CONFIRM: array order is preserved.**

`stringifyCanonical` joins array items in source order
(`packages/core/src/canonical.ts:81`). Matches RFC 8785 §3.2.2.

**2.3 — CONFIRM: `undefined` properties are dropped.**

`Object.entries(value).filter(([, v]) => v !== undefined)`
(`packages/core/src/canonical.ts:100`). Matches RFC 8785 §3.2.1.

**2.4 — CONFIRM: non-finite numbers (`NaN`, `Infinity`, `-Infinity`) are rejected.**

`stringifyCanonical` throws `TypeError` for non-finite numbers
(`packages/core/src/canonical.ts:76`). Matches RFC 8785 §3.2.2.4.

**2.5 — CONFIRM: number serialisation follows RFC 8785.**

`JSON.stringify(number)` delegates to `Number.prototype.toString()`,
which in V8 (Node ≥ 12) uses the Ryu algorithm — the same shortest-
exact decimal form that RFC 8785 §3.2.2.3 normatively specifies
("numbers MUST be serialized in their shortest exact form as
ECMAScript expression"). The earlier draft of this doc claimed deltas
at very-small magnitudes; that was overstated. ECMAScript's
`Number.prototype.toString` IS the RFC 8785 normative path.

Product guidance: cross-language payloads should still prefer integer
cents and ISO 8601 strings over floating-point numbers. Not because of
RFC 8785 deltas (which don't exist in practice between modern
implementations) but because Go / Python / Rust JSON libraries vary in
their number-form normalisation and float equality across languages
remains fraught.

**2.6 — CONFIRM: string escaping inherits `JSON.stringify` rules.**

Forward slash NOT escaped (RFC 8785 §3.2.2.1). Quotation marks,
backslashes escaped. Control characters U+0000 through U+001F escaped
as `\uXXXX` or short forms (`\b`, `\f`, `\n`, `\r`, `\t`).
High-Unicode (≥ U+0080) passes through as raw UTF-8 once encoded via
`TextEncoder`. Consistent with RFC 8785.

**2.7 — CLOSED-BY-FIX: lone-surrogate strings now rejected.**

RFC 8785 §3.2.2.2 requires strings to be valid UTF-16: lone (unpaired)
surrogates have no UTF-8 representation and would canonicalise
inconsistently across implementations. Pre-fix `stringifyCanonical`
delegated to `JSON.stringify` which emits lone surrogates as raw
`\uD8XX` escape sequences, allowing them through.

Fix (`packages/core/src/canonical.ts:147–164`): `hasLoneSurrogate`
scans every string value and every object key for unpaired surrogates;
`stringifyCanonical` throws `TypeError` on the first hit.

Regression tests
(`tests/core-canonical.test.js`):
  - reject string value with lone high surrogate (`'\uD835X'`)
  - reject string value with lone low surrogate (`'X\uDC00'`)
  - reject object key with lone surrogate
  - accept strings composed entirely of valid surrogate pairs
    (math bold `'𝐀𝐁𝐂'`).

**2.8 — CLOSED-BY-FIX: only plain JSON objects accepted; Map / Date / Set / RegExp / class instances now rejected.**

Pre-fix `isJsonObject(v) = typeof v === 'object' && v !== null` was
too permissive. `Map` instances passed the check and reached
`Object.entries(map)` which returns `[]` for a Map (because the Map's
data lives in `[[MapData]]` internal slot, not as enumerable own
properties). Result: `canonicalize(new Map([['a', 1]]))` returned
`"{}"` silently, losing all entries. Same issue for `Date`, `Set`,
`RegExp`, and class instances.

Fix (`packages/core/src/canonical.ts:113`): `isPlainJsonObject`
inspects the prototype chain and accepts only objects whose prototype
is `Object.prototype` or `null`. Non-plain objects fall through to
the trailing `throw new TypeError(...)`.

Regression tests
(`tests/core-canonical.test.js`):
  - reject `Map`, `Date`, `Set`, `RegExp`, and class instances
  - accept `Object.create(null)` (null-prototype plain objects)
  - accept `{ ...sourceLiteral }` (Object.prototype objects)

**2.9 — ADVISORY: no input-size, recursion-depth, or cycle guard.**

`stringifyCanonical` is recursive and has no guards against:
- Pathologically deep nesting (stack overflow → uncaught error)
- Cyclic references (`a.x = a` → infinite recursion → `RangeError:
  Maximum call stack size exceeded`)
- Very large payloads (memory exhaustion)

For a public-API surface this is a DoS vector if untrusted input
reaches `canonicalize`. The `RateLimitExceededError` class exists in
the error hierarchy but is unused inside core today.

Mitigation: deployments accepting untrusted payloads should impose
size / depth limits at the request-validation layer (before
`canonicalize` is called). Production `KeyProvider` implementations
should similarly rate-limit sign operations.

Tracked for follow-up: a future minor version of core could ship a
size-bounded `canonicalize` variant (e.g.
`canonicalize(value, { maxDepth: 64, maxBytes: 65536 })`) and emit
`RateLimitExceededError` on overflow. Not in scope for rc.1.

**2.10 — ADVISORY: Unicode normalisation is NOT performed.**

`canonicalize` does not normalise strings to NFC. RFC 8785 itself does
not mandate normalisation. A consumer constructing two strings
differing only in NFC vs NFD form would produce different canonical
bytes. Document: producers should normalise inputs (NFC recommended)
if they need cross-input equivalence across UI source contexts.

---

## 3. Hashing primitives — algorithm confusion + length extension

### Surface under review

- `sha256Hex(value)` and `sha384Hex(value)` at
  `packages/core/src/canonical.ts:33–37`.
- `buildSigningInput(parts)` at
  `packages/core/src/keys/signing-input.ts:36`.
- WebCrypto digest at `globalThis.crypto.subtle.digest('SHA-256', …)`
  and `digest('SHA-384', …)`.

### Findings

**3.1 — CONFIRM: separate hash algorithms expose separate functions; output lengths differ.**

`sha256Hex` returns a 64-hex-char string (32 bytes); `sha384Hex`
returns 96 hex chars (48 bytes). Conformance tests at
`tests/core-conformance-canonical.test.js:63,71` assert both lengths.
Algorithm-confusion (treating a 32-byte SHA-256 output as a truncated
SHA-384) requires deliberate truncation; the API surface does not
afford it.

**3.2 — CONFIRM: no MAC construction via raw `H(key || message)`.**

`packages/core/src/keys/signing-input.ts:41` produces
`SHA-256(domainBytes) || payload` and feeds the result to a signature
primitive (`crypto.subtle.sign` with `Ed25519` or `ECDSA P-256`). The
hash provides domain separation, NOT message authentication; the
underlying primitive is a digital signature, not an HMAC. Length
extension applies only when an unkeyed hash is used as a secret-key
MAC. Not applicable.

**3.3 — CONFIRM: `buildSigningInput` is deterministic + collision-resistant under SHA-256.**

Canonical-bytes input is byte-stable (§2). SHA-256 provides 128-bit
collision resistance. A forger seeking two distinct
`(payloadType, context)` pairs hashing to the same 32-byte prefix
faces ~2^128 work. HMAC would be the correct primitive for keyed MAC
derivation; for unkeyed domain separation before a digital signature,
the unkeyed hash prefix is appropriate.

**3.4 — ADVISORY: HMAC-pepper derivation is deferred to production providers.**

`derive-principal-pepper` per the canonical doc's §7.10.3 is the
HMAC-based principal-derivation flow. `InMemoryKeyProvider` does not
implement `derive` (test-only stance). No HMAC construction lives in
core at rc.1, so no length-extension or key-recovery concerns from a
mis-implemented HMAC. Track for re-review when the first production
provider implements `derive`.

---

## 4. Browser-safety audit

### Surface under review

- All `packages/core/src/**` source.
- `packages/core/dist/**` production artifacts.
- `tests/core-canonical.browser.test.mjs` happy-dom smoke test.
- `tests/core-invariant-browser-bundle-scan.test.js` machine guard.

### Findings

**4.1 — CONFIRM: no `node:` imports in source or dist.**

The browser-bundle-scan invariant test at
`tests/core-invariant-browser-bundle-scan.test.js` recursively scans
every emitted `.js` / `.cjs` / `.mjs` artifact under
`packages/core/dist/` and asserts zero `from "node:..."`,
`import "node:..."`, `require("node:...")`, and `import("node:...")`
occurrences. Current run: 0 matches.

**4.2 — CONFIRM: WebCrypto access exclusively via `globalThis.crypto.subtle`.**

`packages/core/src/canonical.ts:44`,
`packages/core/src/keys/signing-input.ts:41`, and three call sites in
`packages/core/src/dev/in-memory-key-provider.ts` (lines 223, 230, 243,
250) all reach WebCrypto through the global. Node ≥ 20 exposes it
natively; browsers expose it identically. No `import { webcrypto } from
'node:crypto'` path exists.

**4.3 — CONFIRM: happy-dom exercises the package's WebCrypto path.**

`tests/core-canonical.browser.test.mjs` registers happy-dom globals
BEFORE importing the package and verifies every canonical / hashing
fixture against the same reference table the Node suite uses. Any
divergence between Node's native WebCrypto and the package's expected
interface surfaces immediately.

**4.4 — ADVISORY: Ed25519 in browser WebCrypto requires recent browsers; ECDSA-P256 is universally available.**

WebCrypto Ed25519 support (per current public browser-compat data):
Chrome ≥ 113 (initially behind a flag, ungated by Chrome 137),
Firefox ≥ 129, Safari ≥ 17. Older browsers lack Ed25519 in the
SubtleCrypto surface entirely. ECDSA-P256 is universally supported
(Chrome 37+, Firefox 34+, Safari 7.1+, Edge 12+).

The package declares `engines.node: ">=20"` but does NOT declare a
browser-side minimum. Consumers using `InMemoryKeyProvider` or the
future verifier package in browser-side production traffic SHOULD:

  - Detect WebCrypto Ed25519 availability before relying on it.
  - Fall back to ECDSA-P256 keys for cross-browser support.

Recommendation: document the browser support matrix in the README
alongside `engines.node` when the README is authored for publish.

---

## 5. Test-fixture key handling — `InMemoryKeyProvider` containment

### Surface under review

- `packages/core/src/dev/in-memory-key-provider.ts` (full file).
- `/dev` and `/providers` subpath shape in
  `packages/core/package.json:14–24`.
- `scripts/verify-publish-readiness.js:116–148` (publish-readiness
  validation of the subpath shape).

### Findings

**5.1 — CONFIRM: subpath isolation prevents accidental production resolution.**

`packages/core/package.json:exports` declares three entries: `"."`,
`"./dev"`, and `"./providers": null`. A consumer importing
`@agent-commerce-trust/core` (no subpath) cannot resolve
`InMemoryKeyProvider` — it is only reachable via the explicit `/dev`
subpath. Static analysis tooling can lint for `/dev` imports in
production source as a follow-up.

**5.2 — CONFIRM: `/providers` subpath is reserved (not resolvable).**

`exports['./providers'] = null` causes Node to reject the import
synchronously with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The invariant test
at `tests/core-invariant-providers-subpath.test.js` machine-enforces
this and additionally requires the error message to name both the
package and the `/providers` subpath.

**5.3 — ADVISORY: private keys are stored as extractable `CryptoKey` objects.**

`#generateCryptoKeyPair` at
`packages/core/src/dev/in-memory-key-provider.ts:243,250` generates
keys with `extractable: true`. Round-trip sign-verify tests need to
export the raw public key; the matching private key inherits
extractability.

Mitigation: the provider is documented as test-only at two levels
(the package README and the file-level JSDoc), and the subpath
isolation in §5.1 prevents accidental production use. The trade-off
is intentional: a non-extractable test-only provider would fail to
support consumers that need to capture key material for fixture
generation.

Production providers under `@agent-commerce-trust/core/providers` MUST
NOT generate extractable keys — KMS/HSM-backed providers should source
keys from the KMS, never hold private material in-process.

**5.4 — CONFIRM: no naming collision with planned production providers.**

`InMemoryKeyProvider` is uniquely named. Planned production providers
(`AwsKmsKeyProvider`, `GcpKmsKeyProvider`, `AzureKeyVaultProvider`,
`Pkcs11KeyProvider`, `Fido2KeyProvider`, `RemoteSignerKeyProvider`) per
the canonical doc's §7.1 carry distinct names.

**5.5 — CONFIRM: no path-traversal in the `/dev` subpath resolver.**

`package.json` exports use literal paths (`"./dist/dev/index.js"`
etc.), not patterns. Node's exports resolver does not traverse the
filesystem for literal exports. A consumer attempting to import
`@agent-commerce-trust/core/dev/../providers/secret` resolves to
nothing — the resolver only honours declared subpaths.

---

## Summary table

| Area | CONFIRM | ADVISORY | CLOSED-BY-FIX | BLOCKER |
|---|---|---|---|---|
| §1 KeyProvider purpose enforcement | 3 | 5 | 1 | 0 |
| §2 Canonical bytes vs RFC 8785 | 5 | 2 | 3 | 0 |
| §3 Hashing primitives | 3 | 1 | 0 | 0 |
| §4 Browser safety | 3 | 1 | 0 | 0 |
| §5 Test-fixture key handling | 4 | 1 | 0 | 0 |
| **Totals** | **18** | **10** | **4** | **0** |

### Closed-by-fix list (this revision)

1. **§1.4** Returned `SigningKeyRef` is deep-frozen (`Object.freeze` on
   the outer object + the `purposes` array); mutation attempts throw.
2. **§2.1** Object-key sort changed from Unicode-codepoint to UTF-16
   code-unit comparison (RFC 8785 §3.2.3 conformance).
3. **§2.7** Lone-surrogate strings (RFC 8785 §3.2.2.2) now rejected at
   both value and key position.
4. **§2.8** `Map`, `Date`, `Set`, `RegExp`, and class instances now
   rejected by a tightened plain-object check
   (`Object.getPrototypeOf(v) === Object.prototype || === null`).

Each fix has dedicated regression tests.

### Advisory list (consolidated)

1. **§1.5** `Uint8Array` byte contents inside `publicKey.encoded`
   remain mutable; `Object.freeze` does not block typed-array element
   writes. Mitigated by production-provider defensive-copy guidance.
2. **§1.6** Error messages disclose key IDs, allowed purposes, and
   payload types. Mitigated by production-provider "production mode"
   recommendation.
3. **§1.7** `SigningEvent` audit hook omits payload / payloadType /
   context for log-injection safety; creates a forensic-reconstruction
   gap. Mitigated by deployment-side parallel logging.
4. **§1.8** `KeyProvider` interface does not specify authorisation for
   `listSigningKeys` / `getSigningKey`. Production providers must wrap
   with auth/rate-limit.
5. **§1.9** `provider.derive!(req)` throws native `TypeError` when
   omitted. Documented contract.
6. **§2.9** No size / depth / cycle guard in canonical recursion.
   Mitigated by deployment-side validation; tracked for a future
   bounded variant.
7. **§2.10** No Unicode NFC normalisation; producers responsible for
   cross-input equivalence.
8. **§3.4** HMAC-pepper review deferred to first production provider
   implementing `derive`.
9. **§4.4** Ed25519 WebCrypto requires Chrome ≥ 113, Firefox ≥ 129,
   Safari ≥ 17; ECDSA-P256 universal. Document browser support matrix
   in README before publish.
10. **§5.3** `InMemoryKeyProvider` keys are extractable (intentional
    for test fixtures; mitigated by subpath isolation + documentation).
    Production providers MUST NOT generate extractable keys.

### Blocker list

None unresolved. Four findings raised during this review were closed
by source-level fixes in the same commit (see closed-by-fix list).

---

## Recommendations for the rc.1 publish

1. **Proceed to publish at this revision.** The package's security
   posture is sound for an rc.1 surface aimed at the public AI-agent
   commerce ecosystem.

2. **Document the cross-language payload constraint** in the
   package-level README before publish: prefer integer cents + ISO 8601
   strings for cross-language interop. (Driven by language-runtime
   variation, not by RFC 8785 deltas.)

3. **Document the browser support matrix** in the README, noting
   Ed25519 minimums (Chrome ≥ 113, Firefox ≥ 129, Safari ≥ 17) and
   ECDSA-P256 universal availability alongside the `engines.node`
   declaration.

4. **Track HMAC-pepper review** for re-execution when the first
   production provider implementing `derive` lands under
   `@agent-commerce-trust/core/providers`.

5. **Track production-provider authoring guidance** for the §1.5,
   §1.6, §1.7, §1.8, and §5.3 advisories: each maps to a guideline
   the production-providers authoring spec should pick up.

---

## Sign-off

Reviewed against the source at the current tip of
`feat/core-security-review-rc1` after the round-7 Codex re-review and
the closures recorded above. Re-review required if any of the
following are modified before publish:

- `packages/core/src/canonical.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/keys/*`
- `packages/core/src/dev/in-memory-key-provider.ts`
- `packages/core/package.json` (exports field, dependencies)
