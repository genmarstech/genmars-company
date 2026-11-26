"""Sign in with Google for the website (genmars.co.ke).

The browser asks /google/start/ for Google's sign-in address, goes there, and Google sends it back to
/google/callback/. The callback checks the signed `state`, swaps the code for Google's ID token, finds or
creates the account for that verified email, and sends the browser to the website's /auth/google page with
our API token in the URL fragment (fragments are never sent to servers or logged).

The website also puts a random `nonce` into the state and checks it comes back, so nobody can sign a visitor
into someone else's account with a crafted link.
"""

import json
import secrets
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponseRedirect
from rest_framework import permissions
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

User = get_user_model()

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}
STATE_SALT = 'accounts.google.login'
STATE_MAX_AGE = 600


class GoogleError(Exception):
    pass


def is_configured():
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_LOGIN_REDIRECT_URI)


def _http(method, url, form=None, params=None):
    """One request to Google; returns (status, JSON). Tests replace this."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    data = urllib.parse.urlencode(form).encode() if form else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except ValueError:
            return e.code, {}
    except (urllib.error.URLError, TimeoutError) as e:
        raise GoogleError(f"Couldn't reach Google: {getattr(e, 'reason', e)}") from e


def safe_next(value):
    return value if isinstance(value, str) and value.startswith('/') and not value.startswith('//') else ''


def verified_identity(code):
    """Swap the code for an ID token and return Google's verified claims about the person."""
    status, tokens = _http('POST', TOKEN_URL, form={
        'code': code,
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_LOGIN_REDIRECT_URI,
        'grant_type': 'authorization_code',
    })
    if status != 200 or 'id_token' not in tokens:
        raise GoogleError('Google did not accept the sign-in.')
    # Google checks the token's signature and expiry for us here; we check it was made for our app.
    status, claims = _http('GET', TOKENINFO_URL, params={'id_token': tokens['id_token']})
    if status != 200 or claims.get('aud') != settings.GOOGLE_CLIENT_ID or claims.get('iss') not in ISSUERS:
        raise GoogleError('Google sign-in could not be verified.')
    if str(claims.get('email_verified')).lower() != 'true' or not claims.get('email'):
        raise GoogleError('That Google account has no verified email address.')
    return claims


def account_for(claims):
    email = User.objects.normalize_email(claims['email'])
    user = User.objects.filter(email__iexact=email).first()
    if user:
        return user
    user = User(email=email, full_name=(claims.get('name') or email.split('@')[0])[:255])
    user.set_unusable_password()
    user.save()
    return user


class GoogleStartView(APIView):
    """Returns the Google sign-in address for this visit."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def get(self, request):
        if not is_configured():
            return Response({'error': 'Signing in with Google is not set up yet. Please use your email.'}, status=503)
        nonce = request.query_params.get('nonce', '')
        if not 16 <= len(nonce) <= 128:
            return Response({'error': 'Something went wrong. Please try again.'}, status=400)
        state = signing.dumps({'n': nonce, 'next': safe_next(request.query_params.get('next')), 'r': secrets.token_urlsafe(8)}, salt=STATE_SALT)
        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': settings.GOOGLE_LOGIN_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile',
            'prompt': 'select_account',
            'state': state,
        }
        return Response({'url': f"{AUTH_URL}?{urllib.parse.urlencode(params)}"})


class GoogleCallbackView(APIView):
    """Google sends the browser here; it leaves for the website's /auth/google page either way."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        back = f"{settings.FRONTEND_URL}/auth/google"
        try:
            state = signing.loads(request.query_params.get('state', ''), salt=STATE_SALT, max_age=STATE_MAX_AGE)
        except signing.BadSignature:
            return HttpResponseRedirect(f"{back}#error=expired")
        if request.query_params.get('error') or not request.query_params.get('code'):
            return HttpResponseRedirect(f"{back}#error=cancelled")
        try:
            user = account_for(verified_identity(request.query_params['code']))
        except GoogleError:
            return HttpResponseRedirect(f"{back}#error=failed")
        if not user.is_active:
            return HttpResponseRedirect(f"{back}#error=inactive")
        token, _ = Token.objects.get_or_create(user=user)
        fragment = urllib.parse.urlencode({'token': token.key, 'nonce': state['n'], 'next': state['next']})
        return HttpResponseRedirect(f"{back}#{fragment}")
