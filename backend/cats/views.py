from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsStaffOrAdmin, IsAdmin
from .models import ResidentCat, FavoriteCat
from .serializers import ResidentCatSerializer, FavoriteCatSerializer


class ResidentCatViewSet(viewsets.ModelViewSet):
    serializer_class = ResidentCatSerializer
    pagination_class = None

    def get_queryset(self):
        qs = ResidentCat.objects.all()
        user = self.request.user
        is_staff_or_admin = (
            user.is_authenticated
            and (
                user.groups.filter(name__in=["staff", "admin"]).exists()
                or getattr(user, "is_staff", False)
                or getattr(user, "is_superuser", False)
            )
        )
        available_param = (
            self.request.query_params.get("available")
            or self.request.query_params.get("active")
        )
        if not is_staff_or_admin or (available_param and available_param.lower() in ("true", "1")):
            qs = qs.filter(is_active=True)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        return response

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "favorite":
            return [IsAuthenticated()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsStaffOrAdmin()]

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        cat = self.get_object()
        fav, created = FavoriteCat.objects.get_or_create(user=request.user, cat=cat)
        if not created:
            fav.delete()
            return Response({"detail": "Removed from favorites."})
        return Response({"detail": "Added to favorites."}, status=status.HTTP_201_CREATED)


class FavoriteCatViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FavoriteCatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FavoriteCat.objects.filter(user=self.request.user).select_related("cat")
