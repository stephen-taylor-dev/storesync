# StoreSync Technical Specification

## Overview

StoreSync is a multi-location marketing operations platform that replaces spreadsheet-based campaign management with automated workflows and AI-powered content generation. The platform enables retail chains to manage location-specific marketing materials through a centralized system that captures institutional knowledge and streamlines approval processes.

**Core Value Proposition:** Transform manual, single-person-dependent spreadsheet processes into scalable software that preserves tribal knowledge and enables team-wide participation.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 14)                       │
│    TypeScript │ Tailwind CSS │ React Query │ Zustand                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ REST API + Polling
┌─────────────────────────────────┴───────────────────────────────────┐
│                    Backend (Django 5.0 + DRF)                       │
│    JWT Auth │ ViewSets │ Celery Tasks │ OpenAPI via drf-spectacular │
└──────┬──────────────────────────┬───────────────────────────────────┘
       │                          │
┌──────┴──────┐          ┌────────┴────────┐
│ PostgreSQL  │          │  Redis          │
│ + pgvector  │          │  (Celery broker │
│             │          │   + cache)      │
└─────────────┘          └─────────────────┘
       │
┌──────┴──────┐
│ OpenAI API  │
│ (GPT-4)     │
└─────────────┘
```

---

## Backend Specification

### Technology Stack

|Component|Technology|Version|
|---|---|---|
|Framework|Django|5.0+|
|API|Django REST Framework|3.14+|
|Auth|djangorestframework-simplejwt|5.3+|
|Database|PostgreSQL|16+|
|Vector Search|pgvector|0.5+|
|Task Queue|Celery|5.3+|
|Broker/Cache|Redis|7+|
|API Docs|drf-spectacular|0.26+|
|Excel Import|django-import-export|3.3+|
|State Machine|django-fsm|2.8+|
|AI/LLM|LangChain + OpenAI|latest|

### Project Structure

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
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py
├── apps/
│   ├── __init__.py
│   ├── users/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── tests/
│   ├── brands/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── resources.py          # django-import-export
│   │   └── tests/
│   ├── campaigns/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── tasks.py              # Celery tasks
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── content_generator.py
│   │   │   └── similarity_search.py
│   │   └── tests/
│   └── core/
│       ├── __init__.py
│       ├── models.py             # Abstract base models
│       ├── permissions.py
│       └── pagination.py
└── templates/
    └── admin/                    # Admin customizations
```

### Database Models

#### Core Models (apps/core/models.py)

python

```python
from django.db import models
import uuid


class TimeStampedModel(models.Model):
    """Abstract base model with created/updated timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Abstract base model using UUID as primary key."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True
```

#### User Models (apps/users/models.py)

python

```python
from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.models import TimeStampedModel


class User(AbstractUser, TimeStampedModel):
    """Extended user model with brand association."""
    
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrator'
        BRAND_MANAGER = 'brand_manager', 'Brand Manager'
        LOCATION_MANAGER = 'location_manager', 'Location Manager'
        VIEWER = 'viewer', 'Viewer'
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER
    )
    brands = models.ManyToManyField(
        'brands.Brand',
        related_name='users',
        blank=True
    )
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
```

#### Brand Models (apps/brands/models.py)

python

```python
from django.db import models
from apps.core.models import TimeStampedModel, UUIDModel


class Brand(UUIDModel, TimeStampedModel):
    """Top-level organization representing a retail brand."""
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to='brands/logos/', null=True, blank=True)
    settings = models.JSONField(default=dict)  # Brand-specific config
    
    class Meta:
        db_table = 'brands'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Location(UUIDModel, TimeStampedModel):
    """Physical location belonging to a brand."""
    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name='locations'
    )
    name = models.CharField(max_length=255)
    store_number = models.CharField(max_length=50)
    
    # Address as structured JSON for flexibility
    address = models.JSONField(default=dict)
    # Example: {"street": "123 Main St", "city": "Austin", "state": "TX", "zip": "78701"}
    
    # Location-specific attributes for campaign targeting
    attributes = models.JSONField(default=dict)
    # Example: {"square_footage": 5000, "has_gas_station": true, "region": "southwest"}
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'locations'
        ordering = ['brand', 'store_number']
        unique_together = [['brand', 'store_number']]
        indexes = [
            models.Index(fields=['brand', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.brand.name} - {self.name} ({self.store_number})"
    
    @property
    def full_address(self):
        addr = self.address
        return f"{addr.get('street', '')}, {addr.get('city', '')}, {addr.get('state', '')} {addr.get('zip', '')}"
```

#### Campaign Models (apps/campaigns/models.py)

python

