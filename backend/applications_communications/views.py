import ipaddress

from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from .models import Enquiry
from .notifications import notify_new_enquiry
from . import pitch
from .serializers import EnquiryCreateSerializer, EnquirySerializer, TeamLeadCreateSerializer


def client_ip(request):
    # behind Render/Vercel the visitor's address is the first X-Forwarded-For entry
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    ip = forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR')
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        return None
    return ip


class EnquiryCreateView(generics.CreateAPIView):
    """Public endpoint behind the website's quote form."""

    serializer_class = EnquiryCreateSerializer
    permission_classes = [permissions.AllowAny]
    # no session auth, so the public form needs no CSRF token
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'enquiry'

    def perform_create(self, serializer):
        enquiry = serializer.save(ip_address=client_ip(self.request))
        notify_new_enquiry(enquiry)


class EnquiryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Staff-only lead inbox: list, add, read and move leads through the pipeline, and pitch redesigns."""

    queryset = Enquiry.objects.select_related('project')
    serializer_class = EnquirySerializer
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        return TeamLeadCreateSerializer if self.action == 'create' else EnquirySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        if self.request.query_params.get('pitch'):
            qs = qs.exclude(pitch_status='')
        return qs

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """The client said "build it": make them a client with a project, a deposit invoice and onboarding."""
        lead = self.get_object()
        data = pitch.ConvertSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        project, is_new = pitch.convert(lead, data.validated_data, request.user)
        lead.refresh_from_db()
        return Response({
            **EnquirySerializer(lead).data,
            'client_is_new': is_new,
            'project_url': f"/team/projects/{project.id}",
            'client_url': f"/team/clients/{lead.client_id}",
        })
