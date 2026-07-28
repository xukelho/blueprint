.PHONY: start up stop down restart \
	startdb updb stopdb downdb restartdb \
	startapi upapi stopapi downapi restartapi \
	startfrontend upfrontend stopfrontend downfrontend restartfrontend

# Full application
start up:
	docker compose up --build

stop down:
	docker compose down

restart:
	$(MAKE) down
	$(MAKE) up

# Database (postgresdb)
startdb updb:
	docker compose up postgresdb

stopdb:
	docker compose stop postgresdb

downdb:
	docker compose stop postgresdb
	docker compose rm -f postgresdb

restartdb:
	$(MAKE) downdb
	$(MAKE) updb

# API (blueprint-api)
startapi upapi:
	docker compose up --build blueprint-api

stopapi:
	docker compose stop blueprint-api

downapi:
	docker compose stop blueprint-api
	docker compose rm -f blueprint-api

restartapi:
	$(MAKE) downapi
	$(MAKE) upapi

# Frontend (blueprint-frontend)
startfrontend upfrontend:
	docker compose up blueprint-frontend

stopfrontend:
	docker compose stop blueprint-frontend

downfrontend:
	docker compose stop blueprint-frontend
	docker compose rm -f blueprint-frontend

restartfrontend:
	$(MAKE) downfrontend
	$(MAKE) upfrontend
