export type PublicKeyRef =
  | { readonly kind: 'did'; readonly did: string; readonly fragment: string }
  | { readonly kind: 'pem'; readonly pem: string }
  | { readonly kind: 'jwk'; readonly jwk: Readonly<Record<string, unknown>> }
