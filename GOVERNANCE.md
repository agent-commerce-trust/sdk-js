# Governance

Agent Commerce Trust SDK JS is currently maintained under Airheart-anchored governance. Airheart maintainers review changes, publish release candidates, and coordinate security response while the package ecosystem moves toward external adoption.

## Decision Process

- Editorial and documentation changes may land through normal pull-request review.
- Package-surface changes should start with an issue or discussion.
- Dependency additions require explicit rationale and release-readiness impact.
- Breaking changes before `v1.0.0` are allowed but must be recorded in `CHANGELOG.md`.

## Release Authority

Release candidates are published only after `npm run verify:ci` passes from a clean install and the `@ap2-travel/profile` prerequisite package has a compatible published version. See `RELEASING.md` for the publish order, provenance requirements, and deferred-stub deprecation checks.

## Monorepo Split Criteria

Packages remain in this monorepo until one of the triggers in `RELEASING.md` fires: external maintainership, materially divergent release cadence, or activation of a deferred namespace package into a real surface.
