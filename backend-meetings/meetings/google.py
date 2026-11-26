"""Google OAuth, Calendar and Meet, called from the backend only.

Credentials come from backend/.env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) and the
stored tokens are encrypted with GOOGLE_TOKEN_KEY (or a key derived from DJANGO_SECRET_KEY).
"""

import base64
import hashlib
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import timedelta

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import signing
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import GoogleConnection

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
MEET = 'https://meet.googleapis.com/v2'

# Only what the Meetings tab uses: who connected, calendar events we create, Meet spaces we create, and
# read access to conference records (attendance, transcripts, recordings) of the account's meetings.
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/meetings.space.readonly',
]

STATE_SALT = 'meetings.google.oauth'
STATE_MAX_AGE = 600  # seconds the person has to finish signing in with Google
TIMEOUT = 15


class GoogleError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def is_configured():
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)


# ---------------------------------------------------------------- token encryption

def _fernet():
    key = settings.GOOGLE_TOKEN_KEY or base64.urlsafe_b64encode(hashlib.sha256(f"google-tokens:{settings.SECRET_KEY}".encode()).digest()).decode()
    return Fernet(key)


def encrypt(value):
    return _fernet().encrypt(value.encode()).decode() if value else ''


def decrypt(value):
    if not value:
        return ''
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return ''


# ---------------------------------------------------------------- http

def _http(method, url, *, form=None, body=None, token=None, params=None):
    """Make one request and return (status, parsed JSON). Tests replace this function."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {'Accept': 'application/json'}
    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    elif body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else {}
        except ValueError:
            return e.code, {'error': raw.decode(errors='replace')[:200]}
    except (urllib.error.URLError, TimeoutError) as e:
        raise GoogleError(f"Couldn't reach Google: {getattr(e, 'reason', e)}") from e


def _error_text(payload):
    err = payload.get('error')
    if isinstance(err, dict):
        return err.get('message') or err.get('status') or 'Google returned an error.'
    return payload.get('error_description') or err or 'Google returned an error.'


# ---------------------------------------------------------------- OAuth

def authorization_url(user):
    state = signing.dumps({'u': user.id, 'n': secrets.token_urlsafe(12)}, salt=STATE_SALT)
    params = {
        'client_id': settings.GOOGLE_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(SCOPES),
        'access_type': 'offline',
        'prompt': 'consent',
        'include_granted_scopes': 'true',
        'state': state,
    }
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def read_state(state):
    """The user id the sign-in was started for, or None if the state is forged or stale."""
    try:
        return signing.loads(state or '', salt=STATE_SALT, max_age=STATE_MAX_AGE).get('u')
    except signing.BadSignature:
        return None


def connect(code, user):
    """Swap the code from Google's redirect for tokens and store them as the company connection."""
    status, tokens = _http('POST', TOKEN_URL, form={
        'code': code,
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code',
    })
    if status != 200 or 'access_token' not in tokens:
        raise GoogleError(_error_text(tokens), status)
    status, info = _http('GET', USERINFO_URL, token=tokens['access_token'])
    if status != 200 or not info.get('email'):
        raise GoogleError("Google didn't share the account's email address.", status)

    previous = GoogleConnection.current()
    refresh = tokens.get('refresh_token') or (decrypt(previous.refresh_token) if previous and previous.account_email == info['email'] else '')
    GoogleConnection.objects.exclude(status=GoogleConnection.Status.DISCONNECTED).update(status=GoogleConnection.Status.DISCONNECTED, access_token='', refresh_token='')
    return GoogleConnection.objects.create(
        account_email=info['email'],
        access_token=encrypt(tokens['access_token']),
        refresh_token=encrypt(refresh),
        token_expiry=timezone.now() + timedelta(seconds=int(tokens.get('expires_in', 3600))),
        scopes=tokens.get('scope', ' '.join(SCOPES)),
        connected_by=user,
    )


def disconnect(conn):
    token = decrypt(conn.refresh_token) or decrypt(conn.access_token)
    if token:
        try:
            _http('POST', REVOKE_URL, form={'token': token})
        except GoogleError:
            pass  # still forget the tokens locally
    conn.status = GoogleConnection.Status.DISCONNECTED
    conn.access_token = conn.refresh_token = ''
    conn.save(update_fields=['status', 'access_token', 'refresh_token', 'updated_at'])


def _access_token(conn):
    if conn.token_expiry and conn.token_expiry > timezone.now() + timedelta(seconds=60):
        token = decrypt(conn.access_token)
        if token:
            return token
    refresh = decrypt(conn.refresh_token)
    if not refresh:
        _mark_expired(conn, 'No refresh token; connect Google again.')
    status, tokens = _http('POST', TOKEN_URL, form={
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'refresh_token': refresh,
        'grant_type': 'refresh_token',
    })
    if status != 200 or 'access_token' not in tokens:
        if tokens.get('error') in ('invalid_grant', 'unauthorized_client'):
            _mark_expired(conn, 'Google access was revoked or expired; connect Google again.')
        raise GoogleError(_error_text(tokens), status)
    conn.access_token = encrypt(tokens['access_token'])
    conn.token_expiry = timezone.now() + timedelta(seconds=int(tokens.get('expires_in', 3600)))
    conn.status = GoogleConnection.Status.CONNECTED
    conn.last_error = ''
    conn.save(update_fields=['access_token', 'token_expiry', 'status', 'last_error', 'updated_at'])
    return tokens['access_token']


