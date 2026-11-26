"""Staff-only Meetings API: schedule and start Google Meet calls, and keep each meeting's record
(agenda, notes, problems, solutions, decisions, action items, transcript) in the Genmars database."""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from company.models import Project, Task, User
from company.permissions import Owner, Staff
from . import google, sync
from .models import ActionItem, AgendaItem, Artifact, GoogleConnection, Meeting, MeetingNote, Participant, Point, log


def name_of(user):
    return (user.full_name or user.email) if user else ''


def can_approve(user, meeting):
    return user.is_superuser or meeting.organizer_id == user.id


def push_to_calendar(meeting):
    """Send title, time and guest-list changes to the Google Calendar event. Failures are kept on the
    meeting instead of failing the request, since our record is the source of truth."""
    if not meeting.calendar_event_id or not GoogleConnection.current():
        return
    try:
        google.apply_event(meeting, google.Client().update_event(meeting, meeting.participants.all()))
        meeting.google_error = ''
    except google.GoogleError as e:
        meeting.google_error = f"Calendar not updated: {e}"[:255]
    meeting.save()


# ---------------------------------------------------------------- serializers

class ParticipantSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    response_label = serializers.CharField(source='get_response_display', read_only=True)
    is_guest = serializers.BooleanField(read_only=True)

    class Meta:
        model = Participant
        fields = ['id', 'user', 'email', 'name', 'role', 'role_label', 'response', 'response_label', 'is_guest', 'attended', 'joined_at', 'left_at']
        read_only_fields = ['response', 'attended', 'joined_at', 'left_at']
        extra_kwargs = {'email': {'required': False}}
        validators = []

    def validate_user(self, user):
        if user and not user.is_staff:
            raise serializers.ValidationError('Add clients and other outsiders by email as guests.')
        return user

    def validate(self, attrs):
        user = attrs.get('user')
        if user:
            attrs['email'] = user.email
            attrs['name'] = attrs.get('name') or user.full_name
        elif not attrs.get('email') and not self.instance:
            raise serializers.ValidationError({'email': 'Enter an email address or choose a team member.'})
        elif not self.instance and attrs.get('role') in (None, Participant.Role.ATTENDEE):
            attrs['role'] = Participant.Role.GUEST
        meeting = self.context.get('meeting')
        email = attrs.get('email')
        if meeting and email and meeting.participants.filter(email__iexact=email).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError({'email': 'Already invited.'})
        return attrs


class AgendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgendaItem
        fields = ['id', 'title', 'notes', 'minutes', 'covered', 'position']


class NoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = MeetingNote
        fields = ['id', 'body', 'author', 'author_name', 'created_at', 'updated_at']
        read_only_fields = ['author']

    def get_author_name(self, note):
        return name_of(note.author)


class PointSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    owner_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Point
        fields = [
            'id', 'kind', 'kind_label', 'title', 'detail', 'status', 'status_label', 'problem', 'owner', 'owner_name',
            'approved_by_name', 'approved_at', 'created_at',
        ]
        read_only_fields = ['approved_at']
        extra_kwargs = {'status': {'required': False}}

    def get_owner_name(self, p):
        return name_of(p.owner)

    def get_approved_by_name(self, p):
        return name_of(p.approved_by)

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        if self.instance and 'kind' in attrs and attrs['kind'] != self.instance.kind:
            raise serializers.ValidationError({'kind': 'Add a new point instead of changing what this one is.'})
        allowed = Point.STATUSES[kind]
        if 'status' not in attrs and not self.instance:
            attrs['status'] = allowed[0]
        if 'status' in attrs and attrs['status'] not in allowed:
            raise serializers.ValidationError({'status': f"A {Point.Kind(kind).label.lower()} can only be {', '.join(s.label.lower() for s in allowed)}."})
        # approving is its own step (see PointViewSet.approve), so it's recorded who approved and when
        if 'status' in attrs and attrs['status'] in (Point.Status.APPROVED, Point.Status.ACCEPTED) and getattr(self.instance, 'status', None) != attrs['status']:
            raise serializers.ValidationError({'status': 'Use Approve so the approval is recorded.'})
        problem = attrs.get('problem')
        if problem and (kind != Point.Kind.SOLUTION or problem.kind != Point.Kind.PROBLEM or problem.meeting_id != self.context['meeting'].id):
            raise serializers.ValidationError({'problem': 'Only a proposed solution can answer a problem from this meeting.'})
        owner = attrs.get('owner')
        if owner and not owner.is_staff:
            raise serializers.ValidationError({'owner': 'Choose someone on the team.'})
        return attrs


class ActionSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()
    status = serializers.ChoiceField(choices=ActionItem.Status.choices, required=False)
    task_status = serializers.CharField(source='task.status', read_only=True, default=None)
    meeting_title = serializers.CharField(source='meeting.title', read_only=True)

    class Meta:
        model = ActionItem
        fields = [
            'id', 'meeting', 'meeting_title', 'decision', 'title', 'notes', 'assignee', 'assignee_name', 'due_date',
            'priority', 'status', 'task', 'task_status', 'created_at',
        ]
        read_only_fields = ['meeting', 'task']

    def get_assignee_name(self, a):
        return name_of(a.assignee)

    def to_representation(self, item):
        data = super().to_representation(item)
        data['status'] = item.current_status
        return data

    def validate_assignee(self, user):
        if user and not user.is_staff:
            raise serializers.ValidationError('Action items go to people on the team.')
        return user

    def validate_decision(self, point):
        if point and (point.kind != Point.Kind.DECISION or point.meeting_id != self.context['meeting'].id):
            raise serializers.ValidationError('Choose a decision from this meeting.')
        return point

    def update(self, item, validated):
        item = super().update(item, validated)
        if item.task_id:
            # the task is the real to-do: keep it in step
            task = item.task
            for field in ('title', 'assignee', 'due_date', 'priority', 'status'):
                if field in validated:
                    setattr(task, field, validated[field])
            if 'status' in validated:
                task.completed_at = timezone.now() if task.status == Task.Status.DONE else None
            task.save()
        return item


class ArtifactSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Artifact
        fields = ['id', 'kind', 'kind_label', 'state', 'link', 'content', 'created_at']


class MeetingListSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    report_label = serializers.CharField(source='get_report_status_display', read_only=True)
    organizer_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default='')
    client_name = serializers.CharField(source='project.client.full_name', read_only=True, default='')
    duration_minutes = serializers.IntegerField(read_only=True)
    participant_count = serializers.IntegerField(read_only=True, default=0)
    open_actions = serializers.IntegerField(read_only=True, default=0)
    decision_count = serializers.IntegerField(read_only=True, default=0)
    has_transcript = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Meeting
        fields = [
            'id', 'title', 'kind', 'category', 'category_label', 'status', 'status_label', 'organizer', 'organizer_name',
            'project', 'project_name', 'client_name', 'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end',
            'duration_minutes', 'meet_uri', 'conference_status', 'report_status', 'report_label', 'participant_count',
            'open_actions', 'decision_count', 'has_transcript',
        ]

    def get_organizer_name(self, m):
        return name_of(m.organizer)


class MeetingSerializer(MeetingListSerializer):
    conference_label = serializers.CharField(source='get_conference_status_display', read_only=True)
    report_approved_by_name = serializers.SerializerMethodField()
    participants = ParticipantSerializer(many=True, read_only=True)
    agenda = AgendaSerializer(many=True, read_only=True)
    notes = NoteSerializer(many=True, read_only=True)
    points = PointSerializer(many=True, read_only=True)
    actions = ActionSerializer(many=True, read_only=True)
    artifacts = ArtifactSerializer(many=True, read_only=True)
    activity = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()

    # write-only extras when scheduling
    team = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_staff=True, is_active=True), many=True, write_only=True, required=False)
    guests = serializers.ListField(child=serializers.EmailField(), write_only=True, required=False)
    agenda_lines = serializers.ListField(child=serializers.CharField(max_length=200), write_only=True, required=False)
    send_invites = serializers.BooleanField(write_only=True, required=False, default=True)

    class Meta(MeetingListSerializer.Meta):
        fields = MeetingListSerializer.Meta.fields + [
            'description', 'time_zone', 'meeting_code', 'calendar_link', 'conference_label', 'google_error',
            'last_synced_at', 'sync_done', 'summary', 'report_approved_by_name', 'report_approved_at', 'participants',
            'agenda', 'notes', 'points', 'actions', 'artifacts', 'activity', 'can_approve', 'created_at',
            'team', 'guests', 'agenda_lines', 'send_invites',
        ]
        read_only_fields = ['kind', 'organizer', 'actual_start', 'actual_end', 'meet_uri', 'meeting_code', 'calendar_link', 'report_status']

    def get_report_approved_by_name(self, m):
        return name_of(m.report_approved_by)

    def get_activity(self, m):
        return [{'id': a.id, 'text': a.text, 'actor': name_of(a.actor), 'at': a.created_at} for a in m.activity.all()[:40]]

    def get_can_approve(self, m):
        return can_approve(self.context['request'].user, m)

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError('Give the meeting a title.')
        return value.strip()

    def validate_time_zone(self, value):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError('Unknown time zone.')
        return value

    def validate(self, attrs):
        start = attrs.get('scheduled_start', getattr(self.instance, 'scheduled_start', None))
        end = attrs.get('scheduled_end', getattr(self.instance, 'scheduled_end', None))
        if not start:
            raise serializers.ValidationError({'scheduled_start': 'Choose when the meeting starts.'})
        if end and end <= start:
            raise serializers.ValidationError({'scheduled_end': 'The meeting must end after it starts.'})
        if not self.instance and start < timezone.now() - timedelta(minutes=5):
            raise serializers.ValidationError({'scheduled_start': 'Choose a time in the future, or start an instant meeting.'})
        return attrs


