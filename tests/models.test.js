// Behavioral tests for CC.models.contextLimitForModel — the model-string →
// context-window lookup.
//
// Model-id strings below are best guesses marked FIXTURE-PROVISIONAL: swap in
// real strings once one is captured from a live conversation GET (the lookup
// is substring-based precisely so minor suffix drift doesn't break it).

import { describe, it, expect } from 'vitest';

await import('../src/content/constants.js');
await import('../src/content/models.js');
const CC = globalThis.ClaudeCounter;

const limit = (model) => CC.models.contextLimitForModel(model);

describe('1M-window models', () => {
	it('maps opus-5 and sonnet-5 family strings to 1,000,000', () => {
		expect(limit('claude-opus-5')).toBe(1_000_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-sonnet-5')).toBe(1_000_000); // FIXTURE-PROVISIONAL
	});

	it('tolerates date/version suffixes on 1M models', () => {
		expect(limit('claude-opus-5-20270101')).toBe(1_000_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-sonnet-5-1')).toBe(1_000_000); // FIXTURE-PROVISIONAL
	});
});

describe('500K-window models', () => {
	it('maps opus-4 and sonnet-4 minor variants to 500,000', () => {
		expect(limit('claude-opus-4-6')).toBe(500_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-opus-4-7')).toBe(500_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-opus-4-8')).toBe(500_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-sonnet-4-6')).toBe(500_000); // FIXTURE-PROVISIONAL
	});

	it('does not confuse a 4-family minor version with a 5-family model', () => {
		// "claude-sonnet-4-5" contains "sonnet-4" and must land on 500K,
		// even though a naive glance sees a 5 in it.
		expect(limit('claude-sonnet-4-5')).toBe(500_000); // FIXTURE-PROVISIONAL
	});
});

describe('200K default', () => {
	it('maps haiku family strings to 200,000', () => {
		expect(limit('claude-haiku-4-5')).toBe(200_000); // FIXTURE-PROVISIONAL
		expect(limit('claude-3-5-haiku-20241022')).toBe(200_000); // FIXTURE-PROVISIONAL
	});

	it('maps unrecognized model strings to 200,000', () => {
		expect(limit('claude-mystery-9')).toBe(200_000);
		expect(limit('gpt-6-turbo')).toBe(200_000);
	});

	it('maps null, undefined, and empty strings to 200,000', () => {
		expect(limit(null)).toBe(200_000);
		expect(limit(undefined)).toBe(200_000);
		expect(limit('')).toBe(200_000);
	});

	it('maps non-string inputs to 200,000', () => {
		expect(limit(42)).toBe(200_000);
		expect(limit({ model: 'claude-opus-5' })).toBe(200_000);
	});
});
