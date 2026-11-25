from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Invoice, Message, Milestone, Project


User = get_user_model()


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    ENQUIRY_NOTIFY_EMAIL='team@genmars.test',
)
class PortalTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice W')
        self.bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob K')
        self.staff = User.objects.create_superuser(email='team@example.com', password='S3cure-pass-123', full_name='Edwin Mwangi')

        self.site = Project.objects.create(client=self.alice, name='Website redesign', status='in_progress', progress=75)
        Milestone.objects.create(project=self.site, title='Design phase', status='done', completed_at=timezone.now(), order=1)
        Milestone.objects.create(project=self.site, title='Development', status='in_progress', order=2)
        Project.objects.create(client=self.alice, name='Old shop', status='completed', progress=100)
        self.bobs = Project.objects.create(client=self.bob, name='Bob secret project')

        Invoice.objects.create(client=self.alice, project=self.site, number='GM-001', amount=50000, status='paid', issued_on=date(2026, 11, 1))
        Invoice.objects.create(client=self.alice, project=self.site, number='GM-002', amount=30000, status='sent', issued_on=date(2026, 11, 20))
        Invoice.objects.create(client=self.alice, number='GM-003', amount=99999, status='draft')
        Invoice.objects.create(client=self.bob, number='GM-004', amount=10000, status='sent')

        Message.objects.create(client=self.alice, project=self.site, sender=self.staff, body='Design is ready for review')
        self.client.force_authenticate(self.alice)

    def test_summary_counts_only_my_data(self):
        data = self.client.get('/api/v1/portal/summary/').data
        self.assertEqual(data['active_projects'], 1)
        self.assertEqual(data['completed_projects'], 1)
        self.assertEqual(data['invoices'], 2)  # drafts hidden
        self.assertEqual(float(data['unpaid_total']), 30000)
        self.assertEqual(data['unread_messages'], 1)
        self.assertEqual([p['name'] for p in data['projects']], ['Website redesign'])
        self.assertEqual({a['kind'] for a in data['activity']}, {'milestone', 'message'})

    def test_projects_are_private(self):
        names = [p['name'] for p in self.client.get('/api/v1/portal/projects/').data]
        self.assertNotIn('Bob secret project', names)
        self.assertEqual(self.client.get(f'/api/v1/portal/projects/{self.bobs.id}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_project_detail_has_timeline(self):
        data = self.client.get(f'/api/v1/portal/projects/{self.site.id}/').data
        self.assertEqual([m['title'] for m in data['milestones']], ['Design phase', 'Development'])
        self.assertEqual(data['status_label'], 'In progress')

    def test_invoices_hide_drafts_and_other_clients(self):
        numbers = [i['number'] for i in self.client.get('/api/v1/portal/invoices/').data]
        self.assertEqual(sorted(numbers), ['GM-001', 'GM-002'])

    def test_reading_messages_marks_them_read(self):
        data = self.client.get('/api/v1/portal/messages/').data
        self.assertEqual(data[0]['sender_name'], 'Edwin · Genmars')
        self.assertTrue(data[0]['from_team'])
        self.assertEqual(self.client.get('/api/v1/portal/summary/').data['unread_messages'], 0)

    def test_sending_a_message_notifies_the_team(self):
        response = self.client.post('/api/v1/portal/messages/', {'project': self.site.id, 'body': 'Looks great!'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['sender_name'], 'You')
        self.assertEqual(mail.outbox[0].to, ['team@genmars.test'])
        self.assertIn('Website redesign', mail.outbox[0].subject)

    def test_cannot_post_to_someone_elses_project(self):
        response = self.client.post('/api/v1/portal/messages/', {'project': self.bobs.id, 'body': 'hi'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_portal_needs_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/portal/summary/').status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}})
class TeamApiTests(APITestCase):

    def setUp(self):
        self.client_user = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice W')
        self.other = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob K')
        self.staff = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin Mwangi', is_staff=True)
        self.project = Project.objects.create(client=self.client_user, name='Website redesign', status='in_progress', health='at_risk')
        Message.objects.create(client=self.client_user, sender=self.client_user, body='Any update?')
        self.client.force_authenticate(self.staff)

    def test_clients_cannot_use_team_api(self):
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get('/api/v1/team/summary/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/v1/team/projects/').status_code, status.HTTP_403_FORBIDDEN)

    def test_summary(self):
        data = self.client.get('/api/v1/team/summary/').data
        self.assertEqual(data['total_projects'], 1)
        self.assertEqual(data['in_progress'], 1)
        self.assertEqual(data['clients'], 2)
        self.assertEqual(data['at_risk'], 1)
        self.assertEqual(data['unanswered_messages'], 1)
        self.assertEqual(len(data['activity']), 7)

    def test_clients_list_counts_projects(self):
        rows = {c['email']: c for c in self.client.get('/api/v1/team/clients/').data}
        self.assertEqual(rows['alice@example.com']['project_count'], 1)
        self.assertNotIn('edwin@example.com', rows)

    def test_create_project_and_complete_milestone(self):
        response = self.client.post('/api/v1/team/projects/', {'client': self.other.id, 'name': 'Shop', 'status': 'planning'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        pid = response.data['id']
        m = self.client.post('/api/v1/team/milestones/', {'project': pid, 'title': 'Kickoff'}, format='json')
        self.assertEqual(m.status_code, status.HTTP_201_CREATED)
        done = self.client.patch(f"/api/v1/team/milestones/{m.data['id']}/", {'status': 'done'}, format='json')
        self.assertIsNotNone(done.data['completed_at'])
        reopened = self.client.patch(f"/api/v1/team/milestones/{m.data['id']}/", {'status': 'in_progress'}, format='json')
        self.assertIsNone(reopened.data['completed_at'])

    def test_progress_over_100_is_rejected(self):
        response = self.client.patch(f'/api/v1/team/projects/{self.project.id}/', {'progress': 150}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invoice_project_must_match_client_and_paid_date_is_set(self):
        bad = self.client.post('/api/v1/team/invoices/', {'client': self.other.id, 'project': self.project.id, 'number': 'X1', 'amount': '100'}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        ok = self.client.post('/api/v1/team/invoices/', {'client': self.client_user.id, 'project': self.project.id, 'number': 'X2', 'amount': '100', 'status': 'paid'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(ok.data['paid_on'])

    def test_reply_emails_the_client_and_clears_needs_reply(self):
        response = self.client.post('/api/v1/team/messages/', {'client': self.client_user.id, 'body': 'Launching Friday'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mail.outbox[-1].to, ['alice@example.com'])
        threads = self.client.get('/api/v1/team/threads/').data
        self.assertFalse(threads[0]['needs_reply'])
        self.assertEqual(len(self.client.get(f'/api/v1/team/messages/?client={self.client_user.id}').data), 2)


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    ENQUIRY_NOTIFY_EMAIL='team@genmars.test',
)
class ProjectRequestAndFinanceTests(APITestCase):

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice W', phone_number='+254700000001')
        self.bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob K')
        self.staff = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin M', is_staff=True)

    def test_client_request_becomes_a_lead_with_their_details(self):
        from applications_communications.models import Enquiry
        self.client.force_authenticate(self.alice)
        response = self.client.post('/api/v1/portal/requests/', {'service': 'ecommerce', 'budget': '50k_150k', 'message': 'Add an online shop to our site'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Enquiry.objects.get()
        self.assertEqual((lead.client, lead.email, lead.source, lead.phone_number), (self.alice, 'alice@example.com', 'portal', '+254700000001'))
        self.assertEqual(mail.outbox[0].to, ['team@genmars.test'])

        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get('/api/v1/portal/requests/').data, [])

    def test_public_form_cannot_claim_portal_source(self):
        from applications_communications.models import Enquiry
        self.client.post('/api/v1/enquiries/', {'full_name': 'X', 'email': 'x@example.com', 'message': 'Early access to Commerce please', 'source': 'portal'}, format='json')
        self.client.post('/api/v1/enquiries/', {'full_name': 'Y', 'email': 'y@example.com', 'message': 'Early access to Commerce please', 'source': 'early_access'}, format='json')
        self.assertEqual(sorted(Enquiry.objects.values_list('source', flat=True)), ['early_access', 'website'])

    def test_finance_totals(self):
        today = timezone.localdate()
        Invoice.objects.create(client=self.alice, number='F1', amount=40000, status='paid', paid_on=today)
        Invoice.objects.create(client=self.alice, number='F2', amount=25000, status='sent', due_on=today - timedelta(days=3))
        Invoice.objects.create(client=self.bob, number='F3', amount=10000, status='sent', due_on=today + timedelta(days=10))
        Invoice.objects.create(client=self.bob, number='F4', amount=99999, status='draft')
        self.client.force_authenticate(self.staff)
        data = self.client.get('/api/v1/team/finance/').data
        self.assertEqual(data['paid_this_month'], 40000)
        self.assertEqual(data['outstanding'], 35000)
        self.assertEqual(data['overdue'], 25000)
        self.assertEqual(len(data['months']), 6)
        self.assertEqual(data['months'][-1]['paid'], 40000)
        self.assertEqual([i['number'] for i in data['overdue_invoices']], ['F2'])

    def test_finance_is_staff_only(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get('/api/v1/team/finance/').status_code, status.HTTP_403_FORBIDDEN)


class BrandKitTests(APITestCase):

    def setUp(self):
        self.client_user = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice W')
        self.staff = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin M', is_staff=True)

    def test_staff_can_download_brand_files(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get('/api/v1/team/brand/logos/genmars-logo.svg?download=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertEqual(self.client.get('/api/v1/team/brand/genmars-brand-kit.zip').status_code, status.HTTP_200_OK)

    def test_clients_and_visitors_cannot(self):
        self.assertEqual(self.client.get('/api/v1/team/brand/logos/genmars-logo.svg').status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get('/api/v1/team/brand/logos/genmars-logo.svg').status_code, status.HTTP_403_FORBIDDEN)

    def test_no_files_outside_the_kit(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get('/api/v1/team/brand/../config/settings.py').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get('/api/v1/team/brand/..%2F.env').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get('/api/v1/team/brand/missing.png').status_code, status.HTTP_404_NOT_FOUND)
