import json

from import_export import fields, resources
from import_export.widgets import ForeignKeyWidget, JSONWidget

from .models import Brand, Location


class LocationResource(resources.ModelResource):
    """Resource for importing/exporting locations via django-import-export."""

    brand = fields.Field(
        column_name="brand_slug",
        attribute="brand",
        widget=ForeignKeyWidget(Brand, field="slug"),
    )

    # Flatten address fields for easier spreadsheet editing
    street = fields.Field(column_name="street", attribute=None)
    city = fields.Field(column_name="city", attribute=None)
    state = fields.Field(column_name="state", attribute=None)
    zip_code = fields.Field(column_name="zip_code", attribute=None)

    # JSON attributes as string for import
    attributes_json = fields.Field(
        column_name="attributes",
        attribute="attributes",
        widget=JSONWidget(),
    )

    class Meta:
        model = Location
        import_id_fields = ["brand", "store_number"]
        fields = [
            "brand",
            "store_number",
            "name",
            "street",
            "city",
            "state",
            "zip_code",
            "attributes_json",
            "is_active",
        ]
        export_order = fields
        skip_unchanged = True
        report_skipped = True

    def before_import_row(self, row, row_number=None, **kwargs):
        """Normalize and validate row data before import."""
        # Strip whitespace from all string fields
        for key, value in row.items():
            if isinstance(value, str):
                row[key] = value.strip()

        # Convert is_active to boolean if it's a string
        is_active = row.get("is_active", "true")
        if isinstance(is_active, str):
            row["is_active"] = is_active.lower() in ["true", "yes", "1", "active"]

    def dehydrate_street(self, location):
        """Export street from address JSON."""
        return location.address.get("street", "")

    def dehydrate_city(self, location):
        """Export city from address JSON."""
        return location.address.get("city", "")

    def dehydrate_state(self, location):
        """Export state from address JSON."""
        return location.address.get("state", "")

    def dehydrate_zip_code(self, location):
        """Export zip from address JSON."""
        return location.address.get("zip", "")

    def before_save_instance(self, instance, row, **kwargs):
        """Build address JSON from flat fields before saving."""
        instance.address = {
            "street": row.get("street", ""),
            "city": row.get("city", ""),
            "state": row.get("state", ""),
            "zip": row.get("zip_code", ""),
        }

        # Handle attributes - if it's a string, try to parse as JSON
        attributes = row.get("attributes", {})
        if isinstance(attributes, str):
            try:
                instance.attributes = json.loads(attributes) if attributes else {}
            except json.JSONDecodeError:
                instance.attributes = {}
        elif attributes is None:
            instance.attributes = {}

    def get_instance(self, instance_loader, row):
        """Get existing instance by brand + store_number composite key."""
        try:
            brand_slug = row.get("brand_slug")
            store_number = row.get("store_number")
            if brand_slug and store_number:
                brand = Brand.objects.get(slug=brand_slug)
                return Location.objects.get(brand=brand, store_number=store_number)
        except (Brand.DoesNotExist, Location.DoesNotExist):
            pass
        return None


class BrandResource(resources.ModelResource):
    """Resource for importing/exporting brands."""

    class Meta:
        model = Brand
        import_id_fields = ["slug"]
        fields = ["name", "slug", "settings"]
        skip_unchanged = True
