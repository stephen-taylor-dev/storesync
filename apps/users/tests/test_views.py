"""
Tests for User API views.
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestRegisterView:
    """Tests for user registration endpoint."""

    url = "/api/v1/auth/register/"

    def test_register_success(self, api_client):
        """Test successful user registration."""
        data = {
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "securepass123",
            "password_confirm": "securepass123",
            "first_name": "New",
            "last_name": "User",
        }
        response = api_client.post(self.url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["message"] == "User registered successfully."
        assert response.data["user"]["username"] == "newuser"
        assert User.objects.filter(username="newuser").exists()

    def test_register_password_mismatch(self, api_client):
        """Test registration fails with password mismatch."""
        data = {
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "securepass123",
            "password_confirm": "differentpass",
        }
        response = api_client.post(self.url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_duplicate_username(self, api_client, admin_user):
        """Test registration fails with duplicate username."""
        data = {
            "username": "admin",  # Already exists
            "email": "new@test.com",
            "password": "securepass123",
            "password_confirm": "securepass123",
        }
        response = api_client.post(self.url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_fields(self, api_client):
        """Test registration fails with missing required fields."""
        data = {"username": "newuser"}
        response = api_client.post(self.url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCurrentUserView:
    """Tests for current user endpoint."""

    url = "/api/v1/auth/me/"

    def test_get_current_user(self, admin_client, admin_user):
        """Test getting current user details."""
        response = admin_client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == admin_user.username
        assert response.data["email"] == admin_user.email
        assert response.data["role"] == admin_user.role

    def test_get_current_user_unauthenticated(self, api_client):
        """Test unauthenticated access is denied."""
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_current_user(self, admin_client, admin_user):
        """Test updating current user profile."""
        data = {"first_name": "Updated", "last_name": "Name"}
        response = admin_client.patch(self.url, data)
        assert response.status_code == status.HTTP_200_OK
        admin_user.refresh_from_db()
        assert admin_user.first_name == "Updated"
        assert admin_user.last_name == "Name"

    def test_update_current_user_email(self, admin_client, admin_user):
        """Test updating user email."""
        data = {"email": "newemail@test.com"}
        response = admin_client.patch(self.url, data)
        assert response.status_code == status.HTTP_200_OK
        admin_user.refresh_from_db()
        assert admin_user.email == "newemail@test.com"


@pytest.mark.django_db
class TestChangePasswordView:
    """Tests for password change endpoint."""

    url = "/api/v1/auth/change-password/"

    def test_change_password_success(self, admin_client, admin_user):
        """Test successful password change."""
        data = {
            "old_password": "adminpass123",
            "new_password": "newsecurepass123",
            "new_password_confirm": "newsecurepass123",
        }
        response = admin_client.post(self.url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["message"] == "Password changed successfully."
        admin_user.refresh_from_db()
        assert admin_user.check_password("newsecurepass123")

    def test_change_password_wrong_old(self, admin_client):
        """Test password change fails with wrong old password."""
        data = {
            "old_password": "wrongpassword",
            "new_password": "newsecurepass123",
            "new_password_confirm": "newsecurepass123",
        }
        response = admin_client.post(self.url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_weak_password(self, admin_client):
        """Test password change fails with weak password."""
        data = {
            "old_password": "adminpass123",
            "new_password": "123",  # Too weak
        }
        response = admin_client.post(self.url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_unauthenticated(self, api_client):
        """Test unauthenticated access is denied."""
        data = {
            "old_password": "pass",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123",
        }
        response = api_client.post(self.url, data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTokenAuth:
    """Tests for JWT token authentication."""

    token_url = "/api/v1/auth/token/"
    refresh_url = "/api/v1/auth/token/refresh/"

    def test_obtain_token(self, api_client, admin_user):
        """Test obtaining JWT token with valid credentials."""
        data = {"username": "admin", "password": "adminpass123"}
        response = api_client.post(self.token_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data

    def test_obtain_token_invalid_credentials(self, api_client, admin_user):
        """Test token request fails with invalid credentials."""
        data = {"username": "admin", "password": "wrongpassword"}
        response = api_client.post(self.token_url, data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token(self, api_client, admin_user):
        """Test refreshing JWT token."""
        # First get tokens
        data = {"username": "admin", "password": "adminpass123"}
        response = api_client.post(self.token_url, data)
        refresh_token = response.data["refresh"]

        # Then refresh
        response = api_client.post(self.refresh_url, {"refresh": refresh_token})
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_refresh_token_invalid(self, api_client):
        """Test refresh fails with invalid token."""
        response = api_client.post(self.refresh_url, {"refresh": "invalidtoken"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
