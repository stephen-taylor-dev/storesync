"""
Tests for Campaign models and FSM transitions.
"""

import pytest
from django.db import IntegrityError
from django.utils import timezone
from datetime import timedelta
from django_fsm import TransitionNotAllowed

from apps.campaigns.models import ApprovalStep, CampaignTemplate, LocationCampaign


@pytest.mark.django_db
class TestCampaignTemplateModel:
    """Tests for the CampaignTemplate model."""

    def test_create_template(self, campaign_template):
        """Test creating a campaign template."""
        assert campaign_template.name == "Summer Sale Template"
        assert campaign_template.campaign_type == "seasonal_sale"
        assert campaign_template.is_active is True
        assert "location_name" in campaign_template.content_template
        assert campaign_template.id is not None  # UUID

    def test_template_str(self, campaign_template):
        """Test template string representation."""
        assert str(campaign_template) == "Test Brand - Summer Sale Template"

    def test_template_brand_relationship(self, campaign_template, brand):
        """Test template-brand foreign key relationship."""
        assert campaign_template.brand == brand
        assert campaign_template in brand.campaign_templates.all()

    def test_template_required_variables(self, campaign_template):
        """Test required_variables field."""
        assert campaign_template.required_variables == ["discount_percentage"]

    def test_template_timestamps(self, campaign_template):
        """Test that timestamps are auto-populated."""
        assert campaign_template.created_at is not None
        assert campaign_template.updated_at is not None


@pytest.mark.django_db
class TestCampaignTemplateManager:
    """Tests for CampaignTemplateManager custom methods."""

    def test_active_templates(self, db, campaign_template, inactive_template):
        """Test filtering active templates."""
        active = CampaignTemplate.objects.active()
        assert campaign_template in active
        assert inactive_template not in active

    def test_by_type(self, db, campaign_template, campaign_template_two):
        """Test filtering templates by campaign type."""
        seasonal = CampaignTemplate.objects.by_type("seasonal_sale")
        opening = CampaignTemplate.objects.by_type("grand_opening")
        assert campaign_template in seasonal
        assert campaign_template_two not in seasonal
        assert campaign_template_two in opening


@pytest.mark.django_db
class TestLocationCampaignModel:
    """Tests for the LocationCampaign model."""

    def test_create_campaign(self, draft_campaign):
        """Test creating a location campaign."""
        assert draft_campaign.status == LocationCampaign.Status.DRAFT
        assert draft_campaign.customizations == {"discount_percentage": 25}
        assert draft_campaign.id is not None  # UUID

    def test_campaign_str(self, draft_campaign):
        """Test campaign string representation."""
        expected = f"{draft_campaign.location} - {draft_campaign.template.name}"
        assert str(draft_campaign) == expected

    def test_campaign_relationships(self, draft_campaign, location, campaign_template, admin_user):
        """Test campaign foreign key relationships."""
        assert draft_campaign.location == location
        assert draft_campaign.template == campaign_template
        assert draft_campaign.created_by == admin_user

    def test_campaign_timestamps(self, draft_campaign):
        """Test that timestamps are auto-populated."""
        assert draft_campaign.created_at is not None
        assert draft_campaign.updated_at is not None


@pytest.mark.django_db
class TestLocationCampaignManager:
    """Tests for LocationCampaignManager custom methods."""

    def test_pending_review(self, db, draft_campaign, pending_campaign):
        """Test filtering pending review campaigns."""
        pending = LocationCampaign.objects.pending_review()
        assert pending_campaign in pending
        assert draft_campaign not in pending

    def test_approved(self, db, draft_campaign, approved_campaign):
        """Test filtering approved campaigns."""
        approved = LocationCampaign.objects.approved()
        assert approved_campaign in approved
        assert draft_campaign not in approved

    def test_by_status(self, db, draft_campaign, pending_campaign, approved_campaign):
        """Test filtering by specific status."""
        drafts = LocationCampaign.objects.by_status(LocationCampaign.Status.DRAFT)
        assert draft_campaign in drafts
        assert pending_campaign not in drafts

    def test_for_location(self, db, draft_campaign, location):
        """Test filtering by location."""
        campaigns = LocationCampaign.objects.for_location(location.id)
        assert draft_campaign in campaigns


