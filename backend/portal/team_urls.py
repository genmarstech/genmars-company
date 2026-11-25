from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .team import (
    TeamClientViewSet, TeamInvoiceViewSet, TeamLinkViewSet, TeamMessageViewSet, TeamMilestoneViewSet,
    TeamBrandFileView, TeamFinanceView, TeamProjectViewSet, TeamSummaryView, TeamThreadsView,
)

router = SimpleRouter()
router.register(r"clients", TeamClientViewSet, basename='team-clients')
router.register(r"projects", TeamProjectViewSet, basename='team-projects')
router.register(r"milestones", TeamMilestoneViewSet, basename='team-milestones')
router.register(r"links", TeamLinkViewSet, basename='team-links')
router.register(r"invoices", TeamInvoiceViewSet, basename='team-invoices')
router.register(r"messages", TeamMessageViewSet, basename='team-messages')

urlpatterns = [
    path("summary/", TeamSummaryView.as_view(), name='team-summary'),
    path("threads/", TeamThreadsView.as_view(), name='team-threads'),
    path("finance/", TeamFinanceView.as_view(), name='team-finance'),
    path("brand/<path:path>", TeamBrandFileView.as_view(), name='team-brand-file'),
    path("", include(router.urls)),
]
