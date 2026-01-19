"""
Tests for Brand and Location models.
"""

import pytest
from django.db import IntegrityError

from apps.brands.models import Brand, Location


@pytest.mark.django_db
class TestBrandModel:
    """Tests for the Brand model."""

    def test_create_brand(self, brand):
        """Test creating a brand."""
        assert brand.name == "Test Brand"
        assert brand.slug == "test-brand"
        assert brand.settings == {"default_region": "southwest"}
        assert brand.id is not None  # UUID

    def test_brand_str(self, brand):
        """Test brand string representation."""
        assert str(brand) == "Test Brand"

    def test_brand_slug_unique(self, db, brand):
        """Test that brand slug must be unique."""
        with pytest.raises(IntegrityError):
            Brand.objects.create(name="Another Brand", slug="test-brand")

    def test_brand_timestamps(self, brand):
        """Test that timestamps are auto-populated."""
        assert brand.created_at is not None
        assert brand.updated_at is not None

    def test_brand_ordering(self, db, brand, brand_two):
        """Test brands are ordered by name."""
        brands = list(Brand.objects.all())
        assert brands[0].name == "Second Brand"
        assert brands[1].name == "Test Brand"


@pytest.mark.django_db
class TestBrandManager:
    """Tests for BrandManager custom methods."""

    def test_active_brands(self, db, brand, brand_two, location, inactive_location):
        """Test filtering brands with active locations."""
        # brand has an active location, brand_two has none
        active_brands = Brand.objects.active()
        assert brand in active_brands
        assert brand_two not in active_brands

    def test_with_location_count(self, db, brand, location, location_two):
        """Test annotating brands with location count."""
        brand_with_count = Brand.objects.with_location_count().get(id=brand.id)
        assert brand_with_count.location_count == 2


@pytest.mark.django_db
class TestLocationModel:
    """Tests for the Location model."""

    def test_create_location(self, location):
        """Test creating a location."""
        assert location.name == "Downtown Store"
        assert location.store_number == "001"
        assert location.is_active is True
        assert location.id is not None  # UUID

    def test_location_str(self, location):
        """Test location string representation."""
        assert str(location) == "Test Brand - Downtown Store (001)"

    def test_location_full_address(self, location):
        """Test full_address property."""
        expected = "123 Main St, Austin, TX, 78701"
        assert location.full_address == expected

    def test_location_full_address_partial(self, db, brand):
        """Test full_address with partial address data."""
        loc = Location.objects.create(
            brand=brand,
            name="Test",
            store_number="X01",
            address={"city": "Austin", "state": "TX"},
        )
        assert loc.full_address == "Austin, TX"

    def test_location_full_address_empty(self, db, brand):
        """Test full_address with empty address."""
        loc = Location.objects.create(
            brand=brand,
            name="Test",
            store_number="X02",
            address={},
        )
        assert loc.full_address == ""

    def test_location_brand_relationship(self, location, brand):
        """Test location-brand foreign key relationship."""
        assert location.brand == brand
        assert location in brand.locations.all()

    def test_location_unique_store_number_per_brand(self, db, brand, location):
        """Test that store_number is unique within a brand."""
        with pytest.raises(IntegrityError):
            Location.objects.create(
                brand=brand,
                name="Duplicate Store",
                store_number="001",  # Same as location fixture
            )

    def test_location_same_store_number_different_brand(self, db, brand, brand_two):
        """Test same store_number can exist in different brands."""
        loc1 = Location.objects.create(
            brand=brand, name="Store A", store_number="100"
        )
        loc2 = Location.objects.create(
            brand=brand_two, name="Store B", store_number="100"
        )
        assert loc1.store_number == loc2.store_number
        assert loc1.brand != loc2.brand

    def test_location_timestamps(self, location):
        """Test that timestamps are auto-populated."""
        assert location.created_at is not None
        assert location.updated_at is not None


@pytest.mark.django_db
class TestLocationManager:
    """Tests for LocationManager custom methods."""

    def test_active_locations(self, db, location, inactive_location):
        """Test filtering active locations."""
        active = Location.objects.active()
        assert location in active
        assert inactive_location not in active

    def test_by_region(self, db, location, location_two):
        """Test filtering locations by region attribute."""
        southwest = Location.objects.by_region("southwest")
        north = Location.objects.by_region("north")
        assert location in southwest
        assert location_two not in southwest
        assert location_two in north

    def test_with_attribute(self, db, location, location_two):
        """Test filtering locations by specific attribute."""
        with_gas = Location.objects.with_attribute("has_gas_station", True)
        without_gas = Location.objects.with_attribute("has_gas_station", False)
        assert location_two in with_gas
        assert location not in with_gas
        assert location in without_gas

    def test_with_attribute_numeric(self, db, location, location_two):
        """Test filtering by numeric attribute."""
        large_stores = Location.objects.with_attribute("square_footage", 5000)
        assert location in large_stores
        assert location_two not in large_stores
