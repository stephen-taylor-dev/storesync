from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import Brand, Location
from .resources import BrandResource, LocationResource


@admin.register(Brand)
class BrandAdmin(ImportExportModelAdmin):
    resource_class = BrandResource
    list_display = ["name", "slug", "location_count", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["id", "created_at", "updated_at"]

    def location_count(self, obj):
        return obj.locations.count()

    location_count.short_description = "Locations"


@admin.register(Location)
class LocationAdmin(ImportExportModelAdmin):
    resource_class = LocationResource
    list_display = ["name", "store_number", "brand", "city", "state", "is_active"]
    list_filter = ["brand", "is_active", "created_at"]
    search_fields = ["name", "store_number", "address"]
    readonly_fields = ["id", "created_at", "updated_at"]
    autocomplete_fields = ["brand"]

    def city(self, obj):
        return obj.address.get("city", "")

    city.short_description = "City"

    def state(self, obj):
        return obj.address.get("state", "")

    state.short_description = "State"