def _mark_expired(conn, why):
    conn.status = GoogleConnection.Status.EXPIRED
    conn.last_error = why
    conn.save(update_fields=['status', 'last_error', 'updated_at'])
    raise GoogleError(why, 401)


class Client:
    """Authorised calls to Calendar and Meet as the connected company account."""

    def __init__(self, conn=None):
        self.conn = conn or GoogleConnection.current()
        if not self.conn:
            raise GoogleError('Google is not connected yet.')

    def call(self, method, url, body=None, params=None, ok=(200,)):
        status, payload = _http(method, url, body=body, params=params, token=_access_token(self.conn))
        if status not in ok:
            raise GoogleError(_error_text(payload), status)
        return payload

    def pages(self, url, key, params=None):
        params = dict(params or {})
        while True:
            payload = self.call('GET', url, params=params)
            yield from payload.get(key, [])
            if not payload.get('nextPageToken'):
                return
            params['pageToken'] = payload['nextPageToken']

    # -- Meet

    def create_space(self):
        return self.call('POST', f"{MEET}/spaces", body={})

    def conference_records(self, meeting):
        if meeting.google_space_name:
            filt = f'space.name = "{meeting.google_space_name}"'
        elif meeting.meeting_code:
            filt = f'space.meeting_code = "{meeting.meeting_code}"'
        else:
            return []
        return list(self.pages(f"{MEET}/conferenceRecords", 'conferenceRecords', {'filter': filt}))

    def participants(self, record):
        return list(self.pages(f"{MEET}/{record}/participants", 'participants'))

    def transcripts(self, record):
        return list(self.pages(f"{MEET}/{record}/transcripts", 'transcripts'))

    def transcript_entries(self, transcript):
        return list(self.pages(f"{MEET}/{transcript}/entries", 'transcriptEntries', {'pageSize': 100}))

    def recordings(self, record):
        return list(self.pages(f"{MEET}/{record}/recordings", 'recordings'))

    # -- Calendar

    def event_body(self, meeting, attendees):
        body = {
            'summary': meeting.title,
            'description': meeting.description,
            'start': {'dateTime': meeting.scheduled_start.isoformat(), 'timeZone': meeting.time_zone},
            'end': {'dateTime': (meeting.scheduled_end or meeting.scheduled_start + timedelta(hours=1)).isoformat(), 'timeZone': meeting.time_zone},
            'attendees': [{'email': p.email, **({'displayName': p.name} if p.name else {})} for p in attendees],
        }
        if meeting.project_id:
            body['description'] = f"{meeting.description}\n\nProject: {meeting.project.name}".strip()
        return body

    def create_event(self, meeting, attendees, notify=True):
        body = self.event_body(meeting, attendees)
        body['conferenceData'] = {'createRequest': {'requestId': uuid.uuid4().hex, 'conferenceSolutionKey': {'type': 'hangoutsMeet'}}}
        return self.call('POST', CALENDAR, body=body, params={'conferenceDataVersion': 1, 'sendUpdates': 'all' if notify else 'none'})

    def get_event(self, event_id):
        return self.call('GET', f"{CALENDAR}/{urllib.parse.quote(event_id)}")

    def update_event(self, meeting, attendees, notify=True):
        return self.call('PATCH', f"{CALENDAR}/{urllib.parse.quote(meeting.calendar_event_id)}", body=self.event_body(meeting, attendees), params={'sendUpdates': 'all' if notify else 'none'})

    def cancel_event(self, event_id, notify=True):
        self.call('DELETE', f"{CALENDAR}/{urllib.parse.quote(event_id)}", params={'sendUpdates': 'all' if notify else 'none'}, ok=(200, 204, 410))


def apply_event(meeting, event):
    """Copy the Meet link and status of a Calendar event onto the meeting (not saved)."""
    meeting.calendar_event_id = event.get('id', meeting.calendar_event_id)
    meeting.calendar_link = event.get('htmlLink', meeting.calendar_link)
    conf = event.get('conferenceData') or {}
    state = ((conf.get('createRequest') or {}).get('status') or {}).get('statusCode')
    link = event.get('hangoutLink') or next((e.get('uri') for e in conf.get('entryPoints', []) if e.get('entryPointType') == 'video'), '')
    if link:
        meeting.meet_uri = link
        meeting.meeting_code = conf.get('conferenceId', meeting.meeting_code)
        meeting.conference_status = meeting.Conference.READY
    elif state == 'failure':
        meeting.conference_status = meeting.Conference.FAILED
        meeting.google_error = 'Google could not create a Meet link for this event.'
    else:
        meeting.conference_status = meeting.Conference.PENDING


def parse_time(value):
    return parse_datetime(value) if value else None
