// Guards the hand-maintained userscript copy against silent drift.
//
// userscript/claude-counter.user.js bundles verbatim copies of several
// src/content/ modules. There is no build step, so a fix landing in one place
// but not the other ships silently. This test pins which regions are expected
// to be byte-identical (modulo surrounding whitespace):
//
//   constants.js   whole file
//   ui.js          whole file
//   tokens.js      whole file EXCEPT hashString(), which is platform-specific
//                  (extension hashes via the page bridge; userscript calls
//                  crypto.subtle directly)
//   parsers.js     the two parse* function bodies (the userscript inlines them
//                  into its orchestration IIFE instead of exposing CC.parsers)
//
// main.js and bridge-client.js are intentionally different (the userscript
// has no content-script/page split) and are not compared.
//
// On failure, the message names the first differing line so the fix is
// obvious: port the change to the other copy.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const userscript = read('../userscript/claude-counter.user.js');
const extension = (name) => read(`../src/content/${name}`).trim();

// Matches a one-tab-indented function declaration through its closing brace.
const functionRe = (name) => new RegExp(`\\n\\t(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\t\\}\\n`);

function extractFunction(source, name) {
	const m = source.match(functionRe(name));
	if (!m) throw new Error(`function ${name} not found`);
	return m[0];
}

function stripFunction(source, name) {
	const re = functionRe(name);
	if (!re.test(source)) throw new Error(`function ${name} not found`);
	return source.replace(re, '\n');
}

// Describes the first line where `expected` stops matching `haystack`, anchored
// at the best occurrence of its first line. Returns null when contained.
function firstDrift(haystack, expected, label) {
	if (haystack.includes(expected)) return null;
	const want = expected.split('\n');
	const have = haystack.split('\n');
	let best = { matched: -1, at: -1 };
	have.forEach((line, i) => {
		if (line !== want[0]) return;
		let k = 0;
		while (k < want.length && have[i + k] === want[k]) k += 1;
		if (k > best.matched) best = { matched: k, at: i };
	});
	if (best.at === -1) return `${label}: first line not found in userscript: ${JSON.stringify(want[0])}`;
	const k = best.matched;
	return [
		`${label} drifts at userscript line ${best.at + k + 1} (extension line ${k + 1} of the compared region):`,
		`  extension:  ${JSON.stringify(want[k] ?? '<end>')}`,
		`  userscript: ${JSON.stringify(have[best.at + k] ?? '<end>')}`
	].join('\n');
}

describe('userscript mirrors the extension sources', () => {
	it('constants.js is verbatim', () => {
		expect(firstDrift(userscript, extension('constants.js'), 'constants.js')).toBeNull();
	});

	it('ui.js is verbatim', () => {
		expect(firstDrift(userscript, extension('ui.js'), 'ui.js')).toBeNull();
	});

	it('tokens.js is verbatim apart from the platform-specific hashString()', () => {
		const expected = stripFunction(extension('tokens.js'), 'hashString');
		const haystack = stripFunction(userscript, 'hashString');
		expect(firstDrift(haystack, expected, 'tokens.js')).toBeNull();
	});

	it('both usage parsers are verbatim', () => {
		const parsers = extension('parsers.js');
		for (const name of ['parseUsageFromUsageEndpoint', 'parseUsageFromMessageLimit']) {
			expect(firstDrift(userscript, extractFunction(parsers, name), `parsers.js ${name}`)).toBeNull();
		}
	});
});