```python
from django.db import models
from django.contrib.auth import get_user_model
from django_fsm import FSMField, transition
from pgvector.django import VectorField
from apps.core.models import TimeStampedModel, UUIDModel

User = get_user_model()


class CampaignTemplate(UUIDModel, TimeStampedModel):
    """Reusable campaign template with content placeholders."""
    brand = models.ForeignKey(
        'brands.Brand',
        on_delete=models.CASCADE,
        related_name='campaign_templates'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Jinja2-style template with placeholders
    # Example: "{{location.name}} is having a {{campaign.sale_type}} sale!"
    content_template = models.TextField()
    
    # Define required variables for this template
    required_variables = models.JSONField(default=list)
    # Example: ["sale_type", "discount_percentage", "start_date", "end_date"]
    
    # Campaign type for categorization
    campaign_type = models.CharField(max_length=50)
    # Examples: "seasonal_sale", "grand_opening", "clearance", "holiday"
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'campaign_templates'
        ordering = ['brand', 'name']
    
    def __str__(self):
        return f"{self.brand.name} - {self.name}"


class LocationCampaign(UUIDModel, TimeStampedModel):
    """Campaign instance for a specific location."""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SCHEDULED = 'scheduled', 'Scheduled'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
    
    location = models.ForeignKey(
        'brands.Location',
        on_delete=models.CASCADE,
        related_name='campaigns'
    )
    template = models.ForeignKey(
        CampaignTemplate,
        on_delete=models.PROTECT,
        related_name='location_campaigns'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_campaigns'
    )
    
    # Status workflow using django-fsm
    status = FSMField(default=Status.DRAFT, choices=Status.choices)
    
    # Location-specific customizations override template defaults
    customizations = models.JSONField(default=dict)
    # Example: {"sale_type": "Summer Clearance", "discount_percentage": 30}
    
    # AI-generated or manually edited final content
    generated_content = models.TextField(blank=True)
    
    # Vector embedding for semantic search
    content_embedding = VectorField(dimensions=1536, null=True)
    
    # Scheduling
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'location_campaigns'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['location', 'status']),
            models.Index(fields=['status', 'scheduled_start']),
        ]
    
    def __str__(self):
        return f"{self.location} - {self.template.name}"
    
    # FSM Transitions
    @transition(field=status, source=Status.DRAFT, target=Status.PENDING_REVIEW)
    def submit_for_review(self):
        """Submit campaign for approval."""
        pass
    
    @transition(field=status, source=Status.PENDING_REVIEW, target=Status.APPROVED)
    def approve(self):
        """Approve the campaign."""
        pass
    
    @transition(field=status, source=Status.PENDING_REVIEW, target=Status.REJECTED)
    def reject(self):
        """Reject the campaign."""
        pass
    
    @transition(field=status, source=Status.APPROVED, target=Status.SCHEDULED)
    def schedule(self):
        """Schedule the approved campaign."""
        pass
    
    @transition(field=status, source=[Status.DRAFT, Status.REJECTED], target=Status.DRAFT)
    def revise(self):
        """Return to draft for revision."""
        pass


class ApprovalStep(UUIDModel, TimeStampedModel):
    """Audit trail for campaign approval decisions."""
    
    class Decision(models.TextChoices):
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        REQUESTED_CHANGES = 'requested_changes', 'Requested Changes'
    
    campaign = models.ForeignKey(
        LocationCampaign,
        on_delete=models.CASCADE,
        related_name='approval_steps'
    )
    approver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='approval_decisions'
    )
    decision = models.CharField(max_length=20, choices=Decision.choices)
    comments = models.TextField(blank=True)
    
    # Capture previous and new status for audit
    previous_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)
    
    class Meta:
        db_table = 'approval_steps'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.campaign} - {self.decision} by {self.approver}"
```

### API Endpoints

#### URL Configuration (config/urls.py)

python

```python
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API v1
    path('api/v1/', include([
        path('auth/', include('apps.users.urls')),
        path('brands/', include('apps.brands.urls')),
        path('campaigns/', include('apps.campaigns.urls')),
    ])),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
```

#### Brand Endpoints (apps/brands/urls.py)

python

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.BrandViewSet, basename='brand')
router.register(r'(?P<brand_id>[^/.]+)/locations', views.LocationViewSet, basename='location')

urlpatterns = [
    path('', include(router.urls)),
]
```

#### Campaign Endpoints (apps/campaigns/urls.py)

python

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'templates', views.CampaignTemplateViewSet, basename='campaign-template')
router.register(r'', views.LocationCampaignViewSet, basename='location-campaign')

urlpatterns = [
    path('', include(router.urls)),
    path('generate-content/', views.GenerateContentView.as_view(), name='generate-content'),
    path('similar/', views.SimilarCampaignsView.as_view(), name='similar-campaigns'),
    path('bulk-import/', views.BulkImportView.as_view(), name='bulk-import'),
]
```

#### API Endpoint Summary

