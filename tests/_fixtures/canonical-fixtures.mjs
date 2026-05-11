/**
 * Shared canonical + hashing reference fixtures for `@agent-commerce-trust/core`.
 *
 * Each row encodes (name, input, canonical-string, expected-SHA-256-hex,
 * expected-SHA-384-hex). Generated once via the canonical + WebCrypto pipeline
 * and frozen here; mutation of either canonicalize or the digest helpers
 * against any row breaks the regression boundary.
 *
 * Imported by:
 *   - tests/core-canonical.test.js          (Node-env suite)
 *   - tests/core-canonical.browser.test.mjs (browser-env suite under happy-dom)
 *
 * Both runtimes must produce identical bytes + digests for every row, so any
 * divergence between Node's native WebCrypto and happy-dom's WebCrypto
 * implementation surfaces immediately.
 */
export const canonicalReferenceFixtures = Object.freeze([
	{
		name: 'empty object',
		input: {},
		canonical: '{}',
		sha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
		sha384: 'd2a23bc783e3aa38f401e13c7488505137c4954a7fd88331f1597c5ff71111dc807c7370a5b282c6da541c56ede69f30',
	},
	{
		name: 'empty array',
		input: [],
		canonical: '[]',
		sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
		sha384: '562109b054cb4428fc53607b107c0acdf91de434b990a0295f516ef2aad79efc902238944e76d42f21bcf710bfa4c554',
	},
	{
		name: 'empty string',
		input: '',
		canonical: '""',
		sha256: '12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126',
		sha384: 'd39743d0be940c649b55e7bcc34b3b127e30a2a2a10558d92f532f434ceb40af3d2d766bbfbcb7ef9f3ce7e32a9a2345',
	},
	{
		name: 'single key-value',
		input: { a: 1 },
		canonical: '{"a":1}',
		sha256: '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862',
		sha384: 'e3b2506b8e00695d28cdb60b75a444331c4a33296b3d3c338d3c02f18821d2ce211e29feb62f94489300e43b866c1e7e',
	},
	{
		name: 'two keys sorted',
		input: { a: 1, b: 2 },
		canonical: '{"a":1,"b":2}',
		sha256: '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
		sha384: '5b5061937d9429347654a4a661c91ebd23a83dd2233309e3d1a9eaab2085f2399ddfaee0fccfb405324e6bb5e008400b',
	},
	{
		name: 'object with embedded array',
		input: { a: 1, b: 2, c: [1, 2, 3] },
		canonical: '{"a":1,"b":2,"c":[1,2,3]}',
		sha256: '84f4af92bec11c6859051af709e559ebaf58dba8fda10d9cc11090d044be3c25',
		sha384: 'bb702a59861528f06de57aed8e856f00894690931edece8344ac41db3885ceff3e78bea6431ca17b4ab64b2e74a4efc1',
	},
	{
		name: 'nested object with out-of-order keys',
		input: { z: 1, a: { z: 2, a: 1 } },
		canonical: '{"a":{"a":1,"z":2},"z":1}',
		sha256: '3236b7fbae2061b132634e0fa68798843c97bb661b6a1a10795fae2a91901dfb',
		sha384: 'b6e2c6c0dff33668c184481cc6c78ac516483f89fb085e6fe61597c39e89e29ff363f65e81b93b991dd9b19a1a0f00df',
	},
	{
		name: 'Unicode key codepoint ordering ä > b > a',
		input: { b: 1, 'ä': 2, a: 3 },
		canonical: '{"a":3,"b":1,"ä":2}',
		sha256: '73e74eb9fe924b1e65bb9dffd62ce97ad97a218a2e83b9f1eb5f58c31e20d137',
		sha384: '2be72e805ab3ea0167b0d11b0bf408f458a6ffce54012bc63941c93844ef27a5bc2b23190e02ff5735892c5ae5db7ebd',
	},
	{
		name: 'nested array of objects (each sorted)',
		input: { items: [{ y: 2, x: 1 }, { b: 4, a: 3 }] },
		canonical: '{"items":[{"x":1,"y":2},{"a":3,"b":4}]}',
		sha256: '66970b9a7659e8db95ade2356899bc4b37373c8b4b5dbd8e23b7971406a08a7c',
		sha384: 'b4dbc86334a355cc984d20ad73d88a7ff9336ed8d88c0bf27de0ec5efe75f506c00fe7e14874496a83e53d2e438cf42f',
	},
])
