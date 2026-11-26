from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from company.models import Project, Task, Token, User
from . import google, sync
from .models import ActionItem, Artifact, GoogleConnection, Meeting, Participant, Point

GOOGLE = dict(GOOGLE_CLIENT_ID='cid', GOOGLE_CLIENT_SECRET='csecret', GOOGLE_REDIRECT_URI='https://api.example.com/api/v1/integrations/google/callback/', GOOGLE_TOKEN_KEY='')


class FakeGoogle:
    """Stands in for google._http: answers by method + URL and remembers every call."""

    def __init__(self):
        self.calls = []
        self.event_pending = False
        self.record_end = '2026-01-01T10:45:00Z'

    def __call__(self, method, url, *, form=None, body=None, token=None, params=None):
        self.calls.append((method, url, form, body, params))
        if url == google.TOKEN_URL:
            if form.get('grant_type') == 'refresh_token':
                return 200, {'access_token': 'fresh-access', 'expires_in': 3600}
            return 200, {'access_token': 'acc-1', 'refresh_token': 'ref-1', 'expires_in': 3600, 'scope': ' '.join(google.SCOPES)}
        if url == google.USERINFO_URL:
            return 200, {'email': 'office@genmars.co.ke'}
        if url == google.REVOKE_URL:
            return 200, {}
        if url == f"{google.MEET}/spaces":
            return 200, {'name': 'spaces/abc', 'meetingUri': 'https://meet.google.com/abc-defg-hij', 'meetingCode': 'abc-defg-hij'}
        if url.startswith(google.CALENDAR):
            if method == 'DELETE':
                return 204, {}
            event = {'id': 'evt1', 'htmlLink': 'https://calendar.google.com/event?eid=1', 'status': 'confirmed',
                     'attendees': [{'email': 'guest@client.com', 'responseStatus': 'accepted'}]}
            if self.event_pending:
                event['conferenceData'] = {'createRequest': {'status': {'statusCode': 'pending'}}}
            else:
                event['hangoutLink'] = 'https://meet.google.com/xyz-abcd-efg'
                event['conferenceData'] = {'conferenceId': 'xyz-abcd-efg', 'createRequest': {'status': {'statusCode': 'success'}}}
            return 200, event
        if url == f"{google.MEET}/conferenceRecords":
            return 200, {'conferenceRecords': [{'name': 'conferenceRecords/r1', 'startTime': '2026-01-01T10:02:00Z', 'endTime': self.record_end}]}
        if url.endswith('/participants'):
            return 200, {'participants': [
                {'name': 'conferenceRecords/r1/participants/p1', 'signedinUser': {'displayName': 'Edwin Mwangi'},
                 'earliestStartTime': '2026-01-01T10:02:00Z', 'latestEndTime': '2026-01-01T10:45:00Z'},
            ]}
        if url.endswith('/transcripts'):
            return 200, {'transcripts': [{'name': 'conferenceRecords/r1/transcripts/t1', 'state': 'FILE_GENERATED',
                                          'docsDestination': {'exportUri': 'https://docs.google.com/document/d/1'}}]}
        if url.endswith('/entries'):
            return 200, {'transcriptEntries': [
                {'participant': 'conferenceRecords/r1/participants/p1', 'text': 'We ship on Friday.', 'startTime': '2026-01-01T10:05:00Z'},
            ]}
        if url.endswith('/recordings'):
            return 200, {'recordings': []}
        return 404, {'error': {'message': f'unexpected {method} {url}'}}


