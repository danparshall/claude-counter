// @vitest-environment jsdom

// Characterization tests for CC.ui.CounterUI (src/content/ui.js), observed
// through the DOM it renders. Class names are the contract with
// src/styles.css, so they are the observation points here.
//
// Time is frozen with fake timers so countdown text is deterministic.
// ui.js reaches back into main.js for CC.waitForElement from its DOM
// observer; main.js cannot be loaded in isolation (it starts the extension),
// so that one function is stubbed with a never-resolving promise — the
// reattach path it feeds is not under test here.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

await import('../src/content/constants.js');
await import('../src/content/ui.js');
const CC = globalThis.ClaudeCounter;
CC.waitForElement = () => new Promise(() => {});

const T0 = Date.parse('2026-08-15T12:00:00.000Z');
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();

function mountFixture() {
	document.body.innerHTML = `
		<div class="chat-project-wrapper"><button data-testid="chat-menu-trigger">chat</button></div>
		<div><div><div><div data-testid="model-selector-dropdown"></div></div></div></div>
	`;
}

const q = (sel) => document.querySelector(sel);
const usageTexts = () => Array.from(document.querySelectorAll('.cc-usageText')).map((el) => el.textContent);
// nbsp separators pad the mini bar; normalize them so assertions read naturally.
const headerText = () => q('.cc-header').textContent.replace(/ +/g, ' ').trim();

let ui;
let refreshCalls;
let releaseRefresh;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(T0);
	mountFixture();
	refreshCalls = 0;
	ui = new CC.ui.CounterUI({
		onUsageRefresh: () =>
			new Promise((resolve) => {
				refreshCalls += 1;
				releaseRefresh = resolve;
			})
	});
	ui.initialize();
	ui.attach();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('usage line', () => {
	it('renders session and weekly percentages, reset countdowns, and bar widths', () => {
		ui.setUsage({
			five_hour: { utilization: 42.5, resets_at: iso(T0 + 2 * HOUR + 30 * MIN) },
			seven_day: { utilization: 95, resets_at: iso(T0 + 3 * DAY + 4 * HOUR) }
		});

		expect(q('.cc-usageRow').classList.contains('cc-hidden')).toBe(false);
		expect(usageTexts()).toEqual(['Session: 42.5% · resets in 2h 30m', 'Weekly: 95% · resets in 3d 4h']);

		const fills = document.querySelectorAll('.cc-bar--usage .cc-bar__fill');
		expect(fills[0].style.width).toBe('42.5%');
		expect(fills[0].classList.contains('cc-warn')).toBe(false);
		expect(fills[1].style.width).toBe('95%');
		expect(fills[1].classList.contains('cc-warn')).toBe(true); // >= 90
	});

	it('hides the weekly group when only the session window is known, and the whole row when nothing is', () => {
		ui.setUsage({ five_hour: { utilization: 10, resets_at: null }, seven_day: null });
		expect(q('.cc-usageRow').classList.contains('cc-hidden')).toBe(false);
		expect(q('.cc-usageGroup--weekly').classList.contains('cc-hidden')).toBe(true);
		expect(usageTexts()[0]).toBe('Session: 10%'); // no resets_at -> no countdown

		ui.setUsage(null);
		expect(q('.cc-usageRow').classList.contains('cc-hidden')).toBe(true);
	});

	it('counts down the reset time on tick, switching units as it shrinks', () => {
		ui.setUsage({ five_hour: { utilization: 1, resets_at: iso(T0 + 90 * SEC) }, seven_day: null });
		expect(usageTexts()[0]).toBe('Session: 1% · resets in 2m'); // 90s rounds to 2 minutes

		vi.setSystemTime(T0 + 40 * SEC);
		ui.tick();
		expect(usageTexts()[0]).toBe('Session: 1% · resets in 50s'); // under a minute: seconds

		vi.setSystemTime(T0 + 2 * MIN);
		ui.tick();
		expect(usageTexts()[0]).toBe('Session: 1% · resets in 0s'); // reached
	});

	it('positions the time marker at the elapsed fraction of the window', () => {
		// 5h window ending 1h from now: 4h elapsed of 5h = 80%
		ui.setUsage({ five_hour: { utilization: 1, resets_at: iso(T0 + HOUR) }, seven_day: null });
		const marker = q('.cc-bar--usage .cc-bar__marker');
		expect(marker.classList.contains('cc-hidden')).toBe(false);
		expect(marker.style.left).toBe('80%');
	});

	it('invokes the refresh callback on click and ignores clicks while one is in flight', async () => {
		ui.setUsage({ five_hour: { utilization: 1, resets_at: null }, seven_day: null });
		const row = q('.cc-usageRow');

		row.click();
		row.click();
		expect(refreshCalls).toBe(1);
		expect(row.classList.contains('cc-usageRow--dim')).toBe(true);

		releaseRefresh();
		await Promise.resolve();
		await Promise.resolve();
		expect(row.classList.contains('cc-usageRow--dim')).toBe(false);

		row.click();
		expect(refreshCalls).toBe(2);
	});
});

describe('conversation header', () => {
	it('renders the token count, a mini bar scaled to the context limit, and the cache countdown', () => {
		ui.setConversationMetrics({ totalTokens: 999, cachedUntil: T0 + 90 * SEC });

		expect(headerText()).toBe('~999 tokens cached for 1:30');
		expect(q('.cc-cacheTime').textContent).toBe('1:30');
		expect(q('.cc-bar--mini .cc-bar__fill').style.width).toBe(`${(999 / CC.CONST.CONTEXT_LIMIT_TOKENS) * 100}%`);
	});

	it('ticks the cache countdown down and removes it once expired', () => {
		ui.setConversationMetrics({ totalTokens: 999, cachedUntil: T0 + 90 * SEC });

		vi.setSystemTime(T0 + 60 * SEC);
		ui.tick();
		expect(q('.cc-cacheTime').textContent).toBe('0:30');

		vi.setSystemTime(T0 + 91 * SEC);
		ui.tick();
		expect(q('.cc-cacheTime')).toBeNull();
		expect(headerText()).toBe('~999 tokens');
	});

	it('shows no cache countdown when cachedUntil is already in the past', () => {
		ui.setConversationMetrics({ totalTokens: 999, cachedUntil: T0 - SEC });
		expect(headerText()).toBe('~999 tokens');
		expect(q('.cc-cacheTime')).toBeNull();
	});

	it('drops the mini bar and dims the count when the context is effectively full', () => {
		ui.setConversationMetrics({ totalTokens: CC.CONST.CONTEXT_LIMIT_TOKENS, cachedUntil: null });
		expect(q('.cc-bar--mini')).toBeNull();
		expect(headerText()).toMatch(/^~[\d,.\s]+ tokens$/);
	});

	it('clears the header when called with no metrics (non-conversation page)', () => {
		ui.setConversationMetrics({ totalTokens: 999, cachedUntil: null });
		expect(headerText()).not.toBe('');

		ui.setConversationMetrics();
		expect(headerText()).toBe('');
	});
});