|Method|Endpoint|Description|
|---|---|---|
|POST|/api/v1/auth/token/|Obtain JWT token pair|
|POST|/api/v1/auth/token/refresh/|Refresh access token|
|GET|/api/v1/brands/|List brands (filtered by user access)|
|POST|/api/v1/brands/|Create brand (admin only)|
|GET|/api/v1/brands/{id}/|Retrieve brand details|
|GET|/api/v1/brands/{id}/locations/|List locations for brand|
|POST|/api/v1/brands/{id}/locations/|Create location|
|GET|/api/v1/brands/{id}/locations/{id}/|Retrieve location|
|PATCH|/api/v1/brands/{id}/locations/{id}/|Update location|
|DELETE|/api/v1/brands/{id}/locations/{id}/|Delete location|
|GET|/api/v1/campaigns/templates/|List campaign templates|
|POST|/api/v1/campaigns/templates/|Create template|
|GET|/api/v1/campaigns/|List location campaigns|
|POST|/api/v1/campaigns/|Create campaign|
|GET|/api/v1/campaigns/{id}/|Retrieve campaign|
|PATCH|/api/v1/campaigns/{id}/|Update campaign|
|POST|/api/v1/campaigns/{id}/submit/|Submit for review|
|POST|/api/v1/campaigns/{id}/approve/|Approve campaign|
|POST|/api/v1/campaigns/{id}/reject/|Reject campaign|
|POST|/api/v1/campaigns/generate-content/|AI content generation|
|GET|/api/v1/campaigns/similar/|Semantic similarity search|
|POST|/api/v1/campaigns/bulk-import/|Excel import|

### Serializers (apps/campaigns/serializers.py)

python

```python
from rest_framework import serializers
from .models import CampaignTemplate, LocationCampaign, ApprovalStep


class CampaignTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignTemplate
        fields = [
            'id', 'brand', 'name', 'description', 'content_template',
            'required_variables', 'campaign_type', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ApprovalStepSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.get_full_name', read_only=True)
    
    class Meta:
        model = ApprovalStep
        fields = [
            'id', 'approver', 'approver_name', 'decision', 'comments',
            'previous_status', 'new_status', 'created_at'
        ]
        read_only_fields = ['id', 'previous_status', 'new_status', 'created_at']


class LocationCampaignListSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    
    class Meta:
        model = LocationCampaign
        fields = [
            'id', 'location', 'location_name', 'template', 'template_name',
            'status', 'scheduled_start', 'scheduled_end', 'created_at'
        ]


class LocationCampaignDetailSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    approval_history = ApprovalStepSerializer(source='approval_steps', many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = LocationCampaign
        fields = [
            'id', 'location', 'location_name', 'template', 'template_name',
            'created_by', 'created_by_name', 'status', 'customizations',
            'generated_content', 'scheduled_start', 'scheduled_end',
            'approval_history', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'generated_content', 'created_at', 'updated_at']


class ContentGenerationRequestSerializer(serializers.Serializer):
    campaign_id = serializers.UUIDField()
    use_similar_content = serializers.BooleanField(default=True)
    additional_context = serializers.CharField(required=False, allow_blank=True)


class SimilarCampaignQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500)
    brand_id = serializers.UUIDField(required=False)
    limit = serializers.IntegerField(default=5, min_value=1, max_value=20)
```

### ViewSets (apps/campaigns/views.py)

python

```python
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from .models import CampaignTemplate, LocationCampaign, ApprovalStep
from .serializers import (
    CampaignTemplateSerializer,
    LocationCampaignListSerializer,
    LocationCampaignDetailSerializer,
    ContentGenerationRequestSerializer,
    SimilarCampaignQuerySerializer,
)
from .services.content_generator import ContentGeneratorService
from .services.similarity_search import SimilaritySearchService
from .tasks import generate_content_async, compute_embedding_async


class CampaignTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return CampaignTemplate.objects.all()
        return CampaignTemplate.objects.filter(brand__in=user.brands.all())


class LocationCampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return LocationCampaignListSerializer
        return LocationCampaignDetailSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = LocationCampaign.objects.select_related(
            'location', 'template', 'created_by'
        ).prefetch_related('approval_steps')
        
        if user.role != 'admin':
            queryset = queryset.filter(location__brand__in=user.brands.all())
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by location if provided
        location_id = self.request.query_params.get('location')
        if location_id:
            queryset = queryset.filter(location_id=location_id)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit campaign for review."""
        campaign = self.get_object()
        try:
            campaign.submit_for_review()
            campaign.save()
            
            ApprovalStep.objects.create(
                campaign=campaign,
                approver=request.user,
                decision='submitted',
                previous_status='draft',
                new_status='pending_review'
            )
            
            return Response({'status': 'submitted for review'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve campaign."""
        campaign = self.get_object()
        comments = request.data.get('comments', '')
        
        try:
            with transaction.atomic():
                previous_status = campaign.status
                campaign.approve()
                campaign.save()
                
                ApprovalStep.objects.create(
                    campaign=campaign,
                    approver=request.user,
                    decision='approved',
                    comments=comments,
                    previous_status=previous_status,
                    new_status=campaign.status
                )
            
            return Response({'status': 'approved'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject campaign."""
        campaign = self.get_object()
        comments = request.data.get('comments', '')
        
        if not comments:
            return Response(
                {'error': 'Comments required for rejection'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                previous_status = campaign.status
                campaign.reject()
                campaign.save()
                
                ApprovalStep.objects.create(
                    campaign=campaign,
                    approver=request.user,
                    decision='rejected',
                    comments=comments,
                    previous_status=previous_status,
                    new_status=campaign.status
                )
            
            return Response({'status': 'rejected'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GenerateContentView(APIView):
    """AI-powered content generation endpoint."""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ContentGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        campaign_id = serializer.validated_data['campaign_id']
        use_similar = serializer.validated_data['use_similar_content']
        additional_context = serializer.validated_data.get('additional_context', '')
        
        # Queue async task
        task = generate_content_async.delay(
            campaign_id=str(campaign_id),
            use_similar_content=use_similar,
            additional_context=additional_context
        )
        
        return Response({
            'task_id': task.id,
            'status': 'processing'
        }, status=status.HTTP_202_ACCEPTED)


class SimilarCampaignsView(APIView):
    """Semantic search for similar approved campaigns."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = SimilarCampaignQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        
        service = SimilaritySearchService()
        results = service.find_similar(
            query=serializer.validated_data['query'],
            brand_id=serializer.validated_data.get('brand_id'),
            limit=serializer.validated_data['limit']
        )
        
        return Response(results)
```

