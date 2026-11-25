from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import ClientProfile, GenUsers


class ClientProfileInline(admin.StackedInline):
    model = ClientProfile
    can_delete = False
    extra = 0


@admin.register(GenUsers)
class GenUsersAdmin(UserAdmin):
    ordering = ['-date_joined']
    list_display = ['email', 'full_name', 'phone_number', 'is_staff', 'date_joined']
    search_fields = ['email', 'full_name', 'phone_number']
    inlines = [ClientProfileInline]
    fieldsets = [
        (None, {'fields': ['email', 'password']}),
        ('Personal info', {'fields': ['full_name', 'phone_number']}),
        ('Permissions', {'fields': ['is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
        ('Dates', {'fields': ['last_login', 'date_joined']}),
    ]
    add_fieldsets = [
        (None, {'classes': ['wide'], 'fields': ['email', 'full_name', 'password1', 'password2']}),
    ]


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'company_name', 'industry', 'company_size', 'onboarding_completed_at']
    list_filter = ['company_size', 'contact_method']
    search_fields = ['company_name', 'user__email', 'user__full_name']
