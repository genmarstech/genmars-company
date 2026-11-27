from django.conf import settings
from django.db import models
from django.utils import timezone


class Project(models.Model):
    """A piece of work for a client, shown in their portal, or one of Genmars's own products.

    Internal projects have no client. They start in Testing, where only the team sees them, and
    are moved to Production when they're ready: then they're listed on the public Products page
    and in every client's portal so people can open and use them.
    """

    class Kind(models.TextChoices):
        CLIENT = 'client', 'Client project'
        INTERNAL = 'internal', 'Internal product'

    class Stage(models.TextChoices):
        TESTING = 'testing', 'Testing'
        PRODUCTION = 'production', 'Production'

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

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.CLIENT, db_index=True)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='projects')
    name = models.CharField(max_length=200)
    summary = models.CharField(max_length=255, blank=True, default='')
    service = models.CharField(max_length=32, blank=True, default='')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNING, db_index=True)
    health = models.CharField(max_length=16, choices=Health.choices, default=Health.ON_TRACK)
    progress = models.PositiveSmallIntegerField(default=0, help_text='0–100')
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='KES')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    # internal products only
    stage = models.CharField(max_length=10, choices=Stage.choices, blank=True, default='', db_index=True)
    app_url = models.URLField(blank=True, default='', help_text='Where people open the product once it is live')
    went_live_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.client.email if self.client else 'Genmars'})"

    @property
    def is_internal(self):
        return self.kind == self.Kind.INTERNAL

    @property
    def owner_name(self):
        return self.client.full_name if self.client else 'Genmars'

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


class ServiceOffering(models.Model):
    """One service clients can order from their portal, with its starting price."""

    class Billing(models.TextChoices):
        ONCE = 'once', 'One-off'
        MONTHLY = 'monthly', 'Monthly'

    # matches Enquiry.Service and the website's service list
    key = models.CharField(max_length=32, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    summary = models.CharField(max_length=255, blank=True, default='')
    includes = models.JSONField(default=list, blank=True, help_text='List of short lines')
    timeline = models.CharField(max_length=64, blank=True, default='')
    starting_price = models.DecimalField(max_digits=12, decimal_places=2, help_text='KES')
    billing = models.CharField(max_length=8, choices=Billing.choices, default=Billing.ONCE)
    deposit_percent = models.PositiveSmallIntegerField(default=30, help_text='Share of the quote invoiced before work starts')
    is_active = models.BooleanField(default=True, help_text='Hidden from clients when off')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class Order(models.Model):
    """A client ordering one of our services: from brief, to quote, to a running project."""

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Received'
        REVIEWING = 'reviewing', 'Under review'
        QUOTED = 'quoted', 'Quote ready'
        ACCEPTED = 'accepted', 'Quote accepted'
        IN_PROGRESS = 'in_progress', 'In progress'
        DELIVERED = 'delivered', 'Delivered'
        COMPLETED = 'completed', 'Completed'
        DECLINED = 'declined', 'Quote declined'
        CANCELLED = 'cancelled', 'Cancelled'

    OPEN = [Status.SUBMITTED, Status.REVIEWING, Status.QUOTED, Status.ACCEPTED, Status.IN_PROGRESS, Status.DELIVERED]
    # the client can still pull out before any work has started
    CANCELLABLE = [Status.SUBMITTED, Status.REVIEWING, Status.QUOTED]

    number = models.CharField(max_length=24, unique=True, editable=False)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    service = models.ForeignKey(ServiceOffering, on_delete=models.PROTECT, related_name='orders')
    # what the service was and cost when ordered, so later price changes don't rewrite history
    service_name = models.CharField(max_length=120)
    starting_price = models.DecimalField(max_digits=12, decimal_places=2)
    billing = models.CharField(max_length=8, choices=ServiceOffering.Billing.choices, default=ServiceOffering.Billing.ONCE)

    brief = models.TextField()
    links = models.TextField(blank=True, default='', help_text='Sites or documents the client shared')
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='What the client hopes to spend, KES')
    wanted_by = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_orders')

    quoted_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='KES')
    quote_note = models.TextField(blank=True, default='')
    quote_valid_until = models.DateField(null=True, blank=True)
    quoted_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    project = models.OneToOneField(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='order')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.number} · {self.service_name} for {self.client}"

    def save(self, *args, **kwargs):
        if not self.number:
            year = timezone.localdate().year
            last = Order.objects.filter(number__startswith=f"ORD-{year}-").order_by('-number').values_list('number', flat=True).first()
            seq = int(last.rsplit('-', 1)[1]) + 1 if last else 1
            self.number = f"ORD-{year}-{seq:04d}"
        super().save(*args, **kwargs)

    @property
    def is_open(self):
        return self.status in self.OPEN


class OrderUpdate(models.Model):
    """One line on an order's timeline: a status change, a quote, or a comment."""

    class Kind(models.TextChoices):
        STATUS = 'status', 'Status change'
        QUOTE = 'quote', 'Quote'
        COMMENT = 'comment', 'Comment'

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='updates')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='order_updates')
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.COMMENT)
    status = models.CharField(max_length=16, choices=Order.Status.choices, blank=True, default='')
    body = models.TextField(blank=True, default='')
    # internal notes are for the team only
    internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"{self.order.number}: {self.get_kind_display()}"
