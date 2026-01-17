import io
import tablib
from django.db import transaction
from django.db.models import Count
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from import_export.results import RowResult
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.core.pagination import SmallPagination, StandardPagination
from apps.core.permissions import BrandAccessMixin, HasBrandAccess, IsBrandManager

from .models import Brand, Location
from .resources import LocationResource
from .serializers import (
    BrandCreateUpdateSerializer,
    BrandDetailSerializer,
    BrandListSerializer,
    LocationCreateUpdateSerializer,
    LocationDetailSerializer,
    LocationListSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List brands",
        description="Returns a paginated list of brands the authenticated user has access to.",
        tags=["brands"],
    ),
    retrieve=extend_schema(
        summary="Get brand details",
        description="Returns detailed information about a specific brand.",
        tags=["brands"],
    ),
    create=extend_schema(
        summary="Create brand",
        description="Creates a new brand. Requires brand_manager or admin role.",
        tags=["brands"],
    ),
    update=extend_schema(
        summary="Update brand",
        description="Updates all fields of an existing brand.",
        tags=["brands"],
    ),
    partial_update=extend_schema(
        summary="Partial update brand",
        description="Updates specific fields of an existing brand.",
        tags=["brands"],
    ),
    destroy=extend_schema(
        summary="Delete brand",
        description="Deletes a brand and all associated data.",
        tags=["brands"],
    ),
)
class BrandViewSet(BrandAccessMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing retail brands.

    Brands are the top-level organizational unit in StoreSync.
    Users can only access brands they are assigned to, unless they are admins.
    """

    permission_classes = [permissions.IsAuthenticated, HasBrandAccess]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Brand.objects.annotate(location_count=Count("locations"))
        return self.get_brand_queryset(queryset)

    def get_serializer_class(self):
        if self.action == "list":
            return BrandListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return BrandCreateUpdateSerializer
        return BrandDetailSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsBrandManager()]
        return super().get_permissions()


@extend_schema_view(
    list=extend_schema(
        summary="List locations",
        description="Returns a paginated list of locations for a specific brand.",
        tags=["locations"],
    ),
    retrieve=extend_schema(
        summary="Get location details",
        description="Returns detailed information about a specific location.",
        tags=["locations"],
    ),
    create=extend_schema(
        summary="Create location",
        description="Creates a new location under a brand. Requires brand_manager or admin role.",
        tags=["locations"],
    ),
    update=extend_schema(
        summary="Update location",
        description="Updates all fields of an existing location.",
        tags=["locations"],
    ),
    partial_update=extend_schema(
        summary="Partial update location",
        description="Updates specific fields of an existing location.",
        tags=["locations"],
    ),
    destroy=extend_schema(
        summary="Delete location",
        description="Deletes a location and all associated campaigns.",
        tags=["locations"],
    ),
)
class LocationViewSet(BrandAccessMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing physical store locations.

    Locations belong to brands and store address, attributes, and campaign data.
    Nested under brands: /api/v1/brands/{brand_id}/locations/
    """

    permission_classes = [permissions.IsAuthenticated, HasBrandAccess]
    pagination_class = SmallPagination

    def get_queryset(self):
        brand_id = self.kwargs.get("brand_id")
        queryset = Location.objects.select_related("brand")

        if brand_id:
            queryset = queryset.filter(brand_id=brand_id)

        # Apply additional filters
        queryset = self.get_location_queryset(queryset)

        # Filter by active status if provided
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Search by name or store number
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                name__icontains=search
            ) | queryset.filter(store_number__icontains=search)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return LocationListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return LocationCreateUpdateSerializer
        return LocationDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        brand_id = self.kwargs.get("brand_id")
        if brand_id:
            try:
                context["brand"] = Brand.objects.get(id=brand_id)
            except Brand.DoesNotExist:
                pass
        return context

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "bulk_import"]:
            return [permissions.IsAuthenticated(), IsBrandManager()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        brand_id = self.kwargs.get("brand_id")
        try:
            brand = Brand.objects.get(id=brand_id)
        except Brand.DoesNotExist:
            return Response(
                {"error": "Brand not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(brand=brand)

        # Return detail serializer for response
        detail_serializer = LocationDetailSerializer(serializer.instance)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Bulk import locations",
        description="""
Import multiple locations from a spreadsheet file (CSV, XLSX, or XLS).

**Required columns:**
- `brand_slug`: The brand's slug identifier
- `store_number`: Unique store identifier within the brand
- `name`: Location name

**Optional columns:**
- `street`: Street address
- `city`: City name
- `state`: State/province code
- `zip_code`: Postal code
- `attributes`: JSON string of location attributes
- `is_active`: true/false (default: true)

**Response includes:**
- `created`: Number of new locations created
- `updated`: Number of existing locations updated
- `skipped`: Number of unchanged rows skipped
- `errors`: List of row-level validation errors
        """,
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "file": {"type": "string", "format": "binary"},
                    "dry_run": {"type": "boolean", "default": False},
                },
                "required": ["file"],
            }
        },
        responses={
            200: {
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "dry_run": {"type": "boolean"},
                    "totals": {
                        "type": "object",
                        "properties": {
                            "created": {"type": "integer"},
                            "updated": {"type": "integer"},
                            "skipped": {"type": "integer"},
                            "error": {"type": "integer"},
                        },
                    },
                    "errors": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "row": {"type": "integer"},
                                "error": {"type": "string"},
                            },
                        },
                    },
                },
            }
        },
        tags=["locations"],
    )
    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser])
    def bulk_import(self, request, brand_id=None):
        """Import locations from uploaded spreadsheet file."""
        if "file" not in request.FILES:
            return Response(
                {"error": "No file provided. Please upload a CSV or Excel file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES["file"]
        dry_run = request.data.get("dry_run", "false").lower() == "true"

        # Determine file format
        filename = uploaded_file.name.lower()
        if filename.endswith(".csv"):
            file_format = "csv"
        elif filename.endswith(".xlsx"):
            file_format = "xlsx"
        elif filename.endswith(".xls"):
            file_format = "xls"
        else:
            return Response(
                {"error": "Unsupported file format. Please use CSV, XLSX, or XLS."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Read file content
        try:
            file_content = uploaded_file.read()
            if file_format == "csv":
                dataset = tablib.Dataset().load(
                    file_content.decode("utf-8"), format="csv"
                )
            else:
                dataset = tablib.Dataset().load(file_content, format=file_format)
        except Exception as e:
            return Response(
                {"error": f"Failed to parse file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate required columns
        required_columns = ["brand_slug", "store_number", "name"]
        missing_columns = [col for col in required_columns if col not in dataset.headers]
        if missing_columns:
            return Response(
                {"error": f"Missing required columns: {', '.join(missing_columns)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If brand_id is provided, filter/validate against that brand
        if brand_id:
            try:
                brand = Brand.objects.get(id=brand_id)
                # Optionally enforce that all rows match this brand
                # For now, just validate access
                if request.user.role != "admin":
                    if not request.user.brands.filter(id=brand_id).exists():
                        return Response(
                            {"error": "You do not have access to this brand."},
                            status=status.HTTP_403_FORBIDDEN,
                        )
            except Brand.DoesNotExist:
                return Response(
                    {"error": "Brand not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Perform import
        resource = LocationResource()

        try:
            with transaction.atomic():
                result = resource.import_data(
                    dataset,
                    dry_run=dry_run,
                    raise_errors=False,
                    user=request.user,
                )

                # Collect errors
                errors = []
                for row_idx, row_result in enumerate(result.rows, start=2):  # Start at 2 (header is row 1)
                    if row_result.errors:
                        for error in row_result.errors:
                            errors.append({
                                "row": row_idx,
                                "error": str(error.error),
                            })
                    elif row_result.validation_error:
                        errors.append({
                            "row": row_idx,
                            "error": str(row_result.validation_error),
                        })

                # Count results by type
                totals = {
                    "created": sum(1 for r in result.rows if r.import_type == RowResult.IMPORT_TYPE_NEW),
                    "updated": sum(1 for r in result.rows if r.import_type == RowResult.IMPORT_TYPE_UPDATE),
                    "skipped": sum(1 for r in result.rows if r.import_type == RowResult.IMPORT_TYPE_SKIP),
                    "error": sum(1 for r in result.rows if r.import_type == RowResult.IMPORT_TYPE_ERROR),
                }

                # If dry_run, rollback
                if dry_run:
                    transaction.set_rollback(True)

        except Exception as e:
            return Response(
                {"error": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            "success": len(errors) == 0,
            "dry_run": dry_run,
            "totals": totals,
            "errors": errors[:50],  # Limit errors to first 50
            "message": (
                f"Dry run complete. {totals['created']} would be created, {totals['updated']} updated."
                if dry_run
                else f"Import complete. {totals['created']} created, {totals['updated']} updated."
            ),
        })

    @extend_schema(
        summary="Download import template",
        description="Download a sample CSV template for bulk location import.",
        responses={
            200: {
                "type": "string",
                "format": "binary",
            }
        },
        tags=["locations"],
    )
    @action(detail=False, methods=["get"])
    def import_template(self, request, brand_id=None):
        """Download a sample import template."""
        from django.http import HttpResponse

        # Create sample data
        headers = [
            "brand_slug",
            "store_number",
            "name",
            "street",
            "city",
            "state",
            "zip_code",
            "attributes",
            "is_active",
        ]

        sample_rows = [
            [
                "test-brand",
                "001",
                "Downtown Store",
                "123 Main St",
                "Austin",
                "TX",
                "78701",
                '{"region": "southwest", "square_footage": 5000}',
                "true",
            ],
            [
                "test-brand",
                "002",
                "Mall Location",
                "456 Shopping Blvd",
                "Dallas",
                "TX",
                "75201",
                '{"region": "north", "square_footage": 3500}',
                "true",
            ],
        ]

        dataset = tablib.Dataset(*sample_rows, headers=headers)

        response = HttpResponse(
            dataset.export("csv"),
            content_type="text/csv",
        )
        response["Content-Disposition"] = 'attachment; filename="location_import_template.csv"'
        return response
