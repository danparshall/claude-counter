import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Default to plain node; DOM-touching test files opt in via
		// a `// @vitest-environment jsdom` pragma at the top of the file.
		environment: 'node',
		include: ['tests/**/*.test.js']
	}
});
