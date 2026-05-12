# @agent-commerce-trust/core

Shared trust-layer primitives. The real buildout starts with canonical serialization, signing helpers, AP2 helpers, and fixture utilities.

> ⚠️ **`@agent-commerce-trust/core/dev` is for tests and local development only.**
> The `/dev` subpath ships an in-memory `KeyProvider` whose private keys live in
> JS heap memory and are extractable. Never use it in production. Production
> deployments resolve keys through KMS/HSM-backed implementations shipping under
> `@agent-commerce-trust/core/providers` post-rc.1.

A full quick-start, installation guide, and links to the trust-layer
specification will land alongside the `0.1.0-rc.1` publish.