### AI Services

#### Content Generator (apps/campaigns/services/content_generator.py)

python

```python
from django.conf import settings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from jinja2 import Template
from ..models import LocationCampaign
from .similarity_search import SimilaritySearchService


class ContentGeneratorService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.7,
            api_key=settings.OPENAI_API_KEY
        )
        self.embeddings = OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)
        self.similarity_service = SimilaritySearchService()
    
    def generate(
        self,
        campaign: LocationCampaign,
        use_similar_content: bool = True,
        additional_context: str = ""
    ) -> str:
        # Gather context
        location = campaign.location
        template = campaign.template
        
        # Get similar approved content for RAG
        similar_content = ""
        if use_similar_content:
            similar = self.similarity_service.find_similar(
                query=template.content_template,
                brand_id=str(location.brand_id),
                limit=3,
                status_filter='approved'
            )
            if similar:
                similar_content = "\n\n".join([
                    f"Example {i+1}:\n{s['content']}"
                    for i, s in enumerate(similar)
                ])
        
        # Build prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a marketing content specialist for retail chains. 
Generate engaging, location-specific marketing content based on the template and context provided.

IMPORTANT:
- Match the tone and style of the example content
- Incorporate location-specific details naturally
- Keep content concise and action-oriented
- Do not include placeholder brackets in output"""),
            ("human", """
Template to fill:
{template}

Location details:
- Name: {location_name}
- Store Number: {store_number}
- Address: {address}
- Attributes: {attributes}

Customization variables:
{customizations}

{similar_section}

{additional_context}

Generate the final marketing content:""")
        ])
        
        similar_section = ""
        if similar_content:
            similar_section = f"Reference these approved examples for tone/style:\n{similar_content}"
        
        context_section = ""
        if additional_context:
            context_section = f"Additional context: {additional_context}"
        
        chain = prompt | self.llm | StrOutputParser()
        
        result = chain.invoke({
            "template": template.content_template,
            "location_name": location.name,
            "store_number": location.store_number,
            "address": location.full_address,
            "attributes": str(location.attributes),
            "customizations": str(campaign.customizations),
            "similar_section": similar_section,
            "additional_context": context_section
        })
        
        return result.strip()
    
    def compute_embedding(self, text: str) -> list[float]:
        """Generate embedding vector for content."""
        return self.embeddings.embed_query(text)
```

#### Similarity Search (apps/campaigns/services/similarity_search.py)

python

```python
from django.db import connection
from pgvector.django import CosineDistance
from langchain_openai import OpenAIEmbeddings
from django.conf import settings
from ..models import LocationCampaign


class SimilaritySearchService:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)
    
    def find_similar(
        self,
        query: str,
        brand_id: str = None,
        limit: int = 5,
        status_filter: str = None
    ) -> list[dict]:
        # Generate embedding for query
        query_embedding = self.embeddings.embed_query(query)
        
        # Build queryset
        queryset = LocationCampaign.objects.filter(
            content_embedding__isnull=False
        ).select_related('location', 'template')
        
        if brand_id:
            queryset = queryset.filter(location__brand_id=brand_id)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Order by cosine similarity
        queryset = queryset.annotate(
            distance=CosineDistance('content_embedding', query_embedding)
        ).order_by('distance')[:limit]
        
        results = []
        for campaign in queryset:
            results.append({
                'id': str(campaign.id),
                'location_name': campaign.location.name,
                'template_name': campaign.template.name,
                'content': campaign.generated_content,
                'status': campaign.status,
                'similarity_score': 1 - campaign.distance  # Convert distance to similarity
            })
        
        return results
```

