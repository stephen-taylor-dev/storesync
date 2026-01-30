from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel


class BrandManager(models.Manager):
    """Custom manager for Brand model."""

    def active(self):
        """Return brands that have active locations."""
        return self.filter(locations__is_active=True).distinct()

    def with_location_count(self):
        """Return brands annotated with location count."""
        return self.annotate(location_count=models.Count("locations"))


class Brand(UUIDModel, TimeStampedModel):
    """Top-level organization representing a retail brand."""

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="brands/logos/", null=True, blank=True)
    settings = models.JSONField(default=dict)

    objects = BrandManager()

    class Meta:
        db_table = "brands"
        ordering = ["name"]

    def __str__(self):
        return self.name


class LocationManager(models.Manager):
    """Custom manager for Location model."""

    def active(self):
        """Return only active locations."""
        return self.filter(is_active=True)

    def by_region(self, region: str):
        """Return locations in a specific region."""
        return self.filter(attributes__region=region)

    def with_attribute(self, key: str, value):
        """Return locations with a specific attribute value."""
        return self.filter(**{f"attributes__{key}": value})


class Location(UUIDModel, TimeStampedModel):
    """Physical location belonging to a brand."""

    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    name = models.CharField(max_length=255)
    store_number = models.CharField(max_length=50)

    # Address as structured JSON for flexibility
    # Example: {"street": "123 Main St", "city": "Austin", "state": "TX", "zip": "78701"}
    address = models.JSONField(default=dict)

    # Location-specific attributes for campaign targeting
    # Example: {"square_footage": 5000, "has_gas_station": true, "region": "southwest"}
    attributes = models.JSONField(default=dict)

    # GPS coordinates for map-based features
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    is_active = models.BooleanField(default=True)

    objects = LocationManager()

    class Meta:
        db_table = "locations"
        ordering = ["brand", "store_number"]
        unique_together = [["brand", "store_number"]]
        indexes = [
            models.Index(fields=["brand", "is_active"]),
        ]

    def __str__(self):
        return f"{self.brand.name} - {self.name} ({self.store_number})"

    @property
    def full_address(self):
        """Return formatted full address string."""
        addr = self.address
        parts = [
            addr.get("street", ""),
            addr.get("city", ""),
            addr.get("state", ""),
            addr.get("zip", ""),
        ]
        return ", ".join(filter(None, parts))
