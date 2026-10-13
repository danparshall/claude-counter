// @vitest-environment jsdom

// Orchestration tests for src/content/main.js: the wiring between the bridge
// events, the usage/conversation parsers, and the UI.
//
// main.js is an IIFE that starts the extension at load (reads the URL and
// cookie, wires bridge listeners, fetches, starts the tick interval), so the
// fixture page, URL, and cookie are set up BEFORE it is imported, and all
// tests in this file run in order against that one live instance — later
// tests build on state left by earlier ones.
//
// The real content-script bridge (bridge-client.js) is loaded. What is faked
// is the *other process* — the injected page script — as a message listener
// speaking the documented wire protocol: it records every cc:request, answers
// hash/conversation requests immediately, and holds usage requests until the
// test releases them (so in-flight behavior can be observed). Outcomes are
// asserted on the rendered DOM, never on main.js internals.

import { describe, it, expect, afterAll, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { loadContentScripts, makeConversation, textMessage } from './helpers/load.js';

// --- environment main.js will observe at startup ---------------------------

// main.js starts a 1s tick interval that keeps mutating the DOM; left real, it
// outlives the jsdom environment and its MutationObserver callbacks then throw
// after teardown. Fake only setInterval so the tick never fires on its own.
// setTimeout stays real: the bridge's request timeouts and waitFor() need it.
vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

document.body.innerHTML = `
	<div class="chat-project-wrapper"><button data-testid="chat-menu-trigger">chat</button></div>
	<div><div><div><div data-testid="model-selector-dropdown"></div></div></div></div>
`;
window.history.replaceState({}, '', '/chat/conv-1');
document.cookie = 'lastActiveOrg=org-cookie';

// --- fake page side ----------------------------------------------------------

function post(data) {
	window.dispatchEvent(new MessageEvent('message', { data, source: window }));
}

const page = {
	requests: [],
	heldUsage: [],
	conversations: new Map(), // conversationId -> conversation payload
	usageReply: null, // null = hold usage requests; function(payload) = reply with its result
	emit(type, payload) {
		post({ cc: 'ClaudeCounter', type, payload });
	},
	respond(requestId, ok, payload, error = null) {
		post({ cc: 'ClaudeCounter', type: 'cc:response', requestId, ok, payload, error });
	},
	releaseUsage(reply) {
		const held = this.heldUsage.splice(0);
		for (const req of held) this.respond(req.requestId, true, reply(req.payload));
		return held;
	},
	of(kind) {
		return this.requests.filter((r) => r.kind === kind);
	}
};

window.addEventListener('message', (event) => {
	const d = event.data;
	if (!d || d.cc !== 'ClaudeCounter' || d.type !== 'cc:request') return;
	page.requests.push(d);

	if (d.kind === 'hash') {
		const hash = createHash('sha256').update(d.payload.text).digest('hex').slice(0, 16);
		page.respond(d.requestId, true, { hash });
	} else if (d.kind === 'conversation') {
		const { orgId, conversationId } = d.payload;
		const data = page.conversations.get(conversationId);
		if (!data) return page.respond(d.requestId, false, null, 'not found');
		page.emit('cc:conversation', { orgId, conversationId, data });
		page.respond(d.requestId, true, data);
	} else if (d.kind === 'usage') {
		if (page.usageReply) page.respond(d.requestId, true, page.usageReply(d.payload));
		else page.heldUsage.push(d);
	}
});

// --- helpers -----------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, what) {
	const deadline = Date.now() + 3000;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
		await sleep(10);
	}
}

const settle = () => sleep(60);
// nbsp separators pad the mini bar; normalize them so assertions read naturally.
const headerText = () => (document.querySelector('.cc-header')?.textContent ?? '').replace(/ +/g, ' ').trim();
const sessionText = () => document.querySelector('.cc-usageText')?.textContent ?? '';
const navigate = (path) => {
	window.history.pushState({}, '', path);
	window.dispatchEvent(new CustomEvent('cc:urlchange')); // what the injected bridge fires on pushState
};

const T_RECENT = () => new Date().toISOString();
const twoTokens = (uuid, extra) => textMessage(uuid, 'hello world', extra);
const restUsage = (session) => ({
	five_hour: { utilization: session, resets_at: new Date(Date.now() + 3600e3).toISOString() },
	seven_day: { utilization: 7, resets_at: new Date(Date.now() + 86400e3).toISOString() }
});

page.conversations.set('conv-1', makeConversation([twoTokens('c1-m1')], 'c1-m1'));
page.conversations.set(
	'conv-2',
	makeConversation(
		[twoTokens('c2-m1'), twoTokens('c2-m2', { parent: 'c2-m1', sender: 'assistant', created_at: T_RECENT() })],
		'c2-m2'
	)
);

