// @vitest-environment jsdom

// Behavioral tests for the injected page script (src/injected/bridge.js)
// around event-stream handling: a completion stream that ends must announce
// `cc:generation_end` exactly once, so the content script can refetch the
// conversation without waiting for navigation.
//
// The injected script captures window.fetch at import time, so the fake
// network is installed *before* the import — the fake plays the role of
// claude.ai's server (the other side of the boundary), never the unit under
// test. Assertions observe only the script's wire output: postMessage events
// on the window. jsdom's postMessage does not set event.source, which is fine
// here because we listen for raw message events rather than going through
// bridge-client's source filtering.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextEncoder } from 'node:util';

let nextResponse = null;
window.fetch = async () => nextResponse;
await import('../src/injected/bridge.js');

// Minimal event-stream response: enough surface for the script's
// content-type check, clone(), and body.getReader() loop.
function sseResponse(lines) {
	const bytes = new TextEncoder().encode(lines.join('\n') + '\n');
	const make = () => {
		let consumed = false;
		return {
			headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
			body: {
				getReader: () => ({
					read: async () => {
						if (consumed) return { done: true, value: undefined };
						consumed = true;
						return { done: false, value: bytes };
					}
				})
			},
			clone: make
		};
	};
	return make();
}

let received;
let listener;

beforeEach(() => {
	received = [];
	listener = (event) => {
		if (event?.data?.cc === 'ClaudeCounter') received.push(event.data);
	};
	window.addEventListener('message', listener);
});

afterEach(() => {
	window.removeEventListener('message', listener);
});

const ofType = (type) => received.filter((m) => m.type === type);

async function waitFor(predicate, timeoutMs = 1000) {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) return false;
		await new Promise((r) => setTimeout(r, 10));
	}
	return true;
}

// Let any stray async work and queued postMessages drain.
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('cc:generation_end', () => {
	it('fires exactly once when a completion event-stream ends', async () => {
		nextResponse = sseResponse(['data: {"type":"completion","completion":"hi"}', '']);
		await window.fetch('https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/completion', {
			method: 'POST'
		});
		expect(await waitFor(() => ofType('cc:generation_end').length > 0)).toBe(true);
		await settle();
		expect(ofType('cc:generation_end')).toHaveLength(1);
	});

	it('fires for retry_completion streams too', async () => {
		nextResponse = sseResponse(['data: {"type":"completion","completion":"again"}', '']);
		await window.fetch('https://claude.ai/api/organizations/org-1/chat_conversations/conv-1/retry_completion', {
			method: 'POST'
		});
		expect(await waitFor(() => ofType('cc:generation_end').length > 0)).toBe(true);
		await settle();
		expect(ofType('cc:generation_end')).toHaveLength(1);
	});

	it('does not fire for event-streams on non-completion URLs', async () => {
		// The stream carries a message_limit event; seeing cc:message_limit
		// come through proves the stream really was read to the end — the
		// absence of cc:generation_end is then meaningful, not a dead stream.
		nextResponse = sseResponse([
			'data: {"type":"message_limit","message_limit":{"windows":{"5h":{"utilization":0.4}}}}',
			''
		]);
		await window.fetch('https://claude.ai/api/organizations/org-1/some_other_stream', { method: 'GET' });
		expect(await waitFor(() => ofType('cc:message_limit').length > 0)).toBe(true);
		await settle();
		expect(ofType('cc:generation_end')).toHaveLength(0);
	});
});
