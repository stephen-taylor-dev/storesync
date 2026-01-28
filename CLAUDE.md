# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StoreSync is a multi-location marketing operations platform for retail chains. It enables centralized management of location-specific marketing campaigns with AI-powered content generation and approval workflows.

## Development Commands

### Backend (Django)
```bash
# Start all services with Docker
docker compose up -d

# Run migrations
docker compose exec backend python manage.py migrate

# Run tests
docker compose exec backend pytest

# Run single test file
docker compose exec backend pytest apps/campaigns/tests/test_views.py

# Run single test
docker compose exec backend pytest apps/campaigns/tests/test_views.py::TestCampaignViewSet::test_create_campaign -v

# Run tests with coverage
docker compose exec backend pytest --cov=apps --cov-report=html

# Lint
docker compose exec backend ruff check .

# Format
docker compose exec backend ruff format .

# Create migrations
docker compose exec backend python manage.py makemigrations

# Django shell
docker compose exec backend python manage.py shell
```

### Frontend (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npm run type-check

# Unit tests
npm test

# E2E tests (requires running application)
npm run test:e2e
```

### Make shortcuts
```bash
make up          # Start services
make down        # Stop services
make test        # Run backend tests
make lint        # Run linter
make migrate     # Run migrations
```

## Architecture

### Backend Structure
- **Django 5.0 + DRF** - REST API framework
- **PostgreSQL + pgvector** - Database with vector search for campaign similarity
- **Celery + Redis** - Background task processing (content generation, scheduling)
- **django-fsm** - State machine for campaign approval workflow

Apps:
- `apps/users/` - Custom user model with roles (Admin, Brand Manager, Location Manager, Viewer)
- `apps/brands/` - Brand and Location models with hierarchical structure
- `apps/campaigns/` - Campaign templates, location campaigns, approval workflow
- `apps/core/` - Shared base models (UUIDModel, TimeStampedModel)

### Frontend Structure
- **Next.js 14 (App Router)** - React framework
- **TypeScript** - Type safety
- **Zustand** - Client state management (`src/stores/`)
- **React Query** - Server state and caching (`src/hooks/`)
- **React Hook Form + Zod** - Form handling and validation

Key directories:
- `src/app/` - Next.js pages using App Router (route groups: `(auth)`, `(dashboard)`)
- `src/components/` - React components organized by feature
- `src/hooks/` - React Query hooks for API calls
- `src/lib/api-client.ts` - Axios client with JWT token handling
- `src/types/` - TypeScript type definitions

### Campaign Workflow
The campaign approval flow uses django-fsm state transitions:
```
Draft → Pending Review → Approved → Scheduled → Active → Completed
                      ↘ Rejected → (back to Draft via revise)
```

### AI Content Generation
- Located in `apps/campaigns/services/content_generator.py`
- Uses LangChain + OpenAI (gpt-4o-mini) for content generation
- Jinja2 templates with placeholders (`{{location_name}}`, `{{discount_percentage}}`)
- Vector embeddings (1536 dimensions) stored in PostgreSQL for similarity search
- RAG: Uses similar successful campaigns as context

## Key Patterns

### API Endpoints
All endpoints under `/api/v1/`:
- Auth: `/auth/token/`, `/auth/me/`
- Brands: `/brands/`, `/brands/{id}/locations/`
- Campaigns: `/campaigns/templates/`, `/campaigns/`, `/campaigns/{id}/submit/`

### Testing
- Backend: pytest with fixtures defined in `conftest.py`
- Pre-built fixtures: `admin_user`, `brand_manager_user`, `brand`, `location`, `campaign_template`, `draft_campaign`, `pending_campaign`, etc.
- Authenticated clients: `admin_client`, `brand_manager_client`, `location_manager_client`

### Environment Variables
Required: `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`
Optional: `OPENAI_API_KEY` (for AI features)
