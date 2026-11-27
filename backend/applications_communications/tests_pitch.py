from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import ClientProfile
from portal.models import ClientNote, Invoice, Project, ProjectLink, Task
from .models import Enquiry

User = get_user_model()
INBOX = '/api/v1/enquiries/inbox/'


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    ENQUIRY_NOTIFY_EMAIL='team@genmars.test',
    FRONTEND_URL='https://genmars.test',
)
class RedesignPitchTests(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(email='admin@example.com', password='S3cure-pass-123', full_name='Admin')
        self.client.force_authenticate(self.staff)

    def add_lead(self, **extra):
        body = {
            'full_name': 'Amina Otieno', 'email': 'amina@bakery.test', 'company_name': 'Amina Bakes',
            'current_site_url': 'https://aminabakes.test', **extra,
        }
        response = self.client.post(INBOX, body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Enquiry.objects.get(pk=response.data['id'])

    def test_team_can_add_a_lead_with_a_site_and_it_starts_as_a_draft_pitch(self):
        lead = self.add_lead()
        self.assertEqual((lead.source, lead.pitch_status, lead.service, lead.status), ('team', 'draft', 'website', 'new'))
        self.assertEqual(len(self.client.get(f'{INBOX}?pitch=1').data), 1)
        Enquiry.objects.create(full_name='Other', email='o@x.test', message='Just a normal brief here')
        self.assertEqual(len(self.client.get(f'{INBOX}?pitch=1').data), 1)

    def test_clients_cannot_add_or_convert_leads(self):
        lead = self.add_lead()
        bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob')
        self.client.force_authenticate(bob)
        self.assertEqual(self.client.post(INBOX, {'full_name': 'X', 'email': 'x@x.test'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(f'{INBOX}{lead.id}/convert/', {'price': 50000}, format='json').status_code, 403)

    def test_sending_needs_a_preview_and_moves_the_lead_to_proposal_sent(self):
        lead = self.add_lead()
        response = self.client.patch(f'{INBOX}{lead.id}/', {'pitch_status': 'sent'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('preview_url', response.data)

        response = self.client.patch(f'{INBOX}{lead.id}/', {'pitch_status': 'sent', 'preview_url': 'https://amina-redesign.vercel.app'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        lead.refresh_from_db()
        self.assertEqual((lead.pitch_status, lead.status), ('sent', 'proposal_sent'))
        self.assertIsNotNone(lead.pitch_sent_at)

        self.client.patch(f'{INBOX}{lead.id}/', {'pitch_status': 'feedback', 'pitch_feedback': 'Bigger photos please'}, format='json')
        lead.refresh_from_db()
        self.assertEqual((lead.pitch_status, lead.pitch_feedback), ('feedback', 'Bigger photos please'))

    def test_convert_makes_a_client_project_deposit_and_onboarding_invite(self):
        lead = self.add_lead(preview_url='https://amina-redesign.vercel.app', pitch_status='sent', pitch_feedback='Love it')
        response = self.client.post(f'{INBOX}{lead.id}/convert/', {'price': '60000'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['client_is_new'])

        lead.refresh_from_db()
        user = User.objects.get(email='amina@bakery.test')
        project = Project.objects.get()
        self.assertEqual((lead.client, lead.project, lead.status, lead.pitch_status), (user, project, 'won', 'approved'))
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_staff)
        self.assertEqual(ClientProfile.objects.get(user=user).company_name, 'Amina Bakes')
        self.assertEqual(ClientProfile.objects.get(user=user).website, 'https://aminabakes.test')
        self.assertIsNone(ClientProfile.objects.get(user=user).onboarding_completed_at)

        self.assertEqual((project.client, project.name, project.service, project.budget), (user, 'Website redesign for Amina Bakes', 'websites', Decimal('60000')))
        self.assertEqual(set(ProjectLink.objects.values_list('url', flat=True)), {'https://amina-redesign.vercel.app', 'https://aminabakes.test'})
        invoice = Invoice.objects.get()
        self.assertEqual((invoice.amount, invoice.status, invoice.project), (Decimal('18000'), 'draft', project))
        self.assertTrue(Task.objects.filter(project=project, title__startswith='Kick-off').exists())
        self.assertIn('Love it', ClientNote.objects.get(client=user).body)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['amina@bakery.test'])
        self.assertIn('/reset-password?uid=', mail.outbox[0].body)
        self.assertIn('welcome=1', mail.outbox[0].body)

        again = self.client.post(f'{INBOX}{lead.id}/convert/', {'price': '60000'}, format='json')
        self.assertEqual(again.status_code, 400)
        self.assertEqual(Project.objects.count(), 1)

    def test_the_invite_link_lets_them_set_a_password_and_sign_in(self):
        lead = self.add_lead(preview_url='https://amina-redesign.vercel.app')
        self.client.post(f'{INBOX}{lead.id}/convert/', {'price': '60000'}, format='json')
        user = User.objects.get(email='amina@bakery.test')
        body = mail.outbox[0].body
        uid = body.split('uid=')[1].split('&')[0]
        token = body.split('token=')[1].split('&')[0]
        self.client.force_authenticate(None)
        response = self.client.post('/api/v1/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'password': 'Bakery-pass-2026'}, format='json')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        user.refresh_from_db()
        self.assertTrue(user.check_password('Bakery-pass-2026'))

    def test_existing_client_is_reused_with_custom_terms(self):
        existing = User.objects.create_user(email='amina@bakery.test', password='S3cure-pass-123', full_name='Amina O.')
        lead = self.add_lead(preview_url='https://amina-redesign.vercel.app')
        response = self.client.post(
            f'{INBOX}{lead.id}/convert/',
            {'price': '100000', 'deposit_percent': 50, 'project_name': 'Amina Bakes shop'}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['client_is_new'])
        self.assertEqual(User.objects.filter(email__iexact='amina@bakery.test').count(), 1)
        self.assertEqual(Project.objects.get().client, existing)
        self.assertEqual(Project.objects.get().name, 'Amina Bakes shop')
        self.assertEqual(Invoice.objects.get().amount, Decimal('50000'))
        self.assertIn('/portal/projects/', mail.outbox[0].body)
        self.assertTrue(existing.has_usable_password())

    def test_a_team_email_cannot_be_converted(self):
        lead = self.add_lead(email='admin@example.com')
        response = self.client.post(f'{INBOX}{lead.id}/convert/', {'price': '60000'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Project.objects.exists())
