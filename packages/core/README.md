# `@agent-commerce-trust/core`

Shared trust-layer primitives for the Agent Commerce Trust ecosystem.
Profile-neutral foundations: canonical JSON serialisation, WebCrypto-backed
SHA-256 / SHA-384 hashing, the typed error hierarchy, the normative
`payloadType ↔ purpose` mapping, the domain-separated signing-input
helper, AP2 base mandate construction + validation, and the `KeyProvider`
interface contract every signing / verifying surface accepts.

This package is the substrate every other `@agent-commerce-trust/*`
package depends on. It is intentionally profile-neutral: vertical
profiles (AP2-Travel, AP2-Health, AP2-Procure, …) depend on core, never
the reverse.

---

## Status

`0.1.0-rc.1` — the first public-surface release-candidate.

The pre-1.0 release-candidate cycle is governed by the project's
[`RELEASING.md`](../../RELEASING.md). The rc.1 surface is bound by §5.1
(package entry criteria) and §7 (normative contracts) of the canonical
trust-layer SDK doc; every public export traces to one of those anchors
and the boundary is machine-enforced by
[`tests/core-invariant-export-traceability.test.js`](../../tests/core-invariant-export-traceability.test.js).

## Install

```bash
npm install @agent-commerce-trust/core
```

The package ships ESM + CJS + `.d.ts` + `.d.cts` dual-output, with two
exports entries:

| Subpath | Use | Source |
|---|---|---|
| `@agent-commerce-trust/core` | Production-safe primitives + types | `dist/index.{js,cjs,d.ts,d.cts}` |
| `@agent-commerce-trust/core/dev` | **Test/dev only** — in-memory key provider | `dist/dev/index.{js,cjs,d.ts,d.cts}` |
| `@agent-commerce-trust/core/providers` | *(reserved)* — production KMS/HSM providers | not resolvable at this release |

