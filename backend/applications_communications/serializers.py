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
    """Staff view of a lead, including pipeline status and notes."""

    service_label = serializers.CharField(source='get_service_display', read_only=True)
    budget_label = serializers.CharField(source='get_budget_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Enquiry
        fields = [
            'id', 'full_name', 'email', 'phone_number',
            'service', 'service_label', 'budget', 'budget_label', 'message',
            'source', 'source_label', 'client', 'status', 'internal_notes', 'ip_address', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'full_name', 'email', 'phone_number', 'service', 'budget', 'message',
            'source', 'client', 'ip_address', 'created_at', 'updated_at',
        ]



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
