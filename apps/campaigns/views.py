from django.db import transaction
from django_fsm import can_proceed
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.pagination import StandardPagination
from apps.core.permissions import HasBrandAccess, IsBrandManager

from .models import ApprovalStep, CampaignTemplate, LocationCampaign
from .serializers import (
    CampaignActionSerializer,
    CampaignRejectSerializer,
    CampaignTemplateCreateUpdateSerializer,
    CampaignTemplateDetailSerializer,
    CampaignTemplateListSerializer,
    LocationCampaignCreateUpdateSerializer,
    LocationCampaignDetailSerializer,
    LocationCampaignListSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List campaign templates",
        description="Returns a paginated list of campaign templates for accessible brands.",
        tags=["campaign-templates"],
    ),
    retrieve=extend_schema(
        summary="Get template details",
        description="Returns detailed information about a campaign template including content.",
        tags=["campaign-templates"],
    ),
    create=extend_schema(
        summary="Create template",
        description="Creates a new campaign template with Jinja2-style content placeholders.",
        tags=["campaign-templates"],
    ),
    update=extend_schema(
        summary="Update template",
        description="Updates all fields of an existing campaign template.",
        tags=["campaign-templates"],
    ),
    partial_update=extend_schema(
        summary="Partial update template",
        description="Updates specific fields of an existing campaign template.",
        tags=["campaign-templates"],
    ),
    destroy=extend_schema(
        summary="Delete template",
        description="Deletes a campaign template. Templates with active campaigns cannot be deleted.",
        tags=["campaign-templates"],
    ),
)
class CampaignTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing campaign templates.

    Templates define reusable campaign content with Jinja2-style placeholders
    like {{ location.name }} and {{ campaign.sale_type }}.
    """

    permission_classes = [permissions.IsAuthenticated, HasBrandAccess]
    pagination_class = StandardPagination

    def get_queryset(self):
        user = self.request.user
        queryset = CampaignTemplate.objects.select_related("brand")

        # Filter by user's brand access
        if user.role != "admin":
            queryset = queryset.filter(brand__in=user.brands.all())

        # Filter by brand if provided
        brand_id = self.request.query_params.get("brand")
        if brand_id:
            queryset = queryset.filter(brand_id=brand_id)

        # Filter by campaign type if provided
        campaign_type = self.request.query_params.get("campaign_type")
        if campaign_type:
            queryset = queryset.filter(campaign_type=campaign_type)

        # Filter by active status if provided
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Search by name
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignTemplateListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return CampaignTemplateCreateUpdateSerializer
        return CampaignTemplateDetailSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsBrandManager()]
        return super().get_permissions()

    @extend_schema(
        summary="Preview template content",
        description="""
Preview how a template will render with sample data. Can also use AI to generate
a sample output based on the template.

**Request body:**
- `content_template`: The Jinja2 template content to preview
- `use_ai`: Whether to generate AI content (default: false)
- `sample_data`: Optional custom sample data for variables

**Response:**
- `preview`: The rendered/generated preview content
- `variables`: List of variables found in the template
- `used_ai`: Whether AI was used for generation
        """,
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "content_template": {"type": "string"},
                    "use_ai": {"type": "boolean", "default": False},
                    "sample_data": {"type": "object"},
                },
                "required": ["content_template"],
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "preview": {"type": "string"},
                    "variables": {"type": "array", "items": {"type": "string"}},
                    "used_ai": {"type": "boolean"},
                },
            }
        },
        tags=["campaign-templates"],
    )
    @action(detail=False, methods=["post"])
    def preview(self, request):
        """Preview template content with sample data or AI generation."""
        from .services.content_generator import ContentGeneratorService

        content_template = request.data.get("content_template", "")
        use_ai = request.data.get("use_ai", False)
        sample_data = request.data.get("sample_data", {})

        if not content_template:
            return Response(
                {"error": "content_template is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        generator = ContentGeneratorService()

        # Validate and extract variables
        validation = generator.validate_template(content_template)
        if not validation["valid"]:
            return Response(
                {"error": f"Invalid template: {validation['error']}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Default sample context
        default_context = {
            "brand_name": "Acme Retail",
            "location_name": "Downtown Store",
            "store_number": "001",
            "full_address": "123 Main St, Austin, TX 78701",
            "city": "Austin",
            "state": "TX",
            "street": "123 Main St",
            "zip": "78701",
        }

        # Merge with custom sample data
        context = {**default_context, **sample_data}

        try:
            if use_ai and generator.openai_api_key:
                # Generate AI preview
                from langchain_core.messages import HumanMessage, SystemMessage

                preview_prompt = f"""Generate a sample marketing content based on this template:

