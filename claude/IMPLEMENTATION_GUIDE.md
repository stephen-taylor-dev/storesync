# StoreSync Development Phases

This breakdown organizes the project into 18 phases, each designed to be a focused session with Claude Code. Each phase builds on the previous and produces testable, working code.

---

## Phase 1: Backend Project Scaffolding

**Goal:** Create the Django project structure with all configuration files.

**Tasks:**

- Initialize Django project with the specified directory structure
- Create `pyproject.toml` with all dependencies
- Set up settings module (base, local, production)
- Configure `config/urls.py` with API versioning placeholder
- Create empty app directories: `users`, `brands`, `campaigns`, `core`
- Add `.env.example` with required environment variables

**Deliverables:**

```
storesync/
├── manage.py
├── pyproject.toml
├── requirements/
│   ├── base.txt
│   ├── local.txt
│   └── production.txt
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── local.py
│   ├── urls.py
│   └── wsgi.py
└── apps/
    ├── __init__.py
    ├── core/
    ├── users/
    ├── brands/
    └── campaigns/
```

**Validation:** `python manage.py check` passes

---

## Phase 2: Docker Development Environment

**Goal:** Create Docker configuration for local development.

**Tasks:**

- Write `Dockerfile` for Django backend
- Write `docker-compose.yml` with PostgreSQL (pgvector), Redis, backend services
- Create database initialization script to enable pgvector extension
- Add `Makefile` with common commands (up, down, migrate, shell, test)

**Deliverables:**

- `Dockerfile`
- `docker-compose.yml`
- `scripts/init-db.sh`
- `Makefile`

**Validation:** `docker-compose up` starts all services; `docker-compose exec backend python manage.py check` passes

---

## Phase 3: Core and User Models

**Goal:** Implement abstract base models and custom user model.

**Tasks:**

- Create `TimeStampedModel` and `UUIDModel` in `apps/core/models.py`
- Implement custom `User` model with role field in `apps/users/models.py`
- Configure `AUTH_USER_MODEL` in settings
- Create and run initial migrations

**Deliverables:**

- `apps/core/models.py` with abstract models
- `apps/users/models.py` with User model
- `apps/users/admin.py` with UserAdmin
- Migration files

**Validation:** `python manage.py migrate` succeeds; can create user via Django shell

---

## Phase 4: Brand and Location Models

**Goal:** Implement Brand and Location models.

**Tasks:**

- Create `Brand` model with all fields
- Create `Location` model with JSON fields for address and attributes
- Add model managers with common queries
- Register models in admin
- Create migrations

**Deliverables:**

- `apps/brands/models.py`
- `apps/brands/admin.py`
- Migration files

**Validation:** Can create Brand and Location via admin; `Location.full_address` property works

---

## Phase 5: Campaign Models

**Goal:** Implement CampaignTemplate, LocationCampaign, and ApprovalStep models.

**Tasks:**

- Create `CampaignTemplate` model
- Create `LocationCampaign` model with FSMField for status
- Create `ApprovalStep` model for audit trail
- Add pgvector `VectorField` to LocationCampaign (nullable for now)
- Define FSM transitions (submit, approve, reject, etc.)
- Register in admin
- Create migrations

**Deliverables:**

- `apps/campaigns/models.py`
- `apps/campaigns/admin.py`
- Migration files

**Validation:** Can create campaigns via admin; status transitions work via shell

---

## Phase 6: JWT Authentication API

**Goal:** Implement JWT-based authentication endpoints.

**Tasks:**

- Configure `djangorestframework-simplejwt` in settings
- Create token obtain and refresh views
- Create user registration serializer and view (optional)
- Create current user endpoint (`/api/v1/auth/me/`)
- Add URL routing

**Deliverables:**

- `apps/users/serializers.py`
- `apps/users/views.py`
- `apps/users/urls.py`
- Updated `config/urls.py`

**Validation:** Can obtain JWT token via `/api/v1/auth/token/`; can access `/api/v1/auth/me/` with valid token

---

