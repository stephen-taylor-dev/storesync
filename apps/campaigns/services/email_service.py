"""
Email service for sending campaign marketing emails.

This service handles:
- Sending individual campaign emails
- Batch sending with rate limiting
- Email personalization with recipient data
"""

import logging
import time
from typing import Any

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

logger = logging.getLogger(__name__)


class EmailService:
    """
    Service for sending campaign marketing emails.

    Uses Django's email backend configured in settings.
    """

    # Rate limiting: emails per second
    RATE_LIMIT = 5
    BATCH_SIZE = 50

    def __init__(self):
        """Initialize the email service."""
        self.from_email = getattr(
            settings,
            "DEFAULT_FROM_EMAIL",
            "StoreSync <noreply@storesync.com>",
        )

    def _personalize_content(
        self,
        content: str,
        recipient_name: str = "",
        recipient_email: str = "",
        campaign_id: str = "",
    ) -> str:
        """
        Replace personalization tokens in content.

        Args:
            content: HTML or text content with tokens
            recipient_name: Name to substitute
            recipient_email: Email for unsubscribe link
            campaign_id: Campaign ID for tracking

        Returns:
            Personalized content string
        """
        # Default to "Valued Customer" if no name provided
        name = recipient_name if recipient_name else "Valued Customer"

        # Build unsubscribe link (placeholder for actual implementation)
        unsubscribe_link = f"#unsubscribe?email={recipient_email}&campaign={campaign_id}"

        content = content.replace("{{recipient_name}}", name)
        content = content.replace("{{unsubscribe_link}}", unsubscribe_link)

        return content

    def send_campaign_email(
        self,
        recipient,
        campaign,
    ) -> bool:
        """
        Send a campaign email to a single recipient.

        Args:
            recipient: EmailRecipient instance
            campaign: LocationCampaign instance

        Returns:
            True if sent successfully, False otherwise
        """
        from apps.campaigns.models import EmailRecipient

        if not campaign.generated_html_email:
            logger.error(f"Campaign {campaign.id} has no HTML email content")
            recipient.status = EmailRecipient.Status.FAILED
            recipient.error_message = "No HTML email content available"
            recipient.save(update_fields=["status", "error_message", "updated_at"])
            return False

        try:
            # Personalize content
            html_content = self._personalize_content(
                campaign.generated_html_email,
                recipient_name=recipient.name,
                recipient_email=recipient.email,
                campaign_id=str(campaign.id),
            )

            # Generate plain text fallback from content
            text_content = self._personalize_content(
                campaign.generated_content or campaign.email_subject,
                recipient_name=recipient.name,
                recipient_email=recipient.email,
                campaign_id=str(campaign.id),
            )

            # Create email
            subject = campaign.email_subject or f"Message from {campaign.location}"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[recipient.email],
            )
            email.attach_alternative(html_content, "text/html")

            # Send
            email.send(fail_silently=False)

            # Update recipient status
            recipient.status = EmailRecipient.Status.SENT
            recipient.sent_at = timezone.now()
            recipient.error_message = ""
            recipient.save(update_fields=["status", "sent_at", "error_message", "updated_at"])

            logger.info(f"Sent email to {recipient.email} for campaign {campaign.id}")
            return True

        except Exception as e:
            logger.exception(f"Failed to send email to {recipient.email}: {e}")
            recipient.status = EmailRecipient.Status.FAILED
            recipient.error_message = str(e)[:500]  # Truncate error message
            recipient.save(update_fields=["status", "error_message", "updated_at"])
            return False

    def send_campaign_batch(
        self,
        campaign,
        recipients=None,
    ) -> dict[str, Any]:
        """
        Send campaign emails to multiple recipients with rate limiting.

        Args:
            campaign: LocationCampaign instance
            recipients: Optional queryset of EmailRecipient (defaults to pending)

        Returns:
            Dictionary with sending statistics

        Raises:
            ValueError: If campaign is not in active status
        """
        from apps.campaigns.models import EmailRecipient, LocationCampaign

        # Only allow sending for active campaigns
        if campaign.status != LocationCampaign.Status.ACTIVE:
            raise ValueError("Emails can only be sent for active campaigns")

        if recipients is None:
            recipients = campaign.email_recipients.filter(
                status=EmailRecipient.Status.PENDING
            )

        stats = {
            "total": 0,
            "sent": 0,
            "failed": 0,
            "errors": [],
        }

        batch_count = 0
        for recipient in recipients.iterator():
            stats["total"] += 1

            success = self.send_campaign_email(recipient, campaign)
            if success:
                stats["sent"] += 1
            else:
                stats["failed"] += 1
                stats["errors"].append({
                    "email": recipient.email,
                    "error": recipient.error_message,
                })

            batch_count += 1

            # Rate limiting
            if batch_count >= self.RATE_LIMIT:
                time.sleep(1)
                batch_count = 0

        logger.info(
            f"Batch send complete for campaign {campaign.id}: "
            f"{stats['sent']} sent, {stats['failed']} failed out of {stats['total']}"
        )

        return stats

    def get_campaign_email_stats(self, campaign) -> dict[str, int]:
        """
        Get email sending statistics for a campaign.

        Args:
            campaign: LocationCampaign instance

        Returns:
            Dictionary with counts by status
        """
        from django.db.models import Count

        recipients = campaign.email_recipients.values("status").annotate(
            count=Count("id")
        )

        stats = {
            "total": 0,
            "pending": 0,
            "sent": 0,
            "failed": 0,
        }

        for item in recipients:
            stats[item["status"]] = item["count"]
            stats["total"] += item["count"]

        return stats

    def add_recipients(
        self,
        campaign,
        recipients_data: list[dict[str, str]],
    ) -> dict[str, Any]:
        """
        Add recipients to a campaign.

        Args:
            campaign: LocationCampaign instance
            recipients_data: List of dicts with 'email' and optional 'name'

        Returns:
            Dictionary with created and skipped counts
        """
        from apps.campaigns.models import EmailRecipient

        created = 0
        skipped = 0
        errors = []

        existing_emails = set(
            campaign.email_recipients.values_list("email", flat=True)
        )

        for data in recipients_data:
            email = data.get("email", "").strip().lower()
            name = data.get("name", "").strip()

            if not email:
                continue

            if email in existing_emails:
                skipped += 1
                continue

            try:
                EmailRecipient.objects.create(
                    campaign=campaign,
                    email=email,
                    name=name,
                )
                created += 1
                existing_emails.add(email)
            except Exception as e:
                errors.append({"email": email, "error": str(e)})

        logger.info(
            f"Added {created} recipients to campaign {campaign.id}, "
            f"skipped {skipped} duplicates"
        )

        return {
            "created": created,
            "skipped": skipped,
            "errors": errors,
        }

    def clear_recipients(self, campaign) -> int:
        """
        Remove all pending recipients from a campaign.

        Args:
            campaign: LocationCampaign instance

        Returns:
            Number of recipients deleted
        """
        from apps.campaigns.models import EmailRecipient

        deleted, _ = campaign.email_recipients.filter(
            status=EmailRecipient.Status.PENDING
        ).delete()

        logger.info(f"Cleared {deleted} pending recipients from campaign {campaign.id}")
        return deleted
