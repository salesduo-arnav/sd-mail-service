# sd-mail-service — developer command shortcuts.
# Run `make` (or `make help`) to list targets.
# Dedicated standalone ports: API 3100 · Admin 5180 · Postgres 5442 · Redis 6389 · Mailhog SMTP 1026 / UI 8026

COMPOSE := docker compose
API     := http://localhost:3100
# Create a product + API key in the admin, then pass it: `make smoke KEY=sdm_...`
KEY     ?=

.DEFAULT_GOAL := help
.PHONY: help env setup up up-build infra down reset restart logs ps \
        migrate seed seed-docker dev-api dev-api-only dev-worker dev-scheduler admin \
        build test lint openapi smoke urls

help: ## Show this help
	@node -e "require('fs').readFileSync('Makefile','utf8').split(/\r?\n/).forEach(function(l){var m=l.match(/^([a-zA-Z0-9_-]+):.*?## (.*)/);if(m)console.log('  '+m[1].padEnd(16)+m[2])})"

## ---- Setup ----

env: ## Create backend/.env + admin/.env from the examples (if missing)
	@node -e "['backend','admin'].forEach(function(d){var fs=require('fs'),f=d+'/.env';if(fs.existsSync(f))console.log(f+' exists');else{fs.copyFileSync(d+'/.env.example',f);console.log('created '+f)}})"

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

## ---- Host dev (run each in its own terminal; a standalone terminal window is best on Windows) ----
# The watcher is launched via `node` on ts-node-dev's entry (NOT a .cmd/.bin shim or `npm run`),
# which works under cmd.exe AND bash and avoids the "Terminate batch job (Y/N)?" prompt +
# the stuck terminal input mode on Ctrl-C. If a terminal ever gets stuck: run `reset` in Git Bash.
TSND := node node_modules/ts-node-dev/lib/bin.js --respawn --transpile-only

dev-api: ## Wait for DB, migrate, seed, then run the API on :3100 (hot reload)
	cd backend && npm run db:ready && npm run migrate:up && npm run seed && $(TSND) src/server.ts

dev-api-only: ## Run just the API (skip migrate/seed) — DB must already be set up
	cd backend && $(TSND) src/server.ts

dev-worker: ## Run the queue worker with hot reload
	cd backend && npm run db:ready && $(TSND) src/worker.ts

dev-scheduler: ## Run the scheduler with hot reload
	cd backend && npm run db:ready && $(TSND) src/scheduler.ts

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
	@echo "Admin   -> http://localhost:5180  (admin@salesduo.com / admin12345)"
	@echo "API     -> $(API)/health"
	@echo "Docs    -> $(API)/docs"
	@echo "Mailhog -> http://localhost:8026"

smoke: ## Fire a sample event with a product key — usage: make smoke KEY=sdm_...
	@node -e "var k='$(KEY)';if(!k){console.error('Set KEY: make smoke KEY=<product api key from the admin>');process.exit(1)}fetch('$(API)/v1/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+k},body:JSON.stringify({event_key:'app.trial_started',idempotency_key:'smoke-1',subscriber:{external_id:'smoke1',email:'you@example.com'}})}).then(function(r){console.log('/v1/events: '+r.status)}).catch(function(e){console.error(e.message)})"
