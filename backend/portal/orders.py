"""Ordering services: the public catalogue, a client's own orders, and the team's order desk."""

import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Invoice, Order, OrderUpdate, Project, ServiceOffering, Task
from .team import Staff

logger = logging.getLogger(__name__)
User = get_user_model()

QUOTE_VALID_DAYS = 30

# What a client is told when an order moves to each status.
CLIENT_STATUS_LINES = {
    Order.Status.REVIEWING: "We're reading your brief and will send a quote shortly.",
    Order.Status.IN_PROGRESS: "Work has started. You can follow it from your project page.",
    Order.Status.DELIVERED: "We've delivered your work. Have a look and tell us if anything needs changing.",
    Order.Status.COMPLETED: "This order is complete. Thank you for working with us.",
    Order.Status.CANCELLED: "This order has been cancelled.",
}


def first_name(user):
    return (user.full_name or user.email).split()[0] if user else ''


def kes(amount):
    return f"KES {amount:,.0f}"


def email(to, subject, body):
    """Order emails never block the request: the order is already saved."""
    try:
        send_mail(subject=subject, message=body, from_email=None, recipient_list=[to])
    except Exception:
        logger.exception("Could not send order email to %s", to)


def email_client(order, subject, body):
    link = f"{settings.FRONTEND_URL}/portal/orders/{order.id}"
    email(
        order.client.email,
        f"{subject} · {order.number}",
        f"Hi {first_name(order.client)},\n\n{body}\n\nSee your order: {link}\n\nGenmars Tech\n{settings.ENQUIRY_NOTIFY_EMAIL}\n",
    )


def email_team(order, subject, body):
    link = f"{settings.FRONTEND_URL}/team/orders/{order.id}"
    to = order.assignee.email if order.assignee else settings.ENQUIRY_NOTIFY_EMAIL
    email(to, f"{subject} · {order.number}", f"{body}\n\nOpen the order: {link}\n")


def log(order, author, kind=OrderUpdate.Kind.STATUS, body='', internal=False):
    return OrderUpdate.objects.create(
        order=order, author=author, kind=kind, body=body, internal=internal,
        status=order.status if kind != OrderUpdate.Kind.COMMENT else '',
    )


# ---------------------------------------------------------------- catalogue

