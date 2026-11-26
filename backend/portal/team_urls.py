from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .orders import TeamOrderViewSet, TeamServiceViewSet
from .team import (
    TeamClientViewSet, TeamInvoiceViewSet, TeamLinkViewSet, TeamMessageViewSet, TeamMilestoneViewSet,
    TeamBrandFileView, TeamFinanceView, TeamProjectViewSet, TeamSummaryView, TeamThreadsView,
)

from .workspace import (
    ClientActivityView, ClientDetailView, ClientNoteViewSet, ProfitabilityView, SearchView, StaffViewSet, TaskViewSet,
    TimeEntryViewSet, TodayView,
)

router = SimpleRouter()
router.register(r"clients", TeamClientViewSet, basename='team-clients')
router.register(r"projects", TeamProjectViewSet, basename='team-projects')
router.register(r"milestones", TeamMilestoneViewSet, basename='team-milestones')
router.register(r"links", TeamLinkViewSet, basename='team-links')
router.register(r"invoices", TeamInvoiceViewSet, basename='team-invoices')
router.register(r"messages", TeamMessageViewSet, basename='team-messages')
router.register(r"tasks", TaskViewSet, basename='team-tasks')
router.register(r"time", TimeEntryViewSet, basename='team-time')
router.register(r"staff", StaffViewSet, basename='team-staff')
router.register(r"orders", TeamOrderViewSet, basename='team-orders')
router.register(r"services", TeamServiceViewSet, basename='team-services')
router.register(r"notes", ClientNoteViewSet, basename='team-notes')

urlpatterns = [
    path("summary/", TeamSummaryView.as_view(), name='team-summary'),
    path("threads/", TeamThreadsView.as_view(), name='team-threads'),
    path("finance/", TeamFinanceView.as_view(), name='team-finance'),
    path("brand/<path:path>", TeamBrandFileView.as_view(), name='team-brand-file'),
    path("today/", TodayView.as_view(), name='team-today'),
    path("search/", SearchView.as_view(), name='team-search'),
    path("profitability/", ProfitabilityView.as_view(), name='team-profitability'),
    path("clients/<int:pk>/overview/", ClientDetailView.as_view(), name='team-client-overview'),
    path("clients/<int:pk>/activity/", ClientActivityView.as_view(), name='team-client-activity'),
    path("", include(router.urls)),
]