@pytest.mark.django_db
class TestCampaignFSMTransitions:
    """Tests for campaign state machine transitions."""

    def test_submit_for_review(self, draft_campaign):
        """Test transitioning from DRAFT to PENDING_REVIEW."""
        assert draft_campaign.status == LocationCampaign.Status.DRAFT
        draft_campaign.submit_for_review()
        draft_campaign.save()
        assert draft_campaign.status == LocationCampaign.Status.PENDING_REVIEW

    def test_approve(self, pending_campaign):
        """Test transitioning from PENDING_REVIEW to APPROVED."""
        assert pending_campaign.status == LocationCampaign.Status.PENDING_REVIEW
        pending_campaign.approve()
        pending_campaign.save()
        assert pending_campaign.status == LocationCampaign.Status.APPROVED

    def test_reject(self, pending_campaign):
        """Test transitioning from PENDING_REVIEW to REJECTED."""
        pending_campaign.reject()
        pending_campaign.save()
        assert pending_campaign.status == LocationCampaign.Status.REJECTED

    def test_schedule(self, approved_campaign):
        """Test transitioning from APPROVED to SCHEDULED."""
        # Set schedule dates first
        approved_campaign.scheduled_start = timezone.now() + timedelta(days=1)
        approved_campaign.scheduled_end = timezone.now() + timedelta(days=7)
        approved_campaign.schedule()
        approved_campaign.save()
        assert approved_campaign.status == LocationCampaign.Status.SCHEDULED

    def test_activate(self, scheduled_campaign):
        """Test transitioning from SCHEDULED to ACTIVE."""
        scheduled_campaign.activate()
        scheduled_campaign.save()
        assert scheduled_campaign.status == LocationCampaign.Status.ACTIVE

    def test_complete(self, active_campaign):
        """Test transitioning from ACTIVE to COMPLETED."""
        active_campaign.complete()
        active_campaign.save()
        assert active_campaign.status == LocationCampaign.Status.COMPLETED

    def test_revise_from_draft(self, draft_campaign):
        """Test revise transition from DRAFT (stays DRAFT)."""
        draft_campaign.revise()
        draft_campaign.save()
        assert draft_campaign.status == LocationCampaign.Status.DRAFT

    def test_revise_from_rejected(self, rejected_campaign):
        """Test revise transition from REJECTED to DRAFT."""
        assert rejected_campaign.status == LocationCampaign.Status.REJECTED
        rejected_campaign.revise()
        rejected_campaign.save()
        assert rejected_campaign.status == LocationCampaign.Status.DRAFT

    # Invalid transition tests
    def test_cannot_approve_draft(self, draft_campaign):
        """Test that DRAFT cannot transition directly to APPROVED."""
        with pytest.raises(TransitionNotAllowed):
            draft_campaign.approve()

    def test_cannot_submit_pending(self, pending_campaign):
        """Test that PENDING_REVIEW cannot be submitted again."""
        with pytest.raises(TransitionNotAllowed):
            pending_campaign.submit_for_review()

    def test_cannot_schedule_draft(self, draft_campaign):
        """Test that DRAFT cannot transition directly to SCHEDULED."""
        with pytest.raises(TransitionNotAllowed):
            draft_campaign.schedule()

    def test_cannot_activate_approved(self, approved_campaign):
        """Test that APPROVED cannot transition directly to ACTIVE."""
        with pytest.raises(TransitionNotAllowed):
            approved_campaign.activate()

    def test_cannot_complete_approved(self, approved_campaign):
        """Test that APPROVED cannot transition directly to COMPLETED."""
        with pytest.raises(TransitionNotAllowed):
            approved_campaign.complete()

    def test_cannot_revise_approved(self, approved_campaign):
        """Test that APPROVED cannot be revised."""
        with pytest.raises(TransitionNotAllowed):
            approved_campaign.revise()


@pytest.mark.django_db
class TestApprovalStepModel:
    """Tests for the ApprovalStep model."""

    def test_create_approval_step(self, approval_step):
        """Test creating an approval step."""
        assert approval_step.decision == ApprovalStep.Decision.SUBMITTED
        assert approval_step.previous_status == LocationCampaign.Status.DRAFT
        assert approval_step.new_status == LocationCampaign.Status.PENDING_REVIEW

    def test_approval_step_str(self, approval_step):
        """Test approval step string representation."""
        assert "SUBMITTED" in str(approval_step).upper()

    def test_approval_step_campaign_relationship(self, approval_step, pending_campaign):
        """Test approval step-campaign relationship."""
        assert approval_step.campaign == pending_campaign
        assert approval_step in pending_campaign.approval_steps.all()

    def test_approval_step_decisions(self):
        """Test that all decision choices are valid."""
        assert ApprovalStep.Decision.SUBMITTED == "submitted"
        assert ApprovalStep.Decision.APPROVED == "approved"
        assert ApprovalStep.Decision.REJECTED == "rejected"
        assert ApprovalStep.Decision.REQUESTED_CHANGES == "requested_changes"

    def test_approval_step_with_comments(self, db, pending_campaign, admin_user):
        """Test approval step with comments."""
        step = ApprovalStep.objects.create(
            campaign=pending_campaign,
            approver=admin_user,
            decision=ApprovalStep.Decision.REJECTED,
            comments="Need more details on the discount",
            previous_status=LocationCampaign.Status.PENDING_REVIEW,
            new_status=LocationCampaign.Status.REJECTED,
        )
        assert step.comments == "Need more details on the discount"

    def test_approval_step_ordering(self, db, pending_campaign, admin_user):
        """Test approval steps are ordered by created_at descending."""
        step1 = ApprovalStep.objects.create(
            campaign=pending_campaign,
            approver=admin_user,
            decision=ApprovalStep.Decision.SUBMITTED,
            previous_status="draft",
            new_status="pending_review",
        )
        step2 = ApprovalStep.objects.create(
            campaign=pending_campaign,
            approver=admin_user,
            decision=ApprovalStep.Decision.APPROVED,
            previous_status="pending_review",
            new_status="approved",
        )
        steps = list(pending_campaign.approval_steps.all())
        # Most recent first
        assert steps[0] == step2
        assert steps[1] == step1


@pytest.mark.django_db
class TestCampaignStatusChoices:
    """Tests for campaign status choices."""

    def test_all_statuses_defined(self):
        """Test that all expected statuses are defined."""
        assert LocationCampaign.Status.DRAFT == "draft"
        assert LocationCampaign.Status.PENDING_REVIEW == "pending_review"
        assert LocationCampaign.Status.APPROVED == "approved"
        assert LocationCampaign.Status.REJECTED == "rejected"
        assert LocationCampaign.Status.SCHEDULED == "scheduled"
        assert LocationCampaign.Status.ACTIVE == "active"
        assert LocationCampaign.Status.COMPLETED == "completed"

    def test_status_choices_count(self):
        """Test that we have the expected number of statuses."""
        assert len(LocationCampaign.Status.choices) == 7
