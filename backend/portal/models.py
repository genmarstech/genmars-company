from django.conf import settings
from django.db import models


class Project(models.Model):
    """A piece of work for a client, shown in their portal."""

    class Status(models.TextChoices):
        PLANNING = 'planning', 'Planning'
        IN_PROGRESS = 'in_progress', 'In progress'
        IN_REVIEW = 'in_review', 'In review'
        COMPLETED = 'completed', 'Completed'
        ON_HOLD = 'on_hold', 'On hold'

    class Health(models.TextChoices):
        ON_TRACK = 'on_track', 'On track'
        AT_RISK = 'at_risk', 'At risk'
        OFF_TRACK = 'off_track', 'Off track'

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=200)
    summary = models.CharField(max_length=255, blank=True, default='')
    service = models.CharField(max_length=32, blank=True, default='')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNING, db_index=True)
    health = models.CharField(max_length=16, choices=Health.choices, default=Health.ON_TRACK)
    progress = models.PositiveSmallIntegerField(default=0, help_text='0–100')
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='KES')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.client.email})"

    @property
    def is_active(self):
        return self.status not in (self.Status.COMPLETED, self.Status.ON_HOLD)


class Milestone(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In progress'
        DONE = 'done', 'Done'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=200)
    description = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


class ProjectLink(models.Model):
    """Shared files and previews (designs, staging sites, documents) as links."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='links')
    title = models.CharField(max_length=200)
    url = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Awaiting payment'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    number = models.CharField(max_length=32, unique=True)
    description = models.CharField(max_length=255, blank=True, default='')
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text='KES')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    issued_on = models.DateField(null=True, blank=True)
    due_on = models.DateField(null=True, blank=True)
    paid_on = models.DateField(null=True, blank=True)
    payment_link = models.URLField(blank=True, default='', help_text='Optional link for paying online')

    class Meta:
        ordering = ['-issued_on', '-id']

    def __str__(self):
        return f"{self.number} · KES {self.amount}"


class Message(models.Model):
    """A note between the client and the Genmars team, optionally about one project."""

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='portal_messages')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='sent_portal_messages')
    body = models.TextField()
    read_by_client = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender} → {self.client}: {self.body[:40]}"

    @property
    def from_team(self):
        return self.sender_id != self.client_id


class Task(models.Model):
    """A to-do for someone on the team, optionally about a project or client."""

    class Status(models.TextChoices):
        TODO = 'todo', 'To do'
        DOING = 'doing', 'Doing'
        DONE = 'done', 'Done'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        NORMAL = 'normal', 'Normal'
        HIGH = 'high', 'High'

    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True, default='')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='client_tasks')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_tasks')
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.TODO, db_index=True)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['status', models.F('due_date').asc(nulls_last=True), '-created_at']

    def __str__(self):
        return self.title


class TimeEntry(models.Model):
    """Time someone on the team spent on a project."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='time_entries')
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name='time_entries')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='time_entries')
    date = models.DateField()
    minutes = models.PositiveIntegerField()
    note = models.CharField(max_length=255, blank=True, default='')
    billable = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name_plural = 'time entries'

    def __str__(self):
        return f"{self.user} · {self.minutes}m on {self.project.name}"


class StaffRate(models.Model):
    """What an hour of one team member costs the business, for project profitability."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_rate')
    hourly_cost = models.DecimalField(max_digits=10, decimal_places=2, help_text='KES per hour')

    def __str__(self):
        return f"{self.user} · KES {self.hourly_cost}/h"


class ClientNote(models.Model):
    """An internal note about a client. Clients never see these."""

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='team_notes')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='written_client_notes')
    body = models.TextField()
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-pinned', '-created_at']

    def __str__(self):
        return self.body[:60]
