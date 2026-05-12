---
name: Security report
about: Report a suspected vulnerability — please DO NOT file public issues for active vulnerabilities
title: '[security] '
labels: security
---

> ⚠️ **For active or unpatched vulnerabilities, please follow the
> private-disclosure path in [`SECURITY.md`](../../SECURITY.md) instead
> of filing a public issue.** This template is for already-disclosed
> security findings, follow-up tracking, or low-sensitivity hardening
> requests.

**Package + version affected**
- Package: `@agent-commerce-trust/<package>`
- Version: `0.1.0-rc.X`

**Finding category**
- [ ] Cryptographic correctness
- [ ] Authorisation bypass
- [ ] Information disclosure (logs, error messages, side channels)
- [ ] DoS / resource exhaustion
- [ ] Supply-chain (dependency, provenance)
- [ ] Other:

**Description**
Brief description of the finding. Cite the affected file:line if you
have a source reference.

**Impact**
Who is affected, under what conditions, and with what severity?

**Mitigation / suggested fix**
If you have a recommended fix or a workaround, include it here. If the
finding is already documented in
[`packages/<pkg>/SECURITY_REVIEW_<release>.md`](../../packages),
reference the §-anchor.
