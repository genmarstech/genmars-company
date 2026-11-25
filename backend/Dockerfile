# Genmars API: Django + gunicorn
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Static files (Django admin) are collected at build time and served by WhiteNoise.
RUN DJANGO_DEBUG=False DJANGO_SECRET_KEY=build-only python manage.py collectstatic --no-input \
    && useradd --create-home --uid 10001 genmars \
    && chown -R genmars /app
USER genmars

EXPOSE 8000

# Apply any new migrations, then serve.
CMD ["sh", "-c", "python manage.py migrate --no-input && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60 --access-logfile -"]
