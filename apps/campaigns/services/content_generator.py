"""
Content generation service using LangChain and OpenAI.

This service handles:
- Jinja2 template rendering with location/campaign context
- AI-powered content generation using LangChain
- Vector embeddings for semantic search
"""

import logging
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from jinja2 import BaseLoader, Environment, TemplateSyntaxError, UndefinedError
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Result of content generation, tracking whether AI was actually used."""

    content: str
    used_ai: bool
    fallback_reason: str | None = None


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
    ) -> GenerationResult:
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
            GenerationResult with content, used_ai flag, and optional fallback_reason
        """
        context = self.build_context(campaign)

        # Try AI generation if enabled and configured
        if use_ai and self.openai_api_key:
            try:
                content = self.generate_with_ai(
                    campaign,
                    context=context,
                    additional_instructions=additional_instructions,
                )
                return GenerationResult(content=content, used_ai=True)
            except Exception as e:
                logger.warning(f"AI generation failed, falling back to template: {e}")
                fallback_reason = "AI generation failed"
        elif use_ai and not self.openai_api_key:
            fallback_reason = "AI not configured"
        else:
            fallback_reason = None

        # Fall back to template rendering
        try:
            content = self.render_template(
                campaign.template.content_template,
                context,
            )
        except ValueError:
            # If strict rendering fails, try safe rendering
            content = self.render_template_safe(
                campaign.template.content_template,
                context,
            )

        return GenerationResult(
            content=content, used_ai=False, fallback_reason=fallback_reason
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
    ) -> tuple[GenerationResult, list[float] | None]:
        """
        Generate content and its embedding in one call.

        Args:
            campaign: LocationCampaign instance
            use_ai: Whether to use AI generation
            additional_instructions: Optional additional AI instructions

        Returns:
            Tuple of (GenerationResult, embedding_vector)
            Embedding may be None if not configured or fails
        """
        result = self.generate_content(
            campaign,
            use_ai=use_ai,
            additional_instructions=additional_instructions,
        )

        embedding = None
        if self.openai_api_key:
            try:
                embedding = self.generate_embedding(result.content)
            except Exception as e:
                logger.warning(f"Embedding generation failed: {e}")

        return result, embedding

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

    HTML_EMAIL_SYSTEM_PROMPT = """You are an expert email marketing designer who creates premium, modern HTML emails for major retail and gas station brands.

Your emails should look like they come from brands like Shell, Circle K, QuikTrip, Buc-ee's, or Wawa — clean, bold, and professional.

Design principles:
- MODERN & MINIMAL: Generous white space, clean lines, no clutter. Let the content breathe.
- BOLD HERO SECTION: Large, eye-catching header area with a strong background color (not an image). Big headline text (28-36px), short subheadline underneath.
- CLEAR VISUAL HIERARCHY: One primary CTA button per email. Use size, weight, and color to guide the eye. Section breaks with subtle dividers or spacing, not heavy borders.
- ROUNDED ELEMENTS: Use border-radius on buttons (8px), cards/sections (12px), and containers for a modern feel.
- TYPOGRAPHY: Use system font stack (Arial, Helvetica, sans-serif). Headlines bold 600-700 weight. Body text 15-16px, line-height 1.6, dark gray (#333) on white — never pure black on white.
- BUTTON STYLE: Large pill-shaped or rounded-rect CTA buttons (min 48px height, 200px+ wide), bold text, strong contrast color. Add subtle shadow or hover state via background darkening.
- COLOR USAGE: One strong primary brand color for the hero/header and CTA button. Neutral body (white or #fafafa background). Accent color sparingly for highlights or badges.
- CARD LAYOUT: If showing multiple offers or details, use card-style sections with light background (#f5f5f5), rounded corners, and padding.
- FOOTER: Minimal, light gray background, small text, includes unsubscribe link. No heavy branding in the footer.

Technical requirements:
- All inline CSS (no external stylesheets)
- Table-based layout for email client compatibility
- Mobile-responsive: single-column on small screens, max-width 600px container
- Include {{recipient_name}} and {{unsubscribe_link}} placeholders
- Web-safe fonts with fallbacks
- Output only the complete HTML document, no explanations"""

    # Campaign type to color/style mapping guidance
    CAMPAIGN_STYLE_GUIDE = """
Design Reference — Think of emails from Shell, Circle K, QuikTrip, Buc-ee's, Wawa:

Campaign Style by Type:
- fuel_promo / fuel / gas:
  Primary: Deep green (#059669) or petroleum blue (#0369a1). Hero section with bold cents-off number.
  Vibe: Clean, trustworthy, savings-focused. Think Shell Fuel Rewards emails.
  CTA: "Find a Station" or "Start Saving" style button.

- seasonal_sale / summer:
  Primary: Vibrant orange (#ea580c) or warm coral (#f43f5e). Bright, energetic.
  Vibe: Bold and fun like a QuikTrip summer promo. Big discount number in hero.

- seasonal_sale / winter:
  Primary: Rich navy (#1e3a5f) with ice blue (#38bdf8) accents.
  Vibe: Clean and premium like a holiday fuel rewards email.

- seasonal_sale / fall:
  Primary: Deep amber (#b45309) with warm tan (#fef3c7) background accents.
  Vibe: Warm and inviting, harvest/autumn feel.

- seasonal_sale / spring:
  Primary: Fresh green (#16a34a) with soft mint (#ecfdf5) card backgrounds.
  Vibe: Clean and fresh, renewal energy.

- clearance:
  Primary: Bold red (#dc2626). Large percentage-off badge in hero.
  Vibe: Urgent but still clean — not cluttered. One clear offer.

- grand_opening:
  Primary: Rich gold (#b45309) on dark background (#1a1a2e).
  Vibe: Premium and celebratory. Think new store launch announcement.

- flash_sale:
  Primary: Hot red (#ef4444) with dark (#18181b) header.
  Vibe: High-contrast urgency. Bold countdown or limited-time messaging.

- loyalty / rewards:
  Primary: Deep purple (#7c3aed) or gold (#ca8a04).
  Vibe: Exclusive, VIP feel. Think Circle K Inner Circle or Shell Go+ emails.

- convenience:
  Primary: Teal (#0d9488) or friendly blue (#2563eb).
  Vibe: Approachable, everyday savings. Clean card layout for multiple offers.

- default:
  Primary: Professional blue (#2563eb) on white.
  Vibe: Modern corporate — clean hero, clear CTA, minimal footer.

General rules for ALL types:
- Hero section: Solid color background (NOT gradient), white text, 28-36px headline
- Body: White or near-white (#fafafa) background, 15-16px body text in #333
- CTA button: Primary color, white text, rounded (border-radius: 8px), min 48px tall
- Max 1 primary CTA per email
- Generous padding: 40px+ around hero, 24px+ around body sections
- Footer: Light gray (#f3f4f6) background, 12-13px text
"""

    HTML_EMAIL_GENERATION_PROMPT = """Convert this marketing content into a modern, premium HTML email:

Brand: {brand_name}
Campaign Type: {campaign_type}
Sale/Promotion Details: {customizations}

Content:
{content}

{style_guide}

Structure the email exactly like this:
1. HERO SECTION — Full-width colored background (from style guide), large white headline (28-36px bold), short subtitle, and one rounded CTA button
2. BODY — White background, clean content sections. If multiple offers, use rounded card components with light gray (#f5f5f5) backgrounds. Keep text at 15-16px, color #333.
3. LOCATION/DETAILS — Address and store info in a subtle card or clean text block
4. FOOTER — Light gray bar with small muted text, {{{{unsubscribe_link}}}} placeholder

Technical:
- Complete HTML document with inline CSS only
- Table-based layout, max-width 600px centered
- Mobile-responsive (single column, full-width buttons on small screens)
- Include {{{{recipient_name}}}} placeholder in greeting
- border-radius: 8px on buttons, 12px on cards
- Generous white space — do NOT cram content together
- No emoji in the HTML email — use clean typography instead

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
