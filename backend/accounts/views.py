from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .serializers import GenUsersSerializers


User = get_user_model()

# Create your views here.
class UsersViewset(viewsets.ModelViewSet):
    """Staff manage every account; everyone else only sees and edits their own via /users/me/."""

    queryset = User.objects.all().order_by('id')
    serializer_class = GenUsersSerializers
    permission_classes = [permissions.IsAdminUser]

    def get_permissions(self):
        if self.action == 'register':
            return [permissions.AllowAny()]
        if self.action == 'me':
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_throttles(self):
        if self.action == 'register':
            self.throttle_scope = 'register'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, email=email, password=password)

        if user is not None:
            login(request, user)

            return Response({'message':'Login successful and your session started'}, status=status.HTTP_200_OK)
        return Response({'error': 'invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out'}, status=status.HTTP_200_OK)
