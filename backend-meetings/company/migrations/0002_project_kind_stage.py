import django.db.models.deletion
from django.db import migrations, models


# Mirrors backend/portal/migrations/0005_internal_products. Like 0001, it only touches the
# database in tests: in production the main API owns portal_project and these models are unmanaged.
class Migration(migrations.Migration):

    dependencies = [
        ('company', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='kind',
            field=models.CharField(default='client', max_length=10),
        ),
        migrations.AddField(
            model_name='project',
            name='stage',
            field=models.CharField(blank=True, default='', max_length=10),
        ),
        migrations.AlterField(
            model_name='project',
            name='client',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='projects', to='company.user'),
        ),
    ]
