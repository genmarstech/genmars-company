import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def notify_new_enquiry(enquiry):
    """Tell the team about a new brief and confirm receipt to the client.

    Email problems are logged, never shown to the visitor: the enquiry is already saved.
    """
    team_body = (
        f"New project brief from the website\n\n"
        f"Name: {enquiry.full_name}\n"
        f"Email: {enquiry.email}\n"
        f"Phone: {enquiry.phone_number or '-'}\n"
        f"Service: {enquiry.get_service_display()}\n"
        f"Budget: {enquiry.get_budget_display()}\n\n"
        f"{enquiry.message}\n"
    )
    client_body = (
        f"Hi {enquiry.full_name.split()[0]},\n\n"
        f"Thanks for telling us about your project. We've received your brief for "
        f"{enquiry.get_service_display().lower()} and will reply within one business day "
        f"with next steps and a time for a free consultation call.\n\n"
        f"Your message:\n{enquiry.message}\n\n"
        f"Genmars Tech\n{settings.ENQUIRY_NOTIFY_EMAIL}\n"
    )

    try:
        send_mail(
            subject=f"New enquiry: {enquiry.get_service_display()} · {enquiry.full_name}",
            message=team_body,
            from_email=None,
            recipient_list=[settings.ENQUIRY_NOTIFY_EMAIL],
        )
        send_mail(
            subject="We've received your project brief · Genmars Tech",
            message=client_body,
            from_email=None,
            recipient_list=[enquiry.email],
        )
    except Exception:
        logger.exception("Could not send emails for enquiry %s", enquiry.pk)
