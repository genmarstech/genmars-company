from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .google_login import GoogleCallbackView, GoogleStartView
from .views import LoginView, LogoutView, PasswordResetConfirmView, PasswordResetRequestView, UsersViewset

# relevant views

router = DefaultRouter()

router.register(r"users", UsersViewset, basename='Genmars_users')

urlpatterns = [
    path("", include(router.urls)),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='Logout'),
    path('google/start/', GoogleStartView.as_view(), name='google-login-start'),
    path('google/callback/', GoogleCallbackView.as_view(), name='google-login-callback'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
]