The `/providers` subpath is currently `null` in `package.json` exports,
meaning `import('@agent-commerce-trust/core/providers')` rejects with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. The namespace is reserved for future
production providers (Aws/Gcp/Azure KMS, PKCS#11, FIDO2, RemoteSigner).

## Runtime requirements

- **Node.js ≥ 20** (declared in `engines.node`). Required for native
  WebCrypto `globalThis.crypto.subtle`. No `node:`-prefixed imports —
  the package is browser-safe.
- **Browsers**: any browser with WebCrypto support; specifically for
  Ed25519 signing the minimums are:

  | Browser | Ed25519 SubtleCrypto (default-on) |
  |---|---|
  | Chrome / Edge | ≥ 137 |
  | Firefox | ≥ 129 |
  | Safari | ≥ 17 |

  Older browsers can use ECDSA-P256, which is universally supported.
  Fall back or feature-detect Ed25519 via
  `globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, ...)`
  before relying on it in production browser code.

## Quickstart

The fastest way to exercise the surface is the
[`examples/core-quickstart/`](./examples/core-quickstart/) walkthrough,
which signs an offer with the in-memory provider and verifies the
signature independently.

```ts
import {
  canonicalBytes,
  buildSigningInput,
  createIntentMandate,
} from '@agent-commerce-trust/core'
import { InMemoryKeyProvider } from '@agent-commerce-trust/core/dev'

// 1) Provision a test key. (Use a KMS-backed KeyProvider in production.)
const provider = new InMemoryKeyProvider({ providerId: 'demo' })
const key = await provider.generateSigningKey({
  algorithm: 'Ed25519',
  purposes: ['sign-intent-mandate'],
})

// 2) Construct an AP2 IntentMandate envelope around a profile-neutral payload.
const intent = createIntentMandate(
  { goal: 'buy widget', amountUsdCents: 12500 },
  {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    issuer: 'did:web:agent.example.com',
    principal: 'did:web:user.example.com',
  },
)

// 3) Canonicalise + sign. payloadType is hashed into the signing context
//    as a domain separator so cross-payloadType signature replay fails.
const payload = canonicalBytes(intent)
const result = await provider.sign({
  keyId: key.keyId,
  algorithm: 'Ed25519',
  payload,
  payloadType: 'ap2.IntentMandate/v1',
  purpose: 'sign-intent-mandate',
})

// 4) Independent verification — reconstruct the signing input the same
//    way and feed it to crypto.subtle.verify.
const pub = await provider.getPublicKey(key.keyId)
const publicCryptoKey = await globalThis.crypto.subtle.importKey(
  'raw',
  pub.encoded,
  { name: 'Ed25519' },
  false,
  ['verify'],
)
const signingInput = await buildSigningInput({
  payload,
  payloadType: 'ap2.IntentMandate/v1',
})
const ok = await globalThis.crypto.subtle.verify(
  { name: 'Ed25519' },
  publicCryptoKey,
  result.signature,
  signingInput,
)
console.log(ok) // true
```

## Public surface

Every runtime export below traces to either §5.1 (rc.1 entry criteria)
or §7 (normative contracts) of `trust-layer-sdk.md`.

### Canonicalisation + hashing (§5.1)

| Export | Shape | Notes |
|---|---|---|
| `canonicalize(value)` | `(unknown) => string` | RFC 8785 (JCS) — UTF-16 code-unit sort, undefined-dropped, lone-surrogate rejection, plain-objects-only |
| `canonicalBytes(value)` | `(unknown) => Uint8Array` | UTF-8 encoding of `canonicalize(value)` |
| `sha256Hex(value)` | `(unknown) => Promise<string>` | 64-hex-char SHA-256 of `canonicalBytes(value)` |
| `sha384Hex(value)` | `(unknown) => Promise<string>` | 96-hex-char SHA-384 of `canonicalBytes(value)` |

### Domain-separated signing input (§7.1)

| Export | Shape |
|---|---|
| `buildSigningInput({ payload, payloadType, context? })` | `(parts) => Promise<Uint8Array>` |
| Type `SigningInputParts` | `{ payload, payloadType, context? }` |

Construction: `SHA-256(canonicalBytes({payloadType, context}))` (32 bytes)
prepended to `payload`. A signature over `ap2.IntentMandate/v1` cannot
be replayed against `ap2.CartMandate/v1` even when the inner bytes
coincide.

### Error hierarchy (§7.1)

```
TrustLayerError
├── CanonicalizationError       (code: 'canonicalization')
├── MandateError                (code: 'mandate')
├── VerificationError           (code: 'verification')
└── KeyProviderError            (code: caller-supplied or fixed by child)
    ├── KeyNotFoundError                     (code: 'key-not-found')
    ├── KeyPurposeMismatchError              (code: 'key-purpose-mismatch')
    ├── KeyPurposePayloadTypeMismatchError   (code: 'key-purpose-payload-type-mismatch')
    ├── KeyExpiredError                      (code: 'key-expired')
    ├── KeyRevokedError                      (code: 'key-revoked')
    ├── KmsUnavailableError                  (code: 'kms-unavailable')
    ├── AlgorithmUnsupportedError            (code: 'algorithm-unsupported')
    └── RateLimitExceededError               (code: 'rate-limit-exceeded')
```

Discriminate via `instanceof`. Never match on error message or code
string contents.

### `payloadType ↔ purpose` mapping + validator (§7.1)

| Export | Shape |
|---|---|
| `PAYLOAD_TYPE_PURPOSE_MAP` | `ReadonlyMap<string, KeyPurpose>` (frozen at module load) |
| `validatePayloadTypePurpose(payloadType, purpose)` | `(string, KeyPurpose) => void` (throws `KeyPurposePayloadTypeMismatchError`) |

The map is Proxy-frozen — mutation attempts (including the
`Map.prototype.set.call(...)` prototype-bypass path) throw.

### AP2 base mandate construction + validation (§5.1)

| Export | Notes |
|---|---|
| `createIntentMandate(payload, opts)` | Chain root. `correlationID` defaults to the mandate's nonce. |
| `createCartMandate(payload, { intent, … })` | References `intent.nonce`; inherits `correlationID` |
| `createPaymentMandate(payload, { cart, … })` | References `cart.nonce`; inherits `correlationID` |
| `validateIntentMandate(value)` | Asserts envelope shape; throws `MandateError` on failure |
| `validateCartMandate(value)` | … |
| `validatePaymentMandate(value)` | … |

Validators check envelope shape, strict ISO 8601 timestamp form, and
calendar validity. They do NOT verify signatures or chain integrity —
those belong to a verifier package downstream.

### Types

`@agent-commerce-trust/core` re-exports type-only symbols for the
§7.1 `KeyProvider` contract: `KeyProvider`, `KeyRef`, `SigningKeyRef`,
`DeriveKeyRef`, `SignRequest`, `SignResult`, `DeriveRequest`,
`DeriveResult`, `SigningEvent`, `Algorithm`, `KeyVersion`, `PublicKey`,
`PublicKeyRef`, `KeyPurpose`, `SigningKeyPurpose`, `DeriveKeyPurpose`,
`KeyScope`, `RotationPolicy`, `Unsubscribe`, plus the mandate envelope
types `IntentMandate<T>`, `CartMandate<T>`, `PaymentMandate<T>`,
`MandateMetadata`, `MandateRef`, `AnyMandate<T>`.

`@agent-commerce-trust/core/dev` adds the test-only
`InMemoryKeyProvider` class plus its
`InMemoryKeyProviderOptions` and `GenerateSigningKeyOptions` option
types.

## Cross-language guidance

`canonicalize` is JCS-shaped and the AP2-Travel Go reference
(`agent-commerce-trust/ap2-travel/reference/go/signing.CanonicalSerialize`)
produces byte-identical output for byte-identical input on the AP2
base mandate shapes. For cross-language interop:

- **Prefer integer-cents amounts and ISO 8601 timestamps** in mandate
  payloads. Floating-point numbers vary in their canonical
  representation across JSON libraries; this is a language-runtime
  drift hazard, not a RFC 8785 spec issue.
- **Don't embed locale-formatted strings** (currency symbols, decimal
  separators, …) — use machine-readable codes and let the consumer
  format for display.
