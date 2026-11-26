"""Genmars Meetings API.

A separate service from the main API (backend/), sharing the company database: it reads people, projects
and sign-in tokens from the main API's tables and owns only the meetings_* tables.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


DEBUG = env_bool('DJANGO_DEBUG', False)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.')
    SECRET_KEY = 'django-insecure-local-development-only'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1' if DEBUG else '')
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS')

# Only the meetings site may call this API from a browser.
CORS_ALLOWED_ORIGINS = env_list('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:5174' if DEBUG else 'https://meetings.genmars.co.ke')
CORS_URLS_REGEX = r'^/api/.*$'

# No django.contrib.auth or admin: users, groups and permissions belong to the main API. People sign in
# there and this service checks the same token (see company.authentication).
INSTALLED_APPS = [
    'rest_framework',
    'corsheaders',
    'company',
    'meetings',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# The same database as the main API (genmars_db).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
    }
}

# Tests build the shared tables too (see company.testing).
TEST_RUNNER = 'company.testing.SharedTablesRunner'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['company.authentication.SharedTokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['company.permissions.Staff'],
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_REDIRECT_EXEMPT = [r'^healthz$']
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

# Email (task notifications): Resend when RESEND_EMAIL_API_KEY is set, otherwise the console.
if os.getenv('RESEND_EMAIL_API_KEY'):
    MAILERS = {
        'default': {
            'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
            'OPTIONS': {
                'host': 'smtp.resend.com', 'port': 587, 'username': 'resend',
                'password': os.environ['RESEND_EMAIL_API_KEY'], 'use_tls': True, 'timeout': 10,
            },
        },
    }
else:
    MAILERS = {'default': {'BACKEND': 'django.core.mail.backends.console.EmailBackend'}}
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL') or f"Genmars Tech <{os.getenv('EMAIL') or 'info@genmars.co.ke'}>"

# The meetings site, for redirects after Google sign-in.
MEETINGS_URL = os.getenv('MEETINGS_URL', 'http://localhost:5174' if DEBUG else 'https://meetings.genmars.co.ke').rstrip('/')
# The team dashboard on the main site, for links in emails.
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://www.genmars.co.ke').rstrip('/')

# Google Meet + Calendar. The OAuth client is a "Web application" client in Google Cloud; GOOGLE_REDIRECT_URI
# must be listed there exactly, e.g. https://api.genmars.co.ke/api/v1/integrations/google/callback/
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', '')
# Fernet key that encrypts stored Google tokens; derived from DJANGO_SECRET_KEY when empty.
GOOGLE_TOKEN_KEY = os.getenv('GOOGLE_TOKEN_KEY', '')
