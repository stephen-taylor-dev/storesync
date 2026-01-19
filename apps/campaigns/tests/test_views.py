"""
Tests for Campaign API views.
"""

import pytest
from django.utils import timezone
from datetime import timedelta
from rest_framework import status

from apps.campaigns.models import ApprovalStep, CampaignTemplate, LocationCampaign


@pytest.mark.django_db
class TestCampaignTemplateViewSet:
    """Tests for CampaignTemplateViewSet."""

    base_url = "/api/v1/campaigns/templates/"

    def test_list_templates(self, admin_client, campaign_template, campaign_template_two):
        """Test listing campaign templates."""
        response = admin_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_list_templates_filter_by_brand(self, admin_client, brand, campaign_template):
        """Test filtering templates by brand."""
        response = admin_client.get(f"{self.base_url}?brand={brand.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_list_templates_filter_by_type(self, admin_client, campaign_template):
        """Test filtering templates by campaign type."""
        response = admin_client.get(f"{self.base_url}?campaign_type=seasonal_sale")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_list_templates_filter_active(self, admin_client, campaign_template, inactive_template):
        """Test filtering active templates."""
        response = admin_client.get(f"{self.base_url}?is_active=true")
        assert response.status_code == status.HTTP_200_OK
        # Should not include inactive_template
        slugs = [t["name"] for t in response.data["results"]]
        assert "Old Template" not in slugs

    def test_list_templates_search(self, admin_client, campaign_template, campaign_template_two):
        """Test searching templates by name."""
        response = admin_client.get(f"{self.base_url}?search=Summer")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Summer Sale Template"

    def test_retrieve_template(self, admin_client, campaign_template):
        """Test retrieving a single template."""
        response = admin_client.get(f"{self.base_url}{campaign_template.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Summer Sale Template"
        assert "content_template" in response.data

    def test_create_template(self, admin_client, brand):
        """Test creating a campaign template."""
        data = {
            "brand": str(brand.id),
            "name": "New Template",
            "description": "A new test template",
            "content_template": "Hello {{location_name}}!",
            "required_variables": [],
            "campaign_type": "clearance",
        }
        response = admin_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert CampaignTemplate.objects.filter(name="New Template").exists()

    def test_create_template_viewer_forbidden(self, viewer_client, brand):
        """Test viewer cannot create templates."""
        data = {
            "brand": str(brand.id),
            "name": "Viewer Template",
            "content_template": "Test",
            "campaign_type": "test",
        }
        response = viewer_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_template(self, admin_client, campaign_template):
        """Test updating a template."""
        data = {"name": "Updated Template Name"}
        response = admin_client.patch(
            f"{self.base_url}{campaign_template.id}/", data, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        campaign_template.refresh_from_db()
        assert campaign_template.name == "Updated Template Name"

    def test_delete_template(self, admin_client, campaign_template):
        """Test deleting a template."""
        template_id = campaign_template.id
        response = admin_client.delete(f"{self.base_url}{template_id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestLocationCampaignViewSet:
    """Tests for LocationCampaignViewSet."""

    base_url = "/api/v1/campaigns/"

    def test_list_campaigns(self, admin_client, draft_campaign, pending_campaign):
        """Test listing location campaigns."""
        response = admin_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 2

    def test_list_campaigns_filter_by_status(self, admin_client, draft_campaign, pending_campaign):
        """Test filtering campaigns by status."""
        response = admin_client.get(f"{self.base_url}?status=draft")
        assert response.status_code == status.HTTP_200_OK
        for campaign in response.data["results"]:
            assert campaign["status"] == "draft"

    def test_list_campaigns_filter_by_location(self, admin_client, draft_campaign, location):
        """Test filtering campaigns by location."""
        response = admin_client.get(f"{self.base_url}?location={location.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_retrieve_campaign(self, admin_client, draft_campaign):
        """Test retrieving a single campaign."""
        response = admin_client.get(f"{self.base_url}{draft_campaign.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "draft"
        assert "approval_history" in response.data

    def test_create_campaign(self, admin_client, location, campaign_template):
        """Test creating a location campaign."""
        initial_count = LocationCampaign.objects.count()
        data = {
            "location": str(location.id),
            "template": str(campaign_template.id),
            "customizations": {"discount_percentage": 20},
        }
        response = admin_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        # Verify campaign was created
        assert LocationCampaign.objects.count() == initial_count + 1
        # Get the newly created campaign and verify it's in draft status
        campaign = LocationCampaign.objects.filter(
            location=location,
            customizations__discount_percentage=20
        ).first()
        assert campaign is not None
        assert campaign.status == LocationCampaign.Status.DRAFT

    def test_update_campaign(self, admin_client, draft_campaign):
        """Test updating a campaign."""
        data = {"customizations": {"discount_percentage": 50}}
        response = admin_client.patch(
            f"{self.base_url}{draft_campaign.id}/", data, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        draft_campaign.refresh_from_db()
        assert draft_campaign.customizations["discount_percentage"] == 50

    def test_delete_campaign(self, admin_client, draft_campaign):
        """Test deleting a campaign."""
        campaign_id = draft_campaign.id
        response = admin_client.delete(f"{self.base_url}{campaign_id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not LocationCampaign.objects.filter(id=campaign_id).exists()


@pytest.mark.django_db
class TestCampaignWorkflowActions:
    """Tests for campaign workflow action endpoints."""

    base_url = "/api/v1/campaigns/"

    def test_submit_campaign(self, admin_client, draft_campaign):
        """Test submitting a draft campaign for review."""
        response = admin_client.post(
            f"{self.base_url}{draft_campaign.id}/submit/",
            {"comments": "Ready for review"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "submitted"
        draft_campaign.refresh_from_db()
        assert draft_campaign.status == LocationCampaign.Status.PENDING_REVIEW
        # Check approval step was created
        assert draft_campaign.approval_steps.filter(
            decision=ApprovalStep.Decision.SUBMITTED
        ).exists()

    def test_submit_campaign_invalid_status(self, admin_client, pending_campaign):
        """Test submitting a non-draft campaign fails."""
        response = admin_client.post(
            f"{self.base_url}{pending_campaign.id}/submit/", {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot submit" in response.data["error"]

    def test_approve_campaign(self, admin_client, pending_campaign):
        """Test approving a pending campaign."""
        response = admin_client.post(
            f"{self.base_url}{pending_campaign.id}/approve/",
            {"comments": "Looks good!"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "approved"
        pending_campaign.refresh_from_db()
        assert pending_campaign.status == LocationCampaign.Status.APPROVED

    def test_approve_campaign_viewer_forbidden(self, viewer_client, pending_campaign):
        """Test viewer cannot approve campaigns."""
        response = viewer_client.post(
            f"{self.base_url}{pending_campaign.id}/approve/", {}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_approve_campaign_location_manager_forbidden(
        self, location_manager_client, pending_campaign
    ):
        """Test location manager cannot approve campaigns."""
        response = location_manager_client.post(
            f"{self.base_url}{pending_campaign.id}/approve/", {}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reject_campaign(self, admin_client, pending_campaign):
        """Test rejecting a pending campaign."""
        response = admin_client.post(
            f"{self.base_url}{pending_campaign.id}/reject/",
            {"comments": "Needs more work"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "rejected"
        pending_campaign.refresh_from_db()
        assert pending_campaign.status == LocationCampaign.Status.REJECTED

    def test_reject_campaign_requires_comments(self, admin_client, pending_campaign):
        """Test rejecting without comments fails."""
        response = admin_client.post(
            f"{self.base_url}{pending_campaign.id}/reject/", {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_schedule_campaign(self, admin_client, approved_campaign):
        """Test scheduling an approved campaign."""
        # First set schedule dates
        approved_campaign.scheduled_start = timezone.now() + timedelta(days=1)
        approved_campaign.scheduled_end = timezone.now() + timedelta(days=7)
        approved_campaign.save()

        response = admin_client.post(
            f"{self.base_url}{approved_campaign.id}/schedule/", {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "scheduled"

    def test_schedule_campaign_without_dates(self, admin_client, approved_campaign):
        """Test scheduling without dates fails."""
        # Clear any schedule dates
        approved_campaign.scheduled_start = None
        approved_campaign.scheduled_end = None
        approved_campaign.save()

        response = admin_client.post(
            f"{self.base_url}{approved_campaign.id}/schedule/", {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "scheduled_start" in response.data["error"]

    def test_revise_rejected_campaign(self, admin_client, rejected_campaign):
        """Test returning a rejected campaign to draft."""
        response = admin_client.post(
            f"{self.base_url}{rejected_campaign.id}/revise/",
            {"comments": "Making revisions"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "draft"
        rejected_campaign.refresh_from_db()
        assert rejected_campaign.status == LocationCampaign.Status.DRAFT

    def test_revise_approved_campaign_fails(self, admin_client, approved_campaign):
        """Test revising an approved campaign fails."""
        response = admin_client.post(
            f"{self.base_url}{approved_campaign.id}/revise/", {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCampaignBrandAccess:
    """Tests for brand-based access control on campaigns."""

    base_url = "/api/v1/campaigns/"

    def test_brand_manager_sees_own_brand_campaigns(
        self, brand_manager_client, draft_campaign, brand
    ):
        """Test brand manager only sees campaigns from assigned brands."""
        response = brand_manager_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        # All campaigns should be from brands the user has access to
        for campaign in response.data["results"]:
            # Campaign should be from user's brand (check brand_name field)
            assert campaign.get("brand_name") == "Test Brand"

    def test_admin_sees_all_campaigns(
        self, admin_client, draft_campaign, brand, brand_two
    ):
        """Test admin can see campaigns from all brands."""
        response = admin_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        # Admin should have access to all campaigns

    def test_viewer_without_brand_sees_nothing(self, db, user_without_brand, draft_campaign):
        """Test user without brand access sees no campaigns."""
        from conftest import get_authenticated_client

        client = get_authenticated_client(user_without_brand)
        response = client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 0


@pytest.mark.django_db
class TestApprovalHistory:
    """Tests for campaign approval history."""

    def test_approval_history_in_detail(self, admin_client, pending_campaign, approval_step):
        """Test approval history is included in campaign detail."""
        url = f"/api/v1/campaigns/{pending_campaign.id}/"
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "approval_history" in response.data
        assert len(response.data["approval_history"]) >= 1

    def test_approval_history_order(self, admin_client, db, pending_campaign, admin_user):
        """Test approval history is ordered by most recent first."""
        # Create multiple approval steps
        ApprovalStep.objects.create(
            campaign=pending_campaign,
            approver=admin_user,
            decision=ApprovalStep.Decision.SUBMITTED,
            previous_status="draft",
            new_status="pending_review",
        )
        ApprovalStep.objects.create(
            campaign=pending_campaign,
            approver=admin_user,
            decision=ApprovalStep.Decision.APPROVED,
            previous_status="pending_review",
            new_status="approved",
        )

        url = f"/api/v1/campaigns/{pending_campaign.id}/"
        response = admin_client.get(url)
        history = response.data["approval_history"]
        # Most recent should be first
        assert history[0]["decision"] == "approved"