## Phase 7: Brand and Location API

**Goal:** Implement CRUD endpoints for brands and locations.

**Tasks:**

- Create Brand serializer and ViewSet
- Create Location serializer and nested ViewSet
- Implement permission filtering (users see only their brands)
- Configure URL routing with nested resources
- Add pagination configuration

**Deliverables:**

- `apps/brands/serializers.py`
- `apps/brands/views.py`
- `apps/brands/urls.py`
- `apps/core/pagination.py`
- `apps/core/permissions.py`

**Validation:** API endpoints return correct data; permission filtering works

---

## Phase 8: Campaign Template API

**Goal:** Implement CRUD endpoints for campaign templates.

**Tasks:**

- Create CampaignTemplate serializer
- Create CampaignTemplate ViewSet with brand filtering
- Add URL routing

**Deliverables:**

- `apps/campaigns/serializers.py` (template serializers)
- `apps/campaigns/views.py` (template viewset)
- `apps/campaigns/urls.py`

**Validation:** Can create and list templates filtered by brand

---

## Phase 9: Location Campaign API

**Goal:** Implement CRUD and workflow endpoints for location campaigns.

**Tasks:**

- Create LocationCampaign list and detail serializers
- Create LocationCampaign ViewSet with filtering
- Implement status transition actions (submit, approve, reject)
- Create ApprovalStep on each transition
- Add URL routing

**Deliverables:**

- Updated `apps/campaigns/serializers.py`
- Updated `apps/campaigns/views.py`
- Updated `apps/campaigns/urls.py`

**Validation:** Can create campaigns; status transitions create approval steps; rejection requires comments

---

## Phase 10: API Documentation

**Goal:** Configure automatic OpenAPI documentation.

**Tasks:**

- Configure `drf-spectacular` in settings
- Add schema and Swagger UI URLs
- Add docstrings and descriptions to ViewSets
- Configure authentication in schema

**Deliverables:**

- Updated `config/settings/base.py`
- Updated `config/urls.py`
- Schema available at `/api/schema/`
- Swagger UI at `/api/docs/`

**Validation:** Swagger UI loads and shows all endpoints with correct authentication

---

## Phase 11: Excel Import for Locations

**Goal:** Enable bulk import of locations from spreadsheets.

**Tasks:**

- Configure `django-import-export`
- Create LocationResource with field mappings
- Add import functionality to admin
- Create API endpoint for programmatic import
- Handle validation errors gracefully

**Deliverables:**

- `apps/brands/resources.py`
- Updated `apps/brands/admin.py`
- Bulk import endpoint in `apps/brands/views.py`
- Sample import template Excel file

**Validation:** Can import locations from Excel via admin; errors reported clearly

---

## Phase 12: Frontend Project Scaffolding

**Goal:** Create Next.js project with all tooling configured.

**Tasks:**

- Initialize Next.js 14 with TypeScript and App Router
- Configure Tailwind CSS
- Install and configure shadcn/ui
- Set up directory structure
- Configure environment variables
- Create API client with Axios

**Deliverables:**

```
frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── src/
│   ├── app/
│   │   └── layout.tsx
│   ├── components/ui/
│   ├── lib/
│   │   └── api-client.ts
│   └── types/
```

**Validation:** `npm run dev` starts; Tailwind styles work; API client configured

---

## Phase 13: Frontend Authentication

**Goal:** Implement login flow and protected routes.

**Tasks:**

- Create auth store with Zustand
- Implement token storage and refresh logic in API client
- Create login page with form
- Create auth layout with redirect logic
- Create dashboard layout placeholder

**Deliverables:**

- `src/stores/auth-store.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- Updated `src/lib/api-client.ts` with interceptors

**Validation:** Can log in; redirects to dashboard; token refresh works

---

## Phase 14: Frontend Dashboard Shell

**Goal:** Create dashboard layout with navigation.

**Tasks:**

- Create header component with user menu
- Create sidebar with navigation links
- Create breadcrumbs component
- Create dashboard home page with placeholder stats
- Add loading and error states

**Deliverables:**

- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/breadcrumbs.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/components/shared/loading-spinner.tsx`

