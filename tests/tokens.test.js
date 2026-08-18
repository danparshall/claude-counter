// Characterization tests for CC.tokens.computeConversationMetrics.
//
// All tests feed crafted conversation payloads through the real shipped code,
// including the real vendored o200k_base tokenizer. Exact token counts below
// were computed once from that tokenizer and locked in as characterization
// values:
//   "hello world"                                   -> 2
//   "The quick brown fox jumps over the lazy dog."  -> 10
//   "hello\nworld"                                  -> 3
//   "attached content"                              -> 2
//
// No bridge is present in this file, so the token cache's fingerprint path is
// inert and every message is counted directly (cache behavior is covered in
// tokens-cache.test.js).
//
// Raw per-trunk text counts surface as `textTokens`. `totalTokens` is the
// calibrated display total: ceil(textTokens * 1.2) + mediaTokens, where the
// media heuristics are already in Claude-token units (calibrating them again
// would double-count the correction). The characterization values above are
// raw text counts.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadContentScripts, makeConversation, makeMessage, textMessage, ROOT_UUID } from './helpers/load.js';

const CC = await loadContentScripts();
const metrics = (conv) => CC.tokens.computeConversationMetrics(conv);

describe('trunk reconstruction', () => {
	it('walks leaf-to-root and counts only the active branch, not abandoned siblings', async () => {
		// root -> A -> B1 (abandoned sibling, 10 tokens)
		//           -> B2 (active leaf,       2 tokens)
		const conv = makeConversation(
			[
				textMessage('trunk-a', 'The quick brown fox jumps over the lazy dog.'), // parent = ROOT, 10 tokens
				textMessage('trunk-b1', 'The quick brown fox jumps over the lazy dog.', { parent: 'trunk-a' }), // abandoned sibling
				textMessage('trunk-b2', 'hello world', { parent: 'trunk-a' }) // active leaf, 2 tokens
			],
			'trunk-b2'
		);
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(2); // A + B2, not B1
		expect(m.textTokens).toBe(10 + 2); // = 12; including the abandoned sibling would give 22
	});

	it('returns zero metrics for empty chat_messages', async () => {
		const m = await metrics(makeConversation([], 'no-such-leaf'));
		expect(m).toEqual({
			trunkMessageCount: 0,
			textTokens: 0,
			mediaTokens: 0,
			totalTokens: 0,
			lastAssistantMs: null,
			cachedUntil: null,
			model: null
		});
	});

	it('returns zero metrics when current_leaf_message_uuid is missing', async () => {
		const conv = { chat_messages: [textMessage('lonely-1', 'hello world')] };
		const m = await metrics(conv);
		expect(m).toEqual({
			trunkMessageCount: 0,
			textTokens: 0,
			mediaTokens: 0,
			totalTokens: 0,
			lastAssistantMs: null,
			cachedUntil: null,
			model: null
		});
	});

	it('returns zero metrics when the leaf uuid is not among the messages', async () => {
		const conv = makeConversation([textMessage('present-1', 'hello world')], 'absent-leaf');
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(0);
		expect(m.textTokens).toBe(0);
	});

	it('counts a partial trunk when the parent chain breaks mid-walk', async () => {
		// leaf C -> B -> X (X absent, not ROOT): trunk is [B, C]
		const conv = makeConversation(
			[
				textMessage('orphan-b', 'hello world', { parent: 'orphan-x-missing' }),
				textMessage('orphan-c', 'hello world', { parent: 'orphan-b' })
			],
			'orphan-c'
		);
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(2);
		expect(m.textTokens).toBe(4);
	});

	it('terminates at the all-zeros ROOT uuid', async () => {
		const conv = makeConversation([textMessage('root-child', 'hello world', { parent: ROOT_UUID })], 'root-child');
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(1);
		expect(m.textTokens).toBe(2);
	});

	it('handles non-array chat_messages defensively', async () => {
		const m = await metrics({ chat_messages: 'not-an-array', current_leaf_message_uuid: 'x' });
		expect(m.trunkMessageCount).toBe(0);
		expect(m.textTokens).toBe(0);
	});

	// Regression guard: buildTrunk originally had no cycle guard, so a
	// parent chain A -> B -> A looped forever (found by probing; fixed with
	// a visited set). The probe still runs in a child process killed after
	// 2s, because a regression would reintroduce a busy synchronous loop
	// that no in-process timeout can interrupt.
	it('terminates when the parent chain contains a cycle', () => {
		const probe = fileURLToPath(new URL('./helpers/cycle-probe.cjs', import.meta.url));
		const res = spawnSync(process.execPath, [probe], { timeout: 2000, encoding: 'utf8' });
		expect(res.stderr).not.toMatch(/Error/); // probe loaded cleanly — not a harness crash
		expect(res.stdout).toContain('DONE');
		expect(res.status).toBe(0);
	}, 10000);
});

