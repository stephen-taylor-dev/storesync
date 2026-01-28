"""
URL configuration for StoreSync project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.brands.urls import all_locations_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1
    path(
        "api/v1/",
        include(
            [
                path("auth/", include("apps.users.urls")),
                path("users/", include("apps.users.management_urls")),
                path("brands/", include("apps.brands.urls")),
                path("locations/", include(all_locations_urlpatterns)),
                path("campaigns/", include("apps.campaigns.urls")),
            ]
        ),
    ),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
