from django.conf import settings
from django.db import models


class Profile(models.Model):
    """Extended user profile — one-to-one with User."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    paw_points = models.PositiveIntegerField(default=0)
    lifetime_paw_points = models.PositiveIntegerField(default=0)
    tabby_bonus_credited = models.BooleanField(default=False)
    tubby_bonus_credited = models.BooleanField(default=False)
    stamps_count = models.PositiveIntegerField(default=0)
    free_treats_available = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "accounts_profile"

    @property
    def pawPoints(self):
        return self.paw_points

    @property
    def lifetimePawPoints(self):
        return self.lifetime_paw_points

    @property
    def tabbyBonusCredited(self):
        return self.tabby_bonus_credited

    @property
    def tubbyBonusCredited(self):
        return self.tubby_bonus_credited

    @property
    def tier(self):
        pts = self.lifetime_paw_points or self.paw_points or self.loyalty_points
        if pts >= 2500:
            return "Tubby Club"
        if pts >= 800:
            return "Tabby Club"
        return "Kitten"

    @property
    def earn_multiplier(self):
        pts = self.lifetime_paw_points or self.paw_points or self.loyalty_points
        if pts >= 2500:
            return 1.5
        if pts >= 800:
            return 1.25
        return 1.0

    @property
    def stampsCount(self):
        return self.stamps_count

    @property
    def freeTreatsAvailable(self):
        return self.free_treats_available

    def __str__(self):
        return f"Profile({self.user.username})"