class MeetingCreateMixin:
    """Builds the meeting, its people and agenda, then the Calendar event with its Meet link."""

    def create_meeting(self, serializer):
        data = serializer.validated_data
        team = data.pop('team', [])
        guests = data.pop('guests', [])
        lines = data.pop('agenda_lines', [])
        notify = data.pop('send_invites', True)
        me = self.request.user
        with transaction.atomic():
            meeting = Meeting.objects.create(kind=Meeting.Kind.SCHEDULED, organizer=me, **data)
            Participant.objects.create(meeting=meeting, user=me, email=me.email, name=me.full_name, role=Participant.Role.ORGANIZER, response=Participant.Response.ACCEPTED)
            seen = {me.email.lower()}
            for u in team:
                if u.email.lower() not in seen:
                    seen.add(u.email.lower())
                    Participant.objects.create(meeting=meeting, user=u, email=u.email, name=u.full_name)
            for email in guests:
                if email.lower() not in seen:
                    seen.add(email.lower())
                    Participant.objects.create(meeting=meeting, email=email, role=Participant.Role.GUEST)
            for i, line in enumerate(l.strip() for l in lines):
                if line:
                    AgendaItem.objects.create(meeting=meeting, title=line, position=i)
            log(meeting, me, f"{name_of(me)} scheduled the meeting")

        if GoogleConnection.current() and google.is_configured():
            try:
                event = google.Client().create_event(meeting, meeting.participants.all(), notify=notify)
                google.apply_event(meeting, event)
                log(meeting, None, 'Google Calendar event created' + (' and invitations sent' if notify else ''))
            except google.GoogleError as e:
                meeting.conference_status = Meeting.Conference.FAILED
                meeting.google_error = f"Calendar event not created: {e}"[:255]
            meeting.save()
        return meeting


# ---------------------------------------------------------------- meetings

