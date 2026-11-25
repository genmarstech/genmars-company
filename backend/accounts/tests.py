from django.contrib.auth import get_user_model
from django.core.cache import cache
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
        self.assertEqual(self.client.get('/api/v1/auth/users/').status_code, status.HTTP_403_FORBIDDEN)

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
