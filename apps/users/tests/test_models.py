"""
Tests for User model.
"""

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Tests for the User model."""

    def test_create_user(self):
        """Test creating a basic user."""
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.check_password("testpass123")
        assert user.role == User.Role.VIEWER  # Default role
        assert user.is_active
        assert not user.is_staff
        assert not user.is_superuser

    def test_create_superuser(self):
        """Test creating a superuser."""
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123",
        )
        assert user.is_staff
        assert user.is_superuser
        assert user.is_active

    def test_user_roles(self):
        """Test that all role choices are valid."""
        assert User.Role.ADMIN == "admin"
        assert User.Role.BRAND_MANAGER == "brand_manager"
        assert User.Role.LOCATION_MANAGER == "location_manager"
        assert User.Role.VIEWER == "viewer"

    def test_user_role_assignment(self, admin_user):
        """Test user role assignment."""
        assert admin_user.role == User.Role.ADMIN

    def test_user_brands_relationship(self, brand_manager_user, brand):
        """Test user-brand many-to-many relationship."""
        assert brand in brand_manager_user.brands.all()
        assert brand_manager_user in brand.users.all()

    def test_user_multiple_brands(self, db, brand, brand_two):
        """Test user can be assigned to multiple brands."""
        user = User.objects.create_user(
            username="multiuser",
            email="multi@test.com",
            password="pass123",
        )
        user.brands.add(brand, brand_two)
        assert user.brands.count() == 2

    def test_user_timestamps(self, admin_user):
        """Test that created_at and updated_at are set."""
        assert admin_user.created_at is not None
        assert admin_user.updated_at is not None

    def test_user_str_representation(self, admin_user):
        """Test user string representation."""
        assert str(admin_user) == "admin"
