from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import EnquiryCreateView, EnquiryViewSet

router = SimpleRouter()
router.register(r"inbox", EnquiryViewSet, basename='enquiries')

urlpatterns = [
    path("", EnquiryCreateView.as_view(), name='enquiry-create'),
    path("", include(router.urls)),
]
