# Changelog — `@agent-commerce-trust/core`

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
during the pre-1.0 release-candidate cycle per the workspace
[`RELEASING.md`](../../RELEASING.md).

## [0.1.0-rc.1] — Unreleased

First public release-candidate. Substrate scaffolding promoted to a
real public surface bound by §5.1 (entry criteria) and §7 (normative
contracts) of the canonical trust-layer SDK doc.

### Added

#### Canonicalisation + hashing (§5.1)

- `canonicalize(value): string` — RFC 8785 (JCS) canonical JSON
  serialiser. UTF-16 code-unit key sort (§3.2.3), `undefined`-property
  drop, non-finite-number rejection, lone-surrogate rejection
  (§3.2.2.2), plain-objects-only (rejects `Map` / `Date` / `Set` /
  `RegExp` / class instances).
- `canonicalBytes(value): Uint8Array` — UTF-8 encoding of
  `canonicalize`.
- `sha256Hex(value): Promise<string>` — 64-hex-char SHA-256 via
  WebCrypto.
- `sha384Hex(value): Promise<string>` — 96-hex-char SHA-384 via
  WebCrypto.

#### Typed error hierarchy (§7.1)

`TrustLayerError` base, with subclass tree: `CanonicalizationError`,
`MandateError`, `VerificationError`, `KeyProviderError` →
{`KeyNotFoundError`, `KeyPurposeMismatchError`,
`KeyPurposePayloadTypeMismatchError`, `KeyExpiredError`,
`KeyRevokedError`, `KmsUnavailableError`, `AlgorithmUnsupportedError`,
`RateLimitExceededError`}. Discriminate via `instanceof`; each error
class carries a stable `code` string.

#### `KeyProvider` contract types (§7.1)

`KeyProvider`, `KeyRef` (`SigningKeyRef` + `DeriveKeyRef` discriminated
union), `SignRequest`, `SignResult`, `DeriveRequest`, `DeriveResult`,
`SigningEvent` (six-variant audit-event union covering the full sign +
derive request/result/error lifecycle).

#### Foundational types (§7.1)

`Algorithm` (`'Ed25519' | 'ECDSA_P256'`), `KeyVersion`, `PublicKey`,
`PublicKeyRef` (`did`/`pem`/`jwk` discriminated union), `KeyPurpose`
(21-entry enum covering AP2 mandate purposes through
`sign-trust-root-update`), `SigningKeyPurpose`, `DeriveKeyPurpose`,
`KeyScope`, `RotationPolicy`, `Unsubscribe`.

#### `payloadType ↔ purpose` mapping + validator (§7.1)

- `PAYLOAD_TYPE_PURPOSE_MAP: ReadonlyMap<string, KeyPurpose>` —
  Proxy-frozen at module load; 21 normative rows from the canonical
  doc's §7.1 mapping table. Prototype-bypass mutation
  (`Map.prototype.set.call(...)`) also rejected.
- `validatePayloadTypePurpose(payloadType, purpose): void` — throws
  `KeyPurposePayloadTypeMismatchError` for unknown `payloadType` or
  known-but-mismatched-`purpose`.

#### Domain-separated signing input (§7.1)

- `buildSigningInput({ payload, payloadType, context? }): Promise<Uint8Array>`
  — produces `SHA-256(canonicalBytes({payloadType, context}))`
  prepended to `payload`. Verifiers reconstruct the same input from
  the matching fields. Defeats cross-`payloadType` signature replay.
- `SigningInputParts` type.

#### AP2 base mandate construction + validation (§5.1)

- `createIntentMandate(payload, opts)` — chain root.
- `createCartMandate(payload, { intent, … })` — references
  `intent.nonce`; inherits `correlationID`.
- `createPaymentMandate(payload, { cart, … })` — references
  `cart.nonce`; inherits `correlationID`.
- `validateIntentMandate` / `validateCartMandate` /
  `validatePaymentMandate` — strict ISO 8601 timestamp form +
  calendar validity + envelope shape; throw `MandateError` on
  failure. Type-narrowing assertion functions.
- Mandate envelope types: `IntentMandate<T>`, `CartMandate<T>`,
  `PaymentMandate<T>`, `MandateMetadata`, `MandateRef`,
  `AnyMandate<T>`.

#### `@agent-commerce-trust/core/dev` subpath

- `InMemoryKeyProvider` — WebCrypto-backed test/dev `KeyProvider`
  implementation. Ed25519 + ECDSA-P256 sign/verify round trips.
  Returned `SigningKeyRef` is deep-frozen (mutating
  `ref.purposes` throws). Audit hook (`onSigningEvent`) emits
  `sign-request` / `sign-result` / `sign-error` variants.
- `InMemoryKeyProviderOptions`, `GenerateSigningKeyOptions` types.

#### `@agent-commerce-trust/core/providers` subpath

Reserved (`null` in `package.json` exports). `import(...)` rejects
with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Production providers
(Aws/Gcp/Azure KMS, PKCS#11, FIDO2, RemoteSigner) ship here in a
later release.

#### Tests + invariants

- 146 tests total (142 Node + 4 happy-dom browser); CI matrix runs
  Node 20 + Node 22.
- Conformance suite at `tests/core-conformance-*.test.js` (canonical,
  signing, mandates, cross-profile, imports).
- Invariant guards at `tests/core-invariant-*.test.js`:
  dependency-graph (no `@ap2-travel/*` deps), browser-bundle-scan
  (no `node:` imports in dist), providers-subpath-negative
  (`/providers` does not resolve), export-traceability (every public
  symbol maps to a §5.1 / §7.X anchor).

### Security review

Pre-publish security review at
[`SECURITY_REVIEW_rc1.md`](./SECURITY_REVIEW_rc1.md). 0 unresolved
blockers; 11 documented advisories with mitigations; 4 source-level
findings raised during review and closed by source fixes in the same
commit (deep-freeze of returned `SigningKeyRef`, UTF-16 code-unit
sort, plain-object discriminator for canonicalisation, lone-surrogate
rejection).

### Notes

- This is the first published version of `@agent-commerce-trust/core`.
  The package metadata moves from the substrate `0.1.0-rc.0` stub state
  to the rc.1 public surface as part of this release.
- `engines.node: ">=20"` — native WebCrypto is required. No
  `node:`-prefixed imports anywhere; the package runs in browsers
  whose WebCrypto surface meets the documented support matrix.
- License: Apache 2.0 (see [`LICENSE`](./LICENSE) and
  [`NOTICE`](./NOTICE)).
