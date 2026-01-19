from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"", views.BrandViewSet, basename="brand")

# Nested router for locations under brands
location_router = DefaultRouter()
location_router.register(r"", views.LocationViewSet, basename="location")

# Router for all locations (not nested under brands)
all_locations_router = DefaultRouter()
all_locations_router.register(r"", views.AllLocationsViewSet, basename="all-locations")

urlpatterns = [
    # Brand routes: /api/v1/brands/
    path("", include(router.urls)),
    # Nested location routes: /api/v1/brands/{brand_id}/locations/
    path("<uuid:brand_id>/locations/", include(location_router.urls)),
]

# Export for use in main urls.py
all_locations_urlpatterns = all_locations_router.urls
