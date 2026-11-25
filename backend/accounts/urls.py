from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsersViewset, LoginView, LogoutView

# relevant views

router = DefaultRouter()

router.register(r"users", UsersViewset, basename='Genmars_users')

urlpatterns = [
    path("", include(router.urls)),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='Logout')
]