(() => {
	'use strict';

	const CC = (globalThis.ClaudeCounter = globalThis.ClaudeCounter || {});

	// Model family -> context window. Ordered most-specific-first; first match
	// wins. Substring matching so version/date suffixes don't break the
	// lookup. Family strings are PROVISIONAL until real claude.ai model ids
	// are captured; unknown models fall back to the conservative 200K default.
	const WINDOW_PATTERNS = [
		{ pattern: 'opus-5', limit: 1000000 },
		{ pattern: 'sonnet-5', limit: 1000000 },
		{ pattern: 'opus-4', limit: 500000 },
		{ pattern: 'sonnet-4', limit: 500000 }
	];

	function contextLimitForModel(model) {
		if (typeof model !== 'string' || !model) return CC.CONST.DEFAULT_CONTEXT_LIMIT_TOKENS;
		for (const { pattern, limit } of WINDOW_PATTERNS) {
			if (model.includes(pattern)) return limit;
		}
		return CC.CONST.DEFAULT_CONTEXT_LIMIT_TOKENS;
	}

	CC.models = { contextLimitForModel };
})();
