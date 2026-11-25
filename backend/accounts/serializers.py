from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import ClientProfile




GenmarsUsers = get_user_model()

# relevant serializers
class GenUsersSerializers(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    onboarding_completed = serializers.SerializerMethodField()

    class Meta:
        model = GenmarsUsers
        fields = [
            'id',
            'full_name',
            'email',
            'phone_number',
            'password',
            'is_staff',
            'date_joined',
            'onboarding_completed',
        ]
        read_only_fields = ['id', 'is_staff', 'date_joined']

    def get_onboarding_completed(self, user):
        return ClientProfile.objects.filter(user=user, onboarding_completed_at__isnull=False).exists()


    def validate_password(self, value):
        validate_password(value, self.instance)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        return GenmarsUsers.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        # hash the new password instead of storing it as plain text
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user



SERVICE_SLUGS = {'custom-software', 'websites', 'e-commerce', 'automation', 'ui-ux', 'cloud', 'maintenance'}


class ClientProfileSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source='user.phone_number', required=False, allow_blank=True, max_length=20)
    complete = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = ClientProfile
        fields = [
            'company_name', 'job_title', 'industry', 'company_size', 'website', 'phone_number',
            'services', 'budget', 'timeline', 'contact_method', 'goals',
            'onboarding_completed_at', 'complete',
        ]
        read_only_fields = ['onboarding_completed_at']

    def validate_services(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError('Choose services from the list.')
        unknown = set(value) - SERVICE_SLUGS
        if unknown:
            raise serializers.ValidationError('Choose services from the list.')
        return sorted(set(value))

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        complete = validated_data.pop('complete', False)
        if 'phone_number' in user_data:
            instance.user.phone_number = user_data['phone_number']
            instance.user.save(update_fields=['phone_number'])
        if complete and not instance.onboarding_completed_at:
            instance.onboarding_completed_at = timezone.now()
        return super().update(instance, validated_data)
