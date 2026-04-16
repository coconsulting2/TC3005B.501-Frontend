# Author: Emiliano Deyta Illescas
# Description: Make targets for frontend testing with Vitest.

.PHONY: test-frontend test-frontend-watch test-frontend-coverage

test-frontend:
	pnpm run test

test-frontend-watch:
	pnpm run test:watch

test-frontend-coverage:
	pnpm run test:coverage
