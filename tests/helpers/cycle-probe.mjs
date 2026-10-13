// Child-process probe for buildTrunk's behavior on a cyclic parent chain.
//
// buildTrunk's leaf-to-root walk is synchronous, so a cycle can't be
// interrupted by an in-process test timeout (a busy JS loop blocks the
// event loop, including Vitest's timers). Running the probe in a child
// process lets the parent test kill it after a deadline instead.
//
// Prints DONE and exits 0 if computeConversationMetrics terminates.

const src = (...p) => new URL(['..', '..', 'src', ...p].join('/'), import.meta.url);

const conversation = {
	current_leaf_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
	chat_messages: [
		{
			uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
			parent_message_uuid: 'bbbbbbbb-0000-4000-8000-000000000002',
			sender: 'human',
			content: []
		},
		{
			uuid: 'bbbbbbbb-0000-4000-8000-000000000002',
			parent_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
			sender: 'assistant',
			content: []
		}
	]
};

try {
	await import(src('content', 'constants.js'));
	await import(src('content', 'tokens.js'));
	await globalThis.ClaudeCounter.tokens.computeConversationMetrics(conversation);
	console.log('DONE');
	process.exit(0);
} catch (err) {
	console.error(err);
	process.exit(1);
}
