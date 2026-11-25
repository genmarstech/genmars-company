"""Staff-only API for the team dashboard: every client, project, invoice and message."""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from applications_communications.models import Enquiry
from .models import Invoice, Message, Milestone, Project, ProjectLink
from .serializers import MilestoneSerializer, ProjectLinkSerializer

User = get_user_model()


class TeamClientSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='client_profile.company_name', default='', read_only=True)
    project_count = serializers.IntegerField(read_only=True)
    active_projects = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone_number', 'company_name', 'date_joined', 'project_count', 'active_projects']


class TeamMilestoneSerializer(MilestoneSerializer):
    class Meta(MilestoneSerializer.Meta):
        fields = MilestoneSerializer.Meta.fields + ['project', 'order']
        read_only_fields = ['completed_at']

    def save(self, **kwargs):
        status = self.validated_data.get('status')
        if status == Milestone.Status.DONE and not (self.instance and self.instance.completed_at):
            kwargs['completed_at'] = timezone.now()
        elif status and status != Milestone.Status.DONE:
            kwargs['completed_at'] = None
        return super().save(**kwargs)


class TeamProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    health_label = serializers.CharField(source='get_health_display', read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    milestones = TeamMilestoneSerializer(many=True, read_only=True)
    links = ProjectLinkSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'client', 'client_name', 'name', 'summary', 'service', 'status', 'status_label', 'health',
            'health_label', 'progress', 'budget', 'start_date', 'due_date', 'updated_at', 'milestones', 'links',
        ]

    def validate_progress(self, value):
        if value > 100:
            raise serializers.ValidationError('Progress is a percentage from 0 to 100.')
        return value


class TeamInvoiceSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = [
            'id', 'client', 'client_name', 'project', 'project_name', 'number', 'description', 'amount', 'status',
            'status_label', 'issued_on', 'due_on', 'paid_on', 'payment_link',
        ]

    def validate(self, attrs):
        project = attrs.get('project') or (self.instance and self.instance.project)
        client = attrs.get('client') or (self.instance and self.instance.client)
        if project and client and project.client_id != client.id:
            raise serializers.ValidationError({'project': 'That project belongs to another client.'})
        if attrs.get('status') == Invoice.Status.PAID and not attrs.get('paid_on') and not (self.instance and self.instance.paid_on):
            attrs['paid_on'] = timezone.localdate()
        return attrs


class TeamMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True, default='')
    from_team = serializers.BooleanField(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')

    class Meta:
        model = Message
        fields = ['id', 'client', 'project', 'project_name', 'body', 'sender_name', 'from_team', 'read_by_client', 'created_at']
        read_only_fields = ['read_by_client', 'created_at']

    def validate(self, attrs):
        project = attrs.get('project')
        if project and project.client_id != attrs['client'].id:
            raise serializers.ValidationError({'project': 'That project belongs to another client.'})
        return attrs


class Staff(permissions.IsAdminUser):
    pass


class TeamSummaryView(APIView):
    permission_classes = [Staff]

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=6)
        projects = Project.objects.all()
        clients = User.objects.filter(is_staff=False)

        # milestones finished and client messages received on each of the last 7 days
        days = [week_start + timedelta(days=i) for i in range(7)]
        done = Milestone.objects.filter(completed_at__date__gte=week_start).values_list('completed_at', flat=True)
        msgs = Message.objects.filter(created_at__date__gte=week_start, sender=F('client')).values_list('created_at', flat=True)
        activity = [
            {
                'date': d,
                'milestones': sum(1 for t in done if timezone.localtime(t).date() == d),
                'messages': sum(1 for t in msgs if timezone.localtime(t).date() == d),
            }
            for d in days
        ]

        upcoming = (
            Milestone.objects.exclude(status=Milestone.Status.DONE)
            .filter(due_date__isnull=False)
            .select_related('project__client')
            .order_by('due_date')[:6]
        )

        return Response({
            'total_projects': projects.count(),
            'in_progress': projects.filter(status__in=[Project.Status.IN_PROGRESS, Project.Status.IN_REVIEW]).count(),
            'completed': projects.filter(status=Project.Status.COMPLETED).count(),
            'clients': clients.count(),
            'new_clients_this_month': clients.filter(date_joined__date__gte=today.replace(day=1)).count(),
            'at_risk': projects.filter(health__in=[Project.Health.AT_RISK, Project.Health.OFF_TRACK]).exclude(status=Project.Status.COMPLETED).count(),
            'new_enquiries': Enquiry.objects.filter(status=Enquiry.Status.NEW).count(),
            'unpaid_invoices': Invoice.objects.filter(status__in=[Invoice.Status.SENT, Invoice.Status.OVERDUE]).count(),
            'unanswered_messages': sum(1 for t in message_threads() if t['needs_reply']),
            'activity': activity,
            'upcoming': [
                {
                    'id': m.id, 'title': m.title, 'due_date': m.due_date, 'project': m.project.name,
                    'project_id': m.project_id, 'client': m.project.client.full_name,
                    'overdue': m.due_date < today,
                }
                for m in upcoming
            ],
        })


