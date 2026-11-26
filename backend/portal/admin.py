from django.contrib import admin
from django.utils import timezone
from .models import (
    ClientNote, Invoice, Message, Milestone, Order, OrderUpdate, Project, ProjectLink, ServiceOffering, StaffRate, Task, TimeEntry,
)


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 1
    fields = ['order', 'title', 'description', 'status', 'due_date', 'completed_at']


class ProjectLinkInline(admin.TabularInline):
    model = ProjectLink
    extra = 0


class MessageInline(admin.TabularInline):
    model = Message
    extra = 1
    fields = ['sender', 'body', 'created_at']
    readonly_fields = ['created_at']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'client', 'status', 'health', 'progress', 'due_date', 'updated_at']
    list_filter = ['status', 'health']
    search_fields = ['name', 'client__email', 'client__full_name']
    autocomplete_fields = ['client']
    inlines = [MilestoneInline, ProjectLinkInline]

    def save_formset(self, request, form, formset, change):
        # stamp milestones the moment they're marked done
        for obj in formset.save(commit=False):
            if isinstance(obj, Milestone) and obj.status == Milestone.Status.DONE and not obj.completed_at:
                obj.completed_at = timezone.now()
            obj.save()
        formset.save_m2m()
        for obj in formset.deleted_objects:
            obj.delete()


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['number', 'client', 'project', 'amount', 'status', 'issued_on', 'due_on', 'paid_on']
    list_filter = ['status']
    search_fields = ['number', 'client__email', 'client__full_name']
    autocomplete_fields = ['client', 'project']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['client', 'project', 'sender', 'short_body', 'read_by_client', 'created_at']
    list_filter = ['read_by_client']
    search_fields = ['body', 'client__email']
    autocomplete_fields = ['client', 'project', 'sender']

    @admin.display(description='Message')
    def short_body(self, obj):
        return obj.body[:80]

    def save_model(self, request, obj, form, change):
        # replies written in the admin come from the staff member writing them
        if not change and not obj.sender_id:
            obj.sender = request.user
        super().save_model(request, obj, form, change)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'assignee', 'project', 'status', 'priority', 'due_date']
    list_filter = ['status', 'priority']
    search_fields = ['title', 'notes']


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ['date', 'user', 'project', 'minutes', 'billable', 'note']
    list_filter = ['billable', 'user']


@admin.register(StaffRate)
class StaffRateAdmin(admin.ModelAdmin):
    list_display = ['user', 'hourly_cost']


@admin.register(ClientNote)
class ClientNoteAdmin(admin.ModelAdmin):
    list_display = ['client', 'author', 'pinned', 'created_at']
    search_fields = ['body']


@admin.register(ServiceOffering)
class ServiceOfferingAdmin(admin.ModelAdmin):
    list_display = ['name', 'starting_price', 'billing', 'deposit_percent', 'is_active', 'order']
    list_editable = ['starting_price', 'is_active', 'order']
    prepopulated_fields = {'slug': ['name']}


class OrderUpdateInline(admin.TabularInline):
    model = OrderUpdate
    extra = 0
    fields = ['created_at', 'author', 'kind', 'status', 'body', 'internal']
    readonly_fields = ['created_at']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'client', 'service_name', 'status', 'quoted_price', 'assignee', 'created_at']
    list_filter = ['status', 'service']
    search_fields = ['number', 'client__email', 'client__full_name', 'brief']
    autocomplete_fields = ['client', 'assignee', 'project']
    readonly_fields = ['number', 'created_at', 'updated_at']
    inlines = [OrderUpdateInline]