### Celery Tasks (apps/campaigns/tasks.py)

python

````python
from celery import shared_task
from django.core.cache import cache
from .models import LocationCampaign
from .services.content_generator import ContentGeneratorService


@shared_task(bind=True, max_retries=3)
def generate_content_async(self, campaign_id: str, use_similar_content: bool, additional_context: str):
    """Async task to generate AI content for a campaign."""
    try:
        campaign = LocationCampaign.objects.select_related(
            'location', 'template'
        ).get(id=campaign_id)
        
        service = ContentGeneratorService()
        
        # Generate content
        content = service.generate(
            campaign=campaign,
            use_similar_content=use_similar_content,
            additional_context=additional_context
        )
        
        # Generate embedding
        embedding = service.compute_embedding(content)
        
        # Update campaign
        campaign.generated_content = content
        campaign.content_embedding = embedding
        campaign.save(update_fields=['generated_content', 'content_embedding', 'updated_at'])
        
        return {
            'status': 'completed',
            'campaign_id': campaign_id,
            'content_preview': content[:200]
        }
        
    except LocationCampaign.DoesNotExist:
        return {'status': 'error', 'message': 'Campaign not found'}
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@shared_task
def compute_embedding_async(campaign_id: str):
    """Compute embedding for existing content."""
    try:
        campaign = LocationCampaign.objects.get(id=campaign_id)
        if not campaign.generated_content:
            return {'status': 'skipped', 'message': 'No content to embed'}
        
        service = ContentGeneratorService()
        embedding = service.compute_embedding(campaign.generated_content)
        
        campaign.content_embedding = embedding
        campaign.save(update_fields=['content_embedding', 'updated_at'])
        
        return {'status': 'completed', 'campaign_id': campaign_id}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@shared_task
def batch_generate_campaigns(campaign_ids: list[str]):
    """Batch generate content for multiple campaigns."""
    results = []
    for campaign_id in campaign_ids:
        result = generate_content_async.delay(
            campaign_id=campaign_id,
            use_similar_content=True,
            additional_context=""
        )
        results.append({'campaign_id': campaign_id, 'task_id': result.id})
    return results
```

---

## Frontend Specification

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14+ |
| Language | TypeScript | 5+ |
| Styling | Tailwind CSS | 3.4+ |
| State Management | Zustand | 4+ |
| Data Fetching | TanStack Query | 5+ |
| Forms | React Hook Form + Zod | 7+ / 3+ |
| UI Components | shadcn/ui | latest |
| Tables | TanStack Table | 8+ |
| Drag & Drop | @dnd-kit/core | 6+ |
| Charts | Recharts | 2+ |

### Project Structure
```
frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.local
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Dashboard home
│   │   │   ├── brands/
│   │   │   │   ├── page.tsx                # Brand list
│   │   │   │   └── [brandId]/
│   │   │   │       ├── page.tsx            # Brand detail
│   │   │   │       └── locations/
│   │   │   │           └── page.tsx        # Location management
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx                # Campaign list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx            # Create campaign
│   │   │   │   └── [campaignId]/
│   │   │   │       ├── page.tsx            # Campaign detail
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx        # Edit campaign
│   │   │   ├── templates/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [templateId]/
│   │   │   │       └── page.tsx
│   │   │   └── approvals/
│   │   │       └── page.tsx                # Approval queue
│   │   └── api/
│   │       └── [...path]/
│   │           └── route.ts                # API proxy (optional)
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── breadcrumbs.tsx
│   │   ├── brands/
│   │   │   ├── brand-card.tsx
│   │   │   ├── brand-list.tsx
│   │   │   └── location-table.tsx
│   │   ├── campaigns/
│   │   │   ├── campaign-card.tsx
│   │   │   ├── campaign-list.tsx
│   │   │   ├── campaign-form.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── status-workflow.tsx
│   │   │   ├── content-preview.tsx
│   │   │   └── ai-generate-button.tsx
│   │   ├── approvals/
│   │   │   ├── approval-queue.tsx
│   │   │   ├── approval-card.tsx
│   │   │   └── approval-dialog.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── loading-spinner.tsx
│   │       ├── empty-state.tsx
│   │       └── error-boundary.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-brands.ts
│   │   ├── use-campaigns.ts
│   │   ├── use-templates.ts
│   │   └── use-polling.ts
│   ├── lib/
│   │   ├── api-client.ts                   # Axios instance
│   │   ├── auth.ts                         # JWT handling
│   │   ├── utils.ts
│   │   └── validators.ts                   # Zod schemas
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── ui-store.ts
│   └── types/
│       ├── api.ts
│       ├── brand.ts
│       ├── campaign.ts
│       └── user.ts
└── public/
    └── ...
