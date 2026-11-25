#!/usr/bin/env bash
# Render build command for the Django API.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
