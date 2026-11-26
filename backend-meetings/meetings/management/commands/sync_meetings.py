from django.core.management.base import BaseCommand

from meetings import sync


class Command(BaseCommand):
    help = 'Fetch Meet links, attendance, transcripts and recordings from Google for meetings that are due.'

    def handle(self, *args, **options):
        done, errors = sync.run()
        for e in errors:
            self.stderr.write(e)
        self.stdout.write(f"Synced {done} meeting(s).")
