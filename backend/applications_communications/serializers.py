from rest_framework import serializers
from .models import Enquiry


class EnquiryCreateSerializer(serializers.ModelSerializer):
    """Public form: only the fields a visitor fills in."""

    # honeypot: hidden on the website, so only bots fill it in
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Enquiry
        fields = ['id', 'full_name', 'email', 'phone_number', 'service', 'budget', 'message', 'website', 'created_at']
        read_only_fields = ['id', 'created_at']

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

    class Meta:
        model = Enquiry
        fields = [
            'id', 'full_name', 'email', 'phone_number',
            'service', 'service_label', 'budget', 'budget_label', 'message',
            'status', 'internal_notes', 'ip_address', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'full_name', 'email', 'phone_number', 'service', 'budget', 'message',
            'ip_address', 'created_at', 'updated_at',
        ]
