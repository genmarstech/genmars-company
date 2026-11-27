from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Project

User = get_user_model()


def rows(data):
    return data['results'] if isinstance(data, dict) else data


class InternalProductTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice Wanjiru')
        self.edwin = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin Mwangi', is_staff=True)
        self.client.force_authenticate(self.edwin)

    def make(self, **extra):
        r = self.client.post('/api/v1/team/projects/', {'kind': 'internal', 'name': 'Velora', 'summary': 'Bookings for salons', **extra}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        return r.data

    def test_internal_project_starts_in_testing_without_a_client(self):
        p = self.make()
        self.assertEqual(p['stage'], 'testing')
        self.assertIsNone(p['client'])
        self.assertEqual(p['client_name'], 'Genmars')

    def test_internal_project_cannot_have_a_client_and_client_project_needs_one(self):
        r = self.client.post('/api/v1/team/projects/', {'kind': 'internal', 'name': 'X', 'client': self.alice.id}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        r = self.client.post('/api/v1/team/projects/', {'name': 'Site'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('client', r.data)

    def test_stage_cannot_be_patched_directly(self):
        p = self.make()
        self.client.patch(f"/api/v1/team/projects/{p['id']}/", {'stage': 'production'}, format='json')
        self.assertEqual(Project.objects.get(pk=p['id']).stage, 'testing')

    def test_testing_products_are_hidden_and_live_ones_are_listed(self):
        p = self.make()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/products/').data, [])

        self.client.force_authenticate(self.edwin)
        r = self.client.post(f"/api/v1/team/projects/{p['id']}/go-live/", {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('app_url', r.data)
        r = self.client.post(f"/api/v1/team/projects/{p['id']}/go-live/", {'app_url': 'https://velora.genmars.co.ke'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['stage'], 'production')
        self.assertIsNotNone(r.data['went_live_at'])

        self.client.force_authenticate(None)
        live = self.client.get('/api/v1/products/').data
        self.assertEqual([x['name'] for x in live], ['Velora'])
        self.assertEqual(live[0]['url'], 'https://velora.genmars.co.ke')

        self.client.force_authenticate(self.alice)
        summary = self.client.get('/api/v1/portal/summary/').data
        self.assertEqual([x['name'] for x in summary['products']], ['Velora'])
        # it is not one of her projects
        self.assertEqual(rows(self.client.get('/api/v1/portal/projects/').data), [])

        self.client.force_authenticate(self.edwin)
        r = self.client.post(f"/api/v1/team/projects/{p['id']}/back-to-testing/")
        self.assertEqual(r.data['stage'], 'testing')
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/products/').data, [])

    def test_client_projects_have_no_stage(self):
        p = Project.objects.create(client=self.alice, name='Site')
        r = self.client.post(f"/api/v1/team/projects/{p.id}/go-live/", {'app_url': 'https://x.com'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_projects_work_across_the_dashboard(self):
        p = self.make()
        for url in ['/api/v1/team/today/', '/api/v1/team/profitability/', '/api/v1/team/search/?q=Velora', '/api/v1/team/summary/', '/api/v1/team/projects/?kind=internal']:
            r = self.client.get(url)
            self.assertEqual(r.status_code, status.HTTP_200_OK, url)
        r = self.client.post('/api/v1/team/tasks/', {'title': 'Write tests', 'project': p['id']}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        r = self.client.post('/api/v1/team/time/', {'project': p['id'], 'date': '2026-11-27', 'minutes': 60}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(rows(self.client.get('/api/v1/team/time/').data)[0]['client_name'], 'Genmars')
