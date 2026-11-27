from django.utils import timezone
from rest_framework import serializers
from .models import Enquiry


class EnquiryCreateSerializer(serializers.ModelSerializer):
    """Public form: only the fields a visitor fills in."""

    # honeypot: hidden on the website, so only bots fill it in
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Enquiry
        fields = ['id', 'full_name', 'email', 'phone_number', 'service', 'budget', 'message', 'source', 'website', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_source(self, value):
        # the public form can only be the website or a product early-access sign-up
        return value if value in (Enquiry.Source.WEBSITE, Enquiry.Source.EARLY_ACCESS) else Enquiry.Source.WEBSITE

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Please tell us a little more about the project.')
        return value.strip()

    def validate(self, attrs):
        if attrs.pop('website', ''):
            raise serializers.ValidationError('Spam detected.')
        return attrs


class EnquirySerializer(serializers.ModelSerializer):
    """Staff view of a lead, including pipeline status, notes and any redesign pitch."""

    service_label = serializers.CharField(source='get_service_display', read_only=True)
    budget_label = serializers.CharField(source='get_budget_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    pitch_status_label = serializers.CharField(source='get_pitch_status_display', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')

    class Meta:
        model = Enquiry
        fields = [
            'id', 'full_name', 'email', 'phone_number', 'company_name',
            'service', 'service_label', 'budget', 'budget_label', 'message',
            'source', 'source_label', 'client', 'status', 'internal_notes', 'ip_address',
            'current_site_url', 'preview_url', 'pitch_status', 'pitch_status_label', 'pitch_feedback', 'pitch_sent_at',
            'project', 'project_name', 'converted_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'full_name', 'email', 'phone_number', 'service', 'budget', 'message',
            'source', 'client', 'ip_address', 'pitch_sent_at', 'project', 'converted_at', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        lead = self.instance
        pitch = attrs.get('pitch_status', lead.pitch_status if lead else '')
        preview = attrs.get('preview_url', lead.preview_url if lead else '')
        if pitch in (Enquiry.Pitch.SENT, Enquiry.Pitch.FEEDBACK, Enquiry.Pitch.APPROVED) and not preview:
            raise serializers.ValidationError({'preview_url': 'Add the preview link before sending the pitch.'})
        if lead and lead.project_id and 'pitch_status' in attrs and attrs['pitch_status'] != lead.pitch_status:
            raise serializers.ValidationError({'pitch_status': 'This lead is already a project.'})
        return attrs

    def update(self, lead, attrs):
        was = lead.pitch_status
        now = attrs.get('pitch_status', was)
        if now == Enquiry.Pitch.SENT and was != now:
            if not lead.pitch_sent_at:
                attrs['pitch_sent_at'] = timezone.now()
            # sending the preview is our proposal
            if lead.status in (Enquiry.Status.NEW, Enquiry.Status.CONTACTED) and 'status' not in attrs:
                attrs['status'] = Enquiry.Status.PROPOSAL_SENT
        return super().update(lead, attrs)


class TeamLeadCreateSerializer(EnquirySerializer):
    """A lead the team adds by hand, often a business whose site we want to redesign."""

    class Meta(EnquirySerializer.Meta):
        read_only_fields = ['id', 'source', 'client', 'ip_address', 'pitch_sent_at', 'project', 'converted_at', 'created_at', 'updated_at']
        extra_kwargs = {'service': {'default': Enquiry.Service.WEBSITE}}

    def validate(self, attrs):
        if attrs.get('current_site_url') and not attrs.get('pitch_status'):
            attrs['pitch_status'] = Enquiry.Pitch.DRAFT
        attrs['source'] = Enquiry.Source.TEAM
        return super().validate(attrs)

    def create(self, attrs):
        if attrs.get('pitch_status') == Enquiry.Pitch.SENT:
            attrs['pitch_sent_at'] = timezone.now()
            attrs.setdefault('status', Enquiry.Status.PROPOSAL_SENT)
        return super().create(attrs)


class PortalRequestSerializer(serializers.ModelSerializer):
    """A new project request from a signed-in client; their name and email come from the account."""

    service_label = serializers.CharField(source='get_service_display', read_only=True)
    budget_label = serializers.CharField(source='get_budget_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Enquiry
        fields = ['id', 'service', 'service_label', 'budget', 'budget_label', 'message', 'status', 'status_label', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Please tell us a little more about the project.')
        return value.strip()
