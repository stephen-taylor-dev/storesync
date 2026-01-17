from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return request.user and request.user.role == "admin"


class IsBrandManager(permissions.BasePermission):
    """Allow access to brand managers and above."""

    def has_permission(self, request, view):
        return request.user and request.user.role in ["admin", "brand_manager"]


class IsLocationManager(permissions.BasePermission):
    """Allow access to location managers and above."""

    def has_permission(self, request, view):
        return request.user and request.user.role in [
            "admin",
            "brand_manager",
            "location_manager",
        ]


class HasBrandAccess(permissions.BasePermission):
    """Check if user has access to the brand."""

    def has_permission(self, request, view):
        # Admins have access to all brands
        if request.user.role == "admin":
            return True

        # For nested views, check brand_id from URL
        brand_id = view.kwargs.get("brand_id") or view.kwargs.get("pk")
        if brand_id:
            return request.user.brands.filter(id=brand_id).exists()

        return True

    def has_object_permission(self, request, view, obj):
        # Admins have access to all objects
        if request.user.role == "admin":
            return True

        # Get the brand from the object
        brand = getattr(obj, "brand", None) or obj
        return request.user.brands.filter(id=brand.id).exists()


class ReadOnlyOrAdmin(permissions.BasePermission):
    """Allow read-only access to all, write access to admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.role == "admin"


class BrandAccessMixin:
    """Mixin to filter querysets by user's brand access."""

    def get_brand_queryset(self, queryset):
        """Filter queryset to only include user's accessible brands."""
        user = self.request.user
        if user.role == "admin":
            return queryset
        return queryset.filter(id__in=user.brands.all())

    def get_location_queryset(self, queryset):
        """Filter queryset to only include locations from user's brands."""
        user = self.request.user
        if user.role == "admin":
            return queryset
        return queryset.filter(brand__in=user.brands.all())
