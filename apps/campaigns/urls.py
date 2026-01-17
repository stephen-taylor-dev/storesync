from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"templates", views.CampaignTemplateViewSet, basename="campaign-template")
router.register(r"", views.LocationCampaignViewSet, basename="location-campaign")

urlpatterns = [
    path("", include(router.urls)),
]
