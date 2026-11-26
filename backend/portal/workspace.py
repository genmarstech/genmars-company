"""Staff-only operations API: today's priorities, tasks, time, profitability, client notes, activity and search."""

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import F, Max, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from applications_communications.models import Enquiry
from .models import ClientNote, Invoice, Message, Milestone, Order, Project, StaffRate, Task, TimeEntry
from .team import Staff, message_threads

User = get_user_model()

# How long a lead can sit before it counts as stalled, by status (days without an update).
STALLED_AFTER_DAYS = {Enquiry.Status.NEW: 2, Enquiry.Status.CONTACTED: 7, Enquiry.Status.PROPOSAL_SENT: 7}
# An active project with no update or logged time for this long is flagged as quiet.
QUIET_AFTER_DAYS = 14

UNPAID = [Invoice.Status.SENT, Invoice.Status.OVERDUE]
ACTIVE_PROJECT = ~Q(status__in=[Project.Status.COMPLETED, Project.Status.ON_HOLD])


def first_name(user):
    return (user.full_name or user.email).split()[0] if user else ''


def overdue_invoices(today):
    return Invoice.objects.filter(status__in=UNPAID).filter(Q(status=Invoice.Status.OVERDUE) | Q(due_on__lt=today))


def hourly_costs():
    """KES per hour for each staff member, falling back to the team default."""
    return {r.user_id: r.hourly_cost for r in StaffRate.objects.all()}


def cost_of(minutes_by_user, rates):
    default = Decimal(settings.TEAM_DEFAULT_HOURLY_COST)
    return sum((Decimal(m) / 60 * rates.get(uid, default) for uid, m in minutes_by_user.items()), Decimal(0))


# ---------------------------------------------------------------- tasks

class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True, default='')
    client_name = serializers.CharField(source='client.full_name', read_only=True, default='')
    assignee_name = serializers.CharField(source='assignee.full_name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    logged_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'notes', 'project', 'project_name', 'client', 'client_name', 'assignee', 'assignee_name',
            'created_by_name', 'status', 'status_label', 'priority', 'due_date', 'completed_at', 'created_at',
            'logged_minutes',
        ]
        read_only_fields = ['completed_at', 'created_at']

    def get_logged_minutes(self, task):
        return sum(e.minutes for e in task.time_entries.all())

    def validate_assignee(self, user):
        if user and not user.is_staff:
            raise serializers.ValidationError('Tasks can only be given to people on the team.')
        return user

    def validate_client(self, user):
        if user and user.is_staff:
            raise serializers.ValidationError('Choose a client, not a team member.')
        return user

    def validate(self, attrs):
        project = attrs.get('project', self.instance.project if self.instance else None)
        client = attrs.get('client', self.instance.client if self.instance else None)
        if project:
            if client and client.id != project.client_id:
                raise serializers.ValidationError({'client': 'That project belongs to another client.'})
            attrs['client'] = project.client
        return attrs

    def save(self, **kwargs):
        new_status = self.validated_data.get('status')
        if new_status == Task.Status.DONE and not (self.instance and self.instance.completed_at):
            kwargs['completed_at'] = timezone.now()
        elif new_status and new_status != Task.Status.DONE:
            kwargs['completed_at'] = None
        return super().save(**kwargs)


