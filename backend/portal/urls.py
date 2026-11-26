from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .orders import OrderViewSet
from .views import InvoiceViewSet, MessageViewSet, ProjectRequestViewSet, ProjectViewSet, SummaryView

router = SimpleRouter()
router.register(r"projects", ProjectViewSet, basename='portal-projects')
router.register(r"invoices", InvoiceViewSet, basename='portal-invoices')
router.register(r"messages", MessageViewSet, basename='portal-messages')
router.register(r"orders", OrderViewSet, basename='portal-orders')
router.register(r"requests", ProjectRequestViewSet, basename='portal-requests')

urlpatterns = [
    path("summary/", SummaryView.as_view(), name='portal-summary'),
    path("", include(router.urls)),
]
