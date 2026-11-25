from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class GenUserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            **extra_fields
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError("Superuser must have is_staff=True")

        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class GenUsers(AbstractUser):

    username = None

    full_name = models.CharField(max_length=255)

    email = models.EmailField(unique=True)

    phone_number = models.CharField(
        max_length=20,
        blank=True,
        default=''
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'

    REQUIRED_FIELDS = ['full_name']

    objects = GenUserManager()

    def __str__(self):
        return f"{self.full_name} ({self.email})"

class ClientProfile(models.Model):
    """What a client tells us during onboarding, so we can prepare before the first call."""

    class CompanySize(models.TextChoices):
        SOLO = 'solo', 'Just me'
        SMALL = '2_10', '2–10 people'
        MEDIUM = '11_50', '11–50 people'
        LARGE = '51_plus', '51+ people'

    class ContactMethod(models.TextChoices):
        EMAIL = 'email', 'Email'
        PHONE = 'phone', 'Phone call'
        WHATSAPP = 'whatsapp', 'WhatsApp'

    user = models.OneToOneField(GenUsers, on_delete=models.CASCADE, related_name='client_profile')

    company_name = models.CharField(max_length=255, blank=True, default='')
    job_title = models.CharField(max_length=120, blank=True, default='')
    industry = models.CharField(max_length=120, blank=True, default='')
    company_size = models.CharField(max_length=16, choices=CompanySize.choices, blank=True, default='')
    website = models.URLField(blank=True, default='')

    # service slugs, e.g. ["websites", "e-commerce"]
    services = models.JSONField(default=list, blank=True)
    budget = models.CharField(max_length=32, blank=True, default='')
    timeline = models.CharField(max_length=64, blank=True, default='')
    contact_method = models.CharField(max_length=16, choices=ContactMethod.choices, default=ContactMethod.EMAIL)
    goals = models.TextField(blank=True, default='')

    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name or self.user.full_name} ({self.user.email})"
