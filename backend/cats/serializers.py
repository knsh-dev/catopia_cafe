from rest_framework import serializers
from .models import ResidentCat, FavoriteCat


class ResidentCatSerializer(serializers.ModelSerializer):
    is_favorite = serializers.SerializerMethodField()
    favorited_by_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ResidentCat
        fields = [
            "id", "name", "breed", "photo", "age",
            "personality", "status", "status_display", "schedule",
            "is_active", "is_favorite", "favorited_by_count",
        ]

    def get_is_favorite(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return FavoriteCat.objects.filter(user=request.user, cat=obj).exists()
        return False

    def get_favorited_by_count(self, obj):
        return obj.favorited_by.count()


class FavoriteCatSerializer(serializers.ModelSerializer):
    cat = ResidentCatSerializer(read_only=True)

    class Meta:
        model = FavoriteCat
        fields = ["id", "cat", "created_at"]
