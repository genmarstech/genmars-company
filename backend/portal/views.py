from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum
from rest_framework import mixins, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from applications_communications.models import Enquiry
from applications_communications.notifications import notify_new_enquiry
from applications_communications.serializers import PortalRequestSerializer
from .models import Invoice, Message, Milestone, Project
from .serializers import InvoiceSerializer, MessageSerializer, ProjectDetailSerializer, ProjectSerializer

# Every view here only ever returns the signed-in client's own records.


class SummaryView(APIView):
    """Numbers and recent activity for the portal dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        projects = Project.objects.filter(client=user)
        invoices = Invoice.objects.filter(client=user).exclude(status=Invoice.Status.DRAFT)
        unpaid = invoices.filter(status__in=[Invoice.Status.SENT, Invoice.Status.OVERDUE])

        activity = []
        for m in Milestone.objects.filter(project__client=user, status=Milestone.Status.DONE, completed_at__isnull=False).select_related('project').order_by('-completed_at')[:5]:
            activity.append({'kind': 'milestone', 'text': f"{m.title} completed", 'project': m.project.name, 'at': m.completed_at})
        for msg in Message.objects.filter(client=user).exclude(sender=user).order_by('-created_at')[:5]:
            activity.append({'kind': 'message', 'text': 'New message from Genmars', 'project': msg.project.name if msg.project else '', 'at': msg.created_at})
        activity.sort(key=lambda a: a['at'], reverse=True)

        return Response({
            'active_projects': sum(1 for p in projects if p.is_active),
            'completed_projects': projects.filter(status=Project.Status.COMPLETED).count(),
            'invoices': invoices.count(),
            'unpaid_total': unpaid.aggregate(total=Sum('amount'))['total'] or 0,
            'unread_messages': Message.objects.filter(client=user, read_by_client=False).exclude(sender=user).count(),
            'projects': ProjectSerializer(projects.exclude(status=Project.Status.COMPLETED)[:4], many=True).data,
            'activity': activity[:6],
        })


class ProjectViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(client=self.request.user).prefetch_related('milestones', 'links')

    def get_serializer_class(self):
        return ProjectDetailSerializer if self.action == 'retrieve' else ProjectSerializer


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        # drafts stay internal until they're sent
        return Invoice.objects.filter(client=self.request.user).exclude(status=Invoice.Status.DRAFT).select_related('project')


class MessageViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Message.objects.filter(client=self.request.user).select_related('sender', 'project')
        project = self.request.query_params.get('project')
        return qs.filter(project_id=project) if project else qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # opening the conversation marks the team's messages as read
        self.get_queryset().filter(read_by_client=False).exclude(sender=request.user).update(read_by_client=True)
        return response

    def perform_create(self, serializer):
        message = serializer.save(client=self.request.user, sender=self.request.user, read_by_client=True)
        user = self.request.user
        about = f" about {message.project.name}" if message.project else ''
        send_mail(
            subject=f"New portal message from {user.full_name}{about}",
            message=f"{user.full_name} ({user.email}) wrote{about}:\n\n{message.body}\n\nReply from the Django admin (Portal › Messages).",
            from_email=None,
            recipient_list=[settings.ENQUIRY_NOTIFY_EMAIL],
            fail_silently=True,
        )


class ProjectRequestViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """New project requests a signed-in client sends from their portal. They land in the team's leads."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PortalRequestSerializer
    pagination_class = None

    def get_queryset(self):
        return Enquiry.objects.filter(client=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        enquiry = serializer.save(
            client=user, full_name=user.full_name, email=user.email,
            phone_number=user.phone_number, source=Enquiry.Source.PORTAL,
        )
        notify_new_enquiry(enquiry)