**Validation:** Dashboard loads with navigation; user menu shows current user

---

## Phase 15: Frontend Brand and Location Management

**Goal:** Implement brand and location pages.

**Tasks:**

- Create TypeScript types for Brand and Location
- Create React Query hooks for brands and locations
- Build brand list page with cards
- Build brand detail page
- Build location table with sorting and filtering
- Add create/edit location dialog

**Deliverables:**

- `src/types/brand.ts`
- `src/hooks/use-brands.ts`
- `src/app/(dashboard)/brands/page.tsx`
- `src/app/(dashboard)/brands/[brandId]/page.tsx`
- `src/components/brands/location-table.tsx`
- `src/components/brands/location-form-dialog.tsx`

**Validation:** Can view brands; can CRUD locations; table sorting works

---

## Phase 16: Frontend Campaign Management

**Goal:** Implement campaign list and detail pages.

**Tasks:**

- Create TypeScript types for Campaign and Template
- Create React Query hooks for campaigns
- Build campaign list page with filters
- Build campaign detail page
- Build campaign create/edit form
- Create status badge component

**Deliverables:**

- `src/types/campaign.ts`
- `src/hooks/use-campaigns.ts`
- `src/hooks/use-templates.ts`
- `src/app/(dashboard)/campaigns/page.tsx`
- `src/app/(dashboard)/campaigns/[campaignId]/page.tsx`
- `src/app/(dashboard)/campaigns/new/page.tsx`
- `src/components/campaigns/status-badge.tsx`
- `src/components/campaigns/campaign-form.tsx`

**Validation:** Can list, create, and view campaigns; status displays correctly

---

## Phase 17: Frontend Campaign Workflow

**Goal:** Implement status transitions and approval queue.

**Tasks:**

- Create status workflow component with transition buttons
- Create approval dialog with comments
- Create rejection dialog (comments required)
- Build approval queue page for reviewers
- Add approval history display
- Implement polling for real-time updates

**Deliverables:**

- `src/components/campaigns/status-workflow.tsx`
- `src/components/approvals/approval-dialog.tsx`
- `src/app/(dashboard)/approvals/page.tsx`
- `src/hooks/use-polling.ts`

**Validation:** Can submit, approve, reject campaigns; approval history shows; queue updates

---

## Phase 18: Celery Configuration

**Goal:** Set up Celery for background tasks.

**Tasks:**

- Configure Celery in `config/celery.py`
- Create `__init__.py` setup for Celery app
- Add Celery Beat configuration for scheduled tasks
- Create placeholder tasks in campaigns app
- Update docker-compose with celery worker and beat services
- Add task monitoring via Flower (optional)

**Deliverables:**

- `config/celery.py`
- Updated `config/__init__.py`
- `apps/campaigns/tasks.py` (placeholder tasks)
- Updated `docker-compose.yml`
- `Dockerfile.celery`

**Validation:** Celery worker starts; can trigger task from shell; task executes

---

## Phase 19: AI Content Generation Service

**Goal:** Implement RAG-based content generation.

**Tasks:**

- Create `ContentGeneratorService` class
- Implement OpenAI integration with LangChain
- Create Jinja2 template rendering for campaign content
- Create Celery task for async generation
- Add API endpoint for content generation
- Handle errors and retries

**Deliverables:**

- `apps/campaigns/services/__init__.py`
- `apps/campaigns/services/content_generator.py`
- Updated `apps/campaigns/tasks.py`
- Content generation endpoint in views
- `ContentGenerationRequestSerializer`

**Validation:** Can generate content for a campaign; content saved to model

---

## Phase 20: AI Similarity Search Service

**Goal:** Implement semantic search for similar campaigns.

**Tasks:**

- Create `SimilaritySearchService` class
- Implement embedding generation via OpenAI
- Create pgvector similarity query using `CosineDistance`
- Add Celery task for embedding computation
- Create API endpoint for similarity search
- Integrate with content generator for RAG context