````

### Type Definitions (src/types/)

typescript

```typescript
// src/types/api.ts
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  [key: string]: string | string[] | undefined;
}

// src/types/brand.ts
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  brand: string;
  name: string;
  store_number: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  attributes: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// src/types/campaign.ts
export type CampaignStatus = 
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'active'
  | 'completed';

export interface CampaignTemplate {
  id: string;
  brand: string;
  name: string;
  description: string;
  content_template: string;
  required_variables: string[];
  campaign_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  approver: string;
  approver_name: string;
  decision: 'approved' | 'rejected' | 'requested_changes';
  comments: string;
  previous_status: CampaignStatus;
  new_status: CampaignStatus;
  created_at: string;
}

export interface LocationCampaign {
  id: string;
  location: string;
  location_name: string;
  template: string;
  template_name: string;
  created_by: string;
  created_by_name: string;
  status: CampaignStatus;
  customizations: Record<string, unknown>;
  generated_content: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  approval_history: ApprovalStep[];
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  location: string;
  template: string;
  customizations: Record<string, unknown>;
  scheduled_start?: string;
  scheduled_end?: string;
}

// src/types/user.ts
export type UserRole = 'admin' | 'brand_manager' | 'location_manager' | 'viewer';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  brands: string[];
}
```

### API Client (src/lib/api-client.ts)

typescript

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && originalRequest) {
          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
                refresh: refreshToken,
              });
              
              useAuthStore.getState().setTokens(
                response.data.access,
                refreshToken
              );
              
              originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
              return this.client(originalRequest);
            }
          } catch {
            useAuthStore.getState().logout();
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;

// API functions
export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/auth/token/', { email, password }),
  
  refreshToken: (refresh: string) =>
    apiClient.post('/auth/token/refresh/', { refresh }),

  // Brands
  getBrands: () => apiClient.get('/brands/'),
  getBrand: (id: string) => apiClient.get(`/brands/${id}/`),
  
  // Locations
  getLocations: (brandId: string) => apiClient.get(`/brands/${brandId}/locations/`),
  createLocation: (brandId: string, data: Partial<Location>) =>
    apiClient.post(`/brands/${brandId}/locations/`, data),
  updateLocation: (brandId: string, locationId: string, data: Partial<Location>) =>
    apiClient.patch(`/brands/${brandId}/locations/${locationId}/`, data),

  // Campaign Templates
  getTemplates: (params?: { brand?: string }) =>
    apiClient.get('/campaigns/templates/', { params }),
  getTemplate: (id: string) => apiClient.get(`/campaigns/templates/${id}/`),

  // Campaigns
  getCampaigns: (params?: { status?: string; location?: string }) =>
    apiClient.get('/campaigns/', { params }),
  getCampaign: (id: string) => apiClient.get(`/campaigns/${id}/`),
  createCampaign: (data: CreateCampaignInput) =>
    apiClient.post('/campaigns/', data),
  updateCampaign: (id: string, data: Partial<CreateCampaignInput>) =>
    apiClient.patch(`/campaigns/${id}/`, data),
  
  // Campaign Actions
  submitCampaign: (id: string) => apiClient.post(`/campaigns/${id}/submit/`),
  approveCampaign: (id: string, comments?: string) =>
    apiClient.post(`/campaigns/${id}/approve/`, { comments }),
  rejectCampaign: (id: string, comments: string) =>
    apiClient.post(`/campaigns/${id}/reject/`, { comments }),
  
  // AI Features
  generateContent: (campaignId: string, useSimilar: boolean, additionalContext?: string) =>
    apiClient.post('/campaigns/generate-content/', {
      campaign_id: campaignId,
      use_similar_content: useSimilar,
      additional_context: additionalContext,
    }),
  getSimilarCampaigns: (query: string, brandId?: string, limit?: number) =>
    apiClient.get('/campaigns/similar/', {
      params: { query, brand_id: brandId, limit },
    }),
};
```

### React Query Hooks (src/hooks/use-campaigns.ts)

typescript

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { LocationCampaign, CreateCampaignInput, CampaignStatus } from '@/types/campaign';
import { PaginatedResponse } from '@/types/api';

export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  list: (filters: { status?: string; location?: string }) =>
    [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
};

export function useCampaigns(filters?: { status?: CampaignStatus; location?: string }) {
  return useQuery({
    queryKey: campaignKeys.list(filters || {}),
    queryFn: async () => {
      const { data } = await api.getCampaigns(filters);
      return data as PaginatedResponse<LocationCampaign>;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.getCampaign(id);
      return data as LocationCampaign;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCampaignInput) => api.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCampaignInput> }) =>
      api.updateCampaign(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useSubmitCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => api.submitCampaign(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      api.approveCampaign(id, comments),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useRejectCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      api.rejectCampaign(id, comments),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: ({
      campaignId,
      useSimilar = true,
      additionalContext,
    }: {
      campaignId: string;
      useSimilar?: boolean;
      additionalContext?: string;
    }) => api.generateContent(campaignId, useSimilar, additionalContext),
  });
}
```