class TaskViewSet(viewsets.ModelViewSet):
    """Filters: ?mine=1, ?assignee=<id>, ?project=<id>, ?client=<id>, ?open=1, ?status=todo,doing"""

    permission_classes = [Staff]
    serializer_class = TaskSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Task.objects.select_related('project', 'client', 'assignee', 'created_by').prefetch_related('time_entries')
        p = self.request.query_params
        if p.get('mine') == '1':
            qs = qs.filter(assignee=self.request.user)
        for field in ('assignee', 'project', 'client'):
            if p.get(field):
                qs = qs.filter(**{f'{field}_id': p[field]})
        if p.get('open') == '1':
            qs = qs.exclude(status=Task.Status.DONE)
        if p.get('status'):
            qs = qs.filter(status__in=p['status'].split(','))
        return qs

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        self.tell_assignee(task)

    def perform_update(self, serializer):
        before = serializer.instance.assignee_id
        task = serializer.save()
        if task.assignee_id != before:
            self.tell_assignee(task)

    def tell_assignee(self, task):
        me = self.request.user
        if not task.assignee or task.assignee_id == me.id:
            return
        about = f" ({task.project.name})" if task.project else ''
        due = f"\nDue {task.due_date:%d %b %Y}." if task.due_date else ''
        send_mail(
            subject=f"{first_name(me)} gave you a task: {task.title}",
            message=(
                f"Hi {first_name(task.assignee)},\n\n{first_name(me)} assigned you \"{task.title}\"{about}.{due}\n\n"
                f"{task.notes + chr(10) + chr(10) if task.notes else ''}See your work: {settings.FRONTEND_URL}/team/work\n"
            ),
            from_email=None,
            recipient_list=[task.assignee.email],
            fail_silently=True,
        )


class StaffSerializer(serializers.ModelSerializer):
    hourly_cost = serializers.SerializerMethodField()
    has_own_rate = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'hourly_cost', 'has_own_rate']

    def get_hourly_cost(self, user):
        rate = getattr(user, 'staff_rate', None)
        return rate.hourly_cost if rate else Decimal(settings.TEAM_DEFAULT_HOURLY_COST)

    def get_has_own_rate(self, user):
        return hasattr(user, 'staff_rate')


class StaffViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Everyone on the team, for assigning tasks. Owners (superusers) can set hourly costs."""

    permission_classes = [Staff]
    serializer_class = StaffSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(is_staff=True, is_active=True).select_related('staff_rate').order_by('full_name')

    def partial_update(self, request, pk=None):
        if not request.user.is_superuser:
            raise PermissionDenied('Only an owner can change hourly costs.')
        member = get_object_or_404(self.get_queryset(), pk=pk)
        raw = request.data.get('hourly_cost')
        if raw in (None, ''):
            StaffRate.objects.filter(user=member).delete()
        else:
            try:
                value = Decimal(str(raw))
            except Exception:
                value = Decimal(-1)
            if value < 0:
                return Response({'hourly_cost': ['Enter an amount in KES.']}, status=status.HTTP_400_BAD_REQUEST)
            StaffRate.objects.update_or_create(user=member, defaults={'hourly_cost': value})
        member = self.get_queryset().get(pk=member.pk)
        return Response(self.get_serializer(member).data)


# ---------------------------------------------------------------- time

class TimeEntrySerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    client_name = serializers.CharField(source='project.client.full_name', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True, default='')
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = TimeEntry
        fields = ['id', 'project', 'project_name', 'client_name', 'task', 'task_title', 'user', 'user_name', 'date', 'minutes', 'note', 'billable']
        read_only_fields = ['user']

    def validate_minutes(self, value):
        if not 1 <= value <= 24 * 60:
            raise serializers.ValidationError('Enter between 1 minute and 24 hours.')
        return value

    def validate(self, attrs):
        project = attrs.get('project', self.instance.project if self.instance else None)
        task = attrs.get('task', self.instance.task if self.instance else None)
        if task and task.project_id and task.project_id != project.id:
            raise serializers.ValidationError({'task': 'That task is on another project.'})
        return attrs


class TimeEntryViewSet(viewsets.ModelViewSet):
    """Filters: ?mine=1, ?user=<id>, ?project=<id>, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD"""

    permission_classes = [Staff]
    serializer_class = TimeEntrySerializer
    pagination_class = None

    def get_queryset(self):
        qs = TimeEntry.objects.select_related('project__client', 'task', 'user')
        p = self.request.query_params
        if p.get('mine') == '1':
            qs = qs.filter(user=self.request.user)
        if p.get('user'):
            qs = qs.filter(user_id=p['user'])
        if p.get('project'):
            qs = qs.filter(project_id=p['project'])
        if p.get('from'):
            qs = qs.filter(date__gte=p['from'])
        if p.get('to'):
            qs = qs.filter(date__lte=p['to'])
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def check_own(self, entry):
        if entry.user_id != self.request.user.id and not self.request.user.is_superuser:
            raise PermissionDenied('You can only change your own time.')

    def perform_update(self, serializer):
        self.check_own(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self.check_own(instance)
        instance.delete()


def project_money(projects):
    """Value, invoiced, paid, hours and cost for each project, keyed by project id."""
    ids = [p.id for p in projects]
    rates = hourly_costs()
    invoiced, paid, minutes, billable = {}, {}, {}, {}
    for inv in Invoice.objects.filter(project_id__in=ids).exclude(status=Invoice.Status.DRAFT):
        invoiced[inv.project_id] = invoiced.get(inv.project_id, 0) + inv.amount
        if inv.status == Invoice.Status.PAID:
            paid[inv.project_id] = paid.get(inv.project_id, 0) + inv.amount
    for row in TimeEntry.objects.filter(project_id__in=ids).values('project_id', 'user_id', 'billable').annotate(m=Sum('minutes')):
        minutes.setdefault(row['project_id'], {}).setdefault(row['user_id'], 0)
        minutes[row['project_id']][row['user_id']] += row['m']
        if row['billable']:
            billable[row['project_id']] = billable.get(row['project_id'], 0) + row['m']

    out = {}
    for p in projects:
        inv = Decimal(invoiced.get(p.id, 0))
        # what the project is worth: its budget, or more if more has been invoiced
        value = max(p.budget or Decimal(0), inv)
        cost = cost_of(minutes.get(p.id, {}), rates).quantize(Decimal('1'))
        total_minutes = sum(minutes.get(p.id, {}).values())
        out[p.id] = {
            'value': value,
            'invoiced': inv,
            'paid': Decimal(paid.get(p.id, 0)),
            'minutes': total_minutes,
            'billable_minutes': billable.get(p.id, 0),
            'cost': cost,
            'profit': value - cost,
            'margin': round(float((value - cost) / value * 100)) if value else None,
            'budget_used': round(float(cost / value * 100)) if value else None,
        }
    return out


class ProfitabilityView(APIView):
    """Per project: what it's worth against what the team's time has cost."""

    permission_classes = [Staff]

    def get(self, request):
        projects = list(Project.objects.select_related('client').order_by('-updated_at'))
        if request.query_params.get('active') == '1':
            projects = [p for p in projects if p.is_active]
        money = project_money(projects)
        rows = [
            {'id': p.id, 'name': p.name, 'client': p.client.full_name, 'status': p.status, 'status_label': p.get_status_display(), **money[p.id]}
            for p in projects
        ]
        totals = {k: sum((r[k] for r in rows), Decimal(0)) for k in ('value', 'invoiced', 'paid', 'cost', 'profit')}
        totals['minutes'] = sum(r['minutes'] for r in rows)
        totals['margin'] = round(float(totals['profit'] / totals['value'] * 100)) if totals['value'] else None
        return Response({
            'projects': rows, 'totals': totals, 'default_hourly_cost': settings.TEAM_DEFAULT_HOURLY_COST,
            'can_edit_rates': request.user.is_superuser,
        })


# ---------------------------------------------------------------- clients: notes, detail, activity

class ClientNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True, default='')
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ClientNote
        fields = ['id', 'client', 'body', 'pinned', 'author_name', 'is_mine', 'created_at']
        read_only_fields = ['created_at']

    def get_is_mine(self, note):
        return note.author_id == self.context['request'].user.id

    def validate_client(self, user):
        if user.is_staff:
            raise serializers.ValidationError('Notes are for clients.')
        return user


class ClientNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [Staff]
    serializer_class = ClientNoteSerializer
    pagination_class = None

    def get_queryset(self):
        qs = ClientNote.objects.select_related('author')
        client = self.request.query_params.get('client')
        return qs.filter(client_id=client) if client else qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        # anyone can pin; only the author (or an owner) can reword or delete
        if set(serializer.validated_data) - {'pinned'}:
            self.check_own(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self.check_own(instance)
        instance.delete()

    def check_own(self, note):
        if note.author_id != self.request.user.id and not self.request.user.is_superuser:
            raise PermissionDenied('Only the person who wrote this note can change it.')


def at_noon(d):
    return timezone.make_aware(datetime.combine(d, time(12)))


class ClientDetailView(APIView):
    """One client: profile, money, projects and open tasks."""

    permission_classes = [Staff]

    def get(self, request, pk):
        client = get_object_or_404(User.objects.filter(is_staff=False).select_related('client_profile'), pk=pk)
        profile = getattr(client, 'client_profile', None)
        projects = list(client.projects.all())
        money = project_money(projects)
        invoices = client.invoices.exclude(status=Invoice.Status.DRAFT)
        today = timezone.localdate()
        return Response({
            'id': client.id,
            'full_name': client.full_name,
            'email': client.email,
            'phone_number': client.phone_number,
            'date_joined': client.date_joined,
            'profile': {
                'company_name': profile.company_name,
                'job_title': profile.job_title,
                'industry': profile.industry,
                'company_size': profile.get_company_size_display() if profile.company_size else '',
                'website': profile.website,
                'contact_method': profile.get_contact_method_display(),
                'goals': profile.goals,
            } if profile else None,
            'invoiced': sum((i.amount for i in invoices), Decimal(0)),
            'paid': sum((i.amount for i in invoices if i.status == Invoice.Status.PAID), Decimal(0)),
            'outstanding': sum((i.amount for i in invoices if i.status in UNPAID), Decimal(0)),
            'overdue': sum((i.amount for i in overdue_invoices(today).filter(client=client)), Decimal(0)),
            'minutes': sum(m['minutes'] for m in money.values()),
            'projects': [
                {'id': p.id, 'name': p.name, 'status_label': p.get_status_display(), 'health': p.health, 'progress': p.progress, 'due_date': p.due_date}
                for p in projects
            ],
        })


def client_activity(client, limit=80):
    """Everything that has happened with a client, newest first, built from the records themselves."""
    events = []

    def add(at, kind, title, detail='', link='', all_day=False):
        events.append({'at': at, 'kind': kind, 'title': title, 'detail': detail, 'link': link, 'all_day': all_day})

    add(client.date_joined, 'account', 'Created a client account')
    for e in Enquiry.objects.filter(Q(client=client) | Q(email__iexact=client.email)):
        add(e.created_at, 'lead', f"Sent a brief: {e.get_service_display()}", e.message[:160], f"/team/leads#lead-{e.id}")
    for o in client.orders.all():
        add(o.created_at, 'order', f"Ordered {o.service_name}", f"{o.number} · {o.get_status_display()}", f"/team/orders/{o.id}")
    for p in client.projects.all():
        add(p.created_at, 'project', f"Project started: {p.name}", p.summary, f"/team/projects/{p.id}")
    for m in Milestone.objects.filter(project__client=client, completed_at__isnull=False).select_related('project'):
        add(m.completed_at, 'milestone', f"Finished {m.title}", m.project.name, f"/team/projects/{m.project_id}")
    for inv in client.invoices.exclude(status=Invoice.Status.DRAFT):
        if inv.issued_on:
            add(at_noon(inv.issued_on), 'invoice', f"Invoice {inv.number} sent", f"KES {inv.amount:,.0f}", f"/team/invoices#invoice-{inv.id}", True)
        if inv.paid_on:
            add(at_noon(inv.paid_on), 'payment', f"Paid {inv.number}", f"KES {inv.amount:,.0f}", f"/team/invoices#invoice-{inv.id}", True)
    for msg in Message.objects.filter(client=client).select_related('sender').order_by('-created_at')[:30]:
        who = 'They wrote' if msg.sender_id == client.id else f"{first_name(msg.sender) or 'Team'} replied"
        add(msg.created_at, 'message', who, msg.body[:160], f"/team/messages?client={client.id}")
    for n in ClientNote.objects.filter(client=client).select_related('author'):
        add(n.created_at, 'note', f"Note from {first_name(n.author) or 'the team'}", n.body[:160])
    for t in Task.objects.filter(client=client, completed_at__isnull=False).select_related('assignee'):
        by = f" by {first_name(t.assignee)}" if t.assignee else ''
        add(t.completed_at, 'task', f"Task done{by}: {t.title}", t.project.name if t.project_id else '')

    events.sort(key=lambda e: e['at'], reverse=True)
    return events[:limit]


class ClientActivityView(APIView):
    permission_classes = [Staff]

    def get(self, request, pk):
        client = get_object_or_404(User, pk=pk, is_staff=False)
        return Response(client_activity(client))


# ---------------------------------------------------------------- today

class TodayView(APIView):
    """What needs attention today: money owed, leads going cold, projects slipping, and my own tasks."""

    permission_classes = [Staff]

    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()

        overdue = [
            {
                'id': inv.id, 'number': inv.number, 'client': inv.client.full_name, 'client_id': inv.client_id,
                'amount': inv.amount, 'due_on': inv.due_on, 'days': (today - inv.due_on).days if inv.due_on else None,
            }
            for inv in overdue_invoices(today).select_related('client').order_by(F('due_on').asc(nulls_first=True))
        ]

        stalled = []
        for lead in Enquiry.objects.filter(status__in=list(STALLED_AFTER_DAYS)).order_by('updated_at'):
            idle = (now - lead.updated_at).days
            if idle >= STALLED_AFTER_DAYS[lead.status]:
                stalled.append({
                    'id': lead.id, 'name': lead.full_name, 'service': lead.get_service_display(),
                    'status': lead.status, 'status_label': lead.get_status_display(), 'days': idle,
                })

        last_time = dict(TimeEntry.objects.values('project_id').annotate(d=Max('date')).values_list('project_id', 'd'))
        risky = []
        for p in Project.objects.filter(ACTIVE_PROJECT).select_related('client'):
            reasons = []
            if p.health != Project.Health.ON_TRACK:
                reasons.append(p.get_health_display())
            if p.due_date and p.due_date < today:
                days = (today - p.due_date).days
                reasons.append(f"{days} day{'s' if days != 1 else ''} past due")
            last = max(timezone.localdate(p.updated_at), last_time.get(p.id) or p.created_at.date())
            quiet = (today - last).days
            if quiet >= QUIET_AFTER_DAYS:
                reasons.append(f"No activity for {quiet} days")
            if reasons:
                risky.append({
                    'id': p.id, 'name': p.name, 'client': p.client.full_name, 'health': p.health,
                    'progress': p.progress, 'due_date': p.due_date, 'reasons': reasons,
                })
        risky.sort(key=lambda r: (r['health'] != Project.Health.OFF_TRACK, r['due_date'] or today))

        mine = Task.objects.filter(assignee=request.user).exclude(status=Task.Status.DONE).select_related('project', 'client')
        due = [t for t in mine if t.due_date and t.due_date <= today]
        due.sort(key=lambda t: (t.due_date, t.priority != Task.Priority.HIGH))
        waiting = [t for t in message_threads() if t['needs_reply']]

        # orders waiting on the team: a quote to write, or an accepted quote to start
        orders = Order.objects.filter(status__in=[Order.Status.SUBMITTED, Order.Status.REVIEWING, Order.Status.ACCEPTED]).select_related('client', 'assignee').order_by('created_at')

        return Response({
            'date': today,
            'overdue_invoices': overdue,
            'overdue_total': sum((i['amount'] for i in overdue), Decimal(0)),
            'stalled_leads': stalled,
            'at_risk_projects': risky,
            'my_tasks_due': [
                {
                    'id': t.id, 'title': t.title, 'priority': t.priority, 'due_date': t.due_date, 'status': t.status,
                    'project': t.project.name if t.project else '', 'project_id': t.project_id,
                    'client': t.client.full_name if t.client else '', 'overdue': t.due_date < today,
                }
                for t in due
            ],
            'my_open_tasks': mine.count(),
            'my_minutes_today': TimeEntry.objects.filter(user=request.user, date=today).aggregate(m=Sum('minutes'))['m'] or 0,
            'waiting_replies': waiting[:5],
            'waiting_replies_count': len(waiting),
            'orders_waiting': [
                {
                    'id': o.id, 'number': o.number, 'service': o.service_name, 'client': o.client.full_name,
                    'status': o.status, 'status_label': o.get_status_display(),
                    'assignee': first_name(o.assignee), 'days': (now - (o.accepted_at or o.created_at)).days,
                }
                for o in orders
            ],
        })


# ---------------------------------------------------------------- search

class SearchView(APIView):
    """One box for everything: clients, leads, orders, projects, invoices and tasks."""

    permission_classes = [Staff]
    PER_KIND = 5

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response([])
        n = self.PER_KIND
        results = []

        clients = User.objects.filter(is_staff=False).select_related('client_profile').filter(
            Q(full_name__icontains=q) | Q(email__icontains=q) | Q(phone_number__icontains=q) | Q(client_profile__company_name__icontains=q)
        )[:n]
        for c in clients:
            company = getattr(getattr(c, 'client_profile', None), 'company_name', '')
            results.append({'kind': 'client', 'id': c.id, 'title': c.full_name, 'subtitle': ' · '.join(filter(None, [company, c.email])), 'url': f"/team/clients/{c.id}"})

        for p in Project.objects.select_related('client').filter(Q(name__icontains=q) | Q(summary__icontains=q) | Q(client__full_name__icontains=q))[:n]:
            results.append({'kind': 'project', 'id': p.id, 'title': p.name, 'subtitle': f"{p.client.full_name} · {p.get_status_display()}", 'url': f"/team/projects/{p.id}"})

        for inv in Invoice.objects.select_related('client').filter(Q(number__icontains=q) | Q(description__icontains=q) | Q(client__full_name__icontains=q))[:n]:
            results.append({'kind': 'invoice', 'id': inv.id, 'title': inv.number, 'subtitle': f"{inv.client.full_name} · KES {inv.amount:,.0f} · {inv.get_status_display()}", 'url': f"/team/invoices#invoice-{inv.id}"})

        for lead in Enquiry.objects.filter(Q(full_name__icontains=q) | Q(email__icontains=q) | Q(phone_number__icontains=q) | Q(message__icontains=q))[:n]:
            results.append({'kind': 'lead', 'id': lead.id, 'title': lead.full_name, 'subtitle': f"{lead.get_service_display()} · {lead.get_status_display()}", 'url': f"/team/leads#lead-{lead.id}"})

        for o in Order.objects.select_related('client').filter(Q(number__icontains=q) | Q(service_name__icontains=q) | Q(client__full_name__icontains=q) | Q(brief__icontains=q))[:n]:
            results.append({'kind': 'order', 'id': o.id, 'title': f"{o.number} · {o.service_name}", 'subtitle': f"{o.client.full_name} · {o.get_status_display()}", 'url': f"/team/orders/{o.id}"})

        for t in Task.objects.select_related('project', 'assignee').filter(Q(title__icontains=q) | Q(notes__icontains=q))[:n]:
            where = f"/team/projects/{t.project_id}" if t.project_id else '/team/work'
            who = t.assignee.full_name if t.assignee else 'Unassigned'
            results.append({'kind': 'task', 'id': t.id, 'title': t.title, 'subtitle': f"{who} · {t.get_status_display()}", 'url': where})

        return Response(results)
