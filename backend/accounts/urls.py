from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoginView, LogoutView, PasswordResetConfirmView, PasswordResetRequestView, UsersViewset

# relevant views

router = DefaultRouter()

router.register(r"users", UsersViewset, basename='Genmars_users')

urlpatterns = [
    path("", include(router.urls)),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='Logout'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
]