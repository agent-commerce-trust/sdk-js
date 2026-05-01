# Releasing

This workspace publishes the seven `@agent-commerce-trust/*` packages from the canonical `agent-commerce-trust/sdk-js` repository.

## Prerequisites

- The `@agent-commerce-trust` npm org is owned by an Airheart-controlled account.
- The `@ap2-travel` npm org is owned by an Airheart-controlled account and uses the same publish-token controls as `@agent-commerce-trust`.
- CI publish tokens are npm automation tokens with publish rights only for the two scopes.
- GitHub Actions release jobs use OIDC and `npm publish --provenance` for SLSA provenance attestations.
- `@ap2-travel/profile@0.1.0-rc.0` is published from the canonical `agent-commerce-trust/ap2-travel` repository before publishing this workspace without the local `file:` dependency.

## Local Verification

Run the full substrate from a clean install:

```bash
npm ci
npm run verify:ci
```

`verify:ci` builds the local `@ap2-travel/profile` dependency when the sibling canonical repo exists, builds all workspace packages with ESM and CJS outputs, runs tests, typechecks, verifies package metadata, verifies deferred deprecation intent or registry metadata, and runs `npm publish --dry-run --access public --tag rc` for all seven packages.

## Publish

Publish the five Phase-1 packages first:

```bash
npm publish --workspace @agent-commerce-trust/core --access public --tag rc --provenance
npm publish --workspace @agent-commerce-trust/commerce-mcp --access public --tag rc --provenance
npm publish --workspace @agent-commerce-trust/supplier --access public --tag rc --provenance
npm publish --workspace @agent-commerce-trust/verifier --access public --tag rc --provenance
npm publish --workspace @agent-commerce-trust/agent --access public --tag rc --provenance
```

Then publish and immediately deprecate the two deferred namespace-reservation packages:

```bash
npm publish --workspace @agent-commerce-trust/agent-mcp --access public --tag rc --provenance
npm publish --workspace @agent-commerce-trust/witness --access public --tag rc --provenance
npm run deprecate:deferred
```

Verify registry metadata:

```bash
npm view @agent-commerce-trust/agent-mcp@0.1.0-rc.0 deprecated
npm view @agent-commerce-trust/witness@0.1.0-rc.0 deprecated
```

Both commands must return exactly:

```text
Namespace reserved — package not yet published
```

## Monorepo Split Criteria

Keep the packages in this monorepo until one of these triggers fires:

- A package acquires non-Airheart maintainers.
- A package release cadence diverges materially from the rest of the workspace.
- A deferred-stub package activates content and graduates from namespace reservation to a real public surface.

When one trigger fires, split only the affected package after preserving package history, npm ownership, provenance settings, and compatibility constraints.
