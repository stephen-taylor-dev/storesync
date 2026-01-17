"""
Celery configuration for StoreSync project.
"""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("storesync")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Celery Beat Schedule - Periodic Tasks
app.conf.beat_schedule = {
    # Check for campaigns that need to be activated
    "activate-scheduled-campaigns": {
        "task": "apps.campaigns.tasks.activate_scheduled_campaigns",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
        "options": {"queue": "default"},
    },
    # Check for campaigns that need to be completed
    "complete-expired-campaigns": {
        "task": "apps.campaigns.tasks.complete_expired_campaigns",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
        "options": {"queue": "default"},
    },
    # Send daily digest of pending approvals
    "send-pending-approval-digest": {
        "task": "apps.campaigns.tasks.send_pending_approval_digest",
        "schedule": crontab(hour=9, minute=0),  # Daily at 9 AM UTC
        "options": {"queue": "default"},
    },
    # Cleanup old approval history entries
    "cleanup-old-data": {
        "task": "apps.campaigns.tasks.cleanup_old_data",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),  # Weekly on Sunday at 2 AM
        "options": {"queue": "default"},
    },
}

# Task routing
app.conf.task_routes = {
    "apps.campaigns.tasks.generate_campaign_content": {"queue": "ai"},
    "apps.campaigns.tasks.*": {"queue": "default"},
}

# Task annotations
app.conf.task_annotations = {
    "apps.campaigns.tasks.generate_campaign_content": {
        "rate_limit": "10/m",  # Rate limit AI tasks
        "time_limit": 120,  # 2 minute timeout
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery connectivity."""
    print(f"Request: {self.request!r}")
