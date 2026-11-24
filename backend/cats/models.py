from django.conf import settings
from django.db import models


class ResidentCat(models.Model):
    STATUS_CHOICES = [
        ("ready_to_play", "Ready to play"),
        ("resting", "Resting"),
        ("vet_day", "Vet day"),
    ]

    name = models.CharField(max_length=100)
    breed = models.CharField(max_length=100, blank=True, default="")
    photo = models.ImageField(upload_to="cats/", blank=True)
    age = models.PositiveSmallIntegerField(help_text="Age in years")
    personality = models.TextField(blank=True, help_text="Short personality blurb")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ready_to_play")
    schedule = models.JSONField(
        default=dict,
        blank=True,
        help_text="Rest/play schedule, e.g. {'play': ['10:00-12:00','14:00-17:00'], 'rest': ['12:00-14:00']}",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cats_residentcat"
        ordering = ["name"]

    def __str__(self):
        return self.name


class FavoriteCat(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_cats",
    )
    cat = models.ForeignKey(
        ResidentCat,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cats_favoritecat"
        unique_together = [("user", "cat")]

    def __str__(self):
        return f"{self.user.username} ♥ {self.cat.name}"
