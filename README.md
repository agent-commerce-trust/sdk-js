# Agent Commerce Trust SDK JS

Local scaffold for the seven-package Trust Layer JavaScript workspace.

Phase-1 packages:

- `@agent-commerce-trust/core`
- `@agent-commerce-trust/commerce-mcp`
- `@agent-commerce-trust/supplier`
- `@agent-commerce-trust/verifier`
- `@agent-commerce-trust/agent`

Deferred namespace-reservation packages:

- `@agent-commerce-trust/agent-mcp`
- `@agent-commerce-trust/witness`

All packages start at `0.1.0-rc.0`. Deferred packages are intended to be published with namespace-reservation stubs and then marked deprecated in npm registry metadata:

```bash
npm deprecate @agent-commerce-trust/<pkg>@0.1.0-rc.0 "Namespace reserved — package not yet published"
```

## Verification

Run the full local substrate before any release candidate:

```bash
npm ci
npm run verify:ci
```

`verify:ci` runs:

- workspace package tests
- publish-readiness metadata checks
- deferred package deprecation verification
- publish dry runs for all seven workspace packages

The GitHub workflow runs the same command on pushes to `main`, pull requests, and manual dispatches.

## Release dry run

This workspace is publish-ready only when `npm run verify:ci` passes from a clean install. The dry run does not publish packages; it executes `npm publish --dry-run --access public --tag rc --json` for each package and asserts that all five Phase-1 packages plus the two deferred namespace packages are covered.

Publishing remains a manual registry operation for this scaffold:

```bash
npm publish --workspace @agent-commerce-trust/core --access public
npm publish --workspace @agent-commerce-trust/commerce-mcp --access public
npm publish --workspace @agent-commerce-trust/supplier --access public
npm publish --workspace @agent-commerce-trust/verifier --access public
npm publish --workspace @agent-commerce-trust/agent --access public
npm publish --workspace @agent-commerce-trust/agent-mcp --access public
npm publish --workspace @agent-commerce-trust/witness --access public
```

After publishing the deferred namespace packages, apply the registry deprecation metadata exactly:

```bash
npm run deprecate:deferred
```

See `RELEASING.md` for provenance, npm-scope, and monorepo split criteria.