describe('countable-content rules', () => {
	it('contributes zero textTokens for thinking, redacted_thinking, image, and document blocks', async () => {
		const conv = makeConversation(
			[
				makeMessage({
					uuid: 'uncounted-1',
					content: [
						{ type: 'thinking', thinking: 'The quick brown fox jumps over the lazy dog.' },
						{ type: 'redacted_thinking', data: 'The quick brown fox jumps over the lazy dog.' },
						{ type: 'image', source: { data: 'aGVsbG8gd29ybGQ=' } },
						{ type: 'document', title: 'The quick brown fox' }
					]
				})
			],
			'uncounted-1'
		);
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(1);
		expect(m.textTokens).toBe(0);
	});

	it('counts text blocks; multiple blocks in one message join with a newline', async () => {
		// "hello" + "world" joined -> "hello\nworld" -> 3 tokens (not 2+2)
		const twoBlocks = makeConversation(
			[
				makeMessage({
					uuid: 'join-two',
					content: [
						{ type: 'text', text: 'hello' },
						{ type: 'text', text: 'world' }
					]
				})
			],
			'join-two'
		);
		const oneBlock = makeConversation([textMessage('join-one', 'hello\nworld')], 'join-one');
		const mTwo = await metrics(twoBlocks);
		const mOne = await metrics(oneBlock);
		expect(mTwo.textTokens).toBe(3);
		expect(mTwo.textTokens).toBe(mOne.textTokens);
	});

	it('serializes tool_use deterministically regardless of key insertion order', async () => {
		const inputAB = { alpha: 1, beta: { gamma: 'g', delta: 'd' } };
		const inputBA = { beta: { delta: 'd', gamma: 'g' }, alpha: 1 };
		const toolConv = (uuid, input) =>
			makeConversation(
				[makeMessage({ uuid, content: [{ type: 'tool_use', id: 'toolu_01', name: 'calculator', input }] })],
				uuid
			);
		const mAB = await metrics(toolConv('tool-order-ab', inputAB));
		const mBA = await metrics(toolConv('tool-order-ba', inputBA));
		expect(mAB.textTokens).toBeGreaterThan(0);
		expect(mAB.textTokens).toBe(mBA.textTokens);
	});

	it('serializes tool_result deterministically regardless of key insertion order', async () => {
		const contentAB = [{ type: 'text', text: 'result' }];
		const resultConv = (uuid, block) => makeConversation([makeMessage({ uuid, content: [block] })], uuid);
		const mAB = await metrics(
			resultConv('toolres-ab', { type: 'tool_result', tool_use_id: 'toolu_01', is_error: false, content: contentAB })
		);
		const mBA = await metrics(
			resultConv('toolres-ba', { content: contentAB, is_error: false, tool_use_id: 'toolu_01', type: 'tool_result' })
		);
		expect(mAB.textTokens).toBeGreaterThan(0);
		expect(mAB.textTokens).toBe(mBA.textTokens);
	});

	it('does not throw on tool_use with a circular input object', async () => {
		const input = { name: 'loop' };
		input.self = input;
		const conv = makeConversation(
			[makeMessage({ uuid: 'tool-circular', content: [{ type: 'tool_use', id: 'toolu_02', name: 'looper', input }] })],
			'tool-circular'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBeGreaterThan(0); // serialized with a [Circular] placeholder, still counted
	});

	it('counts attachment extracted_content', async () => {
		const conv = makeConversation(
			[makeMessage({ uuid: 'attach-1', content: [], attachments: [{ file_name: 'a.txt', extracted_content: 'attached content' }] })],
			'attach-1'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBe(2);
	});

	it('treats non-array message content as empty', async () => {
		const conv = makeConversation([makeMessage({ uuid: 'badcontent-1', content: 'not an array' })], 'badcontent-1');
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(1);
		expect(m.textTokens).toBe(0);
	});
});

describe('token counting with the real o200k tokenizer', () => {
	it('produces stable exact counts for known strings', async () => {
		const m1 = await metrics(makeConversation([textMessage('exact-1', 'hello world')], 'exact-1'));
		expect(m1.textTokens).toBe(2);
		const m2 = await metrics(
			makeConversation([textMessage('exact-2', 'The quick brown fox jumps over the lazy dog.')], 'exact-2')
		);
		expect(m2.textTokens).toBe(10);
	});

	it('counts empty or missing text as zero', async () => {
		const conv = makeConversation(
			[
				textMessage('empty-1', ''),
				makeMessage({ uuid: 'empty-2', parent: 'empty-1', content: [{ type: 'text' }] })
			],
			'empty-2'
		);
		const m = await metrics(conv);
		expect(m.trunkMessageCount).toBe(2);
		expect(m.textTokens).toBe(0);
	});
});

describe('cache-window math', () => {
	const T1 = '2026-08-15T12:00:00.000Z';
	const T2 = '2026-08-15T12:10:00.000Z';
	const FIVE_MIN = 5 * 60 * 1000;

	it('sets cachedUntil to the last assistant created_at plus five minutes', async () => {
		const conv = makeConversation(
			[
				textMessage('cw-h1', 'hello world'),
				textMessage('cw-a1', 'hello world', { parent: 'cw-h1', sender: 'assistant', created_at: T1 })
			],
			'cw-a1'
		);
		const m = await metrics(conv);
		expect(m.lastAssistantMs).toBe(Date.parse(T1));
		expect(m.cachedUntil).toBe(Date.parse(T1) + FIVE_MIN);
	});

	it('returns null cachedUntil for a user-only conversation', async () => {
		const conv = makeConversation([textMessage('cw-solo', 'hello world', { created_at: T1 })], 'cw-solo');
		const m = await metrics(conv);
		expect(m.lastAssistantMs).toBeNull();
		expect(m.cachedUntil).toBeNull();
	});

	it('picks the latest of multiple assistant messages regardless of trunk order', async () => {
		// Later assistant (T2) sits earlier in the trunk than the T1 assistant.
		const conv = makeConversation(
			[
				textMessage('cw-m1', 'hello world', { sender: 'assistant', created_at: T2 }),
				textMessage('cw-m2', 'hello world', { parent: 'cw-m1' }),
				textMessage('cw-m3', 'hello world', { parent: 'cw-m2', sender: 'assistant', created_at: T1 })
			],
			'cw-m3'
		);
		const m = await metrics(conv);
		expect(m.lastAssistantMs).toBe(Date.parse(T2));
		expect(m.cachedUntil).toBe(Date.parse(T2) + FIVE_MIN);
	});
});

describe('operation without a bridge', () => {
	it('still counts tokens when CC.bridge is absent (hashing unavailable)', async () => {
		expect(CC.bridge).toBeUndefined(); // node env: bridge-client.js is not loaded here
		const m = await metrics(makeConversation([textMessage('nobridge-1', 'hello world')], 'nobridge-1'));
		expect(m.textTokens).toBe(2);
	});
});

describe('media token estimation', () => {
	// Image/document shapes below are FIXTURE-PROVISIONAL — swap for real
	// captured payload shapes when available.

	it('estimates image tokens as ceil(width * height / 750)', async () => {
		const exact = makeConversation(
			[makeMessage({ uuid: 'img-exact', content: [{ type: 'image', width: 900, height: 750 }] })],
			'img-exact'
		); // 900*750/750 = 900
		const rounded = makeConversation(
			[makeMessage({ uuid: 'img-round', content: [{ type: 'image', width: 100, height: 80 }] })],
			'img-round'
		); // 8000/750 = 10.67 -> 11
		expect((await metrics(exact)).mediaTokens).toBe(900);
		expect((await metrics(rounded)).mediaTokens).toBe(11);
	});

	it('caps a single image at 1600 tokens', async () => {
		const conv = makeConversation(
			[makeMessage({ uuid: 'img-cap', content: [{ type: 'image', width: 2000, height: 1500 }] })],
			'img-cap'
		); // 3,000,000/750 = 4000 -> capped
		expect((await metrics(conv)).mediaTokens).toBe(1600);
	});

	it('falls back to the 1600-token cap for images without dimensions', async () => {
		const conv = makeConversation(
			[makeMessage({ uuid: 'img-nodim', content: [{ type: 'image', source: { data: 'aGVsbG8=' } }] })],
			'img-nodim'
		);
		expect((await metrics(conv)).mediaTokens).toBe(1600);
	});

	it('counts attachment extracted_content as text once, without adding the page heuristic', async () => {
		// "attached content" -> 2 raw tokens. page_count present but must be ignored
		// because the extracted text is already counted.
		const conv = makeConversation(
			[
				makeMessage({
					uuid: 'doc-extracted',
					content: [],
					attachments: [{ file_name: 'a.pdf', page_count: 3, extracted_content: 'attached content' }]
				})
			],
			'doc-extracted'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBe(2);
		expect(m.mediaTokens).toBe(0);
		expect(m.totalTokens).toBe(3); // ceil(2 * 1.2), no 2250-per-page double count
	});

	it('contributes zero mediaTokens for content-block documents', async () => {
		// The page heuristic is specified for document *attachments* only.
		// Content-block documents stay at 0 until Phase B data motivates a
		// heuristic — pin that so an implementation can't silently invent one.
		const conv = makeConversation(
			[makeMessage({ uuid: 'doc-block', content: [{ type: 'document', title: 'The quick brown fox' }] })],
			'doc-block'
		);
		const m = await metrics(conv);
		expect(m.mediaTokens).toBe(0);
		expect(m.textTokens).toBe(0);
	});

	it('estimates 2250 tokens per page for documents without extracted content', async () => {
		const conv = makeConversation(
			[
				makeMessage({
					uuid: 'doc-pages',
					content: [],
					attachments: [{ file_name: 'b.pdf', page_count: 4 }]
				})
			],
			'doc-pages'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBe(0);
		expect(m.mediaTokens).toBe(2250 * 4);
	});

	it('adds media tokens uncalibrated on top of calibrated text', async () => {
		// text "hello world" = 2 raw -> ceil(2*1.2) = 3; image 900x750 = 900.
		// Calibrating the media too would give ceil((2+900)*1.2) = 1083 — wrong.
		const conv = makeConversation(
			[
				makeMessage({
					uuid: 'mixed-1',
					content: [
						{ type: 'text', text: 'hello world' },
						{ type: 'image', width: 900, height: 750 }
					]
				})
			],
			'mixed-1'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBe(2);
		expect(m.mediaTokens).toBe(900);
		expect(m.totalTokens).toBe(3 + 900);
	});
});

describe('calibration', () => {
	it('reports totalTokens as ceil(textTokens * 1.2) for a text-only trunk', async () => {
		const m = await metrics(makeConversation([textMessage('cal-1', 'hello world')], 'cal-1'));
		expect(m.textTokens).toBe(2);
		expect(m.totalTokens).toBe(3); // ceil(2.4)
	});

	it('calibrates the trunk sum once, not per message', async () => {
		// Two 2-token messages: sum-then-calibrate -> ceil(4*1.2) = 5.
		// Per-message calibration would give ceil(2.4) + ceil(2.4) = 6.
		const conv = makeConversation(
			[
				textMessage('cal-sum-1', 'hello world'),
				textMessage('cal-sum-2', 'hello world', { parent: 'cal-sum-1' })
			],
			'cal-sum-2'
		);
		const m = await metrics(conv);
		expect(m.textTokens).toBe(4);
		expect(m.totalTokens).toBe(5);
	});
});

describe('model passthrough', () => {
	it('reports the conversation model string', async () => {
		const conv = {
			...makeConversation([textMessage('model-1', 'hello world')], 'model-1'),
			model: 'claude-opus-5' // FIXTURE-PROVISIONAL
		};
		const m = await metrics(conv);
		expect(m.model).toBe('claude-opus-5');
	});

	it('reports null when the conversation has no model field', async () => {
		const m = await metrics(makeConversation([textMessage('model-2', 'hello world')], 'model-2'));
		expect(m.model).toBeNull();
	});
});
