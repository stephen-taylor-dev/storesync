"""
Pytest configuration and fixtures for StoreSync tests.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.brands.models import Brand, Location
from apps.campaigns.models import ApprovalStep, CampaignTemplate, LocationCampaign


User = get_user_model()


# =============================================================================
# User Fixtures
# =============================================================================


@pytest.fixture
def api_client():
    """Return an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def admin_user(db):
    """Create and return an admin user."""
    user = User.objects.create_user(
        username="admin",
        email="admin@test.com",
        password="adminpass123",
        role=User.Role.ADMIN,
        first_name="Admin",
        last_name="User",
    )
    return user


@pytest.fixture
def brand_manager_user(db, brand):
    """Create and return a brand manager user with brand access."""
    user = User.objects.create_user(
        username="brandmanager",
        email="brandmanager@test.com",
        password="bmpass123",
        role=User.Role.BRAND_MANAGER,
        first_name="Brand",
        last_name="Manager",
    )
    user.brands.add(brand)
    return user


@pytest.fixture
def location_manager_user(db, brand):
    """Create and return a location manager user with brand access."""
    user = User.objects.create_user(
        username="locationmanager",
        email="locationmanager@test.com",
        password="lmpass123",
        role=User.Role.LOCATION_MANAGER,
        first_name="Location",
        last_name="Manager",
    )
    user.brands.add(brand)
    return user


@pytest.fixture
def viewer_user(db, brand):
    """Create and return a viewer user with brand access."""
    user = User.objects.create_user(
        username="viewer",
        email="viewer@test.com",
        password="viewerpass123",
        role=User.Role.VIEWER,
        first_name="Viewer",
        last_name="User",
    )
    user.brands.add(brand)
    return user


@pytest.fixture
def user_without_brand(db):
    """Create and return a user without brand access."""
    user = User.objects.create_user(
        username="nobrand",
        email="nobrand@test.com",
        password="nobrandpass123",
        role=User.Role.VIEWER,
    )
    return user


# =============================================================================
# Authenticated Client Fixtures
# =============================================================================


def get_authenticated_client(user):
    """Helper to create an authenticated API client."""
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def admin_client(admin_user):
    """Return an API client authenticated as admin."""
    return get_authenticated_client(admin_user)


@pytest.fixture
def brand_manager_client(brand_manager_user):
    """Return an API client authenticated as brand manager."""
    return get_authenticated_client(brand_manager_user)


@pytest.fixture
def location_manager_client(location_manager_user):
    """Return an API client authenticated as location manager."""
    return get_authenticated_client(location_manager_user)


@pytest.fixture
def viewer_client(viewer_user):
    """Return an API client authenticated as viewer."""
    return get_authenticated_client(viewer_user)


# =============================================================================
# Brand Fixtures
# =============================================================================


@pytest.fixture
def brand(db):
    """Create and return a test brand."""
    return Brand.objects.create(
        name="Test Brand",
        slug="test-brand",
        settings={"default_region": "southwest"},
    )


@pytest.fixture
def brand_two(db):
    """Create and return a second test brand."""
    return Brand.objects.create(
        name="Second Brand",
        slug="second-brand",
        settings={},
    )


# =============================================================================
# Location Fixtures
# =============================================================================


@pytest.fixture
def location(db, brand):
    """Create and return a test location."""
    return Location.objects.create(
        brand=brand,
        name="Downtown Store",
        store_number="001",
        address={
            "street": "123 Main St",
            "city": "Austin",
            "state": "TX",
            "zip": "78701",
        },
        attributes={
            "region": "southwest",
            "square_footage": 5000,
            "has_gas_station": False,
        },
        is_active=True,
    )


@pytest.fixture
def location_two(db, brand):
    """Create and return a second test location."""
    return Location.objects.create(
        brand=brand,
        name="Mall Location",
        store_number="002",
        address={
            "street": "456 Shopping Blvd",
            "city": "Dallas",
            "state": "TX",
            "zip": "75201",
        },
        attributes={
            "region": "north",
            "square_footage": 3500,
            "has_gas_station": True,
        },
        is_active=True,
    )


@pytest.fixture
def inactive_location(db, brand):
    """Create and return an inactive location."""
    return Location.objects.create(
        brand=brand,
        name="Closed Store",
        store_number="999",
        address={
            "street": "789 Old Road",
            "city": "Houston",
            "state": "TX",
            "zip": "77001",
        },
        attributes={"region": "southeast"},
        is_active=False,
    )


# =============================================================================
# Campaign Template Fixtures
# =============================================================================