- **Normalise Unicode** to NFC at the producer if you need
  cross-input equivalence. RFC 8785 (and this implementation) do not
  normalise.

## Security review

Pre-publish security review at
[`SECURITY_REVIEW_rc1.md`](./SECURITY_REVIEW_rc1.md). Covers
`KeyProvider` purpose-enforcement bypass paths, canonical-bytes
correctness against RFC 8785, hashing-primitive integrity (algorithm
confusion + length extension), browser-safety audit, and test-fixture
key handling. Result: 0 unresolved blockers, 11 documented
advisories, 4 source-level findings closed in the same commit.

## Specification anchors

- **Canonical SDK doc**: [`trust-layer-sdk.md`](https://github.com/agent-commerce-trust/ap2-travel)
  §5.1 (package entry criteria), §7 (normative contracts), §9.1 (rc
  publish gate).
- **AP2-Travel reference profile**: the published canonical doc set
  ships alongside the AP2-Travel repository.
- **RFC 8785** ("JSON Canonicalization Scheme") — the canonical-bytes
  encoding.

## Contributing

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and the
[`CODE_OF_CONDUCT.md`](../../CODE_OF_CONDUCT.md) at the repo root.
The Agent Commerce Trust project uses the Apache 2.0 license; all
contributions are licensed under the same terms.

## Changelog

[`CHANGELOG.md`](./CHANGELOG.md) for this package; the workspace-level
[`CHANGELOG.md`](../../CHANGELOG.md) tracks substrate work across
packages.