@override_settings(MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}}, MEETINGS_URL='http://meetings.example.com', **GOOGLE)
class MeetingsTests(APITestCase):

    def setUp(self):
        self.edwin = User.objects.create(email='edwin@example.com', full_name='Edwin Mwangi', is_staff=True)
        self.grace = User.objects.create(email='grace@example.com', full_name='Grace Otieno', is_staff=True)
        self.owner = User.objects.create(email='owner@example.com', full_name='Owner Person', is_staff=True, is_superuser=True)
        self.alice = User.objects.create(email='alice@example.com', full_name='Alice Client')
        self.project = Project.objects.create(client=self.alice, name='Website redesign', status='in_progress')
        self.fake = FakeGoogle()
        patcher = mock.patch.object(google, '_http', self.fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client.force_authenticate(self.edwin)

    def connect(self):
        return GoogleConnection.objects.create(
            account_email='office@genmars.co.ke', access_token=google.encrypt('acc-1'), refresh_token=google.encrypt('ref-1'),
            token_expiry=timezone.now() + timedelta(hours=1), connected_by=self.owner,
        )

    def schedule(self, **extra):
        start = timezone.now() + timedelta(days=1)
        body = {
            'title': 'Sprint review', 'category': 'project', 'project': self.project.id,
            'scheduled_start': start.isoformat(), 'scheduled_end': (start + timedelta(hours=1)).isoformat(),
            'team': [self.grace.id], 'guests': ['guest@client.com'], 'agenda_lines': ['Demo', 'Next steps'], **extra,
        }
        return self.client.post('/api/v1/meetings/', body, format='json')

    # ---- access

    def test_signs_in_with_the_main_sites_token(self):
        Token.objects.create(key='k' * 40, user=self.grace)
        self.client = self.client_class()  # signed out
        self.assertEqual(self.client.get('/api/v1/meetings/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + 'k' * 40)
        self.assertEqual(self.client.get('/api/v1/meetings/').status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + 'x' * 40)
        self.assertEqual(self.client.get('/api/v1/meetings/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_clients_cannot_see_meetings(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get('/api/v1/meetings/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/v1/meetings/overview/').status_code, status.HTTP_403_FORBIDDEN)

    # ---- Google OAuth

    def test_only_owner_can_connect_google(self):
        self.assertEqual(self.client.get('/api/v1/integrations/google/connect/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/v1/integrations/google/connect/')
        self.assertEqual(res.status_code, 200)
        q = parse_qs(urlparse(res.data['url']).query)
        self.assertEqual(q['access_type'], ['offline'])
        self.assertIn('https://www.googleapis.com/auth/calendar.events', q['scope'][0])
        self.assertEqual(google.read_state(q['state'][0]), self.owner.id)

    def test_callback_stores_encrypted_tokens(self):
        state = google.authorization_url(self.owner).split('state=')[1]
        self.client = self.client_class()  # signed out
        res = self.client.get('/api/v1/integrations/google/callback/', {'code': 'c0de', 'state': parse_qs(f'state={state}')['state'][0]})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res['Location'], 'http://meetings.example.com/?google=connected')
        conn = GoogleConnection.current()
        self.assertEqual(conn.account_email, 'office@genmars.co.ke')
        self.assertNotIn('acc-1', conn.access_token)
        self.assertEqual(google.decrypt(conn.refresh_token), 'ref-1')

    def test_callback_rejects_forged_state(self):
        self.client = self.client_class()  # signed out
        res = self.client.get('/api/v1/integrations/google/callback/', {'code': 'c0de', 'state': 'forged'})
        self.assertTrue(res['Location'].endswith('?google=invalid'))
        self.assertIsNone(GoogleConnection.current())
        # a state made for someone who isn't an owner is refused too
        state = google.authorization_url(self.edwin).split('state=')[1]
        res = self.client.get('/api/v1/integrations/google/callback/', {'code': 'c0de', 'state': parse_qs(f'state={state}')['state'][0]})
        self.assertTrue(res['Location'].endswith('?google=invalid'))

    def test_expired_token_is_refreshed(self):
        conn = self.connect()
        conn.token_expiry = timezone.now() - timedelta(minutes=1)
        conn.save()
        self.assertEqual(google._access_token(conn), 'fresh-access')
        conn.refresh_from_db()
        self.assertEqual(google.decrypt(conn.access_token), 'fresh-access')

    def test_disconnect_revokes_and_forgets(self):
        self.connect()
        self.client.force_authenticate(self.owner)
        res = self.client.post('/api/v1/integrations/google/disconnect/')
        self.assertFalse(res.data['connected'])
        self.assertIsNone(GoogleConnection.current())
        self.assertTrue(any(c[1] == google.REVOKE_URL for c in self.fake.calls))

    # ---- meetings

    def test_schedule_creates_calendar_event_with_meet_link(self):
        self.connect()
        res = self.schedule()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        m = Meeting.objects.get()
        self.assertEqual(m.meet_uri, 'https://meet.google.com/xyz-abcd-efg')
        self.assertEqual(m.conference_status, Meeting.Conference.READY)
        self.assertEqual(m.calendar_event_id, 'evt1')
        self.assertEqual({p.email for p in m.participants.all()}, {'edwin@example.com', 'grace@example.com', 'guest@client.com'})
        self.assertTrue(m.participants.get(email='guest@client.com').is_guest)
        self.assertEqual([a.title for a in m.agenda.all()], ['Demo', 'Next steps'])
        post = next(c for c in self.fake.calls if c[0] == 'POST' and c[1] == google.CALENDAR)
        self.assertEqual(post[4], {'conferenceDataVersion': 1, 'sendUpdates': 'all'})
        self.assertEqual(len(post[3]['attendees']), 3)

    def test_schedule_without_google_still_keeps_the_record(self):
        res = self.schedule()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Meeting.objects.get().conference_status, Meeting.Conference.NONE)

    def test_pending_meet_link_is_picked_up_by_sync(self):
        self.connect()
        self.fake.event_pending = True
        self.schedule()
        m = Meeting.objects.get()
        self.assertEqual(m.conference_status, Meeting.Conference.PENDING)
        self.fake.event_pending = False
        sync.sync_meeting(m)
        m.refresh_from_db()
        self.assertEqual(m.meet_uri, 'https://meet.google.com/xyz-abcd-efg')

    def test_schedule_rejects_bad_times(self):
        res = self.schedule(scheduled_end=(timezone.now() + timedelta(hours=1)).isoformat())
        self.assertIn('scheduled_end', res.data)

    def test_instant_meeting_needs_google(self):
        self.assertEqual(self.client.post('/api/v1/meetings/instant/', {}).status_code, status.HTTP_409_CONFLICT)
        self.connect()
        res = self.client.post('/api/v1/meetings/instant/', {'title': 'Quick sync'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['meet_uri'], 'https://meet.google.com/abc-defg-hij')
        self.assertEqual(res.data['status'], 'live')
        self.assertEqual(Meeting.objects.get().google_space_name, 'spaces/abc')

    def test_cancel_keeps_record_and_cancels_event(self):
        self.connect()
        mid = self.schedule().data['id']
        self.assertEqual(self.client.delete(f'/api/v1/meetings/{mid}/').status_code, 204)
        self.assertEqual(Meeting.objects.get().status, Meeting.Status.CANCELLED)
        self.assertTrue(any(c[0] == 'DELETE' for c in self.fake.calls))

    def test_adding_a_guest_updates_the_calendar(self):
        self.connect()
        mid = self.schedule().data['id']
        res = self.client.post(f'/api/v1/meetings/{mid}/participants/', {'email': 'new@client.com', 'name': 'New Person'})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['role'], 'guest')
        self.assertTrue(any(c[0] == 'PATCH' for c in self.fake.calls))
        dup = self.client.post(f'/api/v1/meetings/{mid}/participants/', {'email': 'NEW@client.com'})
        self.assertEqual(dup.status_code, 400)

    def test_lists_and_search(self):
        mid = self.schedule().data['id']
        Point.objects.create(meeting_id=mid, kind='decision', title='Move launch to March', status='proposed')
        self.assertEqual([m['id'] for m in self.client.get('/api/v1/meetings/?view=upcoming').data], [mid])
        self.assertEqual(self.client.get('/api/v1/meetings/?view=history').data, [])
        self.assertEqual(len(self.client.get('/api/v1/meetings/?q=launch').data), 1)
        self.assertEqual(len(self.client.get(f'/api/v1/meetings/?project={self.project.id}').data), 1)
        self.assertEqual(self.client.get('/api/v1/meetings/?q=nothing-like-this').data, [])

    def test_past_meetings_become_completed(self):
        mid = self.schedule().data['id']
        Meeting.objects.filter(pk=mid).update(scheduled_start=timezone.now() - timedelta(hours=3), scheduled_end=timezone.now() - timedelta(hours=2))
        self.assertEqual(self.client.get('/api/v1/meetings/?view=history').data[0]['status'], 'completed')

    # ---- the record

    def test_decisions_need_approval(self):
        mid = self.schedule().data['id']
        url = f'/api/v1/meetings/{mid}/points/'
        res = self.client.post(url, {'kind': 'decision', 'title': 'Use Postgres', 'status': 'approved'})
        self.assertEqual(res.status_code, 400)
        res = self.client.post(url, {'kind': 'decision', 'title': 'Use Postgres'})
        self.assertEqual(res.data['status'], 'proposed')
        res = self.client.post(f"{url}{res.data['id']}/approve/")
        self.assertEqual(res.data['status'], 'approved')
        self.assertEqual(res.data['approved_by_name'], 'Edwin Mwangi')

    def test_solution_answers_a_problem(self):
        mid = self.schedule().data['id']
        url = f'/api/v1/meetings/{mid}/points/'
        problem = self.client.post(url, {'kind': 'problem', 'title': 'Slow checkout'}).data
        self.assertEqual(problem['status'], 'open')
        sol = self.client.post(url, {'kind': 'solution', 'title': 'Cache prices', 'problem': problem['id']})
        self.assertEqual(sol.data['status'], 'proposed')
        bad = self.client.post(url, {'kind': 'problem', 'title': 'x', 'status': 'proposed'})
        self.assertIn('status', bad.data)

    def test_action_item_becomes_a_task_and_stays_in_step(self):
        mid = self.schedule().data['id']
        item = self.client.post(f'/api/v1/meetings/{mid}/actions/', {'title': 'Send the invoice', 'assignee': self.grace.id}).data
        res = self.client.post(f"/api/v1/meetings/{mid}/actions/{item['id']}/task/")
        self.assertEqual(res.status_code, 201)
        task = Task.objects.get()
        self.assertEqual((task.assignee, task.project, task.created_by), (self.grace, self.project, self.edwin))
        self.assertIn('Sprint review', task.notes)
        # making it again doesn't duplicate
        self.client.post(f"/api/v1/meetings/{mid}/actions/{item['id']}/task/")
        self.assertEqual(Task.objects.count(), 1)
        # the task is the source of truth for status, both ways
        task.status = 'done'
        task.save()
        self.assertEqual(self.client.get(f'/api/v1/meetings/{mid}/').data['actions'][0]['status'], 'done')
        self.client.patch(f"/api/v1/meetings/{mid}/actions/{item['id']}/", {'status': 'doing'})
        task.refresh_from_db()
        self.assertEqual(task.status, 'doing')

    def test_report_approval_is_for_organizer_or_owner(self):
        mid = self.schedule().data['id']
        self.client.force_authenticate(self.grace)
        self.assertEqual(self.client.post(f'/api/v1/meetings/{mid}/report/', {'step': 'approve'}).status_code, 403)
        self.client.force_authenticate(self.edwin)
        self.assertEqual(self.client.post(f'/api/v1/meetings/{mid}/report/', {'step': 'approve'}).status_code, 400)
        self.client.patch(f'/api/v1/meetings/{mid}/', {'summary': 'Agreed the launch plan.'})
        res = self.client.post(f'/api/v1/meetings/{mid}/report/', {'step': 'approve'})
        self.assertEqual(res.data['report_status'], 'approved')
        # editing an approved summary sends it back for review
        self.client.patch(f'/api/v1/meetings/{mid}/', {'summary': 'Changed.'})
        self.assertEqual(Meeting.objects.get().report_status, 'review')

    def test_notes_belong_to_their_author(self):
        mid = self.schedule().data['id']
        note = self.client.post(f'/api/v1/meetings/{mid}/notes/', {'body': 'Client wants dark mode'}).data
        self.client.force_authenticate(self.grace)
        self.assertEqual(self.client.delete(f"/api/v1/meetings/{mid}/notes/{note['id']}/").status_code, 403)

    # ---- sync

    def test_sync_copies_attendance_and_transcript_once(self):
        self.connect()
        mid = self.schedule().data['id']
        m = Meeting.objects.get(pk=mid)
        Meeting.objects.filter(pk=mid).update(scheduled_start=timezone.now() - timedelta(hours=2), scheduled_end=timezone.now() - timedelta(hours=1))
        m.refresh_from_db()
        found = sync.sync_meeting(m)
        self.assertIn('transcript', found)
        m.refresh_from_db()
        self.assertEqual(m.status, Meeting.Status.COMPLETED)
        self.assertIsNotNone(m.actual_start)
        self.assertTrue(m.participants.get(email='edwin@example.com').attended)
        self.assertEqual(m.participants.get(email='guest@client.com').response, 'accepted')
        transcript = Artifact.objects.get()
        self.assertIn('Edwin Mwangi: We ship on Friday.', transcript.content)
        self.assertTrue(m.sync_done)
        sync.sync_meeting(m)
        self.assertEqual(Artifact.objects.count(), 1)

    def test_sync_retries_while_transcript_is_pending(self):
        self.connect()
        self.fake.record_end = None
        m = Meeting.objects.create(title='Live call', kind='instant', status='live', organizer=self.edwin, scheduled_start=timezone.now(), google_space_name='spaces/abc')
        sync.sync_meeting(m)
        m.refresh_from_db()
        self.assertFalse(m.sync_done)
        self.assertIsNotNone(m.next_sync_at)
        self.assertEqual(m.status, 'live')

    def test_directory_lists_team_and_open_projects(self):
        Project.objects.create(client=self.alice, name='Old site', status='completed')
        data = self.client.get('/api/v1/meetings/directory/').data
        self.assertEqual([s['full_name'] for s in data['staff']], ['Edwin Mwangi', 'Grace Otieno', 'Owner Person'])
        self.assertEqual([p['name'] for p in data['projects']], ['Website redesign'])
        self.assertFalse(data['me']['is_owner'])

    def test_overview(self):
        self.connect()
        mid = self.schedule().data['id']
        ActionItem.objects.create(meeting_id=mid, title='Mine', assignee=self.edwin)
        data = self.client.get('/api/v1/meetings/overview/').data
        self.assertEqual(data['upcoming_count'], 1)
        self.assertEqual(data['open_actions'], 1)
        self.assertEqual(data['my_actions'][0]['title'], 'Mine')
        self.assertTrue(data['google']['connected'])
        self.assertNotIn('access_token', str(data))
        self.assertEqual(sum(data['trends']['upcoming']), 1)
        self.assertEqual(len(data['trends']['held']), 8)
        self.assertEqual(data['upcoming'][0]['people'][:1], ['Edwin Mwangi'])
