# Contributing

Thanks for your interest in Agent Commerce Trust SDK JS. The workspace is early-stage and release-candidate scoped, so compatibility and package-boundary discipline matter more than breadth.

## Before Opening A Pull Request

- Open an issue or discussion for package-surface changes, dependency changes, or release-process changes.
- Keep package names under the `@agent-commerce-trust/*` scope.
- Keep AP2-Travel vocabulary in `@ap2-travel/profile`; do not duplicate vertical profile types in this repo.
- Run `npm run verify:ci` before requesting review.

## Package Boundaries

- Every publishable package must remain `private: false`, Apache-2.0 licensed, side-effect free, and dual ESM/CommonJS.
- Phase-1 packages may depend on `@ap2-travel/profile` and on earlier `@agent-commerce-trust/*` Phase-1 packages.
- Deferred namespace packages must stay dependency-free and must export only the namespace-reservation stub until their content tracks open.

## Security

Please report suspected vulnerabilities privately using the process in `SECURITY.md`. Do not open a public issue for an active vulnerability before maintainers confirm disclosure timing.

## Code Of Conduct

All contributors are expected to follow `CODE_OF_CONDUCT.md`.
