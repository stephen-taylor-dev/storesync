from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    ChangePasswordSerializer,
    UserManagementSerializer,
    UserPreferencesSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""

    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "User registered successfully.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CurrentUserView(APIView):
    """Get or update current authenticated user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user details."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """Update current user profile."""
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Change password for current user."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


class UserViewSet(viewsets.ModelViewSet):
    """Admin viewset for managing users."""

    queryset = User.objects.all().prefetch_related("brands")
    serializer_class = UserManagementSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "first_name", "last_name"]
    filterset_fields = ["role", "is_active"]
    ordering_fields = ["username", "date_joined", "role"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        """Return all users for admins."""
        return super().get_queryset()

    def perform_destroy(self, instance):
        """Prevent self-deletion."""
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "You cannot delete your own account."})
        super().perform_destroy(instance)


class UserPreferencesView(APIView):
    """Get or update current user preferences."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get current user preferences."""
        return Response(request.user.preferences)

    def patch(self, request):
        """Update current user preferences (partial update)."""
        serializer = UserPreferencesSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Deep merge with existing preferences
        current_prefs = request.user.preferences.copy()
        for key, value in serializer.validated_data.items():
            if key in current_prefs and isinstance(current_prefs[key], dict):
                current_prefs[key].update(value)
            else:
                current_prefs[key] = value

        request.user.preferences = current_prefs
        request.user.save(update_fields=["preferences"])

        return Response(request.user.preferences)
