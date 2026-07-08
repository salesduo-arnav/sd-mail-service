# sd-mail-service — developer command shortcuts.
# Run `make` (or `make help`) to list targets.
# Dedicated standalone ports: API 3100 · Admin 5180 · Postgres 5442 · Redis 6389 · Mailhog SMTP 1026 / UI 8026

COMPOSE := docker compose
API     := http://localhost:3100
CS_KEY  := sdm_cs_dev_key_do_not_use_in_prod
DEMO_KEY:= sdm_demo_dev_key_do_not_use_in_prod

.DEFAULT_GOAL := help
.PHONY: help env setup up up-build infra down reset restart logs ps \
        migrate seed seed-docker dev-api dev-api-only dev-worker dev-scheduler admin \
        build test lint openapi smoke urls

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

## ---- Setup ----

env: ## Create backend/.env + admin/.env from the examples (if missing)
	@if [ -f backend/.env ]; then echo "backend/.env exists"; else cp backend/.env.example backend/.env; echo "created backend/.env"; fi
	@if [ -f admin/.env ]; then echo "admin/.env exists"; else cp admin/.env.example admin/.env; echo "created admin/.env"; fi

setup: env ## Install backend + admin dependencies
	npm --prefix backend install
	npm --prefix admin install

## ---- Docker (full stack) ----

up: env ## Start the full stack in Docker (api + worker + scheduler + admin + infra)
	$(COMPOSE) up -d

up-build: env ## Rebuild images and start the full stack
	$(COMPOSE) up -d --build

infra: ## Start ONLY infra in Docker (postgres + redis + mailhog) — for host-mode dev
	$(COMPOSE) up -d postgres redis mailhog

down: ## Stop all containers (keeps data volumes)
	$(COMPOSE) down

reset: ## Stop all containers AND wipe data volumes (fresh db/redis)
	$(COMPOSE) down -v

restart: ## Restart the app containers (api/worker/scheduler)
	$(COMPOSE) restart api worker scheduler

logs: ## Tail logs from all containers
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

## ---- Database ----

migrate: ## Apply pending DB migrations (host — needs infra up + backend/.env)
	npm --prefix backend run migrate:up

seed: ## Seed superadmin + products + dev keys (host)
	npm --prefix backend run seed

seed-docker: ## Seed inside the running api container (use after `make up`)
	$(COMPOSE) exec api npm run seed

## ---- Host dev (run each in its own terminal) ----

dev-api: ## Wait for DB, migrate, seed, then run the API on :3100 (hot reload)
	npm --prefix backend run dev

dev-api-only: ## Run just the API (skip migrate/seed) — DB must already be set up
	npm --prefix backend run dev:api

dev-worker: ## Run the queue worker with hot reload
	npm --prefix backend run dev:worker

dev-scheduler: ## Run the scheduler with hot reload
	npm --prefix backend run dev:scheduler

admin: ## Run the admin UI dev server on :5180
	npm --prefix admin run dev

## ---- Quality / build ----

build: ## Build backend (tsc) and admin (vite)
	npm --prefix backend run build
	npm --prefix admin run build

test: ## Run the backend Jest suite
	npm --prefix backend test

lint: ## Lint backend and admin
	npm --prefix backend run lint
	npm --prefix admin run lint

openapi: ## Regenerate docs/openapi.json from the spec
	npm --prefix backend run openapi

## ---- Helpers ----

urls: ## Print the local URLs
	@echo "Admin   → http://localhost:5180  (admin@salesduo.com / admin12345)"
	@echo "API     → $(API)/health"
	@echo "Mailhog → http://localhost:8026"

smoke: ## Fire sample events (welcome + transactional OTP) — watch Mailhog at :8026
	@echo "→ immediate welcome email"
	@curl -s -o /dev/null -w "  /v1/events: %{http_code}\n" -X POST $(API)/v1/events \
		-H "Authorization: Bearer $(CS_KEY)" -H "Content-Type: application/json" \
		-d '{"event_key":"creative_studio.trial_started","idempotency_key":"smoke-welcome","subscriber":{"external_id":"smoke1","email":"you@example.com","name":"You"},"data":{"trial_ends_at":"2026-07-22T10:00:00Z"}}'
	@echo "→ transactional OTP (synchronous)"
	@curl -s -o /dev/null -w "  /v1/messages: %{http_code}\n" -X POST $(API)/v1/messages \
		-H "Authorization: Bearer $(CS_KEY)" -H "Content-Type: application/json" \
		-d '{"template_key":"login_otp","to":{"email":"you@example.com","name":"You"},"data":{"otp":"123456","expires_minutes":5}}'
	@echo "Open http://localhost:8026 to view them."