// --- load in manifest order ----------------------------------------------------

await import('../src/content/constants.js');
await import('../src/content/bridge-client.js');
await loadContentScripts(); // vendor tokenizer + tokens.js
await import('../src/content/parsers.js');
await import('../src/content/ui.js');
await import('../src/content/main.js');

// vitest tears the jsdom window down synchronously (window.close(), then the
// globals are deleted); the DOM mutations that close() performs queue the UI's
// MutationObserver callback as a microtask that would then run without a
// `document`. Emptying the page first, with a tick to flush observers, leaves
// close() nothing to mutate.
afterAll(async () => {
	document.body.replaceChildren();
	await settle();
});

describe('main.js orchestration (sequential)', () => {
	it('on load, fetches the conversation from the URL with the cookie org and renders its token count', async () => {
		await waitFor(() => headerText().includes('tokens'), 'token count in header');

		expect(page.of('conversation').map((r) => r.payload)).toEqual([{ orgId: 'org-cookie', conversationId: 'conv-1' }]);
		expect(headerText()).toBe('~2 tokens');
		expect(headerText()).not.toContain('cached for'); // no assistant message yet
	});

	it('coalesces usage fetches: a navigation while the initial fetch is in flight sends no second request', async () => {
		await waitFor(() => page.heldUsage.length === 1, 'initial usage request');
		expect(page.heldUsage[0].payload).toEqual({ orgId: 'org-cookie' });

		navigate('/chat/conv-2'); // handleUrlChange -> refreshConversation, then refreshUsage (usageState still null)
		await waitFor(() => page.of('conversation').length === 2, 'second conversation request');
		await settle();
		expect(page.of('usage')).toHaveLength(1); // re-entrancy guard held the second one back

		page.usageReply = () => restUsage(42);
		page.releaseUsage(page.usageReply);
		await waitFor(() => sessionText().startsWith('Session: 42%'), 'usage line from /usage reply');
		expect(sessionText()).toMatch(/^Session: 42% · resets in /);
	});

	it('navigating to a conversation renders its tokens and cache countdown', async () => {
		await waitFor(() => headerText().includes('cached for'), 'cache countdown for conv-2');
		expect(headerText()).toMatch(/^~4 tokens cached for (5:00|4:5\d)$/);
	});

	it('updates the usage line from an SSE message_limit event', async () => {
		page.emit('cc:message_limit', { windows: { '5h': { utilization: 0.334, resets_at: 1893456000 } } });
		await waitFor(() => sessionText().startsWith('Session: 33.4%'), 'usage line from SSE');
	});

	it('ignores conversation payloads for a conversation other than the current one', async () => {
		const other = makeConversation([textMessage('o-1', 'The quick brown fox jumps over the lazy dog.')], 'o-1');
		page.emit('cc:conversation', { orgId: 'org-cookie', conversationId: 'conv-other', data: other });
		await settle();
		expect(headerText()).toMatch(/^~4 tokens/);
	});

	it('re-renders when a conversation payload for the current conversation arrives', async () => {
		const grown = makeConversation(
			[twoTokens('c2-m1'), twoTokens('c2-m2', { parent: 'c2-m1' }), twoTokens('c2-m3', { parent: 'c2-m2' })],
			'c2-m3'
		);
		page.emit('cc:conversation', { orgId: 'org-cookie', conversationId: 'conv-2', data: grown });
		await waitFor(() => headerText().startsWith('~6 tokens'), 'updated token count');
		expect(headerText()).toBe('~6 tokens'); // no assistant message -> no cache countdown
	});

	it('adopts the org id carried by a conversation payload for later usage requests', async () => {
		page.emit('cc:conversation', {
			orgId: 'org-from-payload',
			conversationId: 'conv-2',
			data: page.conversations.get('conv-2')
		});
		await waitFor(() => headerText().includes('cached for'), 'conv-2 re-rendered');

		const before = page.of('usage').length;
		document.querySelector('.cc-usageRow').click(); // manual refresh
		await waitFor(() => page.of('usage').length === before + 1, 'usage request from click');
		expect(page.of('usage').at(-1).payload).toEqual({ orgId: 'org-from-payload' });
	});

	it('marks the cache countdown as pending when a generation starts', async () => {
		const span = document.querySelector('.cc-cacheTime');
		expect(span.style.color).not.toBe('');

		page.emit('cc:generation_start', {});
		expect(span.style.color).toBe('');
	});

	it('clears the conversation header on a non-conversation page without fetching', async () => {
		const before = page.of('conversation').length;
		navigate('/new');
		await waitFor(() => headerText() === '', 'header cleared');
		await settle();
		expect(page.of('conversation')).toHaveLength(before);
	});
});
