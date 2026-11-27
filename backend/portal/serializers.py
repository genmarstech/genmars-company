from rest_framework import serializers
from .models import Invoice, Message, Milestone, Project, ProjectLink


class MilestoneSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Milestone
        fields = ['id', 'title', 'description', 'status', 'status_label', 'due_date', 'completed_at']


class ProjectLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectLink
        fields = ['id', 'title', 'url', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    health_label = serializers.CharField(source='get_health_display', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'summary', 'service', 'status', 'status_label', 'health', 'health_label',
            'progress', 'budget', 'start_date', 'due_date', 'updated_at',
        ]


class LiveProductSerializer(serializers.ModelSerializer):
    """A Genmars product that's in production, as clients and visitors see it."""

    url = serializers.URLField(source='app_url', read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'summary', 'url', 'went_live_at']


class ProjectDetailSerializer(ProjectSerializer):
    milestones = MilestoneSerializer(many=True, read_only=True)
    links = ProjectLinkSerializer(many=True, read_only=True)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ['milestones', 'links']


class InvoiceSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = [
            'id', 'number', 'description', 'amount', 'status', 'status_label', 'project', 'project_name',
            'issued_on', 'due_on', 'paid_on', 'payment_link',
        ]


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    from_team = serializers.BooleanField(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')

    class Meta:
        model = Message
        fields = ['id', 'project', 'project_name', 'body', 'sender_name', 'from_team', 'created_at']
        read_only_fields = ['id', 'sender_name', 'from_team', 'created_at']

    def get_sender_name(self, message):
        if message.from_team:
            return f"{message.sender.full_name.split()[0]} · Genmars" if message.sender else 'Genmars team'
        return 'You'

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Write a message first.')
        return value

    def validate_project(self, project):
        if project and project.client_id != self.context['request'].user.id:
            raise serializers.ValidationError('Choose one of your projects.')
        return project
