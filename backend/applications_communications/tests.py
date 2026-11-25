from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Enquiry


User = get_user_model()

BRIEF = {
    'full_name': 'Jane Wanjiru',
    'email': 'jane@company.co.ke',
    'phone_number': '+254700000000',
    'service': 'ecommerce',
    'budget': '50k_150k',
    'message': 'We need an online shop with M-Pesa checkout by March.',
}


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    ENQUIRY_NOTIFY_EMAIL='team@genmars.test',
)
class EnquiryApiTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_superuser(email='admin@example.com', password='S3cure-pass-123', full_name='Admin')
        self.client_user = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob')

    def test_visitor_can_send_a_brief_and_both_sides_get_email(self):
        response = self.client.post('/api/v1/enquiries/', BRIEF, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        enquiry = Enquiry.objects.get()
        self.assertEqual(enquiry.status, Enquiry.Status.NEW)
        self.assertEqual(enquiry.service, 'ecommerce')
        self.assertEqual([m.to for m in mail.outbox], [['team@genmars.test'], ['jane@company.co.ke']])
        self.assertIn('M-Pesa checkout', mail.outbox[0].body)

    def test_invalid_brief_is_rejected(self):
        response = self.client.post('/api/v1/enquiries/', {**BRIEF, 'email': 'nope', 'message': 'hi'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertIn('message', response.data)
        self.assertFalse(Enquiry.objects.exists())

    def test_honeypot_blocks_bots(self):
        response = self.client.post('/api/v1/enquiries/', {**BRIEF, 'website': 'http://spam'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Enquiry.objects.exists())

    def test_logged_in_visitor_needs_no_csrf_token(self):
        client = self.client_class(enforce_csrf_checks=True)
        client.login(email='bob@example.com', password='S3cure-pass-123')
        self.assertEqual(client.post('/api/v1/enquiries/', BRIEF, format='json').status_code, status.HTTP_201_CREATED)

    def test_submissions_are_throttled(self):
        codes = [self.client.post('/api/v1/enquiries/', BRIEF, format='json').status_code for _ in range(6)]
        self.assertEqual(codes[5], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_inbox_is_staff_only(self):
        self.client.post('/api/v1/enquiries/', BRIEF, format='json')
        self.assertEqual(self.client.get('/api/v1/enquiries/inbox/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get('/api/v1/enquiries/inbox/').status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_list_filter_and_update_status(self):
        self.client.post('/api/v1/enquiries/', BRIEF, format='json')
        enquiry = Enquiry.objects.get()
        self.client.force_authenticate(self.staff)

        listing = self.client.get('/api/v1/enquiries/inbox/?status=new')
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(listing.data[0]['service_label'], 'E-commerce store')

        response = self.client.patch(
            f'/api/v1/enquiries/inbox/{enquiry.id}/',
            {'status': 'contacted', 'internal_notes': 'Call booked Friday', 'email': 'changed@x.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        enquiry.refresh_from_db()
        self.assertEqual(enquiry.status, 'contacted')
        self.assertEqual(enquiry.internal_notes, 'Call booked Friday')
        self.assertEqual(enquiry.email, 'jane@company.co.ke')
