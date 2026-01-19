"""
Tests for Brand and Location API views.
"""

import pytest
from rest_framework import status

from apps.brands.models import Brand, Location


@pytest.mark.django_db
class TestBrandViewSet:
    """Tests for BrandViewSet."""

    base_url = "/api/v1/brands/"

    def test_list_brands_admin(self, admin_client, brand, brand_two):
        """Test admin can list all brands."""
        response = admin_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_list_brands_brand_manager(self, brand_manager_client, brand, brand_two):
        """Test brand manager only sees assigned brands."""
        response = brand_manager_client.get(self.base_url)
        assert response.status_code == status.HTTP_200_OK
        # brand_manager_user only has access to 'brand', not 'brand_two'
        assert response.data["count"] == 1
        assert response.data["results"][0]["slug"] == "test-brand"

    def test_list_brands_unauthenticated(self, api_client, brand):
        """Test unauthenticated access is denied."""
        response = api_client.get(self.base_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_retrieve_brand(self, admin_client, brand):
        """Test retrieving a single brand."""
        response = admin_client.get(f"{self.base_url}{brand.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test Brand"
        assert response.data["slug"] == "test-brand"

    def test_create_brand_admin(self, admin_client):
        """Test admin can create a brand."""
        data = {"name": "New Brand", "slug": "new-brand", "settings": {"key": "value"}}
        response = admin_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Brand.objects.filter(slug="new-brand").exists()

    def test_create_brand_brand_manager(self, brand_manager_client):
        """Test brand manager can create a brand."""
        data = {"name": "Manager Brand", "slug": "manager-brand"}
        response = brand_manager_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_brand_viewer_forbidden(self, viewer_client):
        """Test viewer cannot create a brand."""
        data = {"name": "Viewer Brand", "slug": "viewer-brand"}
        response = viewer_client.post(self.base_url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_brand(self, admin_client, brand):
        """Test updating a brand."""
        data = {"name": "Updated Brand", "slug": "test-brand"}
        response = admin_client.patch(f"{self.base_url}{brand.id}/", data, format="json")
        assert response.status_code == status.HTTP_200_OK
        brand.refresh_from_db()
        assert brand.name == "Updated Brand"

    def test_delete_brand(self, admin_client, brand):
        """Test deleting a brand."""
        brand_id = brand.id
        response = admin_client.delete(f"{self.base_url}{brand_id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Brand.objects.filter(id=brand_id).exists()

    def test_delete_brand_viewer_forbidden(self, viewer_client, brand):
        """Test viewer cannot delete a brand."""
        response = viewer_client.delete(f"{self.base_url}{brand.id}/")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestLocationViewSet:
    """Tests for LocationViewSet."""

    def get_url(self, brand_id, location_id=None):
        base = f"/api/v1/brands/{brand_id}/locations/"
        if location_id:
            return f"{base}{location_id}/"
        return base

    def test_list_locations(self, admin_client, brand, location, location_two):
        """Test listing locations for a brand."""
        response = admin_client.get(self.get_url(brand.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_list_locations_filter_active(self, admin_client, brand, location, inactive_location):
        """Test filtering locations by active status."""
        # Filter active only
        response = admin_client.get(f"{self.get_url(brand.id)}?is_active=true")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["store_number"] == "001"

        # Filter inactive only
        response = admin_client.get(f"{self.get_url(brand.id)}?is_active=false")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["store_number"] == "999"

    def test_list_locations_search(self, admin_client, brand, location, location_two):
        """Test searching locations by name or store number."""
        # Search by name
        response = admin_client.get(f"{self.get_url(brand.id)}?search=Downtown")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Downtown Store"

        # Search by store number
        response = admin_client.get(f"{self.get_url(brand.id)}?search=002")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Mall Location"

    def test_retrieve_location(self, admin_client, brand, location):
        """Test retrieving a single location."""
        response = admin_client.get(self.get_url(brand.id, location.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Downtown Store"
        assert response.data["store_number"] == "001"

    def test_create_location(self, admin_client, brand):
        """Test creating a location."""
        data = {
            "name": "New Store",
            "store_number": "X99",
            "address": {"city": "Houston", "state": "TX"},
            "attributes": {"region": "southeast"},
        }
        response = admin_client.post(self.get_url(brand.id), data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Location.objects.filter(store_number="X99").exists()

    def test_create_location_viewer_forbidden(self, viewer_client, brand):
        """Test viewer cannot create a location."""
        data = {"name": "New Store", "store_number": "X99"}
        response = viewer_client.post(self.get_url(brand.id), data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_location_duplicate_store_number(self, admin_client, brand, location):
        """Test creating location with duplicate store number fails."""
        data = {"name": "Duplicate", "store_number": "001"}  # Already exists
        response = admin_client.post(self.get_url(brand.id), data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_location(self, admin_client, brand, location):
        """Test updating a location."""
        data = {"name": "Updated Store Name"}
        response = admin_client.patch(
            self.get_url(brand.id, location.id), data, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        location.refresh_from_db()
        assert location.name == "Updated Store Name"

    def test_delete_location(self, admin_client, brand, location):
        """Test deleting a location."""
        loc_id = location.id
        response = admin_client.delete(self.get_url(brand.id, loc_id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Location.objects.filter(id=loc_id).exists()

    def test_brand_access_control(self, brand_manager_client, brand, brand_two):
        """Test brand manager cannot access unassigned brand's locations."""
        # Create location in brand_two (not assigned to brand_manager)
        loc = Location.objects.create(
            brand=brand_two, name="Other", store_number="X01"
        )

        # Should not be able to access brand_two's locations - returns 403
        response = brand_manager_client.get(self.get_url(brand_two.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestBulkImport:
    """Tests for bulk location import."""

    def get_url(self, brand_id):
        return f"/api/v1/brands/{brand_id}/locations/bulk_import/"

    def test_import_template_download(self, admin_client, brand):
        """Test downloading import template."""
        url = f"/api/v1/brands/{brand.id}/locations/import_template/"
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        assert "attachment" in response["Content-Disposition"]

    def test_bulk_import_no_file(self, admin_client, brand):
        """Test bulk import fails without file."""
        response = admin_client.post(self.get_url(brand.id))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "No file provided" in response.data["error"]

    def test_bulk_import_unsupported_format(self, admin_client, brand):
        """Test bulk import fails with unsupported file format."""
        from io import BytesIO

        file = BytesIO(b"content")
        file.name = "test.txt"
        response = admin_client.post(
            self.get_url(brand.id), {"file": file}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Unsupported file format" in response.data["error"]

    def test_bulk_import_missing_columns(self, admin_client, brand):
        """Test bulk import fails with missing required columns."""
        from io import BytesIO

        csv_content = b"name,city\nStore 1,Austin"
        file = BytesIO(csv_content)
        file.name = "test.csv"
        response = admin_client.post(
            self.get_url(brand.id), {"file": file}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing required columns" in response.data["error"]

    def test_bulk_import_dry_run(self, admin_client, brand):
        """Test bulk import dry run."""
        from io import BytesIO

        csv_content = (
            b"brand_slug,store_number,name,city,state\n"
            b"test-brand,NEW001,New Store,Austin,TX"
        )
        file = BytesIO(csv_content)
        file.name = "test.csv"
        response = admin_client.post(
            self.get_url(brand.id),
            {"file": file, "dry_run": "true"},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["dry_run"] is True
        # Location should not be created during dry run
        assert not Location.objects.filter(store_number="NEW001").exists()

    def test_bulk_import_viewer_forbidden(self, viewer_client, brand):
        """Test viewer cannot perform bulk import."""
        from io import BytesIO

        csv_content = b"brand_slug,store_number,name\ntest-brand,X01,Store"
        file = BytesIO(csv_content)
        file.name = "test.csv"
        response = viewer_client.post(
            self.get_url(brand.id), {"file": file}, format="multipart"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
