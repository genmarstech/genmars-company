from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from applications_communications.models import Enquiry
from .models import ClientNote, Invoice, Message, Milestone, Project, StaffRate, Task, TimeEntry

User = get_user_model()


@override_settings(MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}}, TEAM_DEFAULT_HOURLY_COST=1000)
class WorkspaceTests(APITestCase):

    def setUp(self):
        self.today = timezone.localdate()
        self.alice = User.objects.create_user(email='alice@example.com', password='S3cure-pass-123', full_name='Alice Wanjiru')
        self.bob = User.objects.create_user(email='bob@example.com', password='S3cure-pass-123', full_name='Bob K')
        self.edwin = User.objects.create_user(email='edwin@example.com', password='S3cure-pass-123', full_name='Edwin Mwangi', is_staff=True)
        self.grace = User.objects.create_user(email='grace@example.com', password='S3cure-pass-123', full_name='Grace Otieno', is_staff=True)
        self.owner = User.objects.create_superuser(email='owner@example.com', password='S3cure-pass-123', full_name='Owner Person')
        self.site = Project.objects.create(client=self.alice, name='Website redesign', status='in_progress', budget=100000)
        self.shop = Project.objects.create(client=self.bob, name='Online shop', status='in_progress')
        self.client.force_authenticate(self.edwin)

    # ---- tasks

    def test_assigning_a_task_emails_the_assignee_and_fills_client(self):
        r = self.client.post('/api/v1/team/tasks/', {'title': 'Send wireframes', 'project': self.site.id, 'assignee': self.grace.id, 'due_date': str(self.today)}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['client'], self.alice.id)
        self.assertEqual(r.data['created_by_name'], 'Edwin Mwangi')
        self.assertEqual(mail.outbox[-1].to, ['grace@example.com'])
        self.assertIn('Send wireframes', mail.outbox[-1].subject)

    def test_no_email_when_assigning_to_myself(self):
        self.client.post('/api/v1/team/tasks/', {'title': 'Note to self', 'assignee': self.edwin.id}, format='json')
        self.assertEqual(len(mail.outbox), 0)

    def test_tasks_only_go_to_team_and_match_the_project_client(self):
        r = self.client.post('/api/v1/team/tasks/', {'title': 'X', 'assignee': self.alice.id}, format='json')
        self.assertIn('assignee', r.data)
        r = self.client.post('/api/v1/team/tasks/', {'title': 'X', 'project': self.site.id, 'client': self.bob.id}, format='json')
        self.assertIn('client', r.data)

    def test_my_work_and_completing_a_task(self):
        mine = Task.objects.create(title='Mine', assignee=self.edwin)
        Task.objects.create(title='Hers', assignee=self.grace)
        rows = self.client.get('/api/v1/team/tasks/?mine=1&open=1').data
        self.assertEqual([t['title'] for t in rows], ['Mine'])
        done = self.client.patch(f'/api/v1/team/tasks/{mine.id}/', {'status': 'done'}, format='json')
        self.assertIsNotNone(done.data['completed_at'])
        self.assertEqual(self.client.get('/api/v1/team/tasks/?mine=1&open=1').data, [])
        back = self.client.patch(f'/api/v1/team/tasks/{mine.id}/', {'status': 'todo'}, format='json')
        self.assertIsNone(back.data['completed_at'])

    def test_staff_list(self):
        names = [s['full_name'] for s in self.client.get('/api/v1/team/staff/').data]
        self.assertEqual(names, ['Edwin Mwangi', 'Grace Otieno', 'Owner Person'])

    # ---- time and profitability

    def test_logging_time_and_only_editing_my_own(self):
        r = self.client.post('/api/v1/team/time/', {'project': self.site.id, 'date': str(self.today), 'minutes': 90, 'note': 'Homepage'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['user_name'], 'Edwin Mwangi')
        self.client.force_authenticate(self.grace)
        self.assertEqual(self.client.delete(f"/api/v1/team/time/{r.data['id']}/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(self.client.get('/api/v1/team/time/?mine=1').data), 0)

    def test_time_rules(self):
        too_long = self.client.post('/api/v1/team/time/', {'project': self.site.id, 'date': str(self.today), 'minutes': 2000}, format='json')
        self.assertIn('minutes', too_long.data)
        task = Task.objects.create(title='Shop task', project=self.shop, client=self.bob)
        wrong = self.client.post('/api/v1/team/time/', {'project': self.site.id, 'task': task.id, 'date': str(self.today), 'minutes': 30}, format='json')
        self.assertIn('task', wrong.data)

    def test_profitability_uses_rates_and_invoices(self):
        StaffRate.objects.create(user=self.grace, hourly_cost=2000)
        TimeEntry.objects.create(project=self.site, user=self.edwin, date=self.today, minutes=600)   # 10h × 1,000
        TimeEntry.objects.create(project=self.site, user=self.grace, date=self.today, minutes=300)   # 5h × 2,000
        Invoice.objects.create(client=self.alice, project=self.site, number='P1', amount=60000, status='paid')
        Invoice.objects.create(client=self.alice, project=self.site, number='P2', amount=99999, status='draft')
        Invoice.objects.create(client=self.bob, project=self.shop, number='P3', amount=30000, status='sent')
        data = self.client.get('/api/v1/team/profitability/').data
        rows = {r['name']: r for r in data['projects']}
        site = rows['Website redesign']
        self.assertEqual((site['value'], site['invoiced'], site['paid'], site['minutes']), (100000, 60000, 60000, 900))
        self.assertEqual((site['cost'], site['profit'], site['margin']), (20000, 80000, 80))
        self.assertEqual(rows['Online shop']['value'], 30000)  # no budget, so what's invoiced
        self.assertEqual(data['totals']['profit'], 110000)

    def test_only_owners_set_rates(self):
        self.assertEqual(self.client.patch(f'/api/v1/team/staff/{self.grace.id}/', {'hourly_cost': 5000}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.owner)
        r = self.client.patch(f'/api/v1/team/staff/{self.grace.id}/', {'hourly_cost': 5000}, format='json')
        self.assertEqual((r.data['hourly_cost'], r.data['has_own_rate']), (5000, True))
        r = self.client.patch(f'/api/v1/team/staff/{self.grace.id}/', {'hourly_cost': ''}, format='json')
        self.assertEqual((r.data['hourly_cost'], r.data['has_own_rate']), (1000, False))

    # ---- client notes and activity

    def test_notes_pin_and_ownership(self):
        r = self.client.post('/api/v1/team/notes/', {'client': self.alice.id, 'body': 'Prefers WhatsApp after 5pm'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        nid = r.data['id']
        self.client.force_authenticate(self.grace)
        self.assertEqual(self.client.patch(f'/api/v1/team/notes/{nid}/', {'pinned': True}, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.patch(f'/api/v1/team/notes/{nid}/', {'body': 'changed'}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(f'/api/v1/team/notes/{nid}/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self.client.get(f'/api/v1/team/notes/?client={self.alice.id}').data[0]['pinned'])

    def test_client_activity_and_overview(self):
        Enquiry.objects.create(full_name='Alice Wanjiru', email='ALICE@example.com', message='We need a new site', service='website')
        Milestone.objects.create(project=self.site, title='Design', status='done', completed_at=timezone.now())
        Invoice.objects.create(client=self.alice, project=self.site, number='A1', amount=40000, status='paid', issued_on=self.today, paid_on=self.today)
        Message.objects.create(client=self.alice, sender=self.alice, body='Love it')
        ClientNote.objects.create(client=self.alice, author=self.edwin, body='Met at the expo')
        Task.objects.create(title='Launch', client=self.alice, assignee=self.grace, status='done', completed_at=timezone.now())
        Project.objects.create(client=self.bob, name='Not hers')

        kinds = {e['kind'] for e in self.client.get(f'/api/v1/team/clients/{self.alice.id}/activity/').data}
        self.assertEqual(kinds, {'account', 'lead', 'project', 'milestone', 'invoice', 'payment', 'message', 'note', 'task'})
        overview = self.client.get(f'/api/v1/team/clients/{self.alice.id}/overview/').data
        self.assertEqual([p['name'] for p in overview['projects']], ['Website redesign'])
        self.assertEqual(overview['paid'], 40000)
        self.assertEqual(self.client.get(f'/api/v1/team/clients/{self.edwin.id}/overview/').status_code, status.HTTP_404_NOT_FOUND)

    # ---- today

    def test_today_priorities(self):
        Invoice.objects.create(client=self.alice, number='OD1', amount=25000, status='sent', due_on=self.today - timedelta(days=4))
        Invoice.objects.create(client=self.alice, number='OK1', amount=5000, status='sent', due_on=self.today + timedelta(days=4))
        fresh = Enquiry.objects.create(full_name='Fresh', email='f@example.com', message='hi')
        cold = Enquiry.objects.create(full_name='Cold', email='c@example.com', message='hi', status='contacted')
        Enquiry.objects.filter(pk=cold.pk).update(updated_at=timezone.now() - timedelta(days=9))
        self.site.health = 'at_risk'
        self.site.due_date = self.today - timedelta(days=2)
        self.site.save()
        Project.objects.filter(pk=self.shop.pk).update(updated_at=timezone.now() - timedelta(days=20), created_at=timezone.now() - timedelta(days=30))
        Task.objects.create(title='Overdue thing', assignee=self.edwin, due_date=self.today - timedelta(days=1))
        Task.objects.create(title='Later thing', assignee=self.edwin, due_date=self.today + timedelta(days=5))
        Task.objects.create(title='Not mine', assignee=self.grace, due_date=self.today)

        data = self.client.get('/api/v1/team/today/').data
        self.assertEqual([i['number'] for i in data['overdue_invoices']], ['OD1'])
        self.assertEqual(data['overdue_invoices'][0]['days'], 4)
        self.assertEqual([l['name'] for l in data['stalled_leads']], ['Cold'])
        self.assertNotIn(fresh.full_name, [l['name'] for l in data['stalled_leads']])
        risky = {p['name']: p['reasons'] for p in data['at_risk_projects']}
        self.assertEqual(risky['Website redesign'], ['At risk', '2 days past due'])
        self.assertEqual(risky['Online shop'], ['No activity for 20 days'])
        self.assertEqual([t['title'] for t in data['my_tasks_due']], ['Overdue thing'])
        self.assertEqual(data['my_open_tasks'], 2)

    def test_recent_time_keeps_a_project_off_the_quiet_list(self):
        Project.objects.filter(pk=self.shop.pk).update(updated_at=timezone.now() - timedelta(days=20), created_at=timezone.now() - timedelta(days=30))
        TimeEntry.objects.create(project=self.shop, user=self.edwin, date=self.today, minutes=30)
        names = [p['name'] for p in self.client.get('/api/v1/team/today/').data['at_risk_projects']]
        self.assertNotIn('Online shop', names)

    # ---- search and access

    def test_search_across_everything(self):
        Invoice.objects.create(client=self.alice, number='GM-2026-014', amount=1000)
        Enquiry.objects.create(full_name='Wanjiru Bakery', email='w@example.com', message='A shop')
        Task.objects.create(title='Call Wanjiru about logo')
        kinds = sorted(r['kind'] for r in self.client.get('/api/v1/team/search/?q=wanjiru').data)
        self.assertEqual(kinds, ['client', 'invoice', 'lead', 'project', 'task'])
        self.assertEqual(self.client.get('/api/v1/team/search/?q=GM-2026').data[0]['url'].split('#')[0], '/team/invoices')
        self.assertEqual(self.client.get('/api/v1/team/search/?q=w').data, [])

    def test_clients_cannot_reach_any_of_it(self):
        self.client.force_authenticate(self.alice)
        for url in ['/api/v1/team/today/', '/api/v1/team/tasks/', '/api/v1/team/time/', '/api/v1/team/profitability/',
                    '/api/v1/team/notes/', f'/api/v1/team/clients/{self.alice.id}/activity/', '/api/v1/team/search/?q=web',
                    '/api/v1/team/staff/']:
            self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN, url)
