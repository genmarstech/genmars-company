from django.apps import apps
from django.conf import settings
from django.test.runner import DiscoverRunner


class SharedTablesRunner(DiscoverRunner):
    """In the test database nobody else creates the main API's tables, so let Django build them there."""

    def setup_test_environment(self, **kwargs):
        settings.MANAGE_SHARED_TABLES = True
        for model in apps.get_app_config('company').get_models():
            model._meta.managed = True
        super().setup_test_environment(**kwargs)
