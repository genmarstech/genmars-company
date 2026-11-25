from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class UsersApiPermissionTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice')
        self.bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob')
        self.admin = User.objects.create_superuser(email='admin@example.com', password='S3cure-pass-123', full_name='Admin')

    def test_anonymous_cannot_list_users(self):
        self.assertEqual(self.client.get('/api/v1/auth/users/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_cannot_list_or_touch_other_users(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get('/api/v1/auth/users/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(f'/api/v1/auth/users/{self.bob.id}/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.patch(f'/api/v1/auth/users/{self.bob.id}/', {'full_name': 'Hacked'}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.delete(f'/api/v1/auth/users/{self.bob.id}/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.bob.pk).exists())

    def test_staff_can_list_users(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/v1/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_user_can_read_and_update_self(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get('/api/v1/auth/users/me/').data['email'], 'alice@example.com')
        response = self.client.patch('/api/v1/auth/users/me/', {'full_name': 'Alice W', 'is_staff': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.full_name, 'Alice W')
        self.assertFalse(self.alice.is_staff)

    def test_password_update_is_hashed(self):
        self.client.force_authenticate(self.alice)
        self.client.patch('/api/v1/auth/users/me/', {'password': 'An0ther-strong-pass'})
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password('An0ther-strong-pass'))
        self.assertNotEqual(self.alice.password, 'An0ther-strong-pass')

    def test_register_is_open_and_validates_password(self):
        weak = self.client.post('/api/v1/auth/users/register/', {'email': 'c@example.com', 'full_name': 'C', 'password': '123'})
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        ok = self.client.post(
            '/api/v1/auth/users/register/',
            {'email': 'c@example.com', 'full_name': 'C', 'password': 'S3cure-pass-123'},
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', ok.data)


class LoginThrottleTests(APITestCase):

    def setUp(self):
        cache.clear()
        User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice')

    def test_login_with_valid_credentials(self):
        good = self.client.post('/api/v1/auth/login/', {'email': 'alice@example.com', 'password': 'S3cure-pass-123'})
        self.assertEqual(good.status_code, status.HTTP_200_OK)

    def test_login_throttles_brute_force(self):
        codes = [
            self.client.post('/api/v1/auth/login/', {'email': 'alice@example.com', 'password': 'wrong'}).status_code
            for _ in range(6)
        ]
        self.assertEqual(codes[:5], [status.HTTP_401_UNAUTHORIZED] * 5)
        self.assertEqual(codes[5], status.HTTP_429_TOO_MANY_REQUESTS)


class TokenAuthFlowTests(APITestCase):

    def setUp(self):
        cache.clear()

    def test_sign_up_returns_a_working_token(self):
        response = self.client.post(
            '/api/v1/auth/users/register/',
            {'email': 'new@example.com', 'full_name': 'New Client', 'password': 'S3cure-pass-123'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'new@example.com')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")
        self.assertEqual(self.client.get('/api/v1/auth/users/me/').data['full_name'], 'New Client')

    def test_login_logout_cycle(self):
        User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice')
        login = self.client.post('/api/v1/auth/login/', {'email': 'alice@example.com', 'password': 'S3cure-pass-123'})
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        token = login.data['token']

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(self.client.post('/api/v1/auth/logout/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/v1/auth/users/me/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_password_is_rejected(self):
        User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice')
        response = self.client.post('/api/v1/auth/login/', {'email': 'alice@example.com', 'password': 'nope'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('token', response.data)


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    FRONTEND_URL='https://site.test',
)
class PasswordResetTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice W')

    def reset_link_params(self):
        body = mail.outbox[-1].body
        link = next(line for line in body.splitlines() if line.startswith('https://site.test/reset-password'))
        query = parse_qs(urlparse(link).query)
        return query['uid'][0], query['token'][0]

    def test_reset_email_and_new_password(self):
        response = self.client.post('/api/v1/auth/password-reset/', {'email': 'ALICE@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        uid, token = self.reset_link_params()

        confirm = self.client.post(
            '/api/v1/auth/password-reset/confirm/',
            {'uid': uid, 'token': token, 'password': 'Brand-new-pass-456'},
        )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.assertIn('token', confirm.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Brand-new-pass-456'))

        # the link only works once
        again = self.client.post(
            '/api/v1/auth/password-reset/confirm/',
            {'uid': uid, 'token': token, 'password': 'Another-pass-789'},
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_email_gets_same_answer_and_no_mail(self):
        response = self.client.post('/api/v1/auth/password-reset/', {'email': 'nobody@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_weak_new_password_is_rejected(self):
        self.client.post('/api/v1/auth/password-reset/', {'email': 'alice@example.com'})
        uid, token = self.reset_link_params()
        response = self.client.post('/api/v1/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'password': '123'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)


@override_settings(
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    ENQUIRY_NOTIFY_EMAIL='team@genmars.test',
)
class OnboardingTests(APITestCase):

    URL = '/api/v1/auth/users/me/profile/'

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='client@example.com', password='S3cure-pass-123', full_name='Jane Client')
        self.client.force_authenticate(self.user)

    def test_new_user_is_not_onboarded(self):
        self.assertFalse(self.client.get('/api/v1/auth/users/me/').data['onboarding_completed'])
        self.assertIsNone(self.client.get(self.URL).data['onboarding_completed_at'])

    def test_save_steps_then_complete(self):
        step = self.client.patch(self.URL, {'company_name': 'Acme Ltd', 'company_size': '2_10', 'phone_number': '+254700000000'}, format='json')
        self.assertEqual(step.status_code, status.HTTP_200_OK)
        self.assertIsNone(step.data['onboarding_completed_at'])

        done = self.client.patch(
            self.URL,
            {'services': ['websites', 'e-commerce', 'websites'], 'contact_method': 'whatsapp', 'goals': 'Sell online', 'complete': True},
            format='json',
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertEqual(done.data['services'], ['e-commerce', 'websites'])
        self.assertIsNotNone(done.data['onboarding_completed_at'])
        self.assertTrue(self.client.get('/api/v1/auth/users/me/').data['onboarding_completed'])
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone_number, '+254700000000')

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['team@genmars.test'])
        self.assertIn('Acme Ltd', mail.outbox[0].subject)

        # completing again doesn't notify twice
        self.client.patch(self.URL, {'complete': True}, format='json')
        self.assertEqual(len(mail.outbox), 1)

    def test_unknown_service_is_rejected(self):
        response = self.client.patch(self.URL, {'services': ['hacking']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_profile_needs_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.URL).status_code, status.HTTP_401_UNAUTHORIZED)
