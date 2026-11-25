from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password




GenmarsUsers = get_user_model()

# relevant serializers
class GenUsersSerializers(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

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
        ]
        read_only_fields = ['id', 'is_staff', 'date_joined']


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
