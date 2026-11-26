from django.conf import settings
from django.db import models
from django.utils import timezone

from portal.models import Project, Task


class GoogleConnection(models.Model):
    """The company Google account that Genmars uses to create Meet links and Calendar events.

    Tokens are encrypted at rest (see meetings.google.encrypt) and never leave the backend.
    """

    class Status(models.TextChoices):
        CONNECTED = 'connected', 'Connected'
        EXPIRED = 'expired', 'Needs reconnecting'
        DISCONNECTED = 'disconnected', 'Disconnected'

    account_email = models.EmailField()
    access_token = models.TextField(blank=True, default='')
    refresh_token = models.TextField(blank=True, default='')
    token_expiry = models.DateTimeField(null=True, blank=True)
    scopes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CONNECTED)
    last_error = models.CharField(max_length=255, blank=True, default='')
    connected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='google_connections')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.account_email} ({self.get_status_display()})"

    @classmethod
    def current(cls):
        return cls.objects.filter(status__in=[cls.Status.CONNECTED, cls.Status.EXPIRED]).first()


class Meeting(models.Model):
    """One company meeting: its Meet link, who came, and the record it leaves behind."""

    class Kind(models.TextChoices):
        INSTANT = 'instant', 'Instant'
        SCHEDULED = 'scheduled', 'Scheduled'

    class Category(models.TextChoices):
        INTERNAL = 'internal', 'Internal'
        CLIENT = 'client', 'Client'
        PROJECT = 'project', 'Project'
        STANDUP = 'standup', 'Stand-up'
        SALES = 'sales', 'Sales'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        LIVE = 'live', 'Live'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
        FAILED = 'failed', 'Failed'

    class Conference(models.TextChoices):
        NONE = 'none', 'No Meet link'
        PENDING = 'pending', 'Creating Meet link'
        READY = 'ready', 'Meet link ready'
        FAILED = 'failed', 'Meet link failed'

    class Report(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        REVIEW = 'review', 'Needs review'
        APPROVED = 'approved', 'Approved'

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.SCHEDULED)
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.INTERNAL, db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PLANNED, db_index=True)
    organizer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='organized_meetings')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='meetings')

    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    time_zone = models.CharField(max_length=64, default='Africa/Nairobi')
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Google: our own id never depends on these
    conference_status = models.CharField(max_length=10, choices=Conference.choices, default=Conference.NONE)
    meet_uri = models.URLField(blank=True, default='')
    meeting_code = models.CharField(max_length=32, blank=True, default='', db_index=True)
    google_space_name = models.CharField(max_length=128, blank=True, default='')
    calendar_event_id = models.CharField(max_length=255, blank=True, default='')
    calendar_link = models.URLField(max_length=500, blank=True, default='')
    google_error = models.CharField(max_length=255, blank=True, default='')

    # artifact collection runs in the background after the meeting ends
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_attempts = models.PositiveSmallIntegerField(default=0)
    next_sync_at = models.DateTimeField(null=True, blank=True, db_index=True)
    sync_done = models.BooleanField(default=False)

    # the meeting record
    summary = models.TextField(blank=True, default='', help_text='Executive summary')
    report_status = models.CharField(max_length=10, choices=Report.choices, default=Report.DRAFT)
    report_approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_meeting_reports')
    report_approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_start']

    def __str__(self):
        return f"{self.title} · {timezone.localtime(self.scheduled_start):%d %b %Y %H:%M}"

    @property
    def ends_at(self):
        return self.actual_end or self.scheduled_end

    @property
    def duration_minutes(self):
        start, end = self.actual_start or self.scheduled_start, self.ends_at
        return round((end - start).total_seconds() / 60) if start and end and end > start else None


class Participant(models.Model):
    """Someone invited to a meeting: a team member (user) or an outside guest (email only)."""

    class Role(models.TextChoices):
        ORGANIZER = 'organizer', 'Organizer'
        COHOST = 'cohost', 'Co-host'
        ATTENDEE = 'attendee', 'Attendee'
        GUEST = 'guest', 'Guest'

    class Response(models.TextChoices):
        PENDING = 'needsAction', 'Not answered'
        ACCEPTED = 'accepted', 'Accepted'
        TENTATIVE = 'tentative', 'Maybe'
        DECLINED = 'declined', 'Declined'

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='meeting_invites')
    email = models.EmailField()
    name = models.CharField(max_length=150, blank=True, default='')
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.ATTENDEE)
    response = models.CharField(max_length=12, choices=Response.choices, default=Response.PENDING)
    attended = models.BooleanField(default=False)
    joined_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['role', 'name', 'email']
        constraints = [models.UniqueConstraint(fields=['meeting', 'email'], name='unique_meeting_participant')]

    def __str__(self):
        return self.name or self.email

    @property
    def is_guest(self):
        return self.user_id is None


