(() => {
	'use strict';

	const CC = (globalThis.ClaudeCounter = globalThis.ClaudeCounter || {});

	const ROOT_MESSAGE_ID = '00000000-0000-4000-8000-000000000000';

	function stableStringify(value) {
		const seen = new WeakSet();

		const normalize = (v) => {
			if (v === null || typeof v !== 'object') return v;
			if (seen.has(v)) return '[Circular]';
			seen.add(v);

			if (Array.isArray(v)) return v.map(normalize);

			const out = {};
			for (const key of Object.keys(v).sort()) {
				out[key] = normalize(v[key]);
			}
			return out;
		};

		try {
			return JSON.stringify(normalize(value));
		} catch {
			return '';
		}
	}

	function getTokenizer() {
		return globalThis.GPTTokenizer_o200k_base || null;
	}

	function countTokens(text) {
		if (!text) return 0;
		const tokenizer = getTokenizer();
		if (!tokenizer?.countTokens) return 0;
		try {
			return tokenizer.countTokens(text);
		} catch {
			return 0;
		}
	}

	function buildTrunk(conversation) {
		const messages = Array.isArray(conversation?.chat_messages) ? conversation.chat_messages : [];
		const byId = new Map();
		for (const msg of messages) {
			if (msg?.uuid) byId.set(msg.uuid, msg);
		}

		const leaf = conversation?.current_leaf_message_uuid;
		if (!leaf) return [];

		const trunk = [];
		const visited = new Set();
		let currentId = leaf;
		while (currentId && currentId !== ROOT_MESSAGE_ID && !visited.has(currentId)) {
			visited.add(currentId);
			const msg = byId.get(currentId);
			if (!msg) break;
			trunk.push(msg);
			currentId = msg.parent_message_uuid;
		}

		trunk.reverse();
		return trunk;
	}

	function isCountableContentItem(item) {
		if (!item || typeof item !== 'object') return false;
		if (typeof item.type !== 'string') return false;
		if (item.type === 'thinking' || item.type === 'redacted_thinking') return false;
		if (item.type === 'image' || item.type === 'document') return false;
		return true;
	}

	function stringifyCountableContentItem(item) {
		if (!isCountableContentItem(item)) return '';

		// Common fast-path for text blocks.
		if (item.type === 'text' && typeof item.text === 'string') return item.text;

		// Tool blocks: include observable payloads deterministically, but exclude "thinking".
		if (item.type === 'tool_use') {
			const minimal = {
				id: item.id,
				name: item.name,
				input: item.input
			};
			return stableStringify(minimal);
		}

		if (item.type === 'tool_result') {
			const minimal = {
				tool_use_id: item.tool_use_id,
				is_error: item.is_error,
				content: item.content
			};
			return stableStringify(minimal);
		}

		// Fallback: keep only known-ish textual fields to avoid pulling in huge binary-ish blobs.
		const minimal = {};
		if (typeof item.text === 'string') minimal.text = item.text;
		if (typeof item.title === 'string') minimal.title = item.title;
		if (typeof item.url === 'string') minimal.url = item.url;
		if (typeof item.content === 'string') minimal.content = item.content;
		if (Array.isArray(item.content)) minimal.content = item.content;
		if (Object.keys(minimal).length === 0) return '';
		return stableStringify(minimal);
	}

	// Media heuristics, already in Claude-token units (do NOT apply the text
	// calibration factor on top — that would double-count the correction).
	const IMAGE_PIXELS_PER_TOKEN = 750;
	const IMAGE_TOKENS_CAP = 1600;
	const DOCUMENT_TOKENS_PER_PAGE = 2250;

	function estimateImageTokens(item) {
		const width = Number(item?.width) || Number(item?.source?.width) || 0;
		const height = Number(item?.height) || Number(item?.source?.height) || 0;
		if (width > 0 && height > 0) {
			return Math.min(IMAGE_TOKENS_CAP, Math.ceil((width * height) / IMAGE_PIXELS_PER_TOKEN));
		}
		// Unknown dimensions: assume the cap, so the estimate errs full.
		return IMAGE_TOKENS_CAP;
	}

	function estimateMediaTokens(message) {
		let tokens = 0;

		const content = Array.isArray(message?.content) ? message.content : [];
		for (const item of content) {
			if (item?.type === 'image') tokens += estimateImageTokens(item);
		}

		// Document attachments: when extraction produced text, that text is
		// already counted by the text path — no page heuristic on top.
		const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
		for (const a of attachments) {
			const hasExtracted = typeof a?.extracted_content === 'string' && a.extracted_content;
			if (!hasExtracted && typeof a?.page_count === 'number' && a.page_count > 0) {
				tokens += DOCUMENT_TOKENS_PER_PAGE * a.page_count;
			}
		}

		return tokens;
	}

	function stringifyMessageCountables(message) {
		const parts = [];

		// Message content blocks (primary source for tools, text, etc).
		const content = Array.isArray(message?.content) ? message.content : [];
		for (const item of content) {
			const s = stringifyCountableContentItem(item);
			if (s) parts.push(s);
		}

		// Attachment extracted content (observable, already text).
		const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
		for (const a of attachments) {
			if (typeof a?.extracted_content === 'string' && a.extracted_content) {
				parts.push(a.extracted_content);
			}
		}

		return parts.join('\n');
	}

	async function hashString(str) {
		if (!CC.bridge?.requestHash) return null;
		try {
			const res = await CC.bridge.requestHash(str);
			if (res?.hash) return res.hash;
		} catch {
			// No local hashing fallback.
		}
		return null;
	}

	async function fingerprint(text) {
		if (!text) return null;
		const hash = await hashString(text);
		if (!hash) return null;
		return `${text.length}:${hash}`;
	}

	class TokenCache {
		constructor() {
			this._byMessageId = new Map(); // uuid -> { fp, tokens }
		}

		async getMessageTokens(messageId, messageText) {
			const fp = await fingerprint(messageText);
			if (!fp) return countTokens(messageText);
			const cached = this._byMessageId.get(messageId);
			if (cached && cached.fp === fp) return cached.tokens;

			const tokens = countTokens(messageText);
			this._byMessageId.set(messageId, { fp, tokens });
			return tokens;
		}

		pruneToMessageIds(keepIds) {
			const keep = new Set(keepIds);
			for (const id of this._byMessageId.keys()) {
				if (!keep.has(id)) this._byMessageId.delete(id);
			}
		}
	}

	const tokenCache = new TokenCache();

	async function computeConversationMetrics(conversation) {
		const trunk = buildTrunk(conversation);
		const trunkIds = trunk.map((m) => m.uuid).filter(Boolean);
		tokenCache.pruneToMessageIds(trunkIds);

		let textTokens = 0;
		let mediaTokens = 0;
		let lastAssistantMs = null;

		for (const msg of trunk) {
			if (msg?.sender === 'assistant' && msg?.created_at) {
				const msgMs = Date.parse(msg.created_at);
				if (!lastAssistantMs || msgMs > lastAssistantMs) {
					lastAssistantMs = msgMs;
				}
			}

			const msgText = stringifyMessageCountables(msg);
			const msgTokens = msg?.uuid ? await tokenCache.getMessageTokens(msg.uuid, msgText) : countTokens(msgText);
			textTokens += msgTokens;
			mediaTokens += estimateMediaTokens(msg);
		}
		const cachedUntil = lastAssistantMs ? lastAssistantMs + CC.CONST.CACHE_WINDOW_MS : null;

		// Calibrate the trunk text sum once; media heuristics are already in
		// Claude-token units.
		const totalTokens = Math.ceil(textTokens * CC.CONST.TOKEN_CALIBRATION) + mediaTokens;

		return {
			trunkMessageCount: trunk.length,
			textTokens,
			mediaTokens,
			totalTokens,
			lastAssistantMs,
			cachedUntil,
			model: conversation?.model ?? null
		};
	}

	CC.tokens = { computeConversationMetrics };
})();
