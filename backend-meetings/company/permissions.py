from rest_framework import permissions


class Staff(permissions.BasePermission):
    """Genmars team members only. Clients and guests never reach meeting records."""

    message = 'The Meetings tool is for the Genmars team.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_active and request.user.is_staff)


class Owner(Staff):
    message = 'Only an owner can change the Google connection.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_superuser