Template:
{content_template}

Sample Context:
- Brand: {context.get('brand_name')}
- Location: {context.get('location_name')}
- Store Number: {context.get('store_number')}
- Address: {context.get('full_address')}

Generate polished, ready-to-use marketing content following the template structure.
Only output the final content, no explanations."""

                messages = [
                    SystemMessage(content=generator.SYSTEM_PROMPT),
                    HumanMessage(content=preview_prompt),
                ]

                response = generator.llm.invoke(messages)
                preview = response.content.strip()
                used_ai = True
            else:
                # Template-only preview
                preview = generator.preview_content(content_template, context)
                used_ai = False

            return Response({
                "preview": preview,
                "variables": validation["variables"],
                "used_ai": used_ai,
            })

        except Exception as e:
            return Response(
                {"error": f"Preview generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@extend_schema_view(
    list=extend_schema(
        summary="List location campaigns",
        description="Returns a paginated list of campaigns with filtering options.",
        tags=["location-campaigns"],
    ),
    retrieve=extend_schema(
        summary="Get campaign details",
        description="Returns detailed information including approval history.",
        tags=["location-campaigns"],
    ),
    create=extend_schema(
        summary="Create campaign",
        description="Creates a new campaign for a location using a template.",
        tags=["location-campaigns"],
    ),
    update=extend_schema(
        summary="Update campaign",
        description="Updates campaign details. Only draft campaigns can be fully updated.",
        tags=["location-campaigns"],
    ),
    partial_update=extend_schema(
        summary="Partial update campaign",
        description="Updates specific fields of a campaign.",
        tags=["location-campaigns"],
    ),
    destroy=extend_schema(
        summary="Delete campaign",
        description="Deletes a campaign. Only draft campaigns can be deleted.",
        tags=["location-campaigns"],
    ),
)
class LocationCampaignViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing location campaigns and their approval workflow.

    Campaigns go through a workflow: draft → pending_review → approved → scheduled → active → completed.
    Use the action endpoints to transition between states.
    """

    permission_classes = [permissions.IsAuthenticated, HasBrandAccess]
    pagination_class = StandardPagination

    def get_queryset(self):
        user = self.request.user
        queryset = LocationCampaign.objects.select_related(
            "location", "location__brand", "template", "created_by"
        ).prefetch_related("approval_steps")

        # Filter by user's brand access
        if user.role != "admin":
            queryset = queryset.filter(location__brand__in=user.brands.all())

        # Filter by status if provided
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by location if provided
        location_id = self.request.query_params.get("location")
        if location_id:
            queryset = queryset.filter(location_id=location_id)

        # Filter by template if provided
        template_id = self.request.query_params.get("template")
        if template_id:
            queryset = queryset.filter(template_id=template_id)

        # Filter by brand if provided
        brand_id = self.request.query_params.get("brand")
        if brand_id:
            queryset = queryset.filter(location__brand_id=brand_id)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return LocationCampaignListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return LocationCampaignCreateUpdateSerializer
        return LocationCampaignDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _create_approval_step(self, campaign, user, decision, comments, prev_status, new_status):
        """Helper to create an approval step record."""
        ApprovalStep.objects.create(
            campaign=campaign,
            approver=user,
            decision=decision,
            comments=comments,
            previous_status=prev_status,
            new_status=new_status,
        )

    @extend_schema(
        summary="Submit for review",
        description="Submits a draft campaign for approval review.",
        request=CampaignActionSerializer,
        responses={200: LocationCampaignDetailSerializer},
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit campaign for review."""
        campaign = self.get_object()

        if not can_proceed(campaign.submit_for_review):
            return Response(
                {"error": f"Cannot submit campaign with status '{campaign.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CampaignActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            prev_status = campaign.status
            campaign.submit_for_review()
            campaign.save()

            self._create_approval_step(
                campaign=campaign,
                user=request.user,
                decision=ApprovalStep.Decision.SUBMITTED,
                comments=serializer.validated_data.get("comments", ""),
                prev_status=prev_status,
                new_status=campaign.status,
            )

        return Response(
            {"status": "submitted", "campaign": LocationCampaignDetailSerializer(campaign).data}
        )

    @extend_schema(
        summary="Approve campaign",
        description="Approves a pending campaign. Requires brand_manager or admin role.",
        request=CampaignActionSerializer,
        responses={200: LocationCampaignDetailSerializer},
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve campaign."""
        campaign = self.get_object()

        # Check permission - only brand_manager and admin can approve
        if request.user.role not in ["admin", "brand_manager"]:
            return Response(
                {"error": "You do not have permission to approve campaigns."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not can_proceed(campaign.approve):
            return Response(
                {"error": f"Cannot approve campaign with status '{campaign.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CampaignActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            prev_status = campaign.status
            campaign.approve()
            campaign.save()

            self._create_approval_step(
                campaign=campaign,
                user=request.user,
                decision=ApprovalStep.Decision.APPROVED,
                comments=serializer.validated_data.get("comments", ""),
                prev_status=prev_status,
                new_status=campaign.status,
            )

        return Response(
            {"status": "approved", "campaign": LocationCampaignDetailSerializer(campaign).data}
        )

    @extend_schema(
        summary="Reject campaign",
        description="Rejects a pending campaign with required comments. Requires brand_manager or admin role.",
        request=CampaignRejectSerializer,
        responses={200: LocationCampaignDetailSerializer},
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject campaign."""
        campaign = self.get_object()

        # Check permission - only brand_manager and admin can reject
        if request.user.role not in ["admin", "brand_manager"]:
            return Response(
                {"error": "You do not have permission to reject campaigns."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not can_proceed(campaign.reject):
            return Response(
                {"error": f"Cannot reject campaign with status '{campaign.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CampaignRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            prev_status = campaign.status
            campaign.reject()
            campaign.save()

            self._create_approval_step(
                campaign=campaign,
                user=request.user,
                decision=ApprovalStep.Decision.REJECTED,
                comments=serializer.validated_data["comments"],
                prev_status=prev_status,
                new_status=campaign.status,
            )

        return Response(
            {"status": "rejected", "campaign": LocationCampaignDetailSerializer(campaign).data}
        )

    @extend_schema(
        summary="Schedule campaign",
        description="Schedules an approved campaign for activation. Requires scheduled dates to be set.",
        request=CampaignActionSerializer,
        responses={200: LocationCampaignDetailSerializer},
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        """Schedule an approved campaign."""
        campaign = self.get_object()

        if not can_proceed(campaign.schedule):
            return Response(
                {"error": f"Cannot schedule campaign with status '{campaign.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate scheduling dates
        if not campaign.scheduled_start or not campaign.scheduled_end:
            return Response(
                {"error": "Campaign must have scheduled_start and scheduled_end dates."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            prev_status = campaign.status
            campaign.schedule()
            campaign.save()

            self._create_approval_step(
                campaign=campaign,
                user=request.user,
                decision=ApprovalStep.Decision.APPROVED,
                comments="Campaign scheduled",
                prev_status=prev_status,
                new_status=campaign.status,
            )

        return Response(
            {"status": "scheduled", "campaign": LocationCampaignDetailSerializer(campaign).data}
        )

    @extend_schema(
        summary="Revise campaign",
        description="Returns a rejected or draft campaign back to draft status for revision.",
        request=CampaignActionSerializer,
        responses={200: LocationCampaignDetailSerializer},
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def revise(self, request, pk=None):
        """Return campaign to draft for revision."""
        campaign = self.get_object()

        if not can_proceed(campaign.revise):
            return Response(
                {"error": f"Cannot revise campaign with status '{campaign.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CampaignActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            prev_status = campaign.status
            campaign.revise()
            campaign.save()

            self._create_approval_step(
                campaign=campaign,
                user=request.user,
                decision=ApprovalStep.Decision.REQUESTED_CHANGES,
                comments=serializer.validated_data.get("comments", "Returned for revision"),
                prev_status=prev_status,
                new_status=campaign.status,
            )

        return Response(
            {"status": "draft", "campaign": LocationCampaignDetailSerializer(campaign).data}
        )

    # ========== AI Content Generation Endpoints ==========

    @extend_schema(
        summary="Generate campaign content",
        description="""
Generate content for a campaign using its template and location data.

**Options:**
- `use_ai`: Use AI generation (default: true). If false, uses template substitution only.
- `additional_instructions`: Extra instructions for the AI.
- `async_generation`: Queue generation as background task (default: false).

Content is saved to the campaign's `generated_content` field.
An embedding is computed and stored for similarity search.
        """,
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "use_ai": {"type": "boolean", "default": True},
                    "additional_instructions": {"type": "string"},
                    "async_generation": {"type": "boolean", "default": False},
                },
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "content": {"type": "string"},
                    "content_length": {"type": "integer"},
                    "used_ai": {"type": "boolean"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def generate_content(self, request, pk=None):
        """Generate content for a campaign."""
        from .services.content_generator import ContentGeneratorService
        from .tasks import generate_campaign_content

        campaign = self.get_object()

        use_ai = request.data.get("use_ai", True)
        additional_instructions = request.data.get("additional_instructions")
        async_generation = request.data.get("async_generation", False)

        # For async generation, queue as Celery task
        if async_generation:
            task = generate_campaign_content.delay(str(campaign.id))
            return Response({
                "status": "queued",
                "task_id": task.id,
                "message": "Content generation queued. Check campaign for results.",
            })

        # Synchronous generation
        try:
            service = ContentGeneratorService()
            content, embedding = service.generate_and_embed(
                campaign,
                use_ai=use_ai,
                additional_instructions=additional_instructions,
            )

            # Save content and embedding
            campaign.generated_content = content
            if embedding:
                campaign.content_embedding = embedding
            campaign.save(update_fields=["generated_content", "content_embedding", "updated_at"])

            return Response({
                "status": "success",
                "content": content,
                "content_length": len(content),
                "used_ai": use_ai and service.openai_api_key is not None,
            })

        except Exception as e:
            return Response(
                {"error": f"Content generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Regenerate campaign content",
        description="""
Regenerate content for a campaign that already has content.
Uses AI to create a fresh version based on the template.
        """,
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "additional_instructions": {"type": "string"},
                    "async_generation": {"type": "boolean", "default": False},
                },
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "content": {"type": "string"},
                    "content_length": {"type": "integer"},
                    "used_ai": {"type": "boolean"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def regenerate_content(self, request, pk=None):
        """Regenerate content for a campaign."""
        from .services.content_generator import ContentGeneratorService
        from .tasks import generate_campaign_content

        campaign = self.get_object()

        additional_instructions = request.data.get("additional_instructions")
        async_generation = request.data.get("async_generation", False)

        if async_generation:
            task = generate_campaign_content.delay(str(campaign.id))
            return Response({
                "status": "queued",
                "task_id": task.id,
                "message": "Content regeneration queued.",
            })

        try:
            service = ContentGeneratorService()
            content, embedding = service.generate_and_embed(
                campaign,
                use_ai=True,
                additional_instructions=additional_instructions,
            )

            campaign.generated_content = content
            if embedding:
                campaign.content_embedding = embedding
            campaign.save(update_fields=["generated_content", "content_embedding", "updated_at"])

            return Response({
                "status": "success",
                "content": content,
                "content_length": len(content),
                "used_ai": service.openai_api_key is not None,
            })

        except Exception as e:
            return Response(
                {"error": f"Content regeneration failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Find similar campaigns",
        description="Find campaigns with similar content to this campaign using vector similarity.",
        parameters=[
            {
                "name": "limit",
                "in": "query",
                "type": "integer",
                "default": 5,
            },
            {
                "name": "threshold",
                "in": "query",
                "type": "number",
                "default": 0.7,
            },
            {
                "name": "same_brand",
                "in": "query",
                "type": "boolean",
                "default": False,
            },
        ],
        responses={
            200: {
                "type": "object",
                "properties": {
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "campaign_id": {"type": "string"},
                                "template_name": {"type": "string"},
                                "location_name": {"type": "string"},
                                "brand_name": {"type": "string"},
                                "similarity_score": {"type": "number"},
                                "content_preview": {"type": "string"},
                            },
                        },
                    },
                    "total": {"type": "integer"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["get"])
    def similar_to(self, request, pk=None):
        """Find campaigns similar to this one."""
        from .services.similarity_search import SimilaritySearchService

        campaign = self.get_object()

        limit = int(request.query_params.get("limit", 5))
        threshold = float(request.query_params.get("threshold", 0.7))
        same_brand = request.query_params.get("same_brand", "false").lower() == "true"

        if campaign.content_embedding is None:
            return Response({
                "results": [],
                "total": 0,
                "message": "Campaign has no embedding. Generate content first.",
            })

        try:
            service = SimilaritySearchService()
            similar = service.find_similar_to_campaign(
                campaign_id=str(campaign.id),
                limit=limit,
                similarity_threshold=threshold,
                same_brand_only=same_brand,
            )

            return Response({
                "results": [s.to_dict() for s in similar],
                "total": len(similar),
                "query_campaign_id": str(campaign.id),
            })

        except Exception as e:
            return Response(
                {"error": f"Similarity search failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Compute embedding",
        description="Compute and store the vector embedding for this campaign's content.",
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "embedding_dimensions": {"type": "integer"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=True, methods=["post"])
    def compute_embedding(self, request, pk=None):
        """Compute embedding for a campaign."""
        from .services.similarity_search import SimilaritySearchService

        campaign = self.get_object()

        if not campaign.generated_content:
            return Response(
                {"error": "Campaign has no content to embed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = SimilaritySearchService()
            embedding = service.compute_embedding_for_campaign(campaign)

            if embedding:
                return Response({
                    "status": "success",
                    "embedding_dimensions": len(embedding),
                })
            else:
                return Response(
                    {"error": "Failed to compute embedding"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Exception as e:
            return Response(
                {"error": f"Embedding computation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Search similar campaigns",
        description="""
Search for campaigns similar to a text query or another campaign.

Provide either `query` (text) or `campaign_id` (UUID) to search.
        """,
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "campaign_id": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                    "similarity_threshold": {"type": "number", "default": 0.7},
                    "brand_id": {"type": "string"},
                    "same_brand_only": {"type": "boolean", "default": False},
                    "status_filter": {"type": "array", "items": {"type": "string"}},
                },
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "results": {"type": "array"},
                    "total": {"type": "integer"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=False, methods=["post"])
    def similar(self, request):
        """Search for similar campaigns."""
        from .services.similarity_search import SimilaritySearchService

        query = request.data.get("query")
        campaign_id = request.data.get("campaign_id")
        limit = request.data.get("limit", 10)
        threshold = request.data.get("similarity_threshold", 0.7)
        brand_id = request.data.get("brand_id")
        same_brand_only = request.data.get("same_brand_only", False)
        status_filter = request.data.get("status_filter")

        if not query and not campaign_id:
            return Response(
                {"error": "Provide either 'query' or 'campaign_id'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = SimilaritySearchService()

            if campaign_id:
                similar = service.find_similar_to_campaign(
                    campaign_id=campaign_id,
                    limit=limit,
                    similarity_threshold=threshold,
                    same_brand_only=same_brand_only,
                    status_filter=status_filter,
                )
            else:
                similar = service.find_similar_by_text(
                    query_text=query,
                    limit=limit,
                    similarity_threshold=threshold,
                    brand_id=brand_id,
                    status_filter=status_filter,
                )

            return Response({
                "results": [s.to_dict() for s in similar],
                "total": len(similar),
            })

        except Exception as e:
            return Response(
                {"error": f"Similarity search failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Bulk compute embeddings",
        description="""
Compute embeddings for multiple campaigns at once.

**Options:**
- `campaign_ids`: Specific campaigns to process (optional, defaults to all)
- `recompute`: Recompute existing embeddings (default: false)
- `async_processing`: Run as background task (default: false)
        """,
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "campaign_ids": {"type": "array", "items": {"type": "string"}},
                    "recompute": {"type": "boolean", "default": False},
                    "async_processing": {"type": "boolean", "default": False},
                },
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "success": {"type": "integer"},
                    "failed": {"type": "integer"},
                    "total": {"type": "integer"},
                },
            }
        },
        tags=["location-campaigns"],
    )
    @action(detail=False, methods=["post"])
    def compute_embeddings(self, request):
        """Bulk compute embeddings for campaigns."""
        from .services.similarity_search import SimilaritySearchService

        campaign_ids = request.data.get("campaign_ids")
        recompute = request.data.get("recompute", False)
        async_processing = request.data.get("async_processing", False)

        if async_processing:
            # TODO: Implement async bulk embedding task
            return Response({
                "status": "queued",
                "message": "Bulk embedding computation queued.",
            })

        try:
            service = SimilaritySearchService()
            result = service.bulk_compute_embeddings(
                campaign_ids=campaign_ids,
                recompute=recompute,
            )

            return Response({
                "status": "success",
                **result,
            })

        except Exception as e:
            return Response(
                {"error": f"Bulk embedding failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
