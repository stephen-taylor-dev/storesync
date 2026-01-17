"""
Local development settings for StoreSync project.
"""

from .base import *  # noqa: F401, F403

DEBUG = True

# Django Debug Toolbar
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405

INTERNAL_IPS = ["127.0.0.1", "localhost"]

# Email backend for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# CORS - allow all in development
CORS_ALLOW_ALL_ORIGINS = True
