// Characterization tests for the per-message token cache inside
// CC.tokens.computeConversationMetrics.
//
// The cache only activates when a bridge exposes `requestHash` (the real
// extension hashes in the page context). Tests stand in for that process
// boundary with node:crypto — the fake replaces the *other process*, never
// the unit under test.
//
// Cache hits are observed behaviorally, without peeking at internal state:
// after a first computation, the vendored tokenizer global is removed. A
// cached message still reports its original count (no re-tokenization); an
// uncached or changed message drops to 0 (re-tokenization attempted with the
// tokenizer gone). The tokenizer is restored after each test.
//
// This file runs separately from tokens.test.js so its bridge stub and
// tokenizer manipulation cannot leak into the no-bridge characterization.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { loadContentScripts, makeConversation, textMessage } from './helpers/load.js';

const CC = await loadContentScripts();
const metrics = (conv) => CC.tokens.computeConversationMetrics(conv);

const realTokenizer = globalThis.GPTTokenizer_o200k_base;

const workingBridge = {
	requestHash: async (text) => ({ hash: createHash('sha256').update(text).digest('hex') })
};

beforeEach(() => {
	CC.bridge = workingBridge;
});

afterEach(() => {
	globalThis.GPTTokenizer_o200k_base = realTokenizer;
	delete CC.bridge;
});

// "cache me if you can" -> 5 tokens (real o200k count, locked in).
// Assertions use textTokens (raw counts): the cache stores raw per-message
// counts, and the ×1.2 display calibration is out of scope here.

describe('token cache with a working hash bridge', () => {
	it('serves an unchanged message from cache instead of re-tokenizing', async () => {
		const conv = makeConversation([textMessage('hit-1', 'cache me if you can')], 'hit-1');
		expect((await metrics(conv)).textTokens).toBe(5);

		// Remove the tokenizer: a re-tokenization now yields 0, a cache hit keeps 5.
		delete globalThis.GPTTokenizer_o200k_base;
		expect((await metrics(conv)).textTokens).toBe(5);
	});

	it('re-tokenizes when a message with the same uuid changes text', async () => {
		const before = makeConversation([textMessage('changed-1', 'cache me if you can')], 'changed-1');
		expect((await metrics(before)).textTokens).toBe(5);

		delete globalThis.GPTTokenizer_o200k_base;
		const after = makeConversation([textMessage('changed-1', 'cache me if you can, again')], 'changed-1');
		// Changed fingerprint forces a recount; with the tokenizer gone that recount is 0,
		// proving the stale 5 was not served.
		expect((await metrics(after)).textTokens).toBe(0);
	});

	it('evicts messages that leave the trunk', async () => {
		const convA = makeConversation([textMessage('evict-1', 'cache me if you can')], 'evict-1');
		expect((await metrics(convA)).textTokens).toBe(5);

		// Computing a different conversation prunes evict-1 from the cache.
		const convB = makeConversation([textMessage('evict-2', 'hello world')], 'evict-2');
		expect((await metrics(convB)).textTokens).toBe(2);

		delete globalThis.GPTTokenizer_o200k_base;
		expect((await metrics(convA)).textTokens).toBe(0); // no longer cached
	});

});

describe('token cache degradation', () => {
	it('still counts when the bridge hash request throws', async () => {
		CC.bridge = {
			requestHash: async () => {
				throw new Error('bridge exploded');
			}
		};
		const conv = makeConversation([textMessage('throw-1', 'cache me if you can')], 'throw-1');
		expect((await metrics(conv)).textTokens).toBe(5);
	});

	it('still counts when the bridge returns no hash', async () => {
		CC.bridge = { requestHash: async () => ({}) };
		const conv = makeConversation([textMessage('nohash-1', 'cache me if you can')], 'nohash-1');
		expect((await metrics(conv)).textTokens).toBe(5);
	});

	it('does not serve cache hits without a bridge (direct count every time)', async () => {
		delete CC.bridge;
		const conv = makeConversation([textMessage('direct-1', 'cache me if you can')], 'direct-1');
		expect((await metrics(conv)).textTokens).toBe(5);

		delete globalThis.GPTTokenizer_o200k_base;
		// No fingerprint -> no cache entry -> recount with missing tokenizer -> 0.
		expect((await metrics(conv)).textTokens).toBe(0);
	});
});