class ServiceSerializer(serializers.ModelSerializer):
    billing_label = serializers.CharField(source='get_billing_display', read_only=True)

    class Meta:
        model = ServiceOffering
        fields = [
            'id', 'key', 'slug', 'name', 'summary', 'includes', 'timeline', 'starting_price', 'billing',
            'billing_label', 'deposit_percent', 'is_active', 'order',
        ]

    def validate_includes(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError('Give a list of short lines.')
        return [v.strip() for v in value if v.strip()]

    def validate_deposit_percent(self, value):
        if value > 100:
            raise serializers.ValidationError('A deposit is a percentage from 0 to 100.')
        return value


class ServiceCatalogueViewSet(viewsets.ReadOnlyModelViewSet):
    """Services anyone can order, for the website and the portal."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = ServiceSerializer
    pagination_class = None
    lookup_field = 'slug'

    def get_queryset(self):
        return ServiceOffering.objects.filter(is_active=True)


class TeamServiceViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """The team edits names, prices and what's included. Services are switched off rather than deleted."""

    permission_classes = [Staff]
    serializer_class = ServiceSerializer
    pagination_class = None
    queryset = ServiceOffering.objects.all()


# ---------------------------------------------------------------- serializers

class OrderUpdateSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    from_team = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = OrderUpdate
        fields = ['id', 'kind', 'status', 'status_label', 'body', 'internal', 'author_name', 'from_team', 'created_at']

    def get_from_team(self, update):
        return update.author_id != update.order.client_id

    def get_author_name(self, update):
        if update.author_id is None:
            return 'Genmars'
        if update.author_id == update.order.client_id:
            return 'You' if not self.context.get('team') else first_name(update.author)
        return update.author.full_name if self.context.get('team') else f"{first_name(update.author)} · Genmars"


class OrderSerializer(serializers.ModelSerializer):
    """A client's view of their order."""

    status_label = serializers.CharField(source='get_status_display', read_only=True)
    billing_label = serializers.CharField(source='get_billing_display', read_only=True)
    service_slug = serializers.CharField(source='service.slug', read_only=True)
    service = serializers.SlugRelatedField(slug_field='slug', queryset=ServiceOffering.objects.filter(is_active=True))
    deposit = serializers.SerializerMethodField()
    quote_expired = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'number', 'service', 'service_slug', 'service_name', 'starting_price', 'billing', 'billing_label',
            'brief', 'links', 'budget', 'wanted_by', 'status', 'status_label', 'quoted_price', 'quote_note',
            'quote_valid_until', 'quoted_at', 'quote_expired', 'deposit', 'accepted_at', 'closed_at', 'project',
            'can_cancel', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'number', 'service_name', 'starting_price', 'billing', 'status', 'quoted_price', 'quote_note',
            'quote_valid_until', 'quoted_at', 'accepted_at', 'closed_at', 'project',
        ]

    def get_deposit(self, order):
        if order.quoted_price is None or order.billing == ServiceOffering.Billing.MONTHLY:
            return None
        return (order.quoted_price * order.service.deposit_percent / 100).quantize(Decimal('1'), ROUND_HALF_UP)

    def get_quote_expired(self, order):
        return bool(order.status == Order.Status.QUOTED and order.quote_valid_until and order.quote_valid_until < timezone.localdate())

    def get_can_cancel(self, order):
        return order.status in Order.CANCELLABLE

    def validate_brief(self, value):
        value = value.strip()
        if len(value) < 20:
            raise serializers.ValidationError('Tell us a little more, a few sentences is enough.')
        return value

    def validate_budget(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Leave this empty if you are not sure yet.')
        return value

    def validate_wanted_by(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError('Choose a date from today onwards.')
        return value


class OrderDetailSerializer(OrderSerializer):
    updates = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['updates']

    def get_updates(self, order):
        updates = [u for u in order.updates.all() if not u.internal]
        return OrderUpdateSerializer(updates, many=True, context=self.context).data


class TeamOrderSerializer(OrderSerializer):
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.CharField(source='client.email', read_only=True)
    client_phone = serializers.CharField(source='client.phone_number', read_only=True)
    company_name = serializers.CharField(source='client.client_profile.company_name', read_only=True, default='')
    assignee_name = serializers.CharField(source='assignee.full_name', read_only=True, default='')
    project_name = serializers.CharField(source='project.name', read_only=True, default='')
    service = serializers.CharField(source='service.slug', read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + [
            'client', 'client_name', 'client_email', 'client_phone', 'company_name', 'assignee', 'assignee_name', 'project_name',
        ]
        read_only_fields = [f for f in OrderSerializer.Meta.read_only_fields if f != 'status'] + ['client', 'brief', 'links', 'budget']

    def validate_assignee(self, user):
        if user and not user.is_staff:
            raise serializers.ValidationError('Assign the order to someone on the team.')
        return user

    def validate_status(self, value):
        # quotes and project starts go through their own actions so they're never half done
        if value == Order.Status.QUOTED and not (self.instance and self.instance.quoted_price is not None):
            raise serializers.ValidationError('Send a quote first.')
        if value in (Order.Status.ACCEPTED, Order.Status.DECLINED):
            raise serializers.ValidationError('Only the client can accept or decline a quote.')
        return value


class TeamOrderDetailSerializer(TeamOrderSerializer):
    updates = serializers.SerializerMethodField()

    class Meta(TeamOrderSerializer.Meta):
        fields = TeamOrderSerializer.Meta.fields + ['updates']

    def get_updates(self, order):
        return OrderUpdateSerializer(order.updates.all(), many=True, context={**self.context, 'team': True}).data


class CommentSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000)
    internal = serializers.BooleanField(default=False)

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Write something first.')
        return value


class QuoteSerializer(serializers.Serializer):
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('1'))
    note = serializers.CharField(allow_blank=True, default='', max_length=4000)
    valid_until = serializers.DateField(required=False, allow_null=True)

    def validate_valid_until(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError('Choose a date from today onwards.')
        return value


class StartSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    deposit_invoice = serializers.BooleanField(default=True)


# ---------------------------------------------------------------- client

class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """A signed-in client's own orders."""

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Order.objects.filter(client=self.request.user).select_related('service', 'client')
        return qs.prefetch_related('updates__author') if self.action == 'retrieve' else qs

    def get_serializer_class(self):
        return OrderDetailSerializer if self.action == 'retrieve' else OrderSerializer

    def perform_create(self, serializer):
        service = serializer.validated_data['service']
        user = self.request.user
        order = serializer.save(
            client=user, service_name=service.name, starting_price=service.starting_price, billing=service.billing,
        )
        log(order, user, body='Order placed')
        email_client(
            order,
            f"We've received your order for {service.name.lower()}",
            f"Thanks for your order. We'll read your brief and send you a fixed quote within one working day.\n"
            f"Nothing is charged until you accept it.\n\nYour brief:\n{order.brief}",
        )
        details = [
            f"Client: {user.full_name} ({user.email}{', ' + user.phone_number if user.phone_number else ''})",
            f"Service: {service.name}, from {kes(service.starting_price)}",
            f"Budget: {kes(order.budget) if order.budget else 'not given'}",
            f"Wanted by: {order.wanted_by:%d %b %Y}" if order.wanted_by else 'Wanted by: no date given',
            '', order.brief,
        ]
        if order.links:
            details += ['', f"Links: {order.links}"]
        email_team(order, f"New order: {service.name} for {user.full_name}", '\n'.join(details))

    def reload(self, order):
        order = self.get_queryset().prefetch_related('updates__author').get(pk=order.pk)
        return Response(OrderDetailSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.QUOTED:
            raise ValidationError({'detail': 'There is no quote waiting on this order.'})
        if order.quote_valid_until and order.quote_valid_until < timezone.localdate():
            raise ValidationError({'detail': 'This quote has expired. Send us a note below and we will refresh it.'})
        order.status = Order.Status.ACCEPTED
        order.accepted_at = timezone.now()
        order.save()
        log(order, request.user, body=f"Accepted the quote of {kes(order.quoted_price)}")
        email_team(order, f"Quote accepted by {order.client.full_name}", f"{order.client.full_name} accepted {kes(order.quoted_price)} for {order.service_name}. Start the project when you're ready.")
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.QUOTED:
            raise ValidationError({'detail': 'There is no quote waiting on this order.'})
        reason = (request.data.get('reason') or '').strip()[:2000]
        order.status = Order.Status.DECLINED
        order.closed_at = timezone.now()
        order.save()
        log(order, request.user, body=reason or 'Declined the quote')
        email_team(order, f"Quote declined by {order.client.full_name}", reason or 'No reason given.')
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status not in Order.CANCELLABLE:
            raise ValidationError({'detail': 'Work has already started. Send us a note and we will sort it out with you.'})
        order.status = Order.Status.CANCELLED
        order.closed_at = timezone.now()
        order.save()
        log(order, request.user, body='Cancelled by the client')
        email_team(order, f"Order cancelled by {order.client.full_name}", f"{order.service_name} was cancelled from the portal.")
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        order = self.get_object()
        data = CommentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        log(order, request.user, OrderUpdate.Kind.COMMENT, data.validated_data['body'])
        order.save(update_fields=['updated_at'])
        email_team(order, f"Note from {order.client.full_name}", data.validated_data['body'])
        return self.reload(order)


# ---------------------------------------------------------------- team

class TeamOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [Staff]
    pagination_class = None

    FILTERS = {
        'open': Q(status__in=Order.OPEN),
        'needs_quote': Q(status__in=[Order.Status.SUBMITTED, Order.Status.REVIEWING]),
        'with_client': Q(status=Order.Status.QUOTED),
        'to_start': Q(status=Order.Status.ACCEPTED),
        'in_progress': Q(status__in=[Order.Status.IN_PROGRESS, Order.Status.DELIVERED]),
        'closed': Q(status__in=[Order.Status.COMPLETED, Order.Status.DECLINED, Order.Status.CANCELLED]),
    }

    def get_queryset(self):
        qs = Order.objects.select_related('service', 'client__client_profile', 'assignee', 'project')
        params = self.request.query_params
        if params.get('view') in self.FILTERS:
            qs = qs.filter(self.FILTERS[params['view']])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('client'):
            qs = qs.filter(client_id=params['client'])
        if params.get('mine'):
            qs = qs.filter(assignee=self.request.user)
        if self.action == 'retrieve':
            qs = qs.prefetch_related('updates__author')
        return qs

    def get_serializer_class(self):
        return TeamOrderDetailSerializer if self.action == 'retrieve' else TeamOrderSerializer

    def reload(self, order):
        order = self.get_queryset().prefetch_related('updates__author').get(pk=order.pk)
        return Response(TeamOrderDetailSerializer(order, context=self.get_serializer_context()).data)

    def update(self, request, *args, **kwargs):
        order = self.get_object()
        before_status, before_assignee = order.status, order.assignee_id
        serializer = TeamOrderSerializer(order, data=request.data, partial=True, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        if order.status != before_status:
            if order.status in (Order.Status.COMPLETED, Order.Status.CANCELLED):
                order.closed_at = timezone.now()
            elif order.closed_at and order.is_open:
                order.closed_at = None
            order.save()
            log(order, request.user)
            if order.status in CLIENT_STATUS_LINES:
                email_client(order, f"Your order is now {order.get_status_display().lower()}", CLIENT_STATUS_LINES[order.status])
        if order.assignee_id and order.assignee_id != before_assignee:
            log(order, request.user, OrderUpdate.Kind.COMMENT, f"Assigned to {order.assignee.full_name}", internal=True)
            if order.assignee_id != request.user.id:
                email(
                    order.assignee.email, f"{first_name(request.user)} gave you an order · {order.number}",
                    f"{order.service_name} for {order.client.full_name}.\n\n{order.brief}\n\n{settings.FRONTEND_URL}/team/orders/{order.id}\n",
                )
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def quote(self, request, pk=None):
        order = self.get_object()
        if order.status not in (Order.Status.SUBMITTED, Order.Status.REVIEWING, Order.Status.QUOTED):
            raise ValidationError({'detail': 'This order is past the quote stage.'})
        data = QuoteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        revised = order.quoted_price is not None
        order.quoted_price = v['price']
        order.quote_note = v['note'].strip()
        order.quote_valid_until = v.get('valid_until') or timezone.localdate() + timedelta(days=QUOTE_VALID_DAYS)
        order.quoted_at = timezone.now()
        order.status = Order.Status.QUOTED
        if not order.assignee_id:
            order.assignee = request.user
        order.save()
        per = ' a month' if order.billing == ServiceOffering.Billing.MONTHLY else ''
        log(order, request.user, OrderUpdate.Kind.QUOTE, f"{'Revised quote' if revised else 'Quote'}: {kes(order.quoted_price)}{per}" + (f"\n\n{order.quote_note}" if order.quote_note else ''))
        email_client(
            order,
            f"{'Your updated quote' if revised else 'Your quote'} for {order.service_name.lower()}",
            f"Our fixed price for this work is {kes(order.quoted_price)}{per}.\n"
            + (f"\n{order.quote_note}\n" if order.quote_note else '')
            + f"\nThe quote is valid until {order.quote_valid_until:%d %b %Y}. You can accept or decline it from your portal.",
        )
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Turn an accepted order into a project the client can follow, with a draft deposit invoice."""
        order = self.get_object()
        if order.status != Order.Status.ACCEPTED:
            raise ValidationError({'detail': 'Start the project once the client has accepted the quote.'})
        data = StartSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        company = getattr(getattr(order.client, 'client_profile', None), 'company_name', '')

        with transaction.atomic():
            project = Project.objects.create(
                client=order.client,
                name=(v.get('name') or '').strip() or f"{order.service_name}{' for ' + company if company else ''}",
                summary=order.brief[:255],
                service=order.service.slug,
                status=Project.Status.PLANNING,
                budget=order.quoted_price,
                start_date=timezone.localdate(),
                due_date=v.get('due_date') or order.wanted_by,
            )
            order.project = project
            order.status = Order.Status.IN_PROGRESS
            if not order.assignee_id:
                order.assignee = request.user
            order.save()

            deposit = OrderSerializer().get_deposit(order)
            if v['deposit_invoice'] and deposit:
                Invoice.objects.create(
                    client=order.client, project=project, number=f"{order.number}-D", amount=deposit,
                    description=f"{order.service.deposit_percent}% deposit for {order.service_name}",
                )
            Task.objects.create(
                title=f"Kick-off: {project.name}", project=project, client=order.client, assignee=order.assignee,
                created_by=request.user, priority=Task.Priority.HIGH, due_date=timezone.localdate() + timedelta(days=2),
                notes='Book the kick-off call, agree milestones and add them to the project.',
            )
            log(order, request.user, body=f"Project started: {project.name}")

        email_client(order, 'Work on your order has started', CLIENT_STATUS_LINES[Order.Status.IN_PROGRESS] + f"\n\n{settings.FRONTEND_URL}/portal/projects/{project.id}")
        return self.reload(order)

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        order = self.get_object()
        data = CommentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        log(order, request.user, OrderUpdate.Kind.COMMENT, v['body'], internal=v['internal'])
        order.save(update_fields=['updated_at'])
        if not v['internal']:
            email_client(order, f"{first_name(request.user)} from Genmars wrote about your order", v['body'])
        return self.reload(order)
