from django.contrib import admin
from .models import Enquiry


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'service', 'budget', 'source', 'status', 'created_at']
    list_filter = ['status', 'source', 'service', 'budget', 'created_at']
    list_editable = ['status']
    search_fields = ['full_name', 'email', 'phone_number', 'message']
    readonly_fields = ['ip_address', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
    fieldsets = [
        ('Client', {'fields': ['full_name', 'email', 'phone_number']}),
        ('Project', {'fields': ['service', 'budget', 'message']}),
        ('Pipeline', {'fields': ['status', 'internal_notes', 'source', 'client']}),
        ('Meta', {'fields': ['ip_address', 'created_at', 'updated_at']}),
    ]
