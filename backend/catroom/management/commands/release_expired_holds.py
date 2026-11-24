from django.core.management.base import BaseCommand
from django.utils import timezone
from catroom.models import CatRoomReservation


class Command(BaseCommand):
    help = "Cancel reservations with expired payment holds."

    def handle(self, *args, **options):
        now = timezone.now()
        expired = CatRoomReservation.objects.filter(
            status="pending_payment",
            hold_expires_at__lt=now,
        )
        count = expired.update(status="cancelled")
        self.stdout.write(self.style.SUCCESS(f"Released {count} expired hold(s)."))
