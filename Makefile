.PHONY: dev backend frontend lint test sync-types setup

# ============================================================
# One-command development
# ============================================================

dev: ## Start both backend and frontend
	@echo "Starting backend on :8000 and frontend on :3000..."
	@make backend & make frontend

backend: ## Start backend only
	cd backend && uvicorn app.main:app --reload --port 8000

frontend: ## Start frontend only
	cd frontend && npm run dev

# ============================================================
# Quality checks
# ============================================================

lint: ## Run all linters
	cd backend && ruff check . && ruff format --check .
	cd frontend && npm run lint

test: ## Run all tests
	cd backend && pytest tests/ -v
	cd frontend && npm run test

format: ## Auto-format all code
	cd backend && ruff format . && ruff check --fix .
	cd frontend && npm run format

typecheck: ## Run type checks
	cd frontend && npm run typecheck

# ============================================================
# API sync
# ============================================================

sync-types: ## Generate frontend types from backend OpenAPI
	./scripts/sync-api-types.sh

# ============================================================
# Setup
# ============================================================

setup: ## First-time project setup
	@echo "==> Setting up backend..."
	cd backend && pip install -e ".[dev]"
	@echo "==> Setting up frontend..."
	cd frontend && npm install
	@echo "==> Setting up git hooks..."
	cp scripts/pre-commit .git/hooks/pre-commit 2>/dev/null || true
	chmod +x .git/hooks/pre-commit 2>/dev/null || true
	chmod +x scripts/*.sh
	@echo "✅ Setup complete!"

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
