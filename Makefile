ifneq (,$(wildcard .env))
include .env
export
endif

API_HOST ?= 127.0.0.1
API_PORT ?= 8000

.PHONY: install test eval evidence run demo frontend-install frontend-dev frontend-build docker-build

install:
	python -m venv .venv
	.venv/bin/pip install -r requirements.txt

test:
	.venv/bin/python -m pytest -q

eval:
	.venv/bin/python scripts/evaluate.py

evidence: eval
	.venv/bin/python scripts/build_resume_evidence.py

run:
	.venv/bin/uvicorn app:app --host $(API_HOST) --port $(API_PORT) --reload

demo:
	./scripts/demo.sh

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

docker-build:
	docker build -t local-extractive-rag-service .