class MeetingViewSet(MeetingCreateMixin, viewsets.ModelViewSet):
    """Filters: ?view=upcoming|history, ?q=, ?status=, ?category=, ?project=, ?organizer=, ?participant=,
    ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?mine=1"""

    permission_classes = [Staff]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return UpcomingSerializer if self.request.query_params.get('view') == 'upcoming' else MeetingListSerializer
        return MeetingSerializer

    def get_queryset(self):
        qs = Meeting.objects.select_related('organizer', 'project__client', 'report_approved_by')
        if self.action == 'list':
            qs = qs.annotate(
                participant_count=Count('participants', distinct=True),
                open_actions=Count('actions', filter=~Q(actions__status=ActionItem.Status.DONE) & (Q(actions__task__isnull=True) | ~Q(actions__task__status=Task.Status.DONE)), distinct=True),
                decision_count=Count('points', filter=Q(points__kind=Point.Kind.DECISION, points__status=Point.Status.APPROVED), distinct=True),
                artifact_count=Count('artifacts', filter=Q(artifacts__kind=Artifact.Kind.TRANSCRIPT) & ~Q(artifacts__content=''), distinct=True),
            )
        else:
            qs = qs.prefetch_related(
                'participants', 'agenda', 'notes__author', 'points__owner', 'points__approved_by',
                'actions__assignee', 'actions__task', 'artifacts', 'activity__actor',
            )
        p = self.request.query_params
        now = timezone.now()
        if p.get('view') == 'upcoming':
            qs = qs.filter(status__in=[Meeting.Status.PLANNED, Meeting.Status.LIVE]).prefetch_related('participants').order_by('scheduled_start')
        elif p.get('view') == 'history':
            qs = qs.filter(Q(status__in=[Meeting.Status.COMPLETED, Meeting.Status.CANCELLED, Meeting.Status.FAILED]) | Q(scheduled_start__lt=now - timedelta(hours=12)))
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(
                Q(title__icontains=q) | Q(description__icontains=q) | Q(summary__icontains=q) | Q(notes__body__icontains=q)
                | Q(points__title__icontains=q) | Q(actions__title__icontains=q) | Q(project__name__icontains=q)
                | Q(participants__name__icontains=q) | Q(participants__email__icontains=q)
            ).distinct()
        for field in ('status', 'category', 'report_status'):
            if p.get(field):
                qs = qs.filter(**{f'{field}__in': p[field].split(',')})
        for field in ('project', 'organizer'):
            if p.get(field):
                qs = qs.filter(**{f'{field}_id': p[field]})
        if p.get('participant'):
            qs = qs.filter(participants__user_id=p['participant']).distinct()
        if p.get('mine') == '1':
            qs = qs.filter(Q(organizer=self.request.user) | Q(participants__user=self.request.user)).distinct()
        if p.get('from'):
            qs = qs.filter(scheduled_start__date__gte=p['from'])
        if p.get('to'):
            qs = qs.filter(scheduled_start__date__lte=p['to'])
        return qs

    def list(self, request, *args, **kwargs):
        sync.refresh_statuses()
        qs = self.get_queryset()
        rows = self.get_serializer(qs, many=True).data
        for row, m in zip(rows, qs):
            row['has_transcript'] = m.artifact_count > 0
        return Response(rows)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting = self.create_meeting(serializer)
        return Response(self.get_serializer(self.get_queryset().get(pk=meeting.pk)).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        for extra in ('team', 'guests', 'agenda_lines'):
            serializer.validated_data.pop(extra, None)
        notify = serializer.validated_data.pop('send_invites', True)
        before = {f: getattr(serializer.instance, f) for f in ('title', 'scheduled_start', 'scheduled_end', 'description')}
        meeting = serializer.save()
        changed = [f for f, v in before.items() if getattr(meeting, f) != v]
        if 'summary' in serializer.validated_data and meeting.report_status == Meeting.Report.APPROVED:
            meeting.report_status = Meeting.Report.REVIEW
            meeting.save(update_fields=['report_status', 'updated_at'])
            log(meeting, self.request.user, f"{name_of(self.request.user)} edited the approved summary; it needs review again")
        if changed:
            log(meeting, self.request.user, f"{name_of(self.request.user)} changed the {', '.join(f.replace('scheduled_', '').replace('_', ' ') for f in changed)}")
            if meeting.status == Meeting.Status.COMPLETED and meeting.scheduled_start > timezone.now():
                meeting.status = Meeting.Status.PLANNED
                meeting.save(update_fields=['status', 'updated_at'])
            if notify:
                push_to_calendar(meeting)

    def destroy(self, request, *args, **kwargs):
        """Cancelling keeps the record; the Calendar event is cancelled and guests are told."""
        meeting = self.get_object()
        if meeting.status == Meeting.Status.CANCELLED:
            return Response(status=status.HTTP_204_NO_CONTENT)
        meeting.status = Meeting.Status.CANCELLED
        meeting.sync_done = True
        if meeting.calendar_event_id and GoogleConnection.current():
            try:
                google.Client().cancel_event(meeting.calendar_event_id, notify=request.data.get('notify', True) is not False)
            except google.GoogleError as e:
                meeting.google_error = f"Calendar event not cancelled: {e}"[:255]
        meeting.save()
        log(meeting, request.user, f"{name_of(request.user)} cancelled the meeting")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def instant(self, request):
        """Start a Meet call right now."""
        conn = GoogleConnection.current()
        if not conn or not google.is_configured():
            return Response({'detail': 'Connect Google first to start meetings.'}, status=status.HTTP_409_CONFLICT)
        title = (request.data.get('title') or '').strip() or f"Quick call · {timezone.localtime():%d %b, %H:%M}"
        project = request.data.get('project') or None
        try:
            space = google.Client(conn).create_space()
        except google.GoogleError as e:
            return Response({'detail': f"Google couldn't start the meeting: {e}"}, status=status.HTTP_502_BAD_GATEWAY)
        me = request.user
        meeting = Meeting.objects.create(
            title=title[:200], kind=Meeting.Kind.INSTANT, status=Meeting.Status.LIVE, organizer=me, project_id=project,
            category=request.data.get('category') or Meeting.Category.INTERNAL, scheduled_start=timezone.now(),
            google_space_name=space.get('name', ''), meet_uri=space.get('meetingUri', ''), meeting_code=space.get('meetingCode', ''),
            conference_status=Meeting.Conference.READY, next_sync_at=timezone.now() + sync.FIRST_RETRY,
        )
        Participant.objects.create(meeting=meeting, user=me, email=me.email, name=me.full_name, role=Participant.Role.ORGANIZER, response=Participant.Response.ACCEPTED)
        log(meeting, me, f"{name_of(me)} started an instant meeting")
        return Response(MeetingSerializer(meeting, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        meeting = self.get_object()
        if not meeting.meet_uri:
            return Response({'detail': 'This meeting has no Meet link yet.'}, status=status.HTTP_409_CONFLICT)
        if meeting.status == Meeting.Status.PLANNED and meeting.scheduled_start <= timezone.now() + timedelta(minutes=15):
            meeting.status = Meeting.Status.LIVE
            meeting.save(update_fields=['status', 'updated_at'])
        log(meeting, request.user, f"{name_of(request.user)} joined")
        return Response({'meet_uri': meeting.meet_uri})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        meeting = self.get_object()
        if meeting.status in (Meeting.Status.PLANNED, Meeting.Status.LIVE):
            meeting.status = Meeting.Status.COMPLETED
            meeting.actual_end = meeting.actual_end or timezone.now()
            meeting.next_sync_at = timezone.now()
            meeting.save()
            log(meeting, request.user, f"{name_of(request.user)} marked the meeting as finished")
        return Response(MeetingSerializer(self.get_queryset().get(pk=meeting.pk), context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='sync')
    def sync_now(self, request, pk=None):
        meeting = self.get_object()
        if not GoogleConnection.current():
            return Response({'detail': 'Connect Google first.'}, status=status.HTTP_409_CONFLICT)
        try:
            meeting.sync_done = False
            found = sync.sync_meeting(meeting)
        except google.GoogleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        data = MeetingSerializer(self.get_queryset().get(pk=meeting.pk), context={'request': request}).data
        data['found'] = found
        return Response(data)

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        """Move the meeting record along: submit for review, approve (organizer or owner), or reopen."""
        meeting = self.get_object()
        step = request.data.get('step')
        me = request.user
        if step == 'submit':
            meeting.report_status = Meeting.Report.REVIEW
            text = f"{name_of(me)} sent the record for review"
        elif step == 'approve':
            if not can_approve(me, meeting):
                raise PermissionDenied('Only the organizer or an owner can approve the meeting record.')
            if not meeting.summary.strip():
                return Response({'summary': ['Write a short summary before approving.']}, status=status.HTTP_400_BAD_REQUEST)
            meeting.report_status = Meeting.Report.APPROVED
            meeting.report_approved_by, meeting.report_approved_at = me, timezone.now()
            text = f"{name_of(me)} approved the meeting record"
        elif step == 'reopen':
            meeting.report_status = Meeting.Report.DRAFT
            meeting.report_approved_by = meeting.report_approved_at = None
            text = f"{name_of(me)} reopened the meeting record"
        else:
            return Response({'step': ['Use submit, approve or reopen.']}, status=status.HTTP_400_BAD_REQUEST)
        meeting.save()
        log(meeting, me, text)
        return Response(MeetingSerializer(self.get_queryset().get(pk=meeting.pk), context={'request': request}).data)


class MeetingChild(viewsets.ModelViewSet):
    """Base for things that belong to one meeting: /meetings/<id>/<thing>/"""

    permission_classes = [Staff]
    pagination_class = None
    model = None
    label = ''

    def meeting(self):
        if not hasattr(self, '_meeting'):
            self._meeting = get_object_or_404(Meeting, pk=self.kwargs['meeting_pk'])
        return self._meeting

    def get_queryset(self):
        return self.model.objects.filter(meeting_id=self.kwargs['meeting_pk'])

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'meeting': self.meeting()}

    def perform_create(self, serializer):
        item = serializer.save(meeting=self.meeting(), **self.creator())
        self.logged('added', item)

    def perform_update(self, serializer):
        self.logged('updated', serializer.save())

    def perform_destroy(self, item):
        self.logged('removed', item)
        item.delete()

    def creator(self):
        return {}

    def logged(self, verb, item):
        if self.label:
            log(self.meeting(), self.request.user, f"{name_of(self.request.user)} {verb} {self.label}: {item}")


class ParticipantViewSet(MeetingChild):
    model = Participant
    serializer_class = ParticipantSerializer
    label = 'participant'

    def perform_create(self, serializer):
        super().perform_create(serializer)
        push_to_calendar(self.meeting())

    def perform_destroy(self, item):
        if item.role == Participant.Role.ORGANIZER:
            raise PermissionDenied("The organizer can't be removed.")
        super().perform_destroy(item)
        push_to_calendar(self.meeting())


class AgendaViewSet(MeetingChild):
    model = AgendaItem
    serializer_class = AgendaSerializer
    label = 'agenda item'

    def perform_create(self, serializer):
        last = self.get_queryset().order_by('-position').values_list('position', flat=True).first()
        serializer.validated_data.setdefault('position', (last or 0) + 1)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        serializer.save()  # ticking items off during the call is too chatty for the activity log


class NoteViewSet(MeetingChild):
    model = MeetingNote
    serializer_class = NoteSerializer

    def get_queryset(self):
        return super().get_queryset().select_related('author')

    def creator(self):
        return {'author': self.request.user}

    def perform_create(self, serializer):
        super().perform_create(serializer)
        log(self.meeting(), self.request.user, f"{name_of(self.request.user)} added a note")

    def check_author(self, note):
        if note.author_id != self.request.user.id and not self.request.user.is_superuser:
            raise PermissionDenied('You can only change your own notes.')

    def perform_update(self, serializer):
        self.check_author(serializer.instance)
        serializer.save()

    def perform_destroy(self, note):
        self.check_author(note)
        note.delete()


class PointViewSet(MeetingChild):
    model = Point
    serializer_class = PointSerializer

    def get_queryset(self):
        return super().get_queryset().select_related('owner', 'approved_by')

    def creator(self):
        return {'created_by': self.request.user}

    def logged(self, verb, item):
        log(self.meeting(), self.request.user, f"{name_of(self.request.user)} {verb} a {item.get_kind_display().lower()}: {item.title}")

    @action(detail=True, methods=['post'])
    def approve(self, request, meeting_pk=None, pk=None):
        """Approve a decision or accept a proposed solution, recording who and when."""
        point = self.get_object()
        target = {Point.Kind.DECISION: Point.Status.APPROVED, Point.Kind.SOLUTION: Point.Status.ACCEPTED}.get(point.kind)
        if not target:
            return Response({'detail': 'Only decisions and proposed solutions are approved.'}, status=status.HTTP_400_BAD_REQUEST)
        point.status, point.approved_by, point.approved_at = target, request.user, timezone.now()
        point.save()
        log(point.meeting, request.user, f"{name_of(request.user)} {'approved the decision' if target == Point.Status.APPROVED else 'accepted the solution'}: {point.title}")
        return Response(self.get_serializer(point).data)


class ActionViewSet(MeetingChild):
    model = ActionItem
    serializer_class = ActionSerializer
    label = 'action item'

    def get_queryset(self):
        return super().get_queryset().select_related('assignee', 'task', 'meeting')

    def creator(self):
        return {'created_by': self.request.user}

    @action(detail=True, methods=['post'])
    def task(self, request, meeting_pk=None, pk=None):
        """Turn the action item into a task on the team's task list (once)."""
        item = self.get_object()
        if item.task_id:
            return Response(self.get_serializer(item).data)
        meeting = item.meeting
        when = timezone.localtime(meeting.scheduled_start)
        task = Task.objects.create(
            title=item.title, notes=f"{item.notes}\n\nFrom the meeting \"{meeting.title}\" on {when:%d %b %Y}.".strip(),
            project=meeting.project, client=meeting.project.client if meeting.project else None, assignee=item.assignee,
            created_by=request.user, status=item.status, priority=item.priority, due_date=item.due_date,
        )
        item.task = task
        item.save(update_fields=['task'])
        log(meeting, request.user, f"{name_of(request.user)} made a task: {item.title}")
        if item.assignee and item.assignee_id != request.user.id:
            send_mail(
                subject=f"New task from \"{meeting.title}\": {item.title}",
                message=(
                    f"Hi {name_of(item.assignee).split()[0]},\n\nAn action item from the meeting \"{meeting.title}\" is now your task: "
                    f"\"{item.title}\".{f' Due {item.due_date:%d %b %Y}.' if item.due_date else ''}\n\n"
                    f"See it in the meeting: {settings.MEETINGS_URL}/{meeting.id}\n"
                ),
                from_email=None,
                recipient_list=[item.assignee.email],
                fail_silently=True,
            )
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------- overview

class UpcomingSerializer(MeetingListSerializer):
    people = serializers.SerializerMethodField()

    class Meta(MeetingListSerializer.Meta):
        fields = MeetingListSerializer.Meta.fields + ['people']

    def get_people(self, m):
        people = sorted(m.participants.all(), key=lambda p: p.role != Participant.Role.ORGANIZER)
        return [p.name or p.email for p in people]


def trends(now, weeks=8):
    """Weekly counts for the overview's small charts, oldest first. Upcoming looks ahead; the rest look back."""
    week = timedelta(days=7)
    start = now - week * weeks
    live = Meeting.objects.exclude(status=Meeting.Status.CANCELLED)

    def bucket(values, origin):
        counts = [0] * weeks
        for v in values:
            if v is not None:
                i = int((v - origin) / week)
                if 0 <= i < weeks:
                    counts[i] += 1
        return counts

    return {
        'upcoming': bucket(live.filter(scheduled_start__gte=now, scheduled_start__lt=now + week * weeks).values_list('scheduled_start', flat=True), now),
        'held': bucket(live.filter(scheduled_start__gte=start, scheduled_start__lt=now).values_list('scheduled_start', flat=True), start),
        'completed': bucket(live.filter(status=Meeting.Status.COMPLETED, scheduled_start__gte=start).values_list('scheduled_start', flat=True), start),
        'records': bucket(Meeting.objects.filter(report_approved_at__gte=start).values_list('report_approved_at', flat=True), start),
    }


class OverviewView(APIView):
    """The Meetings tab's top: counts, what's next, my open action items and the Google connection."""

    permission_classes = [Staff]

    def get(self, request):
        sync.refresh_statuses()
        now = timezone.now()
        month_start = timezone.localtime(now).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        live = ~Q(status=Meeting.Status.CANCELLED)
        this_month = Meeting.objects.filter(live, scheduled_start__gte=month_start, scheduled_start__lte=now)
        completed = Meeting.objects.filter(status=Meeting.Status.COMPLETED)
        open_actions = ActionItem.objects.exclude(status=ActionItem.Status.DONE).exclude(task__status=Task.Status.DONE)
        mine = open_actions.filter(assignee=request.user).select_related('meeting', 'task', 'assignee')
        upcoming = (
            Meeting.objects.filter(status__in=[Meeting.Status.PLANNED, Meeting.Status.LIVE]).select_related('organizer', 'project__client')
            .prefetch_related('participants').annotate(participant_count=Count('participants', distinct=True)).order_by('scheduled_start')
        )
        week = timedelta(days=7)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        same_point_last_month = last_month_start + (now - month_start)
        held_last_month = Meeting.objects.filter(live, scheduled_start__gte=last_month_start, scheduled_start__lte=same_point_last_month).count()
        attended = Participant.objects.filter(meeting__in=this_month.filter(status=Meeting.Status.COMPLETED, participants__attended=True).distinct())

        done_count = completed.count()
        with_record = completed.filter(report_status=Meeting.Report.APPROVED).count()
        with_transcript = completed.filter(artifacts__kind=Artifact.Kind.TRANSCRIPT, artifacts__content__gt='').distinct().count()
        all_actions = ActionItem.objects.filter(meeting__scheduled_start__gte=month_start)

        return Response({
            'upcoming_count': upcoming.count(),
            'this_month': this_month.count(),
            'completed': done_count,
            'records_approved': with_record,
            'needs_review': Meeting.objects.filter(report_status=Meeting.Report.REVIEW).exclude(status=Meeting.Status.CANCELLED).count(),
            'open_actions': open_actions.count(),
            'trends': trends(now),
            'upcoming_this_week': upcoming.filter(scheduled_start__lt=now + week).count(),
            'this_month_change': round(100 * (this_month.count() - held_last_month) / held_last_month) if held_last_month else None,
            'completed_this_week': completed.filter(Q(actual_end__gte=now - week) | Q(actual_end__isnull=True, scheduled_start__gte=now - week)).count(),
            'records_this_week': completed.filter(report_approved_at__gte=now - week).count(),
            'insights': {
                'meetings_this_month': this_month.count(),
                'attendance_rate': round(100 * attended.filter(attended=True).count() / attended.count()) if attended.exists() else None,
                'minutes_this_month': sum(m.duration_minutes or 0 for m in this_month.filter(status=Meeting.Status.COMPLETED)),
                'record_rate': round(100 * with_record / done_count) if done_count else None,
                'transcript_rate': round(100 * with_transcript / done_count) if done_count else None,
                'actions_this_month': all_actions.count(),
                'actions_done_this_month': all_actions.filter(Q(status=ActionItem.Status.DONE, task__isnull=True) | Q(task__status=Task.Status.DONE)).count(),
                'linked_to_projects': Meeting.objects.filter(live, project__isnull=False).count(),
            },
            'upcoming': UpcomingSerializer(upcoming[:8], many=True).data,
            'my_actions': ActionSerializer(mine[:20], many=True).data,
            'google': google_status(request.user),
        })


class DecisionsView(APIView):
    """Every decision from every meeting, newest first. Filters: ?status=proposed|approved|rejected, ?q=, ?project="""

    permission_classes = [Staff]

    def get(self, request):
        qs = Point.objects.filter(kind=Point.Kind.DECISION).exclude(meeting__status=Meeting.Status.CANCELLED)
        qs = qs.select_related('meeting__project', 'owner', 'approved_by').order_by('-meeting__scheduled_start', '-id')
        p = request.query_params
        if p.get('status'):
            qs = qs.filter(status__in=p['status'].split(','))
        if p.get('project'):
            qs = qs.filter(meeting__project_id=p['project'])
        if p.get('q'):
            qs = qs.filter(Q(title__icontains=p['q']) | Q(detail__icontains=p['q']) | Q(meeting__title__icontains=p['q']))
        rows = []
        for point in qs[:300]:
            row = PointSerializer(point).data
            row.update(meeting=point.meeting_id, meeting_title=point.meeting.title, meeting_date=point.meeting.scheduled_start,
                       project_name=point.meeting.project.name if point.meeting.project_id else '')
            rows.append(row)
        return Response(rows)


class ActionsView(APIView):
    """Action items from every meeting. Filters: ?mine=1, ?assignee=<id>, ?state=open|done, ?q="""

    permission_classes = [Staff]

    def get(self, request):
        qs = ActionItem.objects.exclude(meeting__status=Meeting.Status.CANCELLED).select_related('meeting', 'assignee', 'task')
        done = Q(task__isnull=True, status=ActionItem.Status.DONE) | Q(task__status=Task.Status.DONE)
        p = request.query_params
        if p.get('mine') == '1':
            qs = qs.filter(assignee=request.user)
        if p.get('assignee'):
            qs = qs.filter(assignee_id=p['assignee'])
        if p.get('state') == 'open':
            qs = qs.exclude(done)
        elif p.get('state') == 'done':
            qs = qs.filter(done)
        if p.get('q'):
            qs = qs.filter(Q(title__icontains=p['q']) | Q(meeting__title__icontains=p['q']))
        return Response(ActionSerializer(qs[:300], many=True).data)


class DirectoryView(APIView):
    """The team and open projects, read from the company database, for invites, owners and project links."""

    permission_classes = [Staff]

    def get(self, request):
        staff = User.objects.filter(is_staff=True, is_active=True).order_by('full_name')
        projects = Project.objects.select_related('client').exclude(status__in=['completed', 'on_hold'])
        return Response({
            'me': {'id': request.user.id, 'full_name': request.user.full_name, 'email': request.user.email, 'is_owner': request.user.is_superuser},
            'staff': [{'id': u.id, 'full_name': u.full_name, 'email': u.email} for u in staff],
            'projects': [{'id': p.id, 'name': p.name, 'client_name': p.client.full_name} for p in projects],
        })


# ---------------------------------------------------------------- Google connection

def google_status(user):
    conn = GoogleConnection.current()
    return {
        'configured': google.is_configured(),
        'connected': bool(conn and conn.status == GoogleConnection.Status.CONNECTED),
        'status': conn.status if conn else 'disconnected',
        'status_label': conn.get_status_display() if conn else 'Not connected',
        'account_email': conn.account_email if conn else '',
        'connected_by': name_of(conn.connected_by) if conn else '',
        'connected_at': conn.created_at if conn else None,
        'scopes': conn.scopes.split() if conn else [],
        'last_error': conn.last_error if conn else '',
        'can_manage': user.is_superuser,
    }




class GoogleStatusView(APIView):
    permission_classes = [Staff]

    def get(self, request):
        return Response(google_status(request.user))


class GoogleConnectView(APIView):
    """Returns the Google sign-in URL; the browser goes there, then Google sends it to the callback."""

    permission_classes = [Owner]

    def get(self, request):
        if not google.is_configured():
            return Response({'detail': 'Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to backend/.env first.'}, status=status.HTTP_409_CONFLICT)
        return Response({'url': google.authorization_url(request.user)})


class GoogleCallbackView(APIView):
    """Google redirects the browser here. There's no API token on a redirect, so the signed, short-lived
    `state` (made for one owner in GoogleConnectView) is what proves who started the sign-in."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        back = f"{settings.MEETINGS_URL}/"
        user_id = google.read_state(request.query_params.get('state'))
        user = User.objects.filter(pk=user_id, is_staff=True, is_superuser=True, is_active=True).first() if user_id else None
        if not user:
            return HttpResponseRedirect(f"{back}?google=invalid")
        if request.query_params.get('error') or not request.query_params.get('code'):
            return HttpResponseRedirect(f"{back}?google=denied")
        try:
            google.connect(request.query_params['code'], user)
        except google.GoogleError:
            return HttpResponseRedirect(f"{back}?google=failed")
        return HttpResponseRedirect(f"{back}?google=connected")


class GoogleDisconnectView(APIView):
    permission_classes = [Owner]

    def post(self, request):
        conn = GoogleConnection.current()
        if conn:
            google.disconnect(conn)
        return Response(google_status(request.user))
