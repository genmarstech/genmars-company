"""Read-mostly views of tables the main API (backend/) owns. managed = False: this service never creates,
migrates or deletes them. Only the columns the Meetings tool needs are listed."""

from django.db import models


class User(models.Model):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'accounts_genusers'

    def __str__(self):
        return self.full_name or self.email

    # what Django REST framework expects of request.user
    is_authenticated = True
    is_anonymous = False


class Token(models.Model):
    """The sign-in token the main API hands out at /api/v1/auth/login/."""

    key = models.CharField(max_length=40, primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='auth_token')
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'authtoken_token'


class Project(models.Model):
    # kind is 'client' or 'internal'; internal projects are Genmars's own products and have no client
    kind = models.CharField(max_length=10, default='client')
    client = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='projects')
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=16)
    stage = models.CharField(max_length=10, blank=True, default='')

    class Meta:
        managed = False
        db_table = 'portal_project'
        ordering = ['name']

    def __str__(self):
        return self.name


class Task(models.Model):
    """The team's task list. Action items from meetings are added here so there is one list of work."""

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
    client = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='client_tasks')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_tasks')
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'portal_task'

    def __str__(self):
        return self.title