**Deliverables:**

- `apps/campaigns/services/similarity_search.py`
- Updated `apps/campaigns/tasks.py` (embedding task)
- Similarity search endpoint
- Updated content generator to use similar content

**Validation:** Can search for similar campaigns; results ranked by similarity score

---

## Phase 21: Frontend AI Integration

**Goal:** Add AI features to frontend.

**Tasks:**

- Create AI generate button component with dialog
- Add options for using similar content and additional context
- Show generation progress/status
- Display generated content with edit capability
- Add similar campaigns panel to campaign detail

**Deliverables:**

- `src/components/campaigns/ai-generate-button.tsx`
- `src/components/campaigns/content-preview.tsx`
- `src/components/campaigns/similar-campaigns.tsx`
- Updated campaign detail page

**Validation:** Can trigger AI generation; see progress; edit results

---

## Phase 22: Backend Testing

**Goal:** Add comprehensive test coverage for backend.

**Tasks:**

- Configure pytest with pytest-django
- Create fixtures for users, brands, locations, campaigns
- Write model tests (validation, properties, FSM transitions)
- Write API tests (CRUD, permissions, workflow)
- Write service tests (mocked OpenAI calls)
- Add test coverage reporting

**Deliverables:**

- `conftest.py` with fixtures
- `apps/users/tests/`
- `apps/brands/tests/`
- `apps/campaigns/tests/`
- `.coveragerc`

**Validation:** `pytest` passes; coverage > 80%

---

## Phase 23: Frontend Testing

**Goal:** Add test coverage for frontend components.

**Tasks:**

- Configure Jest and React Testing Library
- Write tests for auth flow
- Write tests for campaign form validation
- Write tests for status workflow component
- Add E2E tests with Playwright (optional)

**Deliverables:**

- `jest.config.js`
- `src/**/*.test.tsx` files
- `playwright.config.ts` (optional)
- `e2e/` directory (optional)

**Validation:** `npm test` passes

---

## Phase 24: Production Deployment Configuration

**Goal:** Prepare for production deployment.

**Tasks:**

- Create production Dockerfile with gunicorn
- Create production settings with security hardening
- Configure static file serving via WhiteNoise or S3
- Create GitHub Actions workflow for CI/CD
- Write deployment documentation
- Create infrastructure-as-code templates (Terraform or CDK, optional)

**Deliverables:**

- `Dockerfile` (production)
- `config/settings/production.py`
- `.github/workflows/deploy.yml`
- `docs/deployment.md`
- `infrastructure/` (optional)

**Validation:** CI pipeline runs; Docker image builds; deployment docs complete

---

## Phase Dependency Graph

```
Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ─► Phase 5
                                     │          │
                                     ▼          ▼
                               Phase 6 ─► Phase 7 ─► Phase 8 ─► Phase 9 ─► Phase 10
                                                                    │
                                     ┌──────────────────────────────┘
                                     ▼
                               Phase 11
                               
Phase 12 ─► Phase 13 ─► Phase 14 ─► Phase 15 ─► Phase 16 ─► Phase 17
                                                                │
                                     ┌──────────────────────────┘
                                     ▼
Phase 18 ─► Phase 19 ─► Phase 20 ─► Phase 21
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
              Phase 22                          Phase 23
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
                               Phase 24
```

---

## Working with Claude Code

For each phase, provide Claude Code with:

1. **Context:** "We're building StoreSync, a multi-location marketing operations platform. I'm on Phase X: [name]."
2. **Reference:** Share relevant sections from the technical spec.
3. **Request pattern:**

```
   Following the StoreSync technical spec, implement Phase X.
   
   Goals:
   - [List from phase]
   
   The previous phase completed:
   - [What exists]
   
   Please implement:
   - [Specific files/features]
```

4. **Validation:** After each phase, run the validation checks before proceeding.

This phased approach keeps each session focused, produces working code incrementally, and allows you to catch issues early before they compound.