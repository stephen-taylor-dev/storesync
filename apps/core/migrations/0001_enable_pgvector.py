from django.db import migrations
from pgvector.django import VectorExtension


class Migration(migrations.Migration):
    """Enable pgvector extension for vector similarity search."""

    initial = True

    dependencies = []

    operations = [
        VectorExtension(),
    ]
