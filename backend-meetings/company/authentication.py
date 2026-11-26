from rest_framework.authentication import TokenAuthentication

from .models import Token


class SharedTokenAuthentication(TokenAuthentication):
    """`Authorization: Token <key>` with the token from the main API's sign-in, so one sign-in covers
    both the website and the meetings site."""

    model = Token
