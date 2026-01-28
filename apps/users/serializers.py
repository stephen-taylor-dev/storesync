from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.brands.models import Brand

User = get_user_model()


class NotificationPreferencesSerializer(serializers.Serializer):
    """Serializer for notification preferences."""

    email_campaign_submitted = serializers.BooleanField(default=True)
    email_campaign_approved = serializers.BooleanField(default=True)
    email_campaign_rejected = serializers.BooleanField(default=True)


class DisplayPreferencesSerializer(serializers.Serializer):
    """Serializer for display preferences."""

    theme = serializers.ChoiceField(
        choices=["light", "dark", "system"],
        default="system",
    )


class UserPreferencesSerializer(serializers.Serializer):
    """Serializer for user preferences."""

    notifications = NotificationPreferencesSerializer(required=False)
    display = DisplayPreferencesSerializer(required=False)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details."""

    brands = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "brands",
            "preferences",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined", "preferences"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email"]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""

    old_password = serializers.CharField(
        required=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


class BrandMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for brand data in user management."""

    class Meta:
        model = Brand
        fields = ["id", "name"]


class UserManagementSerializer(serializers.ModelSerializer):
    """Serializer for admin user management."""

    brands = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Brand.objects.all(),
        required=False,
    )
    brands_detail = BrandMinimalSerializer(source="brands", many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "brands",
            "brands_detail",
            "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "username", "date_joined"]

    def validate_email(self, value):
        """Ensure email is unique (excluding current user on update)."""
        if value:
            qs = User.objects.filter(email=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A user with this email already exists.")
        return value
