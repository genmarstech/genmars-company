from django.http import JsonResponse
from django.urls import include, path


def healthz(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('healthz', healthz),
    path('api/v1/meetings/', include('meetings.urls')),
    path('api/v1/integrations/google/', include('meetings.google_urls')),
]
