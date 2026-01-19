"""
Similarity search service using pgvector for semantic campaign search.

This service enables:
- Finding similar campaigns based on content embeddings
- Semantic search across campaign content
- RAG context retrieval for content generation
"""

import logging
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db.models import F, Value
from django.db.models.functions import Coalesce
from langchain_openai import OpenAIEmbeddings
from pgvector.django import CosineDistance

logger = logging.getLogger(__name__)


@dataclass
class SimilarCampaign:
    """Represents a similar campaign result with distance score."""

    campaign_id: str
    location_name: str
    template_name: str
    brand_name: str
    content_preview: str
    distance: float
    similarity_score: float  # 1 - distance for cosine

    def to_dict(self) -> dict[str, Any]:
        return {
            "campaign_id": self.campaign_id,
            "location_name": self.location_name,
            "template_name": self.template_name,
            "brand_name": self.brand_name,
            "content_preview": self.content_preview,
            "distance": self.distance,
            "similarity_score": self.similarity_score,
        }


class SimilaritySearchService:
    """
    Service for semantic similarity search using pgvector.

    Uses OpenAI embeddings and pgvector's vector similarity functions
    to find campaigns with similar content.
    """

    # Minimum similarity threshold (cosine similarity)
    DEFAULT_SIMILARITY_THRESHOLD = 0.7

    # Maximum content preview length
    CONTENT_PREVIEW_LENGTH = 200

    def __init__(self):
        """Initialize the similarity search service."""
        self.openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        self._embeddings = None

    @property
    def embeddings(self) -> OpenAIEmbeddings:
        """Lazy initialization of the embeddings client."""
        if self._embeddings is None:
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is not configured")
            self._embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=self.openai_api_key,
            )
        return self._embeddings

    def generate_embedding(self, text: str) -> list[float]:
        """
        Generate an embedding vector for the given text.

        Args:
            text: Text content to embed

        Returns:
            List of floats (1536 dimensions for text-embedding-3-small)
        """
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty text")

        try:
            embedding = self.embeddings.embed_query(text)
            return embedding
        except Exception as e:
            logger.exception(f"Failed to generate embedding: {e}")
            raise

    def find_similar_campaigns(
        self,
        query_embedding: list[float],
        limit: int = 10,
        similarity_threshold: float | None = None,
        exclude_campaign_ids: list[str] | None = None,
        brand_id: str | None = None,
        status_filter: list[str] | None = None,
    ) -> list[SimilarCampaign]:
        """
        Find campaigns similar to the query embedding.

        Args:
            query_embedding: Vector embedding to search against
            limit: Maximum number of results to return
            similarity_threshold: Minimum similarity score (0-1)
            exclude_campaign_ids: Campaign IDs to exclude from results
            brand_id: Filter to specific brand
            status_filter: Filter to specific statuses

        Returns:
            List of SimilarCampaign objects sorted by similarity
        """
        from apps.campaigns.models import LocationCampaign

        if similarity_threshold is None:
            similarity_threshold = self.DEFAULT_SIMILARITY_THRESHOLD

        # Build queryset with filters
        queryset = LocationCampaign.objects.select_related(
            "location", "location__brand", "template"
        ).filter(
            content_embedding__isnull=False,
        )

        # Apply optional filters
        if exclude_campaign_ids:
            queryset = queryset.exclude(id__in=exclude_campaign_ids)

        if brand_id:
            queryset = queryset.filter(location__brand_id=brand_id)

        if status_filter:
            queryset = queryset.filter(status__in=status_filter)

        # Annotate with cosine distance
        # CosineDistance returns distance (0 = identical, 2 = opposite)
        # We want similarity, so we'll calculate it as 1 - (distance/2)
        queryset = queryset.annotate(
            distance=CosineDistance("content_embedding", query_embedding)
        ).order_by("distance")

        # Filter by threshold (convert similarity to distance)
        # For cosine: distance = 1 - similarity for normalized vectors
        # Actually cosine distance in pgvector is: 1 - cosine_similarity
        # So distance < (1 - threshold) means similarity > threshold
        max_distance = 1 - similarity_threshold
        queryset = queryset.filter(distance__lte=max_distance)

        # Limit results
        queryset = queryset[:limit]

        # Build result objects
        results = []
        for campaign in queryset:
            content_preview = (campaign.generated_content or "")[:self.CONTENT_PREVIEW_LENGTH]
            if len(campaign.generated_content or "") > self.CONTENT_PREVIEW_LENGTH:
                content_preview += "..."

            results.append(SimilarCampaign(
                campaign_id=str(campaign.id),
                location_name=campaign.location.name,
                template_name=campaign.template.name,
                brand_name=campaign.location.brand.name,
                content_preview=content_preview,
                distance=campaign.distance,
                similarity_score=1 - campaign.distance,
            ))

        return results

    def find_similar_by_text(
        self,
        query_text: str,
        limit: int = 10,
        similarity_threshold: float | None = None,
        exclude_campaign_ids: list[str] | None = None,
        brand_id: str | None = None,
        status_filter: list[str] | None = None,
    ) -> list[SimilarCampaign]:
        """
        Find campaigns similar to the given text query.

        Generates an embedding for the query text and searches.

        Args:
            query_text: Text to search for similar campaigns
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score
            exclude_campaign_ids: Campaign IDs to exclude
            brand_id: Filter to specific brand
            status_filter: Filter to specific statuses

        Returns:
            List of SimilarCampaign objects
        """
        embedding = self.generate_embedding(query_text)
        return self.find_similar_campaigns(
            query_embedding=embedding,
            limit=limit,
            similarity_threshold=similarity_threshold,
            exclude_campaign_ids=exclude_campaign_ids,
            brand_id=brand_id,
            status_filter=status_filter,
        )

    def find_similar_to_campaign(
        self,
        campaign_id: str,
        limit: int = 10,
        similarity_threshold: float | None = None,
        same_brand_only: bool = False,
        status_filter: list[str] | None = None,
    ) -> list[SimilarCampaign]:
        """
        Find campaigns similar to a specific campaign.

        Args:
            campaign_id: ID of the reference campaign
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score
            same_brand_only: If True, only return campaigns from same brand
            status_filter: Filter to specific statuses

        Returns:
            List of SimilarCampaign objects (excludes the reference campaign)
        """
        from apps.campaigns.models import LocationCampaign

        try:
            campaign = LocationCampaign.objects.select_related(
                "location__brand"
            ).get(id=campaign_id)
        except LocationCampaign.DoesNotExist:
            logger.error(f"Campaign {campaign_id} not found")
            return []

        if campaign.content_embedding is None:
            logger.warning(f"Campaign {campaign_id} has no embedding")
            return []

        brand_id = str(campaign.location.brand_id) if same_brand_only else None

        return self.find_similar_campaigns(
            query_embedding=list(campaign.content_embedding),
            limit=limit,
            similarity_threshold=similarity_threshold,
            exclude_campaign_ids=[campaign_id],
            brand_id=brand_id,
            status_filter=status_filter,
        )

    def get_rag_context(
        self,
        campaign,
        max_examples: int = 3,
        similarity_threshold: float = 0.6,
    ) -> list[dict[str, Any]]:
        """
        Get similar campaign content for RAG context.

        Used to provide examples of similar successful campaigns
        to improve AI content generation.

        Args:
            campaign: LocationCampaign instance to find context for
            max_examples: Maximum number of examples to return
            similarity_threshold: Minimum similarity for inclusion

        Returns:
            List of dicts with campaign content and metadata
        """
        # Build a query from campaign context
        context_parts = [
            f"Brand: {campaign.location.brand.name}",
            f"Location: {campaign.location.name}",
            f"Template: {campaign.template.name}",
            f"Campaign type: {campaign.template.campaign_type}",
        ]

        # Add customizations to context
        for key, value in campaign.customizations.items():
            context_parts.append(f"{key}: {value}")

        query_text = "\n".join(context_parts)

        try:
            similar = self.find_similar_by_text(
                query_text=query_text,
                limit=max_examples,
                similarity_threshold=similarity_threshold,
                exclude_campaign_ids=[str(campaign.id)],
                # Prefer same brand for more relevant examples
                brand_id=str(campaign.location.brand_id),
                # Only use completed/active campaigns as examples
                status_filter=["completed", "active"],
            )

            # If not enough examples from same brand, search across all brands
            if len(similar) < max_examples:
                additional = self.find_similar_by_text(
                    query_text=query_text,
                    limit=max_examples - len(similar),
                    similarity_threshold=similarity_threshold,
                    exclude_campaign_ids=[str(campaign.id)] + [s.campaign_id for s in similar],
                    status_filter=["completed", "active"],
                )
                similar.extend(additional)

            return [
                {
                    "campaign_id": s.campaign_id,
                    "brand": s.brand_name,
                    "location": s.location_name,
                    "template": s.template_name,
                    "content": s.content_preview,
                    "similarity": s.similarity_score,
                }
                for s in similar
            ]

        except Exception as e:
            logger.warning(f"Failed to get RAG context: {e}")
            return []

    def compute_embedding_for_campaign(self, campaign) -> list[float] | None:
        """
        Compute and store embedding for a campaign.

        Args:
            campaign: LocationCampaign instance

        Returns:
            The generated embedding, or None if failed
        """
        if not campaign.generated_content:
            logger.warning(f"Campaign {campaign.id} has no content to embed")
            return None

        try:
            embedding = self.generate_embedding(campaign.generated_content)
            campaign.content_embedding = embedding
            campaign.save(update_fields=["content_embedding", "updated_at"])
            logger.info(f"Computed embedding for campaign {campaign.id}")
            return embedding
        except Exception as e:
            logger.exception(f"Failed to compute embedding for campaign {campaign.id}: {e}")
            return None

    def bulk_compute_embeddings(
        self,
        campaign_ids: list[str] | None = None,
        recompute: bool = False,
    ) -> dict[str, Any]:
        """
        Compute embeddings for multiple campaigns.

        Args:
            campaign_ids: Specific campaign IDs to process (None = all)
            recompute: If True, recompute even if embedding exists

        Returns:
            Dict with success/failure counts
        """
        from apps.campaigns.models import LocationCampaign

        queryset = LocationCampaign.objects.filter(
            generated_content__isnull=False,
        ).exclude(generated_content="")

        if campaign_ids:
            queryset = queryset.filter(id__in=campaign_ids)

        if not recompute:
            queryset = queryset.filter(content_embedding__isnull=True)

        success_count = 0
        failure_count = 0

        for campaign in queryset:
            try:
                embedding = self.generate_embedding(campaign.generated_content)
                campaign.content_embedding = embedding
                campaign.save(update_fields=["content_embedding", "updated_at"])
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to embed campaign {campaign.id}: {e}")
                failure_count += 1

        return {
            "success": success_count,
            "failed": failure_count,
            "total": success_count + failure_count,
        }