def message_threads():
    """One entry per client conversation, newest first, flagging ones waiting on the team."""
    latest = {}
    for m in Message.objects.select_related('client', 'project').order_by('created_at'):
        latest[m.client_id] = m
    threads = [
        {
            'client': m.client_id,
            'client_name': m.client.full_name,
            'last_message': m.body[:140],
            'last_at': m.created_at,
            'needs_reply': m.sender_id == m.client_id,
        }
        for m in latest.values()
    ]
    return sorted(threads, key=lambda t: t['last_at'], reverse=True)


class TeamThreadsView(APIView):
    permission_classes = [Staff]

    def get(self, request):
        return Response(message_threads())


class TeamClientViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [Staff]
    serializer_class = TeamClientSerializer

    def get_queryset(self):
        qs = User.objects.filter(is_staff=False).select_related('client_profile').annotate(
            project_count=Count('projects', distinct=True),
            active_projects=Count('projects', filter=~Q(projects__status__in=['completed', 'on_hold']), distinct=True),
        ).order_by('-date_joined')
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q) | Q(client_profile__company_name__icontains=q))
        return qs


class TeamProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [Staff]
    serializer_class = TeamProjectSerializer

    def get_queryset(self):
        qs = Project.objects.select_related('client').prefetch_related('milestones', 'links')
        client = self.request.query_params.get('client')
        return qs.filter(client_id=client) if client else qs


class TeamMilestoneViewSet(mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [Staff]
    serializer_class = TeamMilestoneSerializer
    queryset = Milestone.objects.all()


class TeamLinkViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [Staff]
    queryset = ProjectLink.objects.all()

    class LinkSerializer(ProjectLinkSerializer):
        class Meta(ProjectLinkSerializer.Meta):
            fields = ProjectLinkSerializer.Meta.fields + ['project']

    serializer_class = LinkSerializer


class TeamInvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [Staff]
    serializer_class = TeamInvoiceSerializer

    def get_queryset(self):
        qs = Invoice.objects.select_related('client', 'project')
        status = self.request.query_params.get('status')
        return qs.filter(status=status) if status else qs


class TeamMessageViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [Staff]
    serializer_class = TeamMessageSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Message.objects.select_related('sender', 'project', 'client')
        client = self.request.query_params.get('client')
        return qs.filter(client_id=client) if client else qs.none()

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        client = message.client
        about = f" about {message.project.name}" if message.project else ''
        send_mail(
            subject=f"New message from Genmars{about}",
            message=(
                f"Hi {client.full_name.split()[0]},\n\n{self.request.user.full_name.split()[0]} from Genmars wrote{about}:\n\n"
                f"{message.body}\n\nReply in your client portal: {settings.FRONTEND_URL}/portal/messages\n\nGenmars Tech\n"
            ),
            from_email=None,
            recipient_list=[client.email],
            fail_silently=True,
        )