class AgendaItem(models.Model):
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='agenda')
    title = models.CharField(max_length=200)
    notes = models.CharField(max_length=500, blank=True, default='')
    minutes = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Time set aside')
    covered = models.BooleanField(default=False)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return self.title


class MeetingNote(models.Model):
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='meeting_notes')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.body[:60]


class Point(models.Model):
    """Something the meeting produced. Each kind has its own states, and they are never interchangeable:
    a suggestion is not a decision until someone approves it."""

    class Kind(models.TextChoices):
        DISCUSSION = 'discussion', 'Discussion'
        PROBLEM = 'problem', 'Problem'
        SOLUTION = 'solution', 'Proposed solution'
        DECISION = 'decision', 'Decision'

    class Status(models.TextChoices):
        NOTED = 'noted', 'Noted'
        OPEN = 'open', 'Open'
        RESOLVED = 'resolved', 'Resolved'
        PROPOSED = 'proposed', 'Proposed'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'
        APPROVED = 'approved', 'Approved'

    STATUSES = {
        Kind.DISCUSSION: [Status.NOTED],
        Kind.PROBLEM: [Status.OPEN, Status.RESOLVED],
        Kind.SOLUTION: [Status.PROPOSED, Status.ACCEPTED, Status.REJECTED],
        Kind.DECISION: [Status.PROPOSED, Status.APPROVED, Status.REJECTED],
    }

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='points')
    kind = models.CharField(max_length=12, choices=Kind.choices, db_index=True)
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True, default='', help_text='Context, impact or expected outcome')
    status = models.CharField(max_length=10, choices=Status.choices)
    # a proposed solution answers a problem
    problem = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='solutions')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_meeting_points')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_meeting_points')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"{self.get_kind_display()}: {self.title}"


class ActionItem(models.Model):
    """A follow-up from a meeting. Once it becomes a team task, the task's status is the one that counts."""

    class Status(models.TextChoices):
        TODO = 'todo', 'To do'
        DOING = 'doing', 'Doing'
        DONE = 'done', 'Done'

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='actions')
    decision = models.ForeignKey(Point, on_delete=models.SET_NULL, null=True, blank=True, related_name='actions')
    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True, default='')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='meeting_actions')
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=8, choices=Task.Priority.choices, default=Task.Priority.NORMAL)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.TODO, db_index=True)
    task = models.OneToOneField(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name='meeting_action')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['status', models.F('due_date').asc(nulls_last=True), 'created_at']

    def __str__(self):
        return self.title

    @property
    def current_status(self):
        return self.task.status if self.task_id else self.status


class Artifact(models.Model):
    """Something Google Meet produced: a transcript, recording or smart notes. Transcripts are copied in
    as text so the evidence survives Google's own retention."""

    class Kind(models.TextChoices):
        TRANSCRIPT = 'transcript', 'Transcript'
        RECORDING = 'recording', 'Recording'
        SMART_NOTES = 'smart_notes', 'Smart notes'

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='artifacts')
    kind = models.CharField(max_length=12, choices=Kind.choices)
    google_name = models.CharField(max_length=255, unique=True)
    state = models.CharField(max_length=32, blank=True, default='')
    link = models.URLField(max_length=500, blank=True, default='', help_text='Google Docs or Drive file')
    content = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['kind', 'created_at']

    def __str__(self):
        return f"{self.get_kind_display()} · {self.meeting.title}"


class Activity(models.Model):
    """Audit trail for one meeting."""

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='activity')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    text = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name_plural = 'activity'

    def __str__(self):
        return self.text


def log(meeting, actor, text):
    Activity.objects.create(meeting=meeting, actor=actor if actor and actor.is_authenticated else None, text=text[:255])
