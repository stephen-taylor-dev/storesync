from django.contrib import admin
from django_fsm import can_proceed

from .models import ApprovalStep, CampaignTemplate, LocationCampaign


class ApprovalStepInline(admin.TabularInline):
    model = ApprovalStep
    extra = 0
    readonly_fields = ["approver", "decision", "comments", "previous_status", "new_status", "created_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(CampaignTemplate)
class CampaignTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "brand", "campaign_type", "is_active", "created_at"]
    list_filter = ["brand", "campaign_type", "is_active"]
    search_fields = ["name", "description", "content_template"]
    readonly_fields = ["id", "created_at", "updated_at"]
    autocomplete_fields = ["brand"]

    fieldsets = (
        (None, {
            "fields": ("brand", "name", "description", "campaign_type", "is_active")
        }),
        ("Template Content", {
            "fields": ("content_template", "required_variables"),
            "classes": ("wide",),
        }),
        ("Metadata", {
            "fields": ("id", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


@admin.register(LocationCampaign)
class LocationCampaignAdmin(admin.ModelAdmin):
    list_display = ["__str__", "status", "created_by", "scheduled_start", "created_at"]
    list_filter = ["status", "template__brand", "created_at"]
    search_fields = ["location__name", "template__name", "generated_content"]
    readonly_fields = ["id", "status", "created_at", "updated_at"]
    autocomplete_fields = ["location", "template", "created_by"]
    inlines = [ApprovalStepInline]

    fieldsets = (
        (None, {
            "fields": ("location", "template", "created_by", "status")
        }),
        ("Content", {
            "fields": ("customizations", "generated_content"),
            "classes": ("wide",),
        }),
        ("Scheduling", {
            "fields": ("scheduled_start", "scheduled_end"),
        }),
        ("Metadata", {
            "fields": ("id", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    actions = ["submit_for_review", "approve_campaigns", "reject_campaigns"]

    @admin.action(description="Submit selected campaigns for review")
    def submit_for_review(self, request, queryset):
        count = 0
        for campaign in queryset:
            if can_proceed(campaign.submit_for_review):
                campaign.submit_for_review()
                campaign.save()
                count += 1
        self.message_user(request, f"{count} campaign(s) submitted for review.")

    @admin.action(description="Approve selected campaigns")
    def approve_campaigns(self, request, queryset):
        count = 0
        for campaign in queryset:
            if can_proceed(campaign.approve):
                campaign.approve()
                campaign.save()
                count += 1
        self.message_user(request, f"{count} campaign(s) approved.")

    @admin.action(description="Reject selected campaigns")
    def reject_campaigns(self, request, queryset):
        count = 0
        for campaign in queryset:
            if can_proceed(campaign.reject):
                campaign.reject()
                campaign.save()
                count += 1
        self.message_user(request, f"{count} campaign(s) rejected.")


@admin.register(ApprovalStep)
class ApprovalStepAdmin(admin.ModelAdmin):
    list_display = ["campaign", "approver", "decision", "created_at"]
    list_filter = ["decision", "created_at"]
    search_fields = ["campaign__location__name", "approver__username", "comments"]
    readonly_fields = ["id", "campaign", "approver", "decision", "comments",
                       "previous_status", "new_status", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
