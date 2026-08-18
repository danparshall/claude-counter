(() => {
	'use strict';

	const CC = (globalThis.ClaudeCounter = globalThis.ClaudeCounter || {});

	CC.DOM = Object.freeze({
		CHAT_MENU_TRIGGER: '[data-testid="chat-menu-trigger"]',
		MODEL_SELECTOR_DROPDOWN: '[data-testid="model-selector-dropdown"]',
		CHAT_PROJECT_WRAPPER: '.chat-project-wrapper',
		BRIDGE_SCRIPT_ID: 'cc-bridge-script'
	});

	CC.CONST = Object.freeze({
		CACHE_WINDOW_MS: 5 * 60 * 1000,
		// Window size when the model is unknown. Conservative on purpose:
		// overstates fullness, so the warning fires early rather than late.
		DEFAULT_CONTEXT_LIMIT_TOKENS: 200000,
		// Compaction expected somewhere above this fraction (unverified;
		// Phase B instrumentation will pin it down).
		CONTEXT_WARN_FRACTION: 0.85,
		// o200k undercounts Claude's tokenizer; ~1.2 is lugia19 folklore plus
		// Claude Code analogues, pending Phase B calibration data.
		TOKEN_CALIBRATION: 1.2
	});

	CC.COLORS = Object.freeze({
		PROGRESS_FILL_DARK: '#2c84db',
		PROGRESS_FILL_LIGHT: '#5aa6ff',
		PROGRESS_OUTLINE_DARK: '#787877',
		PROGRESS_OUTLINE_LIGHT: '#bfbfbf',
		PROGRESS_MARKER_DARK: '#ffffff',
		PROGRESS_MARKER_LIGHT: '#111111',
		RED_WARNING: '#ce2029',
		BOLD_LIGHT: '#141413',
		BOLD_DARK: '#faf9f5'
	});
})();
