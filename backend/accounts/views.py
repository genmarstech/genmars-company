from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import viewsets, status, permissions
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .models import ClientProfile
from .serializers import ClientProfileSerializer, GenUsersSerializers


User = get_user_model()


def auth_response(user, status_code=status.HTTP_200_OK):
    """The token the website stores, plus the signed-in user's profile."""
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': GenUsersSerializers(user).data}, status=status_code)


# Create your views here.
class UsersViewset(viewsets.ModelViewSet):
    """Staff manage every account; everyone else only sees and edits their own via /users/me/."""

    queryset = User.objects.all().order_by('id')
    serializer_class = GenUsersSerializers
    permission_classes = [permissions.IsAdminUser]

    def get_permissions(self):
        if self.action == 'register':
            return [permissions.AllowAny()]
        if self.action in ('me', 'profile'):
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_authenticators(self):
        # sign-up is public, so ignore any stale session or token on the request
        if getattr(self, 'action', None) == 'register' or self.request.path.endswith('/register/'):
            return []
        return super().get_authenticators()

    def get_throttles(self):
        if self.action == 'register':
            self.throttle_scope = 'register'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return auth_response(user, status.HTTP_201_CREATED)

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        if request.method == 'GET':
            return Response(self.get_serializer(request.user).data)

        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # changing the password would otherwise log the user out
        update_session_auth_hash(request, user)
        return Response(serializer.data)


    @action(detail=False, methods=['get', 'patch'], url_path='me/profile', serializer_class=ClientProfileSerializer)
    def profile(self, request):
        """The signed-in client's onboarding details. Send complete=true to finish onboarding."""
        profile, _ = ClientProfile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            return Response(ClientProfileSerializer(profile).data)

        was_complete = bool(profile.onboarding_completed_at)
        serializer = ClientProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        if profile.onboarding_completed_at and not was_complete:
            notify_new_client(profile)
        return Response(serializer.data)


def notify_new_client(profile):
    """Let the team know a client finished onboarding, with what they told us."""
    user = profile.user
    send_mail(
        subject=f"New client onboarded: {profile.company_name or user.full_name}",
        message=(
            f"{user.full_name} ({user.email}, {user.phone_number or 'no phone'}) finished onboarding.\n\n"
            f"Company: {profile.company_name or '-'} ({profile.get_company_size_display() or 'size not given'})\n"
            f"Role: {profile.job_title or '-'}\nIndustry: {profile.industry or '-'}\nWebsite: {profile.website or '-'}\n"
            f"Interested in: {', '.join(profile.services) or '-'}\nBudget: {profile.budget or '-'}\n"
            f"Timeline: {profile.timeline or '-'}\nPrefers: {profile.get_contact_method_display()}\n\n"
            f"Goals:\n{profile.goals or '-'}\n"
        ),
        from_email=None,
        recipient_list=[settings.ENQUIRY_NOTIFY_EMAIL],
        fail_silently=True,
    )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, email=email, password=password)

        if user is not None:
            return auth_response(user)
        return Response({'error': 'Incorrect email or password.'}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        logout(request)
        return Response({'message': 'Logged out'}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """Email a reset link. Always answers the same way so it can't reveal which emails exist."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail(
                subject='Reset your Genmars password',
                message=(
                    f"Hi {user.full_name.split()[0] if user.full_name else ''},\n\n"
                    f"Use this link to choose a new password. It works once and expires in a few days.\n\n"
                    f"{link}\n\n"
                    f"If you didn't ask for this, you can ignore this email.\n\nGenmars Tech\n"
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({'message': 'If that email has an account, a reset link is on its way.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        try:
            pk = force_str(urlsafe_base64_decode(request.data.get('uid', '')))
            user = User.objects.get(pk=pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, request.data.get('token', '')):
            return Response({'error': 'This reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        password = request.data.get('password', '')
        try:
            validate_password(password, user)
        except ValidationError as error:
            return Response({'password': list(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        # sign out every device that used the old password
        Token.objects.filter(user=user).delete()
        return auth_response(user)
