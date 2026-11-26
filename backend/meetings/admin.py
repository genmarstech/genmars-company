from django.contrib import admin

from .models import ActionItem, AgendaItem, Artifact, GoogleConnection, Meeting, MeetingNote, Participant, Point


class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 0


class AgendaInline(admin.TabularInline):
    model = AgendaItem
    extra = 0


@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ['title', 'scheduled_start', 'status', 'category', 'organizer', 'project', 'report_status']
    list_filter = ['status', 'category', 'report_status', 'kind']
    search_fields = ['title', 'description', 'summary']
    inlines = [ParticipantInline, AgendaInline]


@admin.register(GoogleConnection)
class GoogleConnectionAdmin(admin.ModelAdmin):
    list_display = ['account_email', 'status', 'connected_by', 'updated_at']
    # tokens are encrypted and never shown
    exclude = ['access_token', 'refresh_token']
    readonly_fields = ['account_email', 'token_expiry', 'scopes', 'connected_by', 'last_error']


admin.site.register(MeetingNote)
admin.site.register(Point)
admin.site.register(ActionItem)
admin.site.register(Artifact)
