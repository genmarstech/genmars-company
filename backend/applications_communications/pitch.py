"""Redesign pitches: a lead who already has a site, a preview we built for them, and the move to a real project.

The flow is: add the lead (or open one from the website), paste their current site, build a better version
and paste its preview link, mark the pitch sent, note their feedback, and when they say "build it", convert
the lead. Converting makes (or reuses) their client account, opens a project, drafts the deposit invoice,
adds a kick-off task and emails them a link to set a password and fill in onboarding.
"""

import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers

from .models import Enquiry

logger = logging.getLogger(__name__)
User = get_user_model()

DEFAULT_DEPOSIT_PERCENT = 30


class ConvertSerializer(serializers.Serializer):
    project_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('1'))
    deposit_percent = serializers.IntegerField(min_value=0, max_value=100, required=False)
    due_date = serializers.DateField(required=False, allow_null=True)

    def validate_due_date(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError('Choose a date from today onwards.')
        return value


def _offering(lead):
    from portal.models import ServiceOffering
    return ServiceOffering.objects.filter(key=lead.service).first()


def _invoice_number(lead):
    from portal.models import Invoice
    base = f"LD-{lead.id:04d}"
    number, n = base, 1
    while Invoice.objects.filter(number=number).exists():
        n += 1
        number = f"{base}-{n}"
    return number


def _client_for(lead):
    """The lead's client account, made if they don't have one. Returns (user, is_new)."""
    from accounts.models import ClientProfile

    user = lead.client or User.objects.filter(email__iexact=lead.email).first()
    if user and user.is_staff:
        raise serializers.ValidationError({'detail': 'That email belongs to a team account. Change the lead’s email first.'})
    is_new = user is None
    if is_new:
        user = User(email=User.objects.normalize_email(lead.email), full_name=lead.full_name[:255], phone_number=lead.phone_number)
        user.set_unusable_password()
        user.save()
    profile, _ = ClientProfile.objects.get_or_create(user=user)
    changed = []
    if lead.company_name and not profile.company_name:
        profile.company_name, changed = lead.company_name, changed + ['company_name']
    if lead.current_site_url and not profile.website:
        profile.website, changed = lead.current_site_url, changed + ['website']
    if changed:
        profile.save(update_fields=changed + ['updated_at'])
    return user, is_new


def _welcome_email(user, project, is_new):
    first = (user.full_name or user.email).split()[0]
    if is_new:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        step = (
            "We've set up your Genmars account so you can follow the work. Choose a password here, then tell us "
            "a little about your business so we're ready for the kick-off call:\n\n"
            f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}&welcome=1\n\n"
            "The link works once and expires in a few days. You can also sign in with Google using this email."
        )
    else:
        step = f"You can follow it from your portal:\n\n{settings.FRONTEND_URL}/portal/projects/{project.id}"
    try:
        send_mail(
            subject=f"Let's build it: {project.name}",
            message=(
                f"Hi {first},\n\nThanks for going ahead with the new design. We've opened your project and "
                f"will be in touch to book a short kick-off call.\n\n{step}\n\nGenmars Tech\n{settings.ENQUIRY_NOTIFY_EMAIL}\n"
            ),
            from_email=None,
            recipient_list=[user.email],
        )
    except Exception:
        # the project is already saved; the team can resend from the client page
        logger.exception("Could not send the welcome email to %s", user.email)


def convert(lead, data, staff):
    """Turn an approved pitch (or any won lead) into a client, a project and a draft deposit invoice."""
    from portal.models import ClientNote, Invoice, Project, ProjectLink, Task

    if lead.project_id:
        raise serializers.ValidationError({'detail': 'This lead is already a project.'})
    offering = _offering(lead)
    percent = data.get('deposit_percent')
    if percent is None:
        percent = offering.deposit_percent if offering else DEFAULT_DEPOSIT_PERCENT
    price = data['price']
    redesign = bool(lead.current_site_url or lead.preview_url)
    company = lead.company_name

    with transaction.atomic():
        client, is_new = _client_for(lead)
        name = (data.get('project_name') or '').strip() or (
            f"{'Website redesign' if redesign else lead.get_service_display()}{' for ' + company if company else ''}"
        )
        project = Project.objects.create(
            client=client,
            name=name[:200],
            summary=(lead.message or (f"Redesign of {lead.current_site_url}" if lead.current_site_url else ''))[:255],
            service=offering.slug if offering else '',
            status=Project.Status.PLANNING,
            budget=price,
            start_date=timezone.localdate(),
            due_date=data.get('due_date'),
        )
        if lead.preview_url:
            ProjectLink.objects.create(project=project, title='Approved redesign preview', url=lead.preview_url)
        if lead.current_site_url:
            ProjectLink.objects.create(project=project, title='Their site before the redesign', url=lead.current_site_url)

        deposit = (price * percent / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        if deposit:
            Invoice.objects.create(
                client=client, project=project, number=_invoice_number(lead), amount=deposit,
                description=f"{percent}% deposit for {name}"[:255],
            )
        Task.objects.create(
            title=f"Kick-off: {name}"[:200], project=project, client=client, assignee=staff, created_by=staff,
            priority=Task.Priority.HIGH, due_date=timezone.localdate() + timedelta(days=2),
            notes='Book the kick-off call, agree milestones and add them to the project. '
                  'Send the deposit invoice once the scope is agreed.',
        )
        history = [f"Came in as a lead on {lead.created_at:%d %b %Y} ({lead.get_source_display().lower()})."]
        if lead.preview_url:
            history.append(f"Approved our redesign preview: {lead.preview_url}")
        if lead.pitch_feedback:
            history.append(f"Their feedback: {lead.pitch_feedback}")
        if lead.internal_notes:
            history.append(f"Lead notes: {lead.internal_notes}")
        ClientNote.objects.create(client=client, author=staff, body='\n'.join(history))

        lead.client = client
        lead.project = project
        lead.converted_at = timezone.now()
        lead.status = Enquiry.Status.WON
        if lead.pitch_status:
            lead.pitch_status = Enquiry.Pitch.APPROVED
        lead.save()

    _welcome_email(client, project, is_new)
    return project, is_new
