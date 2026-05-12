# core-quickstart

End-to-end walkthrough of the `@agent-commerce-trust/core` rc.1 surface:

1. Provision an in-memory test key.
2. Construct an AP2 Intent → Cart → Payment chain.
3. Sign each mandate with the correct purpose.
4. Verify each signature independently using the matching public key
   reconstructed from the provider's `getPublicKey()` output.
5. Demonstrate that domain separation prevents cross-`payloadType`
   replay.

## Running

From the repository root:

```bash
node packages/core/examples/core-quickstart/index.mjs
```

The example uses only `@agent-commerce-trust/core` and
`@agent-commerce-trust/core/dev`. No external dependencies.

## What the output should look like

```
[step 1] in-memory provider ready (providerId=demo)
[step 2] intent / cart / payment chain assembled (correlationID=…)
[step 3] all three mandates signed
[step 4] all three signatures verify independently against the public keys
[step 5] cross-payloadType replay attempt failed as expected
✓ core-quickstart: 5 / 5 steps green
```

## What this example is NOT

- A production deployment template. Use a real KMS/HSM-backed
  `KeyProvider` (`@agent-commerce-trust/core/providers`, available in a
  later release) for production. The in-memory provider's private
  keys live in JS heap and are extractable; they are unsafe outside
  test and local-dev contexts.
- A receipt-verification harness. Independent verification here uses
  WebCrypto `crypto.subtle.verify` directly against the public key.
  The forthcoming `@agent-commerce-trust/verifier` package will
  wrap this with chain-integrity checks and well-known-JWKS discovery.