### Key Components

#### Campaign Status Workflow (src/components/campaigns/status-workflow.tsx)

typescript

```typescript
'use client';

import { useState } from 'react';
import { CampaignStatus, LocationCampaign } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitCampaign, useApproveCampaign, useRejectCampaign } from '@/hooks/use-campaigns';
import { CheckCircle, XCircle, Send, Clock, AlertCircle } from 'lucide-react';

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-500', icon: <Clock className="w-4 h-4" /> },
  pending_review: { label: 'Pending Review', color: 'bg-yellow-500', icon: <AlertCircle className="w-4 h-4" /> },
  approved: { label: 'Approved', color: 'bg-green-500', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: <XCircle className="w-4 h-4" /> },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500', icon: <Clock className="w-4 h-4" /> },
  active: { label: 'Active', color: 'bg-green-600', icon: <CheckCircle className="w-4 h-4" /> },
  completed: { label: 'Completed', color: 'bg-gray-600', icon: <CheckCircle className="w-4 h-4" /> },
};

interface StatusWorkflowProps {
  campaign: LocationCampaign;
  userRole: string;
}

export function StatusWorkflow({ campaign, userRole }: StatusWorkflowProps) {
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [comments, setComments] = useState('');

  const submitMutation = useSubmitCampaign();
  const approveMutation = useApproveCampaign();
  const rejectMutation = useRejectCampaign();

  const config = statusConfig[campaign.status];
  const canSubmit = campaign.status === 'draft' && campaign.generated_content;
  const canApprove = campaign.status === 'pending_review' && 
    ['admin', 'brand_manager'].includes(userRole);

  const handleSubmit = () => {
    submitMutation.mutate(campaign.id);
  };

  const handleApprove = () => {
    approveMutation.mutate({ id: campaign.id, comments });
    setShowApprovalDialog(false);
    setComments('');
  };

  const handleReject = () => {
    rejectMutation.mutate({ id: campaign.id, comments });
    setShowRejectDialog(false);
    setComments('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge className={`${config.color} text-white`}>
          {config.icon}
          <span className="ml-1">{config.label}</span>
        </Badge>
      </div>

      <div className="flex gap-2">
        {canSubmit && (
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
          >
            <Send className="w-4 h-4 mr-2" />
            Submit for Review
          </Button>
        )}

        {canApprove && (
          <>
            <Button
              variant="default"
              onClick={() => setShowApprovalDialog(true)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </>
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Campaign</DialogTitle>
            <DialogDescription>
              Add optional comments for the approval.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Comments (optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Campaign</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!comments.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

#### AI Generate Button (src/components/campaigns/ai-generate-button.tsx)

typescript

````typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useGenerateContent } from '@/hooks/use-campaigns';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIGenerateButtonProps {
  campaignId: string;
  onGenerated?: () => void;
}

export function AIGenerateButton({ campaignId, onGenerated }: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [useSimilar, setUseSimilar] = useState(true);
  const [additionalContext, setAdditionalContext] = useState('');

  const generateMutation = useGenerateContent();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        campaignId,
        useSimilar,
        additionalContext: additionalContext.trim() || undefined,
      });
      setOpen(false);
      onGenerated?.();
    } catch (error) {
      console.error('Failed to generate content:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Content Generation</DialogTitle>
          <DialogDescription>
            Generate marketing content using AI. The system will use the campaign
            template and location details to create customized content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-similar" className="flex flex-col gap-1">
              <span>Use similar approved content</span>
              <span className="font-normal text-sm text-muted-foreground">
                Reference past approved campaigns for better results
              </span>
            </Label>
            <Switch
              id="use-similar"
              checked={useSimilar}
              onCheckedChange={setUseSimilar}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              placeholder="Add any specific instructions or context for the AI..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Deployment Specification

### Infrastructure Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloud Provider (AWS)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Route 53   │───▶│  CloudFront  │───▶│  S3 Bucket   │          │
│  │    (DNS)     │    │    (CDN)     │    │  (Frontend)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │     ALB      │───▶│    ECS       │                              │
│  │              │    │  (Backend)   │                              │
│  └──────────────┘    └──────────────┘                              │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                  │
│         ▼                   ▼                   ▼                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │     RDS      │    │ ElastiCache  │    │     S3       │          │
│  │ (PostgreSQL) │    │   (Redis)    │    │   (Media)    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
````

### Docker Configuration

#### Backend Dockerfile

dockerfile

```dockerfile
# Dockerfile
FROM python:3.12-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements/production.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r production.txt

