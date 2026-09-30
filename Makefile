.PHONY: help venv install run dev migrate makemigrations upgrade downgrade seed admin \
        up down down-v logs psql lint format typecheck check test \
        precommit clean lock audit

# ---- Variables ----
PYTHON := .venv/bin/python
UVICORN := .venv/bin/uvicorn
ALEMBIC := .venv/bin/alembic
RUFF := .venv/bin/ruff
MYPY := .venv/bin/mypy
PYTEST := .venv/bin/pytest

APP := app.main:app
DB_CONTAINER := coins_postgres
DB_USER := coins_user
DB_NAME := coins_db

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---- Environment ----

venv: ## Create virtualenv via uv
	uv venv --python 3.12

install: ## Install dependencies from requirements.txt (exact versions, hash-checked)
	uv pip sync requirements.txt

lock: ## Re-pin requirements.txt after editing requirements.in (make lock up=pkg to upgrade one)
	uv pip compile requirements.in --python-version 3.12 --generate-hashes -o requirements.txt $(if $(up),-P $(up),)

audit: ## Check Python and npm dependencies for known vulnerabilities
	.venv/bin/pip-audit -r requirements.txt --disable-pip
	cd frontend && npm audit

# ---- Running the app ----

run: ## Run server (no reload)
	$(UVICORN) $(APP) --host 0.0.0.0 --port 8000

dev: ## Run server with auto-reload
	$(UVICORN) $(APP) --reload

# ---- Database / Docker ----

up: ## Start Postgres container and wait until it is ready
	docker compose up -d
	@echo "Waiting for Postgres to be ready..."
	@until docker exec $(DB_CONTAINER) pg_isready -U $(DB_USER) -d $(DB_NAME) > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "Postgres is ready."

down: ## Stop and remove containers (data is preserved)
	docker compose down

down-v: ## Stop containers and remove volume (full data reset)
	docker compose down -v

logs: ## Follow Postgres container logs
	docker logs -f $(DB_CONTAINER)

psql: ## Open psql shell inside the container
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

# ---- Migrations ----

makemigrations: ## Create a new migration (make makemigrations m="description")
	$(ALEMBIC) revision --autogenerate -m "$(m)"

upgrade: ## Apply all migrations
	$(ALEMBIC) upgrade head

downgrade: ## Roll back the last migration
	$(ALEMBIC) downgrade -1

migrate: upgrade ## Alias for upgrade

# ---- Linting / formatting ----

lint: ## Check code with the linter
	$(RUFF) check .

format: ## Auto-format code and fix lint issues
	$(RUFF) format .
	$(RUFF) check . --fix

typecheck: ## Run static type checking
	$(MYPY) app

check: lint typecheck ## Run full check (lint + mypy)

precommit: ## Run all pre-commit hooks on all files
	.venv/bin/pre-commit run --all-files

# ---- Tests ----

test: ## Run tests
	$(PYTEST)

# ---- Misc ----

clean: ## Remove caches and temporary files
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .mypy_cache .ruff_cache .pytest_cache

seed: ## Populate reference tables with curated data (metals, etc.)
	$(PYTHON) -m app.db.seed.run

admin: ## Make a registered account admin (make admin email=you@example.com)
	@test -n "$(email)" || (echo 'Usage: make admin email=you@example.com' && exit 1)
	$(PYTHON) -m app.scripts.set_role "$(email)" admin
