from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import TimeStampedModel


def default_user_preferences():
    """Default preferences for new users."""
    return {
        "notifications": {
            "email_campaign_submitted": True,
            "email_campaign_approved": True,
            "email_campaign_rejected": True,
        },
        "display": {
            "theme": "system",
        },
    }


class User(AbstractUser, TimeStampedModel):
    """Extended user model with role and brand association."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        BRAND_MANAGER = "brand_manager", "Brand Manager"
        LOCATION_MANAGER = "location_manager", "Location Manager"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    brands = models.ManyToManyField(
        "brands.Brand",
        related_name="users",
        blank=True,
    )
    preferences = models.JSONField(default=default_user_preferences)

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
        ]
