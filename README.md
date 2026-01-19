# StoreSync

A multi-location marketing operations platform for retail chains to centrally manage location-specific marketing campaigns with AI-powered content generation and sophisticated approval workflows.

![alt text](<claude/Screenshot 2026-01-19 at 2.47.24 PM.png>)

## Work in Progess ⚠️

> [!Important]
> This project is one of my experiments with Claude Code! It's still needs polishing. It's currently a work in progress.

## The Problem

Retail chains with multiple locations face significant challenges in marketing operations:

- **Inconsistent Messaging**: Each store creates its own marketing content, leading to brand inconsistency
- **Manual Processes**: Campaign creation, approval, and deployment are time-consuming manual tasks
- **No Visibility**: Corporate has limited visibility into what marketing is being used at each location
- **Scalability Issues**: As the number of locations grows, managing campaigns becomes exponentially harder
- **Content Quality**: Not every location has skilled marketers to create compelling content

## The Solution

StoreSync provides a centralized platform where:

1. **Corporate teams** create reusable campaign templates with brand guidelines
2. **Location managers** customize campaigns for their specific stores
3. **Brand managers** review and approve campaigns before they go live
4. **AI assists** in generating high-quality, on-brand content
5. **Everyone** has visibility into campaign status across all locations

## Features

### Campaign Management
- Create reusable templates with Jinja2-style variables (`{{location_name}}`, `{{discount_percentage}}`)
- Customize campaigns per location while maintaining brand consistency
- Schedule campaigns for future activation
- Track campaign status across all locations

### Approval Workflow
Complete 7-stage workflow with full audit trail:

```
Draft → Pending Review → Approved → Scheduled → Active → Completed
                      ↘ Rejected → (back to Draft)
```

- Role-based permissions (Admin, Brand Manager, Location Manager, Viewer)
- Required comments for rejections
- Complete history of all approval decisions

### AI Content Generation
- **Template Rendering**: Automatically populate templates with location-specific data
- **AI-Enhanced Content**: Generate creative marketing copy using GPT-4
- **RAG (Retrieval-Augmented Generation)**: Uses successful past campaigns as context for better results
- **Semantic Search**: Find similar campaigns using vector embeddings

### Multi-Brand Support
- Manage multiple brands from a single platform
- Brand-specific templates and settings
- Location hierarchies under each brand
- Bulk import locations via CSV/Excel

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Django 5.0 | Web framework |
| Django REST Framework | REST API |
| PostgreSQL + pgvector | Database with vector search |
| Celery + Redis | Background task processing |
| LangChain + OpenAI | AI content generation |
| django-fsm | Workflow state machine |

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 | React framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Zustand | State management |
| React Query | Server state & caching |
| React Hook Form + Zod | Form handling & validation |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                        localhost:3000                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Django REST API                             │
│                       localhost:8000                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Auth     │  │   Brands    │  │       Campaigns         │  │
│  │  (JWT)      │  │  Locations  │  │  Templates, Approvals   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  PostgreSQL │    │      Redis      │    │     OpenAI      │
│  + pgvector │    │  (Task Broker)  │    │   (LLM + RAG)   │
└─────────────┘    └─────────────────┘    └─────────────────┘
                           │
                           ▼
                   ┌─────────────────┐
                   │  Celery Workers │
                   │  - Content Gen  │
                   │  - Scheduling   │
                   │  - Notifications│
                   └─────────────────┘
```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- OpenAI API key (for AI features)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd storesync
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

3. **Start all services**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations**
   ```bash
   docker compose exec backend python manage.py migrate
   ```

5. **Create a superuser**
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:8000/api/v1/
   - API Docs: http://localhost:8000/api/docs/
   - Celery Flower: http://localhost:5555

### Local Development

#### Backend
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements/local.txt

# Set environment variables
export DATABASE_URL=postgres://storesync:storesync@localhost:5432/storesync
export REDIS_URL=redis://localhost:6379/0
export OPENAI_API_KEY=your-key-here

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## API Overview

### Authentication
```
POST /api/v1/auth/token/           # Login (returns JWT tokens)
POST /api/v1/auth/token/refresh/   # Refresh access token
POST /api/v1/auth/register/        # Register new user
GET  /api/v1/auth/me/              # Get current user
```

### Brands & Locations
```
GET/POST     /api/v1/brands/
GET/PATCH    /api/v1/brands/{id}/
GET/POST     /api/v1/brands/{id}/locations/
POST         /api/v1/brands/{id}/locations/bulk_import/
```

### Campaign Templates
```
GET/POST     /api/v1/campaigns/templates/
GET/PATCH    /api/v1/campaigns/templates/{id}/
```

### Campaigns
```
GET/POST     /api/v1/campaigns/
GET/PATCH    /api/v1/campaigns/{id}/

# Workflow Actions
POST         /api/v1/campaigns/{id}/submit/
POST         /api/v1/campaigns/{id}/approve/
POST         /api/v1/campaigns/{id}/reject/
POST         /api/v1/campaigns/{id}/schedule/

# AI Features
POST         /api/v1/campaigns/{id}/generate_content/
POST         /api/v1/campaigns/similar/
```

Full API documentation available at `/api/docs/` (Swagger UI) or `/api/redoc/`.

## Project Structure

```
storesync/
├── apps/
│   ├── users/          # User authentication & roles
│   ├── brands/         # Brand & location management
│   ├── campaigns/      # Templates, campaigns, approvals
│   │   └── services/   # AI content generation, similarity search
│   └── core/           # Shared utilities
├── config/             # Django settings & URLs
├── frontend/
│   ├── src/
│   │   ├── app/        # Next.js pages (App Router)
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # API client, utilities
│   │   ├── stores/     # Zustand stores
│   │   └── types/      # TypeScript types
│   └── e2e/            # Playwright tests
├── requirements/       # Python dependencies
└── docker-compose.yml  # Docker services
```

## Testing

### Backend Tests
```bash
# Run all tests
docker compose exec backend pytest

# Run with coverage
docker compose exec backend pytest --cov=apps --cov-report=html
```

### Frontend Tests
```bash
cd frontend

# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (requires running application)
npm run test:e2e
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | Django secret key | Yes |
| `DEBUG` | Enable debug mode | No (default: False) |
| `DATABASE_URL` | PostgreSQL connection URL | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No* |
| `ALLOWED_HOSTS` | Allowed host headers | Yes (production) |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | Yes |

*AI features will be disabled without an OpenAI API key

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access |
| **Brand Manager** | Approve/reject campaigns, manage templates |
| **Location Manager** | Create and submit campaigns |
| **Viewer** | Read-only access |

## Background Tasks

StoreSync uses Celery for background processing:

- **Content Generation**: Async AI content generation with retries
- **Campaign Activation**: Auto-activate scheduled campaigns (every 5 min)
- **Campaign Completion**: Auto-complete expired campaigns (every 5 min)
- **Approval Digest**: Daily email summary of pending approvals
- **Embedding Computation**: Batch vector embedding generation

Monitor tasks at http://localhost:5555 (Celery Flower).

## License

This project is proprietary software. All rights reserved.
