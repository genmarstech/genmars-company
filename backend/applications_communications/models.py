from django.conf import settings
from django.db import models


class Enquiry(models.Model):
    """A project brief sent from the website's quote form."""

    class Service(models.TextChoices):
        CUSTOM_SOFTWARE = 'custom_software', 'Custom software'
        WEBSITE = 'website', 'Website'
        ECOMMERCE = 'ecommerce', 'E-commerce store'
        AUTOMATION = 'automation', 'Business automation'
        UI_UX = 'ui_ux', 'UI/UX design'
        CLOUD = 'cloud', 'Cloud & deployment'
        MAINTENANCE = 'maintenance', 'Maintenance & support'
        OTHER = 'other', 'Something else'

    class Budget(models.TextChoices):
        UNDER_50K = 'under_50k', 'Under KES 50,000'
        FROM_50K = '50k_150k', 'KES 50,000 – 150,000'
        FROM_150K = '150k_500k', 'KES 150,000 – 500,000'
        OVER_500K = 'over_500k', 'KES 500,000+'
        UNSURE = 'unsure', 'Not sure yet'

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        CONTACTED = 'contacted', 'Contacted'
        PROPOSAL_SENT = 'proposal_sent', 'Proposal sent'
        WON = 'won', 'Won'
        LOST = 'lost', 'Lost'

    class Source(models.TextChoices):
        WEBSITE = 'website', 'Website form'
        PORTAL = 'portal', 'Client portal'
        EARLY_ACCESS = 'early_access', 'Product early access'

    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, blank=True, default='')
    service = models.CharField(max_length=32, choices=Service.choices, default=Service.OTHER)
    budget = models.CharField(max_length=32, choices=Budget.choices, default=Budget.UNSURE)
    message = models.TextField()

    source = models.CharField(max_length=16, choices=Source.choices, default=Source.WEBSITE)
    # set when a signed-in client asks for a new project from their portal
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_requests'
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW, db_index=True)
    internal_notes = models.TextField(blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'enquiries'

    def __str__(self):
        return f"{self.full_name} · {self.get_service_display()} ({self.get_status_display()})"