@pytest.fixture
def campaign_template(db, brand):
    """Create and return a test campaign template."""
    return CampaignTemplate.objects.create(
        brand=brand,
        name="Summer Sale Template",
        description="Template for summer sales campaigns",
        content_template=(
            "🌞 {{location_name}} Summer Sale! "
            "Get {{discount_percentage}}% off at our {{city}} location. "
            "Visit us at {{full_address}}!"
        ),
        required_variables=["discount_percentage"],
        campaign_type="seasonal_sale",
        is_active=True,
    )


@pytest.fixture
def campaign_template_two(db, brand):
    """Create and return a second campaign template."""
    return CampaignTemplate.objects.create(
        brand=brand,
        name="Grand Opening Template",
        description="Template for grand opening events",
        content_template=(
            "🎉 Grand Opening! {{location_name}} is now open! "
            "Join us on {{opening_date}} for exclusive deals."
        ),
        required_variables=["opening_date"],
        campaign_type="grand_opening",
        is_active=True,
    )


@pytest.fixture
def inactive_template(db, brand):
    """Create and return an inactive campaign template."""
    return CampaignTemplate.objects.create(
        brand=brand,
        name="Old Template",
        description="Deprecated template",
        content_template="Old content: {{location_name}}",
        required_variables=[],
        campaign_type="clearance",
        is_active=False,
    )


# =============================================================================
# Location Campaign Fixtures
# =============================================================================


@pytest.fixture
def draft_campaign(db, location, campaign_template, admin_user):
    """Create and return a draft campaign."""
    return LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 25},
        generated_content="",
    )


@pytest.fixture
def pending_campaign(db, location, campaign_template, admin_user):
    """Create and return a pending review campaign."""
    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 30},
        generated_content="Summer Sale at Downtown Store!",
    )
    campaign.submit_for_review()
    campaign.save()
    return campaign


@pytest.fixture
def approved_campaign(db, location, campaign_template, admin_user):
    """Create and return an approved campaign."""
    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 35},
        generated_content="Approved campaign content",
    )
    campaign.submit_for_review()
    campaign.approve()
    campaign.save()
    return campaign


@pytest.fixture
def rejected_campaign(db, location, campaign_template, admin_user):
    """Create and return a rejected campaign."""
    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 15},
        generated_content="Rejected content",
    )
    campaign.submit_for_review()
    campaign.reject()
    campaign.save()
    return campaign


@pytest.fixture
def scheduled_campaign(db, location, campaign_template, admin_user):
    """Create and return a scheduled campaign."""
    from django.utils import timezone
    from datetime import timedelta

    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 40},
        generated_content="Scheduled campaign content",
        scheduled_start=timezone.now() + timedelta(days=1),
        scheduled_end=timezone.now() + timedelta(days=7),
    )
    campaign.submit_for_review()
    campaign.approve()
    campaign.schedule()
    campaign.save()
    return campaign


@pytest.fixture
def active_campaign(db, location, campaign_template, admin_user):
    """Create and return an active campaign."""
    from django.utils import timezone
    from datetime import timedelta

    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 50},
        generated_content="Active campaign content",
        scheduled_start=timezone.now() - timedelta(days=1),
        scheduled_end=timezone.now() + timedelta(days=6),
    )
    campaign.submit_for_review()
    campaign.approve()
    campaign.schedule()
    campaign.activate()
    campaign.save()
    return campaign


@pytest.fixture
def completed_campaign(db, location, campaign_template, admin_user):
    """Create and return a completed campaign."""
    from django.utils import timezone
    from datetime import timedelta

    campaign = LocationCampaign.objects.create(
        location=location,
        template=campaign_template,
        created_by=admin_user,
        status=LocationCampaign.Status.DRAFT,
        customizations={"discount_percentage": 20},
        generated_content="Completed campaign content",
        scheduled_start=timezone.now() - timedelta(days=14),
        scheduled_end=timezone.now() - timedelta(days=7),
    )
    campaign.submit_for_review()
    campaign.approve()
    campaign.schedule()
    campaign.activate()
    campaign.complete()
    campaign.save()
    return campaign


# =============================================================================
# Approval Step Fixture
# =============================================================================


@pytest.fixture
def approval_step(db, pending_campaign, admin_user):
    """Create and return an approval step."""
    return ApprovalStep.objects.create(
        campaign=pending_campaign,
        approver=admin_user,
        decision=ApprovalStep.Decision.SUBMITTED,
        comments="Submitting for review",
        previous_status=LocationCampaign.Status.DRAFT,
        new_status=LocationCampaign.Status.PENDING_REVIEW,
    )
