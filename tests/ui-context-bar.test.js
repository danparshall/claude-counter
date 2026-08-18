// @vitest-environment jsdom

// Behavioral tests for the header context mini-bar: the bar must scale
// against the conversation's actual context limit (passed in by the caller),
// warn as compaction approaches, and tell the truth about its scale in the
// tooltip. Assertions read rendered DOM state (fill width, warn class,
// tooltip text) off the UI's own containers — the components live detached
// from claude.ai's DOM here, which is fine: attachment is a separate concern.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

await import('../src/content/constants.js');
await import('../src/content/ui.js');
const CC = globalThis.ClaudeCounter;

// ui.js's reattach observer calls CC.waitForElement, which main.js provides
// in the shipped load order. Stub that environment dependency so DOM churn in
// the tests can't throw; reattachment behavior is out of scope in this file.
CC.waitForElement = () => Promise.resolve(null);

let ui;

beforeEach(() => {
	document.body.innerHTML = '';
	ui = new CC.ui.CounterUI();
	ui.initialize();
});

afterEach(() => {
	// Each initialize() attaches a MutationObserver to document.body; left
	// running, its callbacks fire after jsdom teardown and throw.
	ui.domObserver?.disconnect();
});

const fill = () => ui.headerContainer.querySelector('.cc-bar--mini .cc-bar__fill');
const bar = () => ui.headerContainer.querySelector('.cc-bar--mini');

describe('bar scale follows the passed context limit', () => {
	it('computes fill percent against a 1M limit', () => {
		ui.setConversationMetrics({ totalTokens: 250_000, contextLimit: 1_000_000 });
		// Against the old fixed 200K scale this would read 100% and hide the bar.
		expect(fill()).not.toBeNull();
		expect(fill().style.width).toBe('25%');
	});

	it('computes fill percent against a 500K limit', () => {
		ui.setConversationMetrics({ totalTokens: 250_000, contextLimit: 500_000 });
		expect(fill().style.width).toBe('50%');
	});

	it('falls back to the 200K default when no limit is passed', () => {
		ui.setConversationMetrics({ totalTokens: 100_000 });
		expect(fill().style.width).toBe('50%');
	});

	it('still hides the bar at >= 99.5% of the actual limit', () => {
		ui.setConversationMetrics({ totalTokens: 499_000, contextLimit: 500_000 });
		expect(bar()).toBeNull();
	});
});

describe('compaction warning at 85%', () => {
	it('applies the warn class at exactly 85% of the limit', () => {
		ui.setConversationMetrics({ totalTokens: 425_000, contextLimit: 500_000 });
		expect(fill().classList.contains('cc-warn')).toBe(true);
	});

	it('does not warn below 85%', () => {
		ui.setConversationMetrics({ totalTokens: 400_000, contextLimit: 500_000 });
		expect(fill().classList.contains('cc-warn')).toBe(false);
	});

	it('renders the warn state in the warning color, not the normal fill color', () => {
		ui.setConversationMetrics({ totalTokens: 425_000, contextLimit: 500_000 });
		expect(bar().style.getPropertyValue('--cc-fill-warn')).toBe(CC.COLORS.RED_WARNING);
		// The warn color must actually differ from the normal fill — this is
		// the claim in the test name, independent of which constant it is.
		expect(bar().style.getPropertyValue('--cc-fill-warn')).not.toBe(bar().style.getPropertyValue('--cc-fill'));
	});
});

describe('tooltip states the actual scale', () => {
	it('names a 500K limit', () => {
		ui.setConversationMetrics({ totalTokens: 1_000, contextLimit: 500_000 });
		expect(ui.lengthTooltip.textContent).toContain('500k');
	});

	it('names a 1M limit', () => {
		ui.setConversationMetrics({ totalTokens: 1_000, contextLimit: 1_000_000 });
		expect(ui.lengthTooltip.textContent).toContain('1M');
	});

	it('discloses the calibration and the unverified compaction threshold', () => {
		ui.setConversationMetrics({ totalTokens: 1_000, contextLimit: 500_000 });
		expect(ui.lengthTooltip.textContent).toMatch(/1\.2/);
		expect(ui.lengthTooltip.textContent).toMatch(/85%/);
	});
});
