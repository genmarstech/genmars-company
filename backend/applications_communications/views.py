import ipaddress

from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.throttling import ScopedRateThrottle
from .models import Enquiry
from .notifications import notify_new_enquiry
from .serializers import EnquiryCreateSerializer, EnquirySerializer


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


class EnquiryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Staff-only lead inbox: list, read and move enquiries through the pipeline."""

    queryset = Enquiry.objects.all()
    serializer_class = EnquirySerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        return qs.filter(status=status) if status else qs
