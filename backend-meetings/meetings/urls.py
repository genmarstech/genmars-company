from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ActionsView, ActionViewSet, AgendaViewSet, DecisionsView, DirectoryView, MeetingViewSet, NoteViewSet, OverviewView, ParticipantViewSet, PointViewSet

router = SimpleRouter()
router.register(r'(?P<meeting_pk>\d+)/participants', ParticipantViewSet, basename='meeting-participants')
router.register(r'(?P<meeting_pk>\d+)/agenda', AgendaViewSet, basename='meeting-agenda')
router.register(r'(?P<meeting_pk>\d+)/notes', NoteViewSet, basename='meeting-notes')
router.register(r'(?P<meeting_pk>\d+)/points', PointViewSet, basename='meeting-points')
router.register(r'(?P<meeting_pk>\d+)/actions', ActionViewSet, basename='meeting-actions')
router.register(r'', MeetingViewSet, basename='meetings')

urlpatterns = [
    path('overview/', OverviewView.as_view(), name='meetings-overview'),
    path('directory/', DirectoryView.as_view(), name='meetings-directory'),
    path('decisions/', DecisionsView.as_view(), name='meetings-decisions'),
    path('actions/', ActionsView.as_view(), name='meetings-actions'),
    path('', include(router.urls)),
]
