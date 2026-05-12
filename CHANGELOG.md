# Changelog

All notable changes to the Agent Commerce Trust JavaScript packages are recorded here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses pre-v1 semantic versioning.

## Unreleased

### Added

- `@agent-commerce-trust/core@0.1.0-rc.1` first public release-candidate.
  See [`packages/core/CHANGELOG.md`](./packages/core/CHANGELOG.md) for
  the full package-level entry covering the canonicalisation /
  hashing / error-hierarchy / `KeyProvider` / domain-separated
  signing-input / AP2 base mandate / `InMemoryKeyProvider` surface and
  the four source-level findings closed during pre-publish security
  review.
- Apache 2.0 [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) at the
  repo root, also copied into `packages/core/` for the published
  tarball.
- GitHub repository hygiene:
  [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) (bug /
  feature / security templates) and
  [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md).
- `packages/core/examples/core-quickstart/` end-to-end walkthrough
  demonstrating chain assembly, signing, independent verification,
  and cross-payloadType replay defence.

### Changed

- `scripts/workspace-packages.js` now exposes per-package version
  expectations via `packageVersionOverrides` + `expectedVersionFor()`.
  Allows individual Phase-1 packages to be promoted past the
  workspace default version one at a time. Core is the first
  override, set to `0.1.0-rc.1`.
- `scripts/verify-publish-readiness.js` enforces the Appendix C
  publishing-checklist artifacts (LICENSE, NOTICE, CHANGELOG.md in
  both `files` and on disk) for any package promoted past the
  workspace default version.
- Phase-1 packages (`agent`, `commerce-mcp`, `supplier`, `verifier`)
  bumped their declared `@agent-commerce-trust/core` dependency from
  `0.1.0-rc.0` to `0.1.0-rc.1`. These packages remain at their own
  rc.0 stub state until their own public-surface promotion lands.

## [0.1.0-rc.0] - 2026-05-01

### Added

- Initial seven-package npm workspace for `@agent-commerce-trust/*`.
- Phase-1 package scaffolds for `core`, `commerce-mcp`, `supplier`, `verifier`, and `agent`.
- Deferred namespace-reservation stubs for `agent-mcp` and `witness`.
- Dual ESM/CommonJS builds, TypeScript declarations, package-role exports, publish-readiness checks, deferred-deprecation checks, and publish dry-run verification.
- Local `@ap2-travel/profile` prerequisite wiring for pre-publish verification against the canonical AP2-Travel repository.
