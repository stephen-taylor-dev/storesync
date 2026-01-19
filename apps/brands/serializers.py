from rest_framework import serializers

from .models import Brand, Location


class BrandListSerializer(serializers.ModelSerializer):
    """Serializer for brand list view."""

    location_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Brand
        fields = [
            "id",
            "name",
            "slug",
            "logo",
            "location_count",
            "created_at",
        ]


class BrandDetailSerializer(serializers.ModelSerializer):
    """Serializer for brand detail view."""

    location_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            "id",
            "name",
            "slug",
            "logo",
            "settings",
            "location_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_location_count(self, obj):
        return obj.locations.count()


class BrandCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating brands."""

    class Meta:
        model = Brand
        fields = [
            "name",
            "slug",
            "logo",
            "settings",
        ]


class LocationListSerializer(serializers.ModelSerializer):
    """Serializer for location list view."""

    brand_name = serializers.CharField(source="brand.name", read_only=True)
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "store_number",
            "city",
            "state",
            "is_active",
            "created_at",
        ]

    def get_city(self, obj):
        return obj.address.get("city", "")

    def get_state(self, obj):
        return obj.address.get("state", "")


class AllLocationsListSerializer(serializers.ModelSerializer):
    """Serializer for listing all locations across brands."""

    brand_name = serializers.CharField(source="brand.name", read_only=True)
    full_address = serializers.CharField(read_only=True)
    campaign_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Location
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "store_number",
            "address",
            "full_address",
            "is_active",
            "campaign_count",
            "created_at",
        ]


class LocationDetailSerializer(serializers.ModelSerializer):
    """Serializer for location detail view."""

    brand_name = serializers.CharField(source="brand.name", read_only=True)
    full_address = serializers.CharField(read_only=True)
    campaign_count = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "store_number",
            "address",
            "full_address",
            "attributes",
            "is_active",
            "campaign_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "brand", "created_at", "updated_at"]

    def get_campaign_count(self, obj):
        return obj.campaigns.count()


class LocationCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating locations."""

    class Meta:
        model = Location
        fields = [
            "name",
            "store_number",
            "address",
            "attributes",
            "is_active",
        ]

    def validate_store_number(self, value):
        """Validate store number is unique within brand."""
        brand = self.context.get("brand")
        instance = self.instance

        if brand:
            queryset = Location.objects.filter(brand=brand, store_number=value)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    "A location with this store number already exists for this brand."
                )
        return value
