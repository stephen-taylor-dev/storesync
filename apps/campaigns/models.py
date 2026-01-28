from django.contrib.auth import get_user_model
from django.db import models
from django_fsm import FSMField, transition
from pgvector.django import VectorField

from apps.core.models import TimeStampedModel, UUIDModel

User = get_user_model()


class CampaignTemplateManager(models.Manager):
    """Custom manager for CampaignTemplate model."""

    def active(self):
        """Return only active templates."""
        return self.filter(is_active=True)

    def by_type(self, campaign_type: str):
        """Return templates of a specific type."""
        return self.filter(campaign_type=campaign_type)


class CampaignTemplate(UUIDModel, TimeStampedModel):
    """Reusable campaign template with content placeholders."""

    brand = models.ForeignKey(
        "brands.Brand",
        on_delete=models.CASCADE,
        related_name="campaign_templates",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Jinja2-style template with placeholders
    # Example: "{{location.name}} is having a {{campaign.sale_type}} sale!"
    content_template = models.TextField()

    # Define required variables for this template
    # Example: ["sale_type", "discount_percentage", "start_date", "end_date"]
    required_variables = models.JSONField(default=list)

    # Campaign type for categorization
    # Examples: "seasonal_sale", "grand_opening", "clearance", "holiday"
    campaign_type = models.CharField(max_length=50)

    is_active = models.BooleanField(default=True)

    objects = CampaignTemplateManager()

    class Meta:
        db_table = "campaign_templates"
        ordering = ["brand", "name"]

    def __str__(self):
        return f"{self.brand.name} - {self.name}"


class LocationCampaignManager(models.Manager):
    """Custom manager for LocationCampaign model."""

    def pending_review(self):
        """Return campaigns awaiting review."""
        return self.filter(status=LocationCampaign.Status.PENDING_REVIEW)

    def approved(self):
        """Return approved campaigns."""
        return self.filter(status=LocationCampaign.Status.APPROVED)

    def by_status(self, status: str):
        """Return campaigns with a specific status."""
        return self.filter(status=status)

    def for_location(self, location_id):
        """Return campaigns for a specific location."""
        return self.filter(location_id=location_id)


class LocationCampaign(UUIDModel, TimeStampedModel):
    """Campaign instance for a specific location."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        SCHEDULED = "scheduled", "Scheduled"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    location = models.ForeignKey(
        "brands.Location",
        on_delete=models.CASCADE,
        related_name="campaigns",
    )
    template = models.ForeignKey(
        CampaignTemplate,
        on_delete=models.PROTECT,
        related_name="location_campaigns",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_campaigns",
    )

    # Status workflow using django-fsm
    status = FSMField(default=Status.DRAFT, choices=Status.choices)

    # Location-specific customizations override template defaults
    # Example: {"sale_type": "Summer Clearance", "discount_percentage": 30}
    customizations = models.JSONField(default=dict)

    # AI-generated or manually edited final content
    generated_content = models.TextField(blank=True)

    # HTML email fields
    generated_html_email = models.TextField(blank=True)
    email_subject = models.CharField(max_length=255, blank=True)
    email_preview_text = models.CharField(max_length=255, blank=True)

    # Vector embedding for semantic search (1536 dimensions for OpenAI embeddings)
    content_embedding = VectorField(dimensions=1536, null=True, blank=True)

    # Scheduling
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)

    objects = LocationCampaignManager()

    class Meta:
        db_table = "location_campaigns"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["location", "status"]),
            models.Index(fields=["status", "scheduled_start"]),
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

    @transition(field=status, source=Status.SCHEDULED, target=Status.ACTIVE)
    def activate(self):
        """Activate a scheduled campaign."""
        pass

    @transition(field=status, source=Status.ACTIVE, target=Status.COMPLETED)
    def complete(self):
        """Mark campaign as completed."""
        pass

    @transition(field=status, source=[Status.DRAFT, Status.REJECTED], target=Status.DRAFT)
    def revise(self):
        """Return to draft for revision."""
        pass


class ApprovalStep(UUIDModel, TimeStampedModel):
    """Audit trail for campaign approval decisions."""

    class Decision(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        REQUESTED_CHANGES = "requested_changes", "Requested Changes"

    campaign = models.ForeignKey(
        LocationCampaign,
        on_delete=models.CASCADE,
        related_name="approval_steps",
    )
    approver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="approval_decisions",
    )
    decision = models.CharField(max_length=20, choices=Decision.choices)
    comments = models.TextField(blank=True)

    # Capture previous and new status for audit
    previous_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)

    class Meta:
        db_table = "approval_steps"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.campaign} - {self.decision} by {self.approver}"


class EmailRecipient(UUIDModel, TimeStampedModel):
    """Email recipient for campaign email delivery."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    campaign = models.ForeignKey(
        LocationCampaign,
        on_delete=models.CASCADE,
        related_name="email_recipients",
    )
    email = models.EmailField()
    name = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "email_recipients"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign", "status"]),
        ]

    def __str__(self):
        return f"{self.email} - {self.campaign} ({self.status})"
