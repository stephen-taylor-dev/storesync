.PHONY: help build up down restart logs shell dbshell migrate makemigrations createsuperuser test lint format clean

# Default target
help:
	@echo "StoreSync Development Commands"
	@echo ""
	@echo "Docker commands:"
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs (all services)"
	@echo "  make logs-backend   - View backend logs"
	@echo ""
	@echo "Django commands:"
	@echo "  make shell          - Open Django shell"
	@echo "  make dbshell        - Open database shell"
	@echo "  make migrate        - Run migrations"
	@echo "  make makemigrations - Create new migrations"
	@echo "  make createsuperuser - Create admin user"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test           - Run tests"
	@echo "  make lint           - Run linter"
	@echo "  make format         - Format code"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          - Remove containers and volumes"

# Docker commands
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

# Django commands
shell:
	docker-compose exec backend python manage.py shell

dbshell:
	docker-compose exec backend python manage.py dbshell

migrate:
	docker-compose exec backend python manage.py migrate

makemigrations:
	docker-compose exec backend python manage.py makemigrations

createsuperuser:
	docker-compose exec backend python manage.py createsuperuser

# Testing & Quality
test:
	docker-compose exec backend pytest

lint:
	docker-compose exec backend ruff check .

format:
	docker-compose exec backend ruff format .

# Utilities
clean:
	docker-compose down -v --remove-orphans
	docker system prune -f
