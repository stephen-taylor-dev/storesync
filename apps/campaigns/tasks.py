"""
Celery tasks for campaign management.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_campaign_content(self, campaign_id: str) -> dict:
    """
    Generate AI-powered content for a campaign using the template and location data.

    Uses ContentGeneratorService to generate content via LangChain/OpenAI
    and computes vector embeddings for similarity search.

    Args:
        campaign_id: UUID of the LocationCampaign to generate content for

    Returns:
        dict with status and generated content
    """
    from apps.campaigns.models import LocationCampaign
    from apps.campaigns.services.content_generator import ContentGeneratorService

    try:
        campaign = LocationCampaign.objects.select_related(
            "template", "location", "location__brand"
        ).get(id=campaign_id)

        logger.info(f"Generating content for campaign {campaign_id}")

        service = ContentGeneratorService()
        content, embedding = service.generate_and_embed(campaign)

        # Update campaign with generated content and embedding
        campaign.generated_content = content
        if embedding:
            campaign.content_embedding = embedding
        campaign.save(update_fields=["generated_content", "content_embedding", "updated_at"])

        logger.info(f"Content generated successfully for campaign {campaign_id}")

        return {
            "status": "success",
            "campaign_id": str(campaign_id),
            "content_length": len(content),
            "has_embedding": embedding is not None,
        }

    except LocationCampaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found")
        return {"status": "error", "message": "Campaign not found"}

    except Exception as exc:
        logger.exception(f"Error generating content for campaign {campaign_id}")
        raise self.retry(exc=exc)


@shared_task
def activate_scheduled_campaigns() -> dict:
    """
    Check for approved campaigns that are scheduled to start and activate them.
    Runs every 5 minutes via Celery Beat.

    Returns:
        dict with count of activated campaigns
    """
    from apps.campaigns.models import LocationCampaign

    now = timezone.now()
    activated_count = 0

    # Find campaigns that are scheduled and should be active
    campaigns = LocationCampaign.objects.filter(
        status=LocationCampaign.Status.SCHEDULED,
        scheduled_start__lte=now,
    )

    for campaign in campaigns:
        try:
            with transaction.atomic():
                campaign.activate()
                campaign.save()
                activated_count += 1
                logger.info(f"Activated campaign {campaign.id}")
        except Exception as e:
            logger.error(f"Failed to activate campaign {campaign.id}: {e}")

    if activated_count > 0:
        logger.info(f"Activated {activated_count} campaigns")

    return {"activated": activated_count}


@shared_task
def complete_expired_campaigns() -> dict:
    """
    Check for active campaigns that have passed their end date and complete them.
    Runs every 5 minutes via Celery Beat.

    Returns:
        dict with count of completed campaigns
    """
    from apps.campaigns.models import LocationCampaign

    now = timezone.now()
    completed_count = 0

    # Find active campaigns that should be completed
    campaigns = LocationCampaign.objects.filter(
        status=LocationCampaign.Status.ACTIVE,
        scheduled_end__lte=now,
        scheduled_end__isnull=False,
    )

    for campaign in campaigns:
        try:
            with transaction.atomic():
                campaign.complete()
                campaign.save()
                completed_count += 1
                logger.info(f"Completed campaign {campaign.id}")
        except Exception as e:
            logger.error(f"Failed to complete campaign {campaign.id}: {e}")

    if completed_count > 0:
        logger.info(f"Completed {completed_count} campaigns")

    return {"completed": completed_count}


@shared_task
def send_pending_approval_digest() -> dict:
    """
    Send a daily digest email to approvers with pending campaigns.
    Runs daily at 9 AM UTC via Celery Beat.

    Returns:
        dict with count of notifications sent
    """
    from apps.campaigns.models import LocationCampaign
    from apps.users.models import User

    # Get count of pending campaigns
    pending_count = LocationCampaign.objects.filter(
        status=LocationCampaign.Status.PENDING_REVIEW
    ).count()

    if pending_count == 0:
        logger.info("No pending campaigns for digest")
        return {"sent": 0, "pending_count": 0}

    # Get approvers (admins and brand managers)
    approvers = User.objects.filter(
        role__in=["admin", "brand_manager"],
        is_active=True,
    )

    sent_count = 0
    for approver in approvers:
        try:
            # TODO: Implement actual email sending
            # For now, just log the notification
            logger.info(
                f"Would send digest to {approver.email}: "
                f"{pending_count} campaigns pending approval"
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to send digest to {approver.email}: {e}")

    return {"sent": sent_count, "pending_count": pending_count}


@shared_task
def cleanup_old_data() -> dict:
    """
    Clean up old data to prevent database bloat.
    Runs weekly on Sunday at 2 AM via Celery Beat.

    - Deletes approval history entries older than 1 year for completed campaigns
    - Cleans up orphaned data

    Returns:
        dict with cleanup statistics
    """
    from apps.campaigns.models import ApprovalStep, LocationCampaign

    one_year_ago = timezone.now() - timedelta(days=365)
    deleted_count = 0

    # Delete old approval history for completed campaigns
    old_steps = ApprovalStep.objects.filter(
        campaign__status=LocationCampaign.Status.COMPLETED,
        created_at__lt=one_year_ago,
    )
    deleted_count = old_steps.count()
    old_steps.delete()

    if deleted_count > 0:
        logger.info(f"Deleted {deleted_count} old approval history entries")

    return {"deleted_approval_steps": deleted_count}


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_campaign_notification(
    self,
    campaign_id: str,
    notification_type: str,
    recipient_ids: list[int] | None = None,
) -> dict:
    """
    Send notification about campaign status changes.

    Args:
        campaign_id: UUID of the campaign
        notification_type: Type of notification (submitted, approved, rejected, etc.)
        recipient_ids: Optional list of user IDs to notify (defaults to relevant users)

    Returns:
        dict with notification status
    """
    from apps.campaigns.models import LocationCampaign
    from apps.users.models import User

    try:
        campaign = LocationCampaign.objects.select_related(
            "location__brand", "template", "created_by"
        ).get(id=campaign_id)

        # Determine recipients if not specified
        if recipient_ids is None:
            if notification_type in ["submitted"]:
                # Notify approvers
                recipients = User.objects.filter(
                    role__in=["admin", "brand_manager"],
                    is_active=True,
                )
            elif notification_type in ["approved", "rejected"]:
                # Notify campaign creator
                if campaign.created_by:
                    recipients = User.objects.filter(id=campaign.created_by.id)
                else:
                    recipients = User.objects.none()
            else:
                recipients = User.objects.none()
        else:
            recipients = User.objects.filter(id__in=recipient_ids)

        sent_count = 0
        for recipient in recipients:
            try:
                # TODO: Implement actual notification sending (email, push, etc.)
                logger.info(
                    f"Would notify {recipient.email} about campaign {campaign_id} "
                    f"({notification_type})"
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to notify {recipient.email}: {e}")

        return {
            "status": "success",
            "campaign_id": str(campaign_id),
            "notification_type": notification_type,
            "sent_count": sent_count,
        }

    except LocationCampaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found for notification")
        return {"status": "error", "message": "Campaign not found"}

    except Exception as exc:
        logger.exception(f"Error sending notification for campaign {campaign_id}")
        raise self.retry(exc=exc)


@shared_task
def bulk_generate_campaign_content(campaign_ids: list[str]) -> dict:
    """
    Generate content for multiple campaigns in parallel.

    Args:
        campaign_ids: List of campaign UUIDs

    Returns:
        dict with task IDs for each campaign
    """
    task_ids = {}
    for campaign_id in campaign_ids:
        result = generate_campaign_content.delay(campaign_id)
        task_ids[campaign_id] = result.id

    return {"queued": len(task_ids), "task_ids": task_ids}


# ========== HTML Email Tasks ==========


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_html_email_content(self, campaign_id: str) -> dict:
    """
    Generate HTML email content for a campaign.

    Generates:
    - HTML email from plain text content
    - Email subject line
    - Email preview text

    Args:
        campaign_id: UUID of the LocationCampaign

    Returns:
        dict with status and generated content info
    """
    from apps.campaigns.models import LocationCampaign
    from apps.campaigns.services.content_generator import ContentGeneratorService

    try:
        campaign = LocationCampaign.objects.select_related(
            "template", "location", "location__brand"
        ).get(id=campaign_id)

        if not campaign.generated_content:
            logger.error(f"Campaign {campaign_id} has no content to convert to HTML")
            return {"status": "error", "message": "No content available"}

        logger.info(f"Generating HTML email for campaign {campaign_id}")

        service = ContentGeneratorService()
        result = service.generate_full_email(campaign)

        # Save to campaign
        campaign.generated_html_email = result["html"]
        campaign.email_subject = result["subject"]
        campaign.email_preview_text = result["preview_text"]
        campaign.save(update_fields=[
            "generated_html_email",
            "email_subject",
            "email_preview_text",
            "updated_at",
        ])

        logger.info(f"HTML email generated for campaign {campaign_id}")

        return {
            "status": "success",
            "campaign_id": str(campaign_id),
            "subject": result["subject"],
            "html_length": len(result["html"]),
        }

    except LocationCampaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found")
        return {"status": "error", "message": "Campaign not found"}

    except Exception as exc:
        logger.exception(f"Error generating HTML email for campaign {campaign_id}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_campaign_emails(
    self,
    campaign_id: str,
    recipient_ids: list[str] | None = None,
) -> dict:
    """
    Send campaign emails to recipients.

    Args:
        campaign_id: UUID of the LocationCampaign
        recipient_ids: Optional list of EmailRecipient UUIDs (defaults to all pending)

    Returns:
        dict with sending statistics
    """
    from apps.campaigns.models import EmailRecipient, LocationCampaign
    from apps.campaigns.services.email_service import EmailService

    try:
        campaign = LocationCampaign.objects.get(id=campaign_id)

        # Only allow sending for active campaigns
        if campaign.status != LocationCampaign.Status.ACTIVE:
            logger.error(f"Campaign {campaign_id} is not active (status: {campaign.status})")
            return {"status": "error", "message": "Emails can only be sent for active campaigns"}

        if not campaign.generated_html_email:
            logger.error(f"Campaign {campaign_id} has no HTML email content")
            return {"status": "error", "message": "No HTML email content"}

        # Get recipients
        if recipient_ids:
            recipients = EmailRecipient.objects.filter(
                campaign=campaign,
                id__in=recipient_ids,
                status=EmailRecipient.Status.PENDING,
            )
        else:
            recipients = campaign.email_recipients.filter(
                status=EmailRecipient.Status.PENDING
            )

        logger.info(
            f"Sending emails for campaign {campaign_id} to {recipients.count()} recipients"
        )

        service = EmailService()
        stats = service.send_campaign_batch(campaign, recipients)

        return {
            "status": "success",
            "campaign_id": str(campaign_id),
            **stats,
        }

    except LocationCampaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found")
        return {"status": "error", "message": "Campaign not found"}

    except Exception as exc:
        logger.exception(f"Error sending emails for campaign {campaign_id}")
        raise self.retry(exc=exc)


@shared_task
def send_test_email(campaign_id: str, test_email: str) -> dict:
    """
    Send a test email for preview purposes.

    Args:
        campaign_id: UUID of the LocationCampaign
        test_email: Email address to send test to

    Returns:
        dict with status
    """
    from django.core.mail import EmailMultiAlternatives

    from apps.campaigns.models import LocationCampaign

    try:
        campaign = LocationCampaign.objects.get(id=campaign_id)

        if not campaign.generated_html_email:
            return {"status": "error", "message": "No HTML email content"}

        # Create test email with placeholder values
        html_content = campaign.generated_html_email.replace(
            "{{recipient_name}}", "Test Recipient"
        ).replace(
            "{{unsubscribe_link}}", "#test-unsubscribe"
        )

        text_content = campaign.generated_content or campaign.email_subject or ""
        subject = f"[TEST] {campaign.email_subject or 'Campaign Email'}"

        from_addr = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@storesync.com")
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_addr,
            to=[test_email],
        )
        email.attach_alternative(html_content, "text/html")
        email.send()

        logger.info(f"Sent test email for campaign {campaign_id} to {test_email}")

        return {
            "status": "success",
            "campaign_id": str(campaign_id),
            "sent_to": test_email,
        }

    except LocationCampaign.DoesNotExist:
        return {"status": "error", "message": "Campaign not found"}

    except Exception as e:
        logger.exception(f"Error sending test email: {e}")
        return {"status": "error", "message": str(e)}
