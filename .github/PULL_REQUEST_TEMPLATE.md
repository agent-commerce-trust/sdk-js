## Summary

<!-- 1-3 sentences. What changed and why. -->

## Package(s) affected

- [ ] `@agent-commerce-trust/core`
- [ ] `@agent-commerce-trust/core/dev`
- [ ] `@agent-commerce-trust/agent`
- [ ] `@agent-commerce-trust/agent-mcp`
- [ ] `@agent-commerce-trust/commerce-mcp`
- [ ] `@agent-commerce-trust/supplier`
- [ ] `@agent-commerce-trust/verifier`
- [ ] `@agent-commerce-trust/witness`
- [ ] Workspace / tooling only (no published-package surface change)

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (requires a major or rc bump per `RELEASING.md`)
- [ ] Documentation / repository hygiene
- [ ] Test-only

## Specification anchors

<!--
Cite the canonical SDK doc anchors this change touches or derives from,
e.g. `trust-layer-sdk.md` §5.1 (rc.1 entry criteria), §7 (normative
contracts). For changes that introduce a new public symbol, the
`tests/core-invariant-export-traceability.test.js` allowlist must be
updated; reference the new allowlist row here.
-->

## Test plan

<!-- The test runs you executed locally. -->

- [ ] `npm run verify:ci` (Node 20 + Node 22) green
- [ ] Browser-environment tests (`test:browser`) green
- [ ] Lint clean across all workspaces
- [ ] Publish dry-run clean across all packages

## Security considerations

<!--
If the change touches any of the following surfaces, summarise the
security impact and link to the relevant
`SECURITY_REVIEW_<release>.md` section:
  - Canonical-bytes serialisation
  - Hashing / signing primitives
  - KeyProvider interface, error hierarchy, or audit hook
  - package.json exports field or runtime dependencies
  - browser bundle output
-->

## Checklist

- [ ] PR description explains the why, not just the what
- [ ] Commit messages follow the existing pattern (no `Co-Authored-By:
      Claude` trailer in `agent-commerce-trust/*` repos)
- [ ] No spec-internal references in code/test comments
- [ ] Public-surface changes update `tests/core-invariant-export-traceability.test.js`
- [ ] CHANGELOG.md entry added under the relevant package (if surface-affecting)
