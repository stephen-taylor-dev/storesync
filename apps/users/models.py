from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import TimeStampedModel


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

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
        ]
