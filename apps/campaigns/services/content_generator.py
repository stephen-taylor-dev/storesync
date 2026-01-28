"""
Content generation service using LangChain and OpenAI.

This service handles:
- Jinja2 template rendering with location/campaign context
- AI-powered content generation using LangChain
- Vector embeddings for semantic search
"""

import logging
from typing import Any

from django.conf import settings
from jinja2 import BaseLoader, Environment, TemplateSyntaxError, UndefinedError
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

logger = logging.getLogger(__name__)


class ContentGeneratorService:
    """
    Service for generating campaign content using templates and AI.

    Supports two modes:
    1. Template-only: Renders Jinja2 templates with variable substitution
    2. AI-enhanced: Uses LLM to generate creative content based on template and context
    """

    # System prompt for AI content generation
    SYSTEM_PROMPT = """You are a marketing content specialist for retail brands.
Your task is to generate compelling marketing content for brand campaigns.

Guidelines:
- Write in a professional yet engaging tone
- IMPORTANT: Use the BRAND NAME (not location/city name) in headlines and calls-to-action
  Example: "Save Big at QuickFuel!" NOT "Save Big at Fort Worth!"
- Location details (address, city) should only appear in the "Visit us" or contact section
- Keep content concise and action-oriented
- Follow brand voice guidelines if provided
- Do not include placeholder text or variables in the output
- Generate ready-to-use marketing copy

Output only the final marketing content, no explanations or meta-commentary."""

    GENERATION_PROMPT = """Generate marketing content for the following campaign:

Brand: {brand_name}
Campaign Type: {campaign_type}
Location: {location_name} (Store #{store_number})
Address: {full_address}

Campaign Template:
{template_content}

Location Attributes:
{location_attributes}

Campaign Customizations:
{customizations}
{rag_context}
Based on the template and context above, generate polished marketing content that:
1. Uses the BRAND NAME "{brand_name}" in headlines and promotional text (NOT the city/location name)
2. Follows the structure suggested by the template
3. Only includes location address in a "Visit us at" or directions section
4. Is ready for immediate use in marketing materials
{rag_instruction}
Generated Content:"""

    RAG_CONTEXT_TEMPLATE = """
Examples of Similar Successful Campaigns:
{examples}
"""

    RAG_INSTRUCTION = (
        """4. Learn from the similar campaign examples to match the successful style and tone"""
    )

    def __init__(self):
        """Initialize the content generator with LangChain components."""
        self.openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        self._llm = None
        self._embeddings = None
        self._jinja_env = Environment(loader=BaseLoader())

    @property
    def llm(self) -> ChatOpenAI:
        """Lazy initialization of the LLM client."""
        if self._llm is None:
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is not configured")
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.7,
                max_tokens=1000,
                openai_api_key=self.openai_api_key,
            )
        return self._llm

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

    def build_context(self, campaign) -> dict[str, Any]:
        """
        Build the context dictionary for template rendering.

        Args:
            campaign: LocationCampaign instance

        Returns:
            Dictionary with all available context variables
        """
        location = campaign.location
        template = campaign.template
        brand = location.brand

        context = {
            # Brand info
            "brand_name": brand.name,
            "brand_slug": brand.slug,

            # Location info
            "location_name": location.name,
            "store_number": location.store_number,
            "full_address": location.full_address,
            "city": location.address.get("city", ""),
            "state": location.address.get("state", ""),
            "street": location.address.get("street", ""),
            "zip": location.address.get("zip", ""),

            # Template info
            "template_name": template.name,
            "campaign_type": template.campaign_type,

            # Merge location attributes
            **location.attributes,

            # Merge campaign customizations (these take precedence)
            **campaign.customizations,
        }

        return context

    def render_template(self, template_content: str, context: dict[str, Any]) -> str:
        """
        Render a Jinja2 template with the provided context.

        Args:
            template_content: Jinja2 template string
            context: Dictionary of variables to substitute

        Returns:
            Rendered template string

        Raises:
            ValueError: If template rendering fails
        """
        try:
            template = self._jinja_env.from_string(template_content)
            rendered = template.render(**context)
            return rendered.strip()
        except TemplateSyntaxError as e:
            logger.error(f"Template syntax error: {e}")
            raise ValueError(f"Invalid template syntax: {e}")
        except UndefinedError as e:
            logger.warning(f"Undefined variable in template: {e}")
            # Return partially rendered template with missing vars noted
            raise ValueError(f"Missing required variable: {e}")

    def render_template_safe(self, template_content: str, context: dict[str, Any]) -> str:
        """
        Render a template with fallback for undefined variables.

        Instead of raising errors for undefined variables, replaces them with
        empty strings or placeholder text.

        Args:
            template_content: Jinja2 template string
            context: Dictionary of variables to substitute

        Returns:
            Rendered template string (may have empty placeholders)
        """
        try:
            # Configure environment to be lenient with undefined vars
            from jinja2 import BaseLoader, Environment, Undefined

            class SilentUndefined(Undefined):
                def _fail_with_undefined_error(self, *args, **kwargs):
                    return ""

                __add__ = __radd__ = __mul__ = __rmul__ = __div__ = __rdiv__ = \
                __truediv__ = __rtruediv__ = __floordiv__ = __rfloordiv__ = \
                __mod__ = __rmod__ = __pos__ = __neg__ = __call__ = \
                __getitem__ = __lt__ = __le__ = __gt__ = __ge__ = __int__ = \
                __float__ = __complex__ = __pow__ = __rpow__ = \
                _fail_with_undefined_error

                def __str__(self):
                    return ""

                def __repr__(self):
                    return ""

                def __bool__(self):
                    return False

            safe_env = Environment(loader=BaseLoader(), undefined=SilentUndefined)
            template = safe_env.from_string(template_content)
            rendered = template.render(**context)
            return rendered.strip()
        except TemplateSyntaxError as e:
            logger.error(f"Template syntax error: {e}")
            raise ValueError(f"Invalid template syntax: {e}")

    def _get_rag_context(self, campaign) -> tuple[str, str]:
        """
        Get RAG context from similar campaigns.

        Args:
            campaign: LocationCampaign instance

        Returns:
            Tuple of (rag_context_string, rag_instruction_string)
        """
        try:
            from .similarity_search import SimilaritySearchService

            search_service = SimilaritySearchService()
            similar_campaigns = search_service.get_rag_context(
                campaign,
                max_examples=3,
                similarity_threshold=0.6,
            )

            if similar_campaigns:
                examples = []
                for i, sc in enumerate(similar_campaigns, 1):
                    examples.append(
                        f"Example {i} ({sc['brand']} - {sc['location']}):\n{sc['content']}"
                    )

                rag_context = self.RAG_CONTEXT_TEMPLATE.format(
                    examples="\n\n".join(examples)
                )
                return rag_context, self.RAG_INSTRUCTION
            else:
                return "", ""

        except Exception as e:
            logger.warning(f"Failed to get RAG context: {e}")
            return "", ""

    def generate_with_ai(
        self,
        campaign,
        context: dict[str, Any] | None = None,
        additional_instructions: str | None = None,
        use_rag: bool = True,
    ) -> str:
        """
        Generate content using AI based on the template and context.

        Uses RAG (Retrieval-Augmented Generation) to include examples
        from similar successful campaigns for better quality output.

        Args:
            campaign: LocationCampaign instance
            context: Optional pre-built context (will build if not provided)
            additional_instructions: Optional additional instructions for the AI
            use_rag: Whether to include similar campaign examples (default True)

        Returns:
            AI-generated content string

        Raises:
            ValueError: If OpenAI API is not configured
            Exception: If AI generation fails
        """
        if context is None:
            context = self.build_context(campaign)

        # Format location attributes and customizations for the prompt
        location_attrs = "\n".join(
            f"- {k}: {v}" for k, v in campaign.location.attributes.items()
        ) or "None specified"

        customizations = "\n".join(
            f"- {k}: {v}" for k, v in campaign.customizations.items()
        ) or "None specified"

        # Get RAG context from similar campaigns
        rag_context = ""
        rag_instruction = ""
        if use_rag and self.openai_api_key:
            rag_context, rag_instruction = self._get_rag_context(campaign)
            if rag_context:
                logger.info(f"Using RAG context for campaign {campaign.id}")

        # Build the generation prompt
        user_prompt = self.GENERATION_PROMPT.format(
            brand_name=context.get("brand_name", ""),
            campaign_type=context.get("campaign_type", "general"),
            location_name=context.get("location_name", ""),
            store_number=context.get("store_number", ""),
            full_address=context.get("full_address", ""),
            template_content=campaign.template.content_template,
            location_attributes=location_attrs,
            customizations=customizations,
            rag_context=rag_context,
            rag_instruction=rag_instruction,
        )

        if additional_instructions:
            user_prompt += f"\n\nAdditional Instructions: {additional_instructions}"

        try:
            messages = [
                SystemMessage(content=self.SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]

            response = self.llm.invoke(messages)
            generated_content = response.content.strip()

            logger.info(
                f"Generated AI content for campaign {campaign.id} "
                f"(with_rag={bool(rag_context)})"
            )
            return generated_content

        except Exception as e:
            logger.exception(f"AI content generation failed: {e}")
            raise

    def generate_content(
        self,
        campaign,
        use_ai: bool = True,
        additional_instructions: str | None = None,
    ) -> str:
        """
        Generate content for a campaign.

        This is the main entry point for content generation. It will:
        1. Build the context from campaign data
        2. If use_ai is True and OpenAI is configured, use AI generation
        3. Otherwise, fall back to template rendering

        Args:
            campaign: LocationCampaign instance
            use_ai: Whether to use AI generation (default True)
            additional_instructions: Optional additional AI instructions

        Returns:
            Generated content string
        """
        context = self.build_context(campaign)

        # Try AI generation if enabled and configured
        if use_ai and self.openai_api_key:
            try:
                return self.generate_with_ai(
                    campaign,
                    context=context,
                    additional_instructions=additional_instructions,
                )
            except Exception as e:
                logger.warning(f"AI generation failed, falling back to template: {e}")

        # Fall back to template rendering
        try:
            return self.render_template(
                campaign.template.content_template,
                context,
            )
        except ValueError:
            # If strict rendering fails, try safe rendering
            return self.render_template_safe(
                campaign.template.content_template,
                context,
            )

    def generate_embedding(self, content: str) -> list[float]:
        """
        Generate a vector embedding for the given content.

        Args:
            content: Text content to embed

        Returns:
            List of floats representing the embedding vector (1536 dimensions)

        Raises:
            ValueError: If OpenAI API is not configured
        """
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured for embeddings")

        try:
            embedding = self.embeddings.embed_query(content)
            return embedding
        except Exception as e:
            logger.exception(f"Embedding generation failed: {e}")
            raise

    def generate_and_embed(
        self,
        campaign,
        use_ai: bool = True,
        additional_instructions: str | None = None,
    ) -> tuple[str, list[float] | None]:
        """
        Generate content and its embedding in one call.

        Args:
            campaign: LocationCampaign instance
            use_ai: Whether to use AI generation
            additional_instructions: Optional additional AI instructions

        Returns:
            Tuple of (generated_content, embedding_vector)
            Embedding may be None if not configured or fails
        """
        content = self.generate_content(
            campaign,
            use_ai=use_ai,
            additional_instructions=additional_instructions,
        )

        embedding = None
        if self.openai_api_key:
            try:
                embedding = self.generate_embedding(content)
            except Exception as e:
                logger.warning(f"Embedding generation failed: {e}")

        return content, embedding

    def validate_template(self, template_content: str) -> dict[str, Any]:
        """
        Validate a template and extract its variables.

        Args:
            template_content: Jinja2 template string to validate

        Returns:
            Dictionary with:
                - valid: bool
                - variables: list of variable names found
                - error: error message if invalid
        """
        try:
            # Parse the template
            ast = self._jinja_env.parse(template_content)

            # Extract variable names using undeclared_variables
            from jinja2 import meta
            variables = meta.find_undeclared_variables(ast)

            return {
                "valid": True,
                "variables": sorted(list(variables)),
                "error": None,
            }
        except TemplateSyntaxError as e:
            return {
                "valid": False,
                "variables": [],
                "error": str(e),
            }

    def preview_content(
        self,
        template_content: str,
        sample_context: dict[str, Any] | None = None,
    ) -> str:
        """
        Preview how a template will render with sample data.

        Useful for template editing UI to show live preview.

        Args:
            template_content: Jinja2 template string
            sample_context: Optional sample data for preview

        Returns:
            Rendered preview string
        """
        if sample_context is None:
            sample_context = {
                "brand_name": "Sample Brand",
                "location_name": "Downtown Store",
                "store_number": "001",
                "full_address": "123 Main St, Austin, TX 78701",
                "city": "Austin",
                "state": "TX",
                "street": "123 Main St",
                "zip": "78701",
            }

        return self.render_template_safe(template_content, sample_context)

    # ========== HTML Email Generation Methods ==========

    HTML_EMAIL_SYSTEM_PROMPT = """You are an expert email marketing specialist who creates responsive HTML emails.
Your task is to convert plain text marketing content into professional HTML emails that:
- Use inline CSS for maximum email client compatibility
- Use table-based layouts for consistent rendering
- Are mobile-responsive with media queries
- Include proper email structure (preheader, header, body, footer)
- Match the visual style to the campaign type and sale theme

Guidelines:
- Always use inline styles (no external CSS)
- Use table layouts for structure, not div/flexbox
- Include alt text for any images
- Use web-safe fonts with fallbacks
- Keep the design simple and focused on the content
- Include an unsubscribe link placeholder: {{unsubscribe_link}}
- Include a recipient name placeholder: {{recipient_name}}
- Output only the complete HTML, no explanations"""

    # Campaign type to color/style mapping guidance
    CAMPAIGN_STYLE_GUIDE = """
Campaign Style Guidelines by Type:
- seasonal_sale / summer: Warm colors (orange #f97316, yellow #eab308), sunny/bright feel
- seasonal_sale / winter: Cool colors (blue #3b82f6, silver #94a3b8), cozy/festive feel
- seasonal_sale / fall: Earth tones (amber #d97706, brown #92400e), warm autumn feel
- seasonal_sale / spring: Fresh colors (green #22c55e, pink #ec4899), renewal/fresh feel
- clearance: Bold red (#dc2626) or orange (#ea580c), urgent/exciting feel
- grand_opening: Celebratory gold (#ca8a04), confetti-style, festive
- holiday: Festive reds and greens, or themed colors for specific holidays
- flash_sale: High contrast, urgent red (#ef4444), countdown feel
- loyalty / rewards: Premium purple (#7c3aed) or gold (#ca8a04), exclusive feel
- fuel / gas: Green (#16a34a) or blue (#2563eb), savings-focused
- convenience: Friendly blue (#3b82f6) or teal (#0d9488), approachable
- default: Professional blue (#2563eb) with clean modern styling
"""

    HTML_EMAIL_GENERATION_PROMPT = """Convert this marketing content into a responsive HTML email:

Brand: {brand_name}
Campaign Type: {campaign_type}
Sale/Promotion Details: {customizations}

Content:
{content}

{style_guide}

Requirements:
1. Create a complete HTML email document
2. Use inline CSS for all styling
3. Use table-based layout
4. Include mobile-responsive styles
5. Include placeholder for unsubscribe link ({{{{unsubscribe_link}}}})
6. Include placeholder for recipient name ({{{{recipient_name}}}})
7. Choose colors and styling that match the campaign type above
8. Make the call-to-action prominent and clickable
9. The design should visually convey the theme/mood of this type of sale

HTML Email:"""

    EMAIL_SUBJECT_PROMPT = """Generate a compelling email subject line for this marketing content:

Brand: {brand_name}
Campaign Type: {campaign_type}

Content:
{content}

Requirements:
- Maximum 60 characters
- Create urgency or curiosity appropriate to the campaign type
- Include the BRAND NAME (not location/city)
- No spam words or all caps
- Output only the subject line, nothing else

Subject Line:"""

    def generate_html_email(
        self,
        campaign,
        content: str | None = None,
    ) -> str:
        """
        Generate a responsive HTML email from plain text content.

        Args:
            campaign: LocationCampaign instance
            content: Optional content override (defaults to campaign.generated_content)

        Returns:
            HTML email string

        Raises:
            ValueError: If OpenAI API is not configured or no content available
        """
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured")

        content = content or campaign.generated_content
        if not content:
            raise ValueError("Campaign has no generated content")

        context = self.build_context(campaign)

        # Format customizations for the prompt
        customizations_str = ", ".join(
            f"{k}: {v}" for k, v in campaign.customizations.items()
        ) or "General promotion"

        prompt = self.HTML_EMAIL_GENERATION_PROMPT.format(
            brand_name=context.get("brand_name", ""),
            campaign_type=context.get("campaign_type", "general"),
            customizations=customizations_str,
            content=content,
            style_guide=self.CAMPAIGN_STYLE_GUIDE,
        )

        try:
            messages = [
                SystemMessage(content=self.HTML_EMAIL_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]

            response = self.llm.invoke(messages)
            html_content = response.content.strip()

            # Clean up any markdown code blocks if present
            if html_content.startswith("```html"):
                html_content = html_content[7:]
            if html_content.startswith("```"):
                html_content = html_content[3:]
            if html_content.endswith("```"):
                html_content = html_content[:-3]

            logger.info(f"Generated HTML email for campaign {campaign.id}")
            return html_content.strip()

        except Exception as e:
            logger.exception(f"HTML email generation failed: {e}")
            raise

    def generate_email_subject(
        self,
        campaign,
        content: str | None = None,
    ) -> str:
        """
        Generate a compelling email subject line.

        Args:
            campaign: LocationCampaign instance
            content: Optional content override

        Returns:
            Subject line string
        """
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured")

        content = content or campaign.generated_content
        if not content:
            raise ValueError("Campaign has no generated content")

        context = self.build_context(campaign)

        prompt = self.EMAIL_SUBJECT_PROMPT.format(
            brand_name=context.get("brand_name", ""),
            campaign_type=context.get("campaign_type", "general"),
            content=content[:500],  # Limit content for subject generation
        )

        try:
            system_content = (
                "You are an email marketing specialist. "
                "Generate only the requested output, nothing else."
            )
            messages = [
                SystemMessage(content=system_content),
                HumanMessage(content=prompt),
            ]

            response = self.llm.invoke(messages)
            subject = response.content.strip()

            # Remove quotes if present
            if subject.startswith('"') and subject.endswith('"'):
                subject = subject[1:-1]
            if subject.startswith("'") and subject.endswith("'"):
                subject = subject[1:-1]

            # Truncate if too long
            if len(subject) > 60:
                subject = subject[:57] + "..."

            logger.info(f"Generated email subject for campaign {campaign.id}")
            return subject

        except Exception as e:
            logger.exception(f"Email subject generation failed: {e}")
            raise

    def generate_email_preview_text(
        self,
        campaign,
        content: str | None = None,
    ) -> str:
        """
        Generate email preview text (preheader).

        Args:
            campaign: LocationCampaign instance
            content: Optional content override

        Returns:
            Preview text string (max 100 chars)
        """
        content = content or campaign.generated_content
        if not content:
            return ""

        # Simple extraction: use first sentence or first 100 chars
        content = content.strip()

        # Try to get first sentence
        for sep in [". ", "! ", "? "]:
            if sep in content:
                first_sentence = content.split(sep)[0] + sep[0]
                if len(first_sentence) <= 100:
                    return first_sentence

        # Fallback to truncation
        if len(content) > 100:
            return content[:97] + "..."
        return content

    def generate_full_email(
        self,
        campaign,
    ) -> dict[str, str]:
        """
        Generate all email components at once.

        Args:
            campaign: LocationCampaign instance

        Returns:
            Dictionary with keys: html, subject, preview_text
        """
        content = campaign.generated_content
        if not content:
            raise ValueError("Campaign has no generated content")

        html = self.generate_html_email(campaign, content)
        subject = self.generate_email_subject(campaign, content)
        preview_text = self.generate_email_preview_text(campaign, content)

        return {
            "html": html,
            "subject": subject,
            "preview_text": preview_text,
        }
