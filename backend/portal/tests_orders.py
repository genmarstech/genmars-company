from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Invoice, Order, ServiceOffering, Task

User = get_user_model()

BRIEF = 'We sell furniture in Nairobi and need a website that shows our catalogue and takes enquiries.'


@override_settings(MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}}, ENQUIRY_NOTIFY_EMAIL='info@genmars.co.ke')
class OrderTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice Wanjiru')
        self.bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob K')
        self.edwin = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin Mwangi', is_staff=True)
        self.grace = User.objects.create_user(email='grace@example.com', password='S3cure-pass-123', full_name='Grace Otieno', is_staff=True)
        self.website = ServiceOffering.objects.get(slug='websites')

    def place(self, user=None, **extra):
        self.client.force_authenticate(user or self.alice)
        return self.client.post('/api/v1/portal/orders/', {'service': 'websites', 'brief': BRIEF, **extra}, format='json')

    def as_team(self, user=None):
        self.client.force_authenticate(user or self.edwin)

    # ---- catalogue

    def test_catalogue_is_public_and_seeded_with_prices(self):
        r = self.client.get('/api/v1/services/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        prices = {s['slug']: Decimal(s['starting_price']) for s in r.data}
        self.assertEqual(prices['websites'], 20000)
        self.assertEqual(prices['custom-software'], 150000)
        self.assertEqual(prices['maintenance'], 5000)
        self.assertEqual(len(prices), 7)

    def test_hidden_services_cannot_be_ordered(self):
        self.website.is_active = False
        self.website.save()
        self.assertNotIn('websites', [s['slug'] for s in self.client.get('/api/v1/services/').data])
        self.assertEqual(self.place().status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_staff_edit_the_catalogue(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.patch(f'/api/v1/team/services/{self.website.id}/', {'starting_price': 1}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.as_team()
        r = self.client.patch(f'/api/v1/team/services/{self.website.id}/', {'starting_price': '25000'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.website.refresh_from_db()
        self.assertEqual(self.website.starting_price, 25000)

    # ---- placing an order

    def test_placing_an_order_snapshots_price_and_emails_both_sides(self):
        r = self.place(budget='30000')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data['status'], 'submitted')
        self.assertTrue(r.data['number'].startswith(f'ORD-{timezone.localdate().year}-'))
        self.assertEqual(Decimal(r.data['starting_price']), 20000)
        recipients = [m.to[0] for m in mail.outbox]
        self.assertIn('alice@example.com', recipients)
        self.assertIn('info@genmars.co.ke', recipients)

        # a later price change doesn't rewrite the order
        self.website.starting_price = 99999
        self.website.save()
        self.assertEqual(Order.objects.get().starting_price, 20000)

    def test_order_numbers_count_up(self):
        a = self.place().data['number']
        b = self.place().data['number']
        self.assertEqual(int(b.rsplit('-', 1)[1]), int(a.rsplit('-', 1)[1]) + 1)

    def test_short_brief_and_past_date_are_refused(self):
        r = self.place(brief='a site')
        self.assertIn('brief', r.data)
        r = self.place(wanted_by=str(timezone.localdate() - timedelta(days=1)))
        self.assertIn('wanted_by', r.data)

    def test_clients_only_see_their_own_orders(self):
        order = self.place().data
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get('/api/v1/portal/orders/').data, [])
        self.assertEqual(self.client.get(f"/api/v1/portal/orders/{order['id']}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post(f"/api/v1/portal/orders/{order['id']}/cancel/").status_code, status.HTTP_404_NOT_FOUND)

    def test_clients_cannot_use_the_team_order_api(self):
        self.place()
        self.assertEqual(self.client.get('/api/v1/team/orders/').status_code, status.HTTP_403_FORBIDDEN)

    # ---- the full journey

    def test_quote_accept_and_start_a_project(self):
        order_id = self.place(wanted_by=str(timezone.localdate() + timedelta(days=40))).data['id']

        self.as_team()
        mail.outbox.clear()
        r = self.client.post(f'/api/v1/team/orders/{order_id}/quote/', {'price': '45000', 'note': 'Five pages, a catalogue and an enquiry form.'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['status'], 'quoted')
        self.assertEqual(r.data['assignee'], self.edwin.id)
        self.assertEqual(r.data['quote_valid_until'], str(timezone.localdate() + timedelta(days=30)))
        self.assertEqual(mail.outbox[-1].to, ['alice@example.com'])
        self.assertIn('KES 45,000', mail.outbox[-1].body)

        # the team can't accept on the client's behalf
        self.assertEqual(self.client.patch(f'/api/v1/team/orders/{order_id}/', {'status': 'accepted'}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.alice)
        r = self.client.get(f'/api/v1/portal/orders/{order_id}/')
        self.assertEqual(Decimal(r.data['deposit']), Decimal('13500'))
        r = self.client.post(f'/api/v1/portal/orders/{order_id}/accept/')
        self.assertEqual(r.data['status'], 'accepted')
        self.assertFalse(r.data['can_cancel'])
        self.assertEqual(mail.outbox[-1].to, ['edwin@example.com'])

        self.as_team()
        r = self.client.post(f'/api/v1/team/orders/{order_id}/start/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['status'], 'in_progress')
        order = Order.objects.get(pk=order_id)
        project = order.project
        self.assertEqual(project.client, self.alice)
        self.assertEqual(project.budget, 45000)
        self.assertEqual(project.service, 'websites')
        self.assertEqual(project.due_date, order.wanted_by)
        invoice = Invoice.objects.get(project=project)
        self.assertEqual((invoice.amount, invoice.status), (Decimal('13500'), Invoice.Status.DRAFT))
        self.assertTrue(Task.objects.filter(project=project, assignee=self.edwin).exists())

        # starting twice is refused
        self.assertEqual(self.client.post(f'/api/v1/team/orders/{order_id}/start/', {}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # the client sees the whole history, in order
        self.client.force_authenticate(self.alice)
        kinds = [(u['kind'], u['status']) for u in self.client.get(f'/api/v1/portal/orders/{order_id}/').data['updates']]
        self.assertEqual(kinds, [('status', 'submitted'), ('quote', 'quoted'), ('status', 'accepted'), ('status', 'in_progress')])

    def test_expired_quotes_cannot_be_accepted(self):
        order_id = self.place().data['id']
        self.as_team()
        self.client.post(f'/api/v1/team/orders/{order_id}/quote/', {'price': '45000'}, format='json')
        Order.objects.filter(pk=order_id).update(quote_valid_until=timezone.localdate() - timedelta(days=1))
        self.client.force_authenticate(self.alice)
        self.assertTrue(self.client.get(f'/api/v1/portal/orders/{order_id}/').data['quote_expired'])
        self.assertEqual(self.client.post(f'/api/v1/portal/orders/{order_id}/accept/').status_code, status.HTTP_400_BAD_REQUEST)

    def test_declining_and_cancelling(self):
        order_id = self.place().data['id']
        self.as_team()
        self.client.post(f'/api/v1/team/orders/{order_id}/quote/', {'price': '45000'}, format='json')
        self.client.force_authenticate(self.alice)
        r = self.client.post(f'/api/v1/portal/orders/{order_id}/decline/', {'reason': 'Over our budget for now'}, format='json')
        self.assertEqual(r.data['status'], 'declined')
        self.assertIsNotNone(r.data['closed_at'])

        other = self.place().data['id']
        self.assertEqual(self.client.post(f'/api/v1/portal/orders/{other}/cancel/').data['status'], 'cancelled')

    def test_cannot_cancel_once_work_started(self):
        order_id = self.place().data['id']
        Order.objects.filter(pk=order_id).update(status=Order.Status.IN_PROGRESS)
        self.assertEqual(self.client.post(f'/api/v1/portal/orders/{order_id}/cancel/').status_code, status.HTTP_400_BAD_REQUEST)

    # ---- comments and assignment

    def test_internal_notes_stay_internal(self):
        order_id = self.place().data['id']
        self.as_team()
        mail.outbox.clear()
        self.client.post(f'/api/v1/team/orders/{order_id}/comment/', {'body': 'Looks like a repeat client, give a discount', 'internal': True}, format='json')
        self.assertEqual(mail.outbox, [])
        self.client.post(f'/api/v1/team/orders/{order_id}/comment/', {'body': 'Do you already have a domain?'}, format='json')
        self.assertEqual(mail.outbox[-1].to, ['alice@example.com'])

        self.client.force_authenticate(self.alice)
        bodies = [u['body'] for u in self.client.get(f'/api/v1/portal/orders/{order_id}/').data['updates']]
        self.assertIn('Do you already have a domain?', bodies)
        self.assertNotIn('Looks like a repeat client, give a discount', bodies)

        r = self.client.post(f'/api/v1/portal/orders/{order_id}/comment/', {'body': 'Yes, furnitureke.co.ke'}, format='json')
        self.assertEqual(r.data['updates'][-1]['author_name'], 'You')

    def test_assigning_emails_the_assignee_and_status_change_emails_client(self):
        order_id = self.place().data['id']
        self.as_team()
        mail.outbox.clear()
        r = self.client.patch(f'/api/v1/team/orders/{order_id}/', {'assignee': self.grace.id, 'status': 'reviewing'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['alice@example.com', 'grace@example.com'])
        self.assertEqual(self.client.patch(f'/api/v1/team/orders/{order_id}/', {'assignee': self.alice.id}, format='json').status_code, status.HTTP_400_BAD_REQUEST)

    def test_team_filters_today_and_search(self):
        waiting = self.place().data['id']
        quoted = self.place().data['id']
        self.as_team()
        self.client.post(f'/api/v1/team/orders/{quoted}/quote/', {'price': '45000'}, format='json')

        self.assertEqual([o['id'] for o in self.client.get('/api/v1/team/orders/?view=needs_quote').data], [waiting])
        self.assertEqual([o['id'] for o in self.client.get('/api/v1/team/orders/?view=with_client').data], [quoted])
        self.assertEqual([o['id'] for o in self.client.get('/api/v1/team/today/').data['orders_waiting']], [waiting])
        results = self.client.get('/api/v1/team/search/?q=furniture').data
        self.assertEqual({r['kind'] for r in results} & {'order'}, {'order'})

        self.client.force_authenticate(self.alice)
        summary = self.client.get('/api/v1/portal/summary/').data
        self.assertEqual(summary['open_orders'], 2)
        self.assertEqual([q['id'] for q in summary['quotes_waiting']], [quoted])
