"""
Tests for Campaign services (ContentGeneratorService, SimilaritySearchService).
"""

import pytest
from unittest.mock import MagicMock, patch

from apps.campaigns.services.content_generator import ContentGeneratorService


@pytest.mark.django_db
class TestContentGeneratorService:
    """Tests for ContentGeneratorService."""

    def test_build_context(self, draft_campaign):
        """Test building context from campaign."""
        service = ContentGeneratorService()
        context = service.build_context(draft_campaign)

        assert context["brand_name"] == "Test Brand"
        assert context["brand_slug"] == "test-brand"
        assert context["location_name"] == "Downtown Store"
        assert context["store_number"] == "001"
        assert context["city"] == "Austin"
        assert context["state"] == "TX"
        assert context["full_address"] == "123 Main St, Austin, TX, 78701"
        # Customizations should be in context
        assert context["discount_percentage"] == 25
        # Location attributes should be in context
        assert context["region"] == "southwest"

    def test_render_template_success(self):
        """Test successful template rendering."""
        service = ContentGeneratorService()
        template = "Hello {{name}}! Welcome to {{city}}."
        context = {"name": "John", "city": "Austin"}

        result = service.render_template(template, context)
        assert result == "Hello John! Welcome to Austin."

    def test_render_template_syntax_error(self):
        """Test template with syntax error raises ValueError."""
        service = ContentGeneratorService()
        template = "Hello {{name"  # Missing closing braces

        with pytest.raises(ValueError) as exc_info:
            service.render_template(template, {"name": "John"})
        assert "Invalid template syntax" in str(exc_info.value)

    def test_render_template_missing_variable_renders_empty(self):
        """Test template with missing variable renders empty (Jinja2 default)."""
        service = ContentGeneratorService()
        # By default, Jinja2 renders undefined variables as empty strings
        template = "Hello {{name}}! Your order is {{order_id}}."
        context = {"name": "John"}  # Missing order_id

        # Jinja2 default behavior: undefined renders as empty
        result = service.render_template(template, context)
        assert "Hello John!" in result
        assert "Your order is ." in result

    def test_render_template_safe_missing_variable(self):
        """Test safe rendering with missing variables."""
        service = ContentGeneratorService()
        template = "Hello {{name}}! Your order is {{order_id}}."
        context = {"name": "John"}  # Missing order_id

        result = service.render_template_safe(template, context)
        assert "Hello John!" in result
        # Missing variable should be empty string
        assert "Your order is ." in result

    def test_render_template_safe_syntax_error(self):
        """Test safe rendering still raises on syntax errors."""
        service = ContentGeneratorService()
        template = "Hello {{name"  # Missing closing braces

        with pytest.raises(ValueError):
            service.render_template_safe(template, {"name": "John"})

    def test_validate_template_valid(self):
        """Test validating a valid template."""
        service = ContentGeneratorService()
        template = "{{location_name}} has a {{discount_percentage}}% sale!"

        result = service.validate_template(template)
        assert result["valid"] is True
        assert "location_name" in result["variables"]
        assert "discount_percentage" in result["variables"]
        assert result["error"] is None

    def test_validate_template_invalid(self):
        """Test validating an invalid template."""
        service = ContentGeneratorService()
        template = "{{location_name} is invalid"  # Missing closing brace

        result = service.validate_template(template)
        assert result["valid"] is False
        assert result["variables"] == []
        assert result["error"] is not None

    def test_preview_content_with_sample(self):
        """Test previewing content with sample context."""
        service = ContentGeneratorService()
        template = "{{brand_name}} - {{location_name}} in {{city}}"

        result = service.preview_content(template)
        assert result == "Sample Brand - Downtown Store in Austin"

    def test_preview_content_custom_context(self):
        """Test previewing content with custom context."""
        service = ContentGeneratorService()
        template = "{{name}} at {{place}}"
        context = {"name": "Custom", "place": "Location"}

        result = service.preview_content(template, context)
        assert result == "Custom at Location"

    def test_generate_content_without_ai(self, draft_campaign):
        """Test content generation without AI (template only)."""
        service = ContentGeneratorService()

        # Disable AI by passing use_ai=False
        content = service.generate_content(draft_campaign, use_ai=False)

        assert "Downtown Store" in content

    def test_generate_content_no_api_key_falls_back(self, draft_campaign):
        """Test content generation falls back to template when no API key."""
        service = ContentGeneratorService()
        service.openai_api_key = None  # Ensure no API key

        content = service.generate_content(draft_campaign, use_ai=True)

        # Should fall back to template rendering
        assert "Downtown Store" in content

    def test_generate_with_ai_mocked(self, draft_campaign):
        """Test AI content generation with mocked LLM."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        # Mock the LLM
        mock_response = MagicMock()
        mock_response.content = "Generated marketing content for the summer sale!"

        with patch.object(service, "_llm", mock_response):
            service._llm = MagicMock()
            service._llm.invoke.return_value = mock_response

            # Also mock _get_rag_context to return empty
            with patch.object(service, "_get_rag_context", return_value=("", "")):
                content = service.generate_with_ai(draft_campaign, use_rag=False)

        assert content == "Generated marketing content for the summer sale!"

    def test_generate_embedding_mocked(self):
        """Test embedding generation with mocked embeddings client."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        mock_embedding = [0.1] * 1536  # 1536-dimensional vector
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.return_value = mock_embedding
        service._embeddings = mock_embeddings

        embedding = service.generate_embedding("Test content")

        assert len(embedding) == 1536
        assert embedding[0] == 0.1

    def test_generate_embedding_no_api_key(self):
        """Test embedding generation fails without API key."""
        service = ContentGeneratorService()
        service.openai_api_key = None

        with pytest.raises(ValueError) as exc_info:
            service.generate_embedding("Test content")
        assert "OPENAI_API_KEY" in str(exc_info.value)

    def test_generate_and_embed(self, draft_campaign):
        """Test generating content and embedding together."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        mock_embedding = [0.1] * 1536
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.return_value = mock_embedding
        service._embeddings = mock_embeddings

        content, embedding = service.generate_and_embed(
            draft_campaign, use_ai=False
        )

        assert "Downtown Store" in content
        assert len(embedding) == 1536


@pytest.mark.django_db
class TestContentGeneratorServiceRAG:
    """Tests for RAG functionality in ContentGeneratorService."""

    def test_get_rag_context_mocked(self, draft_campaign):
        """Test RAG context retrieval with mocked search service."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        mock_similar = [
            {
                "brand": "Test Brand",
                "location": "Another Store",
                "content": "Previous successful campaign content",
            }
        ]

        with patch(
            "apps.campaigns.services.similarity_search.SimilaritySearchService"
        ) as MockSearchService:
            mock_search = MockSearchService.return_value
            mock_search.get_rag_context.return_value = mock_similar

            rag_context, rag_instruction = service._get_rag_context(draft_campaign)

        assert "Previous successful campaign content" in rag_context
        assert rag_instruction != ""

    def test_get_rag_context_empty(self, draft_campaign):
        """Test RAG context when no similar campaigns found."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        with patch(
            "apps.campaigns.services.similarity_search.SimilaritySearchService"
        ) as MockSearchService:
            mock_search = MockSearchService.return_value
            mock_search.get_rag_context.return_value = []

            rag_context, rag_instruction = service._get_rag_context(draft_campaign)

        assert rag_context == ""
        assert rag_instruction == ""

    def test_get_rag_context_error_handling(self, draft_campaign):
        """Test RAG context gracefully handles errors."""
        service = ContentGeneratorService()
        service.openai_api_key = "test-key"

        with patch(
            "apps.campaigns.services.similarity_search.SimilaritySearchService"
        ) as MockSearchService:
            MockSearchService.side_effect = Exception("Database error")

            # Should not raise, should return empty
            rag_context, rag_instruction = service._get_rag_context(draft_campaign)

        assert rag_context == ""
        assert rag_instruction == ""


@pytest.mark.django_db
class TestContentGeneratorIntegration:
    """Integration tests for content generation flow."""

    def test_full_template_rendering_flow(self, draft_campaign, campaign_template):
        """Test complete template rendering flow."""
        service = ContentGeneratorService()

        # Update template to use all available context
        campaign_template.content_template = (
            "{{brand_name}} - {{location_name}} in {{city}}, {{state}}. "
            "Sale: {{discount_percentage}}% off!"
        )
        campaign_template.save()

        context = service.build_context(draft_campaign)
        content = service.render_template(
            campaign_template.content_template, context
        )

        assert "Test Brand" in content
        assert "Downtown Store" in content
        assert "Austin" in content
        assert "TX" in content
        assert "25%" in content

    def test_template_with_nested_attributes(self, draft_campaign, location):
        """Test template rendering with nested location attributes."""
        service = ContentGeneratorService()

        template = "Region: {{region}}, Size: {{square_footage}} sq ft"
        context = service.build_context(draft_campaign)
        content = service.render_template(template, context)

        assert "southwest" in content
        assert "5000" in content

    def test_template_variable_extraction(self):
        """Test extracting variables from complex templates."""
        service = ContentGeneratorService()

        template = """
        Welcome to {{location_name}}!
        {% if discount_percentage %}
        Get {{discount_percentage}}% off on {{sale_type}}!
        {% endif %}
        Visit us at {{full_address}}.
        """

        result = service.validate_template(template)
        assert result["valid"] is True
        assert "location_name" in result["variables"]
        assert "discount_percentage" in result["variables"]
        assert "sale_type" in result["variables"]
        assert "full_address" in result["variables"]


@pytest.mark.django_db
class TestSimilaritySearchService:
    """Tests for SimilaritySearchService."""

    def test_generate_embedding(self):
        """Test embedding generation."""
        from apps.campaigns.services.similarity_search import SimilaritySearchService

        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.return_value = [0.1] * 1536

        with patch.object(SimilaritySearchService, "__init__", lambda x: None):
            service = SimilaritySearchService()
            service._embeddings = mock_embeddings
            service.openai_api_key = "test-key"

            embedding = service.generate_embedding("Test text")

        assert len(embedding) == 1536

    def test_similar_campaign_dataclass(self):
        """Test SimilarCampaign dataclass."""
        from apps.campaigns.services.similarity_search import SimilarCampaign

        campaign = SimilarCampaign(
            campaign_id="123",
            location_name="Test Location",
            template_name="Test Template",
            brand_name="Test Brand",
            content_preview="Preview content...",
            distance=0.2,
            similarity_score=0.8,
        )

        assert campaign.campaign_id == "123"
        assert campaign.similarity_score == 0.8
        assert campaign.distance == 0.2