# Production stage
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels and install
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache /wheels/*

# Copy application
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

#### Celery Worker Dockerfile

dockerfile

```dockerfile
# Dockerfile.celery
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/production.txt .
RUN pip install --no-cache-dir -r production.txt

COPY . .

RUN adduser --disabled-password --gecos '' appuser
USER appuser

CMD ["celery", "-A", "config", "worker", "--loglevel=info"]
```

#### Docker Compose (Development)

yaml

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: storesync
      POSTGRES_USER: storesync
      POSTGRES_PASSWORD: storesync_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U storesync"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    environment:
      - DEBUG=True
      - DATABASE_URL=postgres://storesync:storesync_dev@db:5432/storesync
      - REDIS_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery:
    build:
      context: .
      dockerfile: Dockerfile.celery
    volumes:
      - .:/app
    environment:
      - DATABASE_URL=postgres://storesync:storesync_dev@db:5432/storesync
      - REDIS_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile.celery
    command: celery -A config beat --loglevel=info
    volumes:
      - .:/app
    environment:
      - DATABASE_URL=postgres://storesync:storesync_dev@db:5432/storesync
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      - db

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

volumes:
  postgres_data:
```

### Environment Configuration

#### Backend (.env.production)

bash

```bash
# Django
DEBUG=False
SECRET_KEY=<generated-secret-key>
ALLOWED_HOSTS=api.storesync.example.com
CSRF_TRUSTED_ORIGINS=https://storesync.example.com

# Database
DATABASE_URL=postgres://user:password@host:5432/storesync

# Redis
REDIS_URL=redis://host:6379/0

# AWS
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_STORAGE_BUCKET_NAME=storesync-media
AWS_S3_REGION_NAME=us-east-1

# OpenAI
OPENAI_API_KEY=<api-key>

# Sentry (error tracking)
SENTRY_DSN=<sentry-dsn>
```

#### Frontend (.env.production)

bash

```bash
NEXT_PUBLIC_API_URL=https://api.storesync.example.com/api/v1
NEXT_PUBLIC_APP_URL=https://storesync.example.com
```

### CI/CD Pipeline (GitHub Actions)

yaml

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: storesync
  ECS_CLUSTER: storesync-cluster
  ECS_SERVICE: storesync-service

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements/local.txt
      
      - name: Run tests
        env:
          DATABASE_URL: postgres://test_user:test_pass@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
        run: |
          pytest --cov=apps --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync out/ s3://${{ secrets.S3_BUCKET }} --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Database Migrations

bash

```bash
# Initial setup script
#!/bin/bash

# Run migrations
python manage.py migrate

# Enable pgvector extension
python manage.py dbshell <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
EOF

# Create superuser (for initial setup)
python manage.py createsuperuser --noinput \
    --email admin@example.com

# Load initial data (if any)
python manage.py loaddata initial_data.json
```

---

## Development Workflow

### Getting Started

bash

```bash
# Clone repository
git clone https://github.com/your-org/storesync.git
cd storesync

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Access:
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/api/docs/
# - Frontend: http://localhost:3000
# - Admin: http://localhost:8000/admin/
```

### Testing

bash

```bash
# Backend tests
docker-compose exec backend pytest

# Frontend tests
cd frontend && npm test

# E2E tests (if implemented)
cd frontend && npm run test:e2e
```

### Code Quality

bash

```bash
# Backend linting
docker-compose exec backend ruff check .
docker-compose exec backend ruff format .

# Frontend linting
cd frontend && npm run lint
cd frontend && npm run format
```

---

## Weekend Build Timeline

### Day 1 (8 hours): Backend Foundation

|Time|Task|
|---|---|
|Hours 1-2|Project setup: Django, DRF, Docker, PostgreSQL with pgvector|
|Hours 3-4|Core models: Brand, Location, CampaignTemplate, LocationCampaign|
|Hours 5-6|API endpoints: CRUD ViewSets, JWT auth, basic permissions|
|Hours 7-8|Excel import via django-import-export, admin interface|

### Day 2 (8 hours): Frontend & Workflow

|Time|Task|
|---|---|
|Hours 1-2|Next.js setup: TypeScript, Tailwind, shadcn/ui, API client|
|Hours 3-4|Auth flow: Login page, token storage, protected routes|
|Hours 5-6|Dashboard: Location list, campaign grid, status badges|
|Hours 7-8|Campaign workflow: Create form, status transitions, drag-drop|

### Day 3 (4 hours): AI Integration & Polish

|Time|Task|
|---|---|
|Hours 1-2|pgvector setup, OpenAI integration, content generation service|
|Hours 3-4|Similarity search endpoint, AI generate UI, Celery tasks|

---

This specification provides a complete blueprint for implementing StoreSync. Begin with the backend models and API, then build the frontend progressively, saving AI features for last once the core workflow is stable.