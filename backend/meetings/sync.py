"""Keep meetings in step with Google: Meet links still being created, RSVPs, attendance, transcripts and
recordings. Artifacts appear some time after a meeting ends, so a meeting is checked again with backoff
until everything Google made for it has been copied in, or MAX_ATTEMPTS is reached.

Safe to repeat: artifacts are keyed by Google's resource name, so a rerun never duplicates anything.
Run `python manage.py sync_meetings` every 10–15 minutes (see the README in this app).
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from . import google
from .models import Artifact, GoogleConnection, Meeting, Participant, log

MAX_ATTEMPTS = 8
FIRST_RETRY = timedelta(minutes=10)
LONGEST_RETRY = timedelta(hours=6)
# Google usually has transcripts ready within this long after the call ends.
SETTLE_AFTER = timedelta(minutes=30)
# A Meet call with no end time from Google is treated as over after this long.
INSTANT_MAX = timedelta(hours=12)
FINAL_STATES = {'FILE_GENERATED', 'ENDED_WITH_ERROR'}


def refresh_statuses(now=None):
    """Mark meetings whose time has passed as completed. Google sync fills in the real times later."""
    now = now or timezone.now()
    grace = timedelta(minutes=15)
    over = Q(scheduled_end__lt=now - grace) | Q(scheduled_end__isnull=True, scheduled_start__lt=now - INSTANT_MAX)
    stale = Meeting.objects.filter(status__in=[Meeting.Status.PLANNED, Meeting.Status.LIVE]).filter(over)
    for m in stale:
        m.status = Meeting.Status.COMPLETED
        if not m.next_sync_at and (m.google_space_name or m.meeting_code):
            m.next_sync_at = now
        m.save(update_fields=['status', 'next_sync_at', 'updated_at'])


def due(now=None):
    now = now or timezone.now()
    return (
        Meeting.objects.exclude(status=Meeting.Status.CANCELLED)
        .filter(sync_done=False, scheduled_start__lte=now + timedelta(minutes=5))
        .filter(Q(google_space_name__gt='') | Q(meeting_code__gt='') | Q(calendar_event_id__gt=''))
        .filter(Q(next_sync_at__isnull=True) | Q(next_sync_at__lte=now))
    )


def sync_meeting(meeting, client=None, now=None):
    """Pull everything Google has for one meeting. Returns a short summary of what changed."""
    now = now or timezone.now()
    client = client or google.Client()
    found = []

    if meeting.calendar_event_id:
        event = client.get_event(meeting.calendar_event_id)
        had_link = bool(meeting.meet_uri)
        google.apply_event(meeting, event)
        if meeting.meet_uri and not had_link:
            found.append('Meet link')
        if event.get('status') == 'cancelled' and meeting.status != Meeting.Status.CANCELLED:
            meeting.status = Meeting.Status.CANCELLED
            found.append('cancelled in Google Calendar')
        answers = {a.get('email', '').lower(): a.get('responseStatus') for a in event.get('attendees', [])}
        for p in meeting.participants.all():
            answer = answers.get(p.email.lower())
            if answer in Participant.Response.values and answer != p.response:
                p.response = answer
                p.save(update_fields=['response'])

    records = client.conference_records(meeting) if (meeting.google_space_name or meeting.meeting_code) else []
    pending = False
    if records:
        starts = [google.parse_time(r.get('startTime')) for r in records if r.get('startTime')]
        ends = [google.parse_time(r.get('endTime')) for r in records]
        ongoing = any(e is None for e in ends)
        if starts:
            meeting.actual_start = min(starts)
        if not ongoing:
            meeting.actual_end = max(ends)
        if ongoing and meeting.status == Meeting.Status.PLANNED:
            meeting.status = Meeting.Status.LIVE
        elif not ongoing and meeting.status in (Meeting.Status.PLANNED, Meeting.Status.LIVE):
            meeting.status = Meeting.Status.COMPLETED

        for record in records:
            names = _attendance(meeting, client, record['name'])
            pending |= _transcripts(meeting, client, record['name'], names, found)
            pending |= _recordings(meeting, client, record['name'], found)

    ended_at = meeting.actual_end or (meeting.ends_at if meeting.status == Meeting.Status.COMPLETED else None)
    settled = ended_at and now >= ended_at + SETTLE_AFTER and not pending
    meeting.last_synced_at = now
    meeting.sync_attempts += 1
    if meeting.status == Meeting.Status.CANCELLED or settled or meeting.sync_attempts >= MAX_ATTEMPTS:
        meeting.sync_done = True
        meeting.next_sync_at = None
    else:
        wait = FIRST_RETRY * (2 ** max(meeting.sync_attempts - 1, 0)) if ended_at else FIRST_RETRY
        meeting.next_sync_at = now + min(wait, LONGEST_RETRY)
    meeting.google_error = ''
    meeting.save()
    if found:
        log(meeting, None, f"Fetched from Google: {', '.join(found)}")
    return found


def _attendance(meeting, client, record):
    """Mark who came. Meet gives display names, not emails, so people are matched by name."""
    people = {(p.name or p.email).strip().lower(): p for p in meeting.participants.all()}
    names = {}
    for item in client.participants(record):
        who = item.get('signedinUser') or item.get('anonymousUser') or item.get('phoneUser') or {}
        name = who.get('displayName', '')
        names[item.get('name', '')] = name
        p = people.get(name.strip().lower())
        if not p:
            continue
        joined, left = google.parse_time(item.get('earliestStartTime')), google.parse_time(item.get('latestEndTime'))
        p.attended = True
        p.joined_at = min(filter(None, [p.joined_at, joined]), default=None)
        p.left_at = max(filter(None, [p.left_at, left]), default=None)
        p.save(update_fields=['attended', 'joined_at', 'left_at'])
    return names


def _transcripts(meeting, client, record, names, found):
    pending = False
    for t in client.transcripts(record):
        state = t.get('state', '')
        art, _ = Artifact.objects.get_or_create(google_name=t['name'], defaults={'meeting': meeting, 'kind': Artifact.Kind.TRANSCRIPT})
        art.state = state
        art.link = (t.get('docsDestination') or {}).get('exportUri', art.link)
        if state == 'FILE_GENERATED' and not art.content:
            lines = []
            for e in client.transcript_entries(t['name']):
                at = google.parse_time(e.get('startTime'))
                stamp = timezone.localtime(at).strftime('%H:%M') if at else ''
                lines.append(f"[{stamp}] {names.get(e.get('participant', ''), 'Someone')}: {e.get('text', '').strip()}")
            art.content = '\n'.join(lines)
            found.append('transcript')
        elif state not in FINAL_STATES:
            pending = True
        art.save()
    return pending


def _recordings(meeting, client, record, found):
    pending = False
    for r in client.recordings(record):
        state = r.get('state', '')
        art, made = Artifact.objects.get_or_create(google_name=r['name'], defaults={'meeting': meeting, 'kind': Artifact.Kind.RECORDING})
        link = (r.get('driveDestination') or {}).get('exportUri', '')
        if link and not art.link:
            found.append('recording')
        art.state, art.link = state, link or art.link
        art.save()
        pending |= state not in FINAL_STATES
    return pending


def run(limit=50):
    """Sync every meeting that is due. Used by the management command."""
    refresh_statuses()
    conn = GoogleConnection.current()
    if not conn or not google.is_configured():
        return 0, ['Google is not connected; nothing to sync.']
    client = google.Client(conn)
    done, errors = 0, []
    for meeting in due()[:limit]:
        try:
            sync_meeting(meeting, client)
            done += 1
        except google.GoogleError as e:
            meeting.google_error = str(e)[:255]
            meeting.sync_attempts += 1
            meeting.next_sync_at = timezone.now() + FIRST_RETRY
            meeting.sync_done = meeting.sync_attempts >= MAX_ATTEMPTS
            meeting.save(update_fields=['google_error', 'sync_attempts', 'next_sync_at', 'sync_done', 'updated_at'])
            errors.append(f"{meeting.pk}: {e}")
            if e.status == 401:
                break  # the connection itself is broken; stop until someone reconnects
    return done, errors
