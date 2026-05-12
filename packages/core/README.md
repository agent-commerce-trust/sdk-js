# @agent-commerce-trust/core

Shared trust-layer primitives: canonical JSON serialization, WebCrypto-backed
SHA-256/384 hashing, the typed error hierarchy, the normative payloadType ↔
purpose mapping, a domain-separated signing-input helper, and AP2 base
mandate construction + validation helpers.

> ⚠️ **`@agent-commerce-trust/core/dev` is for tests and local development only.**
> The `/dev` subpath ships an in-memory `KeyProvider` whose private keys live in
> JS heap memory and are extractable. Never use it in production. Production
> deployments resolve keys through KMS/HSM-backed implementations under the
> `@agent-commerce-trust/core/providers` subpath, which is reserved (no
> exports) until concrete production providers land.
