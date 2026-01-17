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
