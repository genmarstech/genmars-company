
from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models

# These tables belong to the main API. Only the test database builds them here (see company.testing).
MANAGED = getattr(settings, 'MANAGE_SHARED_TABLES', False)


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('full_name', models.CharField(max_length=255)),
                ('is_staff', models.BooleanField(default=False)),
                ('is_superuser', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'accounts_genusers',
                'managed': MANAGED,
            },
        ),
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('status', models.CharField(max_length=16)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to='company.user')),
            ],
            options={
                'db_table': 'portal_project',
                'ordering': ['name'],
                'managed': MANAGED,
            },
        ),
        migrations.CreateModel(
            name='Task',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('notes', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('todo', 'To do'), ('doing', 'Doing'), ('done', 'Done')], default='todo', max_length=8)),
                ('priority', models.CharField(choices=[('low', 'Low'), ('normal', 'Normal'), ('high', 'High')], default='normal', max_length=8)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='company.project')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, blank=True, null=True, related_name='client_tasks', to='company.user')),
                ('assignee', models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, blank=True, null=True, related_name='assigned_tasks', to='company.user')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, related_name='created_tasks', to='company.user')),
            ],
            options={
                'db_table': 'portal_task',
                'managed': MANAGED,
            },
        ),
        migrations.CreateModel(
            name='Token',
            fields=[
                ('key', models.CharField(max_length=40, primary_key=True, serialize=False)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='auth_token', to='company.user')),
            ],
            options={
                'db_table': 'authtoken_token',
                'managed': MANAGED,
            },
        ),
    ]
