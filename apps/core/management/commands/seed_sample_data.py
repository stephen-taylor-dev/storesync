"""
Management command to seed sample data for testing.

Creates:
- AcmeMart brand with 50 store locations
- 8 campaign templates
- Sample campaigns for testing AI features

Usage:
    python manage.py seed_sample_data
    python manage.py seed_sample_data --clear  # Clear existing data first
"""

import csv
import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.brands.models import Brand, Location
from apps.campaigns.models import CampaignTemplate, LocationCampaign

User = get_user_model()

SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "sample_data"


class Command(BaseCommand):
    help = "Seed database with sample AcmeMart data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing sample data before seeding",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.clear_data()

        with transaction.atomic():
            brand = self.create_brand()
            locations = self.create_locations(brand)
            templates = self.create_templates(brand)
            self.create_sample_campaigns(locations, templates)

        self.stdout.write(self.style.SUCCESS("Sample data seeded successfully!"))

    def clear_data(self):
        """Clear existing AcmeMart data."""
        self.stdout.write("Clearing existing AcmeMart data...")

        brand = Brand.objects.filter(slug="acmemart").first()
        if brand:
            # This will cascade delete locations, campaigns, etc.
            brand.delete()
            self.stdout.write(self.style.WARNING("Cleared existing AcmeMart data"))

    def create_brand(self):
        """Create the AcmeMart brand."""
        self.stdout.write("Creating AcmeMart brand...")

        brand, created = Brand.objects.get_or_create(
            slug="acmemart",
            defaults={
                "name": "AcmeMart",
                "settings": {
                    "primary_color": "#2563eb",
                    "tagline": "Your Neighborhood Store",
                    "founded": 1985,
                    "headquarters": "Austin, TX",
                },
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created brand: {brand.name}"))
        else:
            self.stdout.write(f"Brand already exists: {brand.name}")

        return brand

    def create_locations(self, brand):
        """Create store locations from CSV."""
        self.stdout.write("Creating store locations...")

        csv_path = SAMPLE_DATA_DIR / "acmemart_locations.csv"
        if not csv_path.exists():
            self.stdout.write(self.style.ERROR(f"CSV file not found: {csv_path}"))
            return []

        locations = []
        created_count = 0

        with open(csv_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                location, created = Location.objects.get_or_create(
                    brand=brand,
                    store_number=row["store_number"],
                    defaults={
                        "name": row["name"],
                        "address": {
                            "street": row["street"],
                            "city": row["city"],
                            "state": row["state"],
                            "zip": row["zip"],
                        },
                        "attributes": {
                            "region": row["region"],
                            "square_footage": int(row["square_footage"]),
                            "has_pharmacy": row["has_pharmacy"].lower() == "true",
                            "has_gas_station": row["has_gas_station"].lower() == "true",
                            "store_type": row["store_type"],
                        },
                        "is_active": row["is_active"].lower() == "true",
                    },
                )
                locations.append(location)
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} locations (total: {len(locations)})"))
        return locations

    def create_templates(self, brand):
        """Create campaign templates from JSON."""
        self.stdout.write("Creating campaign templates...")

        json_path = SAMPLE_DATA_DIR / "acmemart_templates.json"
        if not json_path.exists():
            self.stdout.write(self.style.ERROR(f"JSON file not found: {json_path}"))
            return []

        with open(json_path, "r") as f:
            template_data = json.load(f)

        templates = []
        created_count = 0

        for data in template_data:
            template, created = CampaignTemplate.objects.get_or_create(
                brand=brand,
                name=data["name"],
                defaults={
                    "description": data["description"],
                    "campaign_type": data["campaign_type"],
                    "content_template": data["content_template"],
                    "required_variables": data["required_variables"],
                    "is_active": True,
                },
            )
            templates.append(template)
            if created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} templates (total: {len(templates)})"))
        return templates

    def create_sample_campaigns(self, locations, templates):
        """Create sample campaigns for testing."""
        self.stdout.write("Creating sample campaigns...")

        if not locations or not templates:
            self.stdout.write(self.style.WARNING("No locations or templates, skipping campaign creation"))
            return

        # Get or create a test user for campaign ownership
        user, _ = User.objects.get_or_create(
            username="campaign_admin",
            defaults={
                "email": "campaigns@acmemart.test",
                "role": "brand_manager",
                "is_staff": False,
            },
        )

        # Sample campaign configurations
        sample_campaigns = [
            {
                "location_filter": {"attributes__store_type": "flagship"},
                "template_type": "seasonal_sale",
                "customizations": {
                    "discount_percentage": "40",
                    "sale_end_date": "August 31st",
                },
            },
            {
                "location_filter": {"attributes__has_pharmacy": True},
                "template_type": "pharmacy",
                "customizations": {
                    "service_highlight": "FREE Flu Shots - No appointment needed!",
                    "appointment_info": "Walk-ins welcome or call (555) 123-4567",
                },
            },
            {
                "location_filter": {"attributes__has_gas_station": True},
                "template_type": "fuel_promo",
                "customizations": {
                    "cents_off": "10",
                    "reward_details": "Use your AcmeMart Rewards card and save an extra 5¢/gallon!",
                },
            },
            {
                "location_filter": {"attributes__region": "southwest"},
                "template_type": "weekly_deals",
                "customizations": {
                    "deal_highlight": "Fresh Texas Beef - $4.99/lb (Reg. $7.99)",
                    "valid_dates": "This Friday through Sunday",
                },
            },
        ]

        created_count = 0
        for config in sample_campaigns:
            template = next(
                (t for t in templates if t.campaign_type == config["template_type"]),
                None,
            )
            if not template:
                continue

            filtered_locations = Location.objects.filter(
                brand=locations[0].brand,
                **config["location_filter"],
            )[:5]  # Limit to 5 locations per campaign type

            for location in filtered_locations:
                campaign, created = LocationCampaign.objects.get_or_create(
                    location=location,
                    template=template,
                    defaults={
                        "created_by": user,
                        "customizations": config["customizations"],
                        "status": "draft",
                    },
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} sample campaigns"))
