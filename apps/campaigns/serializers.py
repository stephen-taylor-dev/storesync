from rest_framework import serializers

from .models import ApprovalStep, CampaignTemplate, LocationCampaign


class CampaignTemplateListSerializer(serializers.ModelSerializer):
    """Serializer for campaign template list view."""

    brand_name = serializers.CharField(source="brand.name", read_only=True)
    campaign_count = serializers.SerializerMethodField()

    class Meta:
        model = CampaignTemplate
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "campaign_type",
            "is_active",
            "campaign_count",
            "created_at",
        ]

    def get_campaign_count(self, obj):
        return obj.location_campaigns.count()


class CampaignTemplateDetailSerializer(serializers.ModelSerializer):
    """Serializer for campaign template detail view."""

    brand_name = serializers.CharField(source="brand.name", read_only=True)
    campaign_count = serializers.SerializerMethodField()

    class Meta:
        model = CampaignTemplate
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "description",
            "content_template",
            "required_variables",
            "campaign_type",
            "is_active",
            "campaign_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_campaign_count(self, obj):
        return obj.location_campaigns.count()


class CampaignTemplateCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating campaign templates."""

    class Meta:
        model = CampaignTemplate
        fields = [
            "brand",
            "name",
            "description",
            "content_template",
            "required_variables",
            "campaign_type",
            "is_active",
        ]

    def validate_required_variables(self, value):
        """Ensure required_variables is a list of strings."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Required variables must be a list.")
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError(
                    "Each required variable must be a string."
                )
        return value


class ApprovalStepSerializer(serializers.ModelSerializer):
    """Serializer for approval step details."""

    approver_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalStep
        fields = [
            "id",
            "approver",
            "approver_name",
            "decision",
            "comments",
            "previous_status",
            "new_status",
            "created_at",
        ]
        read_only_fields = ["id", "previous_status", "new_status", "created_at"]

    def get_approver_name(self, obj):
        if obj.approver:
            return obj.approver.get_full_name() or obj.approver.username
        return None


class LocationCampaignListSerializer(serializers.ModelSerializer):
    """Serializer for location campaign list view."""

    location_name = serializers.CharField(source="location.name", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    brand_name = serializers.CharField(source="location.brand.name", read_only=True)

    class Meta:
        model = LocationCampaign
        fields = [
            "id",
            "location",
            "location_name",
            "template",
            "template_name",
            "brand_name",
            "status",
            "scheduled_start",
            "scheduled_end",
            "created_at",
        ]


class LocationCampaignDetailSerializer(serializers.ModelSerializer):
    """Serializer for location campaign detail view."""

    location_name = serializers.CharField(source="location.name", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    brand = serializers.CharField(source="location.brand.id", read_only=True)
    brand_name = serializers.CharField(source="location.brand.name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    approval_history = ApprovalStepSerializer(
        source="approval_steps", many=True, read_only=True
    )

    class Meta:
        model = LocationCampaign
        fields = [
            "id",
            "location",
            "location_name",
            "template",
            "template_name",
            "brand",
            "brand_name",
            "created_by",
            "created_by_name",
            "status",
            "customizations",
            "generated_content",
            "scheduled_start",
            "scheduled_end",
            "approval_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "generated_content",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class LocationCampaignCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating location campaigns."""

    class Meta:
        model = LocationCampaign
        fields = [
            "id",
            "location",
            "template",
            "customizations",
            "scheduled_start",
            "scheduled_end",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        """Validate that location and template belong to the same brand."""
        location = attrs.get("location") or self.instance.location
        template = attrs.get("template") or self.instance.template

        if location and template and location.brand_id != template.brand_id:
            raise serializers.ValidationError(
                "Location and template must belong to the same brand."
            )
        return attrs


class CampaignActionSerializer(serializers.Serializer):
    """Serializer for campaign workflow actions."""

    comments = serializers.CharField(required=False, allow_blank=True, default="")


class CampaignRejectSerializer(serializers.Serializer):
    """Serializer for campaign rejection (comments required)."""

    comments = serializers.CharField(required=True, min_length=1)

    def validate_comments(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comments are required for rejection.")
        return value
