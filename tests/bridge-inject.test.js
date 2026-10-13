// @vitest-environment jsdom

// Lifecycle tests for CC.injectBridgeOnce (src/content/bridge-client.js):
// the content script injects src/injected/bridge.js into the page exactly
// once and reports whether it loaded.
//
// injectBridgeOnce memoizes in module scope, so each test re-evaluates the
// module (vi.resetModules + re-import) to start from a fresh "never injected"
// state. The extension runtime is faked at the `globalThis.chrome.runtime`
// boundary — the only thing the code needs from it is getURL().

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

await import('../src/content/constants.js');
const CC = globalThis.ClaudeCounter;
const SCRIPT_ID = CC.DOM.BRIDGE_SCRIPT_ID;

const fakeRuntime = { getURL: (path) => `chrome-extension://fake-id/${path}` };

beforeEach(async () => {
	vi.resetModules();
	await import('../src/content/bridge-client.js');
});

afterEach(() => {
	delete globalThis.chrome;
	document.getElementById(SCRIPT_ID)?.remove();
});

describe('injectBridgeOnce', () => {
	it('resolves false and injects nothing when no extension runtime is available', async () => {
		await expect(CC.injectBridgeOnce()).resolves.toBe(false);
		expect(document.getElementById(SCRIPT_ID)).toBeNull();
	});

	it('injects the page script from the runtime URL and resolves true once it loads', async () => {
		globalThis.chrome = { runtime: fakeRuntime };
		const ready = CC.injectBridgeOnce();

		const script = document.getElementById(SCRIPT_ID);
		expect(script?.tagName).toBe('SCRIPT');
		expect(script.src).toBe('chrome-extension://fake-id/src/injected/bridge.js');

		script.dispatchEvent(new Event('load'));
		await expect(ready).resolves.toBe(true);
	});

	it('injects only once: repeat calls share the same promise and add no second tag', async () => {
		globalThis.chrome = { runtime: fakeRuntime };
		const first = CC.injectBridgeOnce();
		const second = CC.injectBridgeOnce();
		expect(second).toBe(first);
		expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);

		document.getElementById(SCRIPT_ID).dispatchEvent(new Event('load'));
		await expect(first).resolves.toBe(true);
		expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
	});

	it('resolves false when the page script fails to load, and does not retry', async () => {
		globalThis.chrome = { runtime: fakeRuntime };
		const ready = CC.injectBridgeOnce();
		document.getElementById(SCRIPT_ID).dispatchEvent(new Event('error'));
		await expect(ready).resolves.toBe(false);

		// Characterized: the failed attempt is memoized; no second injection.
		await expect(CC.injectBridgeOnce()).resolves.toBe(false);
		expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
	});

	it('treats an already-present bridge tag as ready', async () => {
		globalThis.chrome = { runtime: fakeRuntime };
		const existing = document.createElement('script');
		existing.id = SCRIPT_ID;
		document.head.appendChild(existing);

		await expect(CC.injectBridgeOnce()).resolves.toBe(true);
		expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
	});
});
