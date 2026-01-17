from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views

urlpatterns = [
    # JWT token endpoints
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # User endpoints
    path("register/", views.RegisterView.as_view(), name="register"),
    path("me/", views.CurrentUserView.as_view(), name="current_user"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change_password"),
]
