.DEFAULT_GOAL := help

.PHONY: help setup dev test lint format format-check typecheck api-client seed build check

help: ## List available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Traceback commands:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Install frontend and backend dependencies
	corepack pnpm install
	cd apps/api && uv sync --all-groups

dev: ## Run the web and API development servers
	@trap 'kill 0' INT TERM EXIT; \
		(corepack pnpm --filter @traceback/web dev) & \
		(cd apps/api && uv run uvicorn app.main:app --reload) & \
		wait

test: ## Run all automated tests
	corepack pnpm test
	cd apps/api && uv run pytest

lint: ## Run frontend and backend linters
	corepack pnpm lint
	cd apps/api && uv run ruff check . ../../scripts

format: ## Format frontend and backend files
	corepack pnpm format
	cd apps/api && uv run ruff format . ../../scripts

format-check: ## Check formatting without changing files
	corepack pnpm format:check
	cd apps/api && uv run ruff format --check . ../../scripts

typecheck: ## Run frontend and backend type checks
	corepack pnpm typecheck
	cd apps/api && uv run pyright

api-client: ## Regenerate the TypeScript API contract
	./scripts/generate-api-client.sh

seed: ## Seed the configured development database
	cd apps/api && uv run python ../../scripts/seed_database.py

build: ## Build all applications and packages
	corepack pnpm build

check: format-check lint typecheck test api-client build ## Run the complete local merge gate
	git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/schema.d.ts
