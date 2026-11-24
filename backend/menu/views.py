from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce

from accounts.permissions import IsStaffOrAdmin, IsAdmin
from .models import MenuCategory, MenuItem, Review
from .serializers import MenuCategorySerializer, MenuItemSerializer, ReviewSerializer


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    pagination_class = None

    def get_queryset(self):
        qs = MenuCategory.objects.all()
        # Non-staff/admin only see visible categories
        user = self.request.user
        is_staff_or_admin = (
            user.is_authenticated
            and (
                user.groups.filter(name__in=["staff", "admin"]).exists()
                or getattr(user, "is_staff", False)
                or getattr(user, "is_superuser", False)
            )
        )
        if not is_staff_or_admin:
            qs = qs.filter(is_visible=True)
        return qs.order_by("sort_order", "name")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsStaffOrAdmin()]

    @action(detail=False, methods=["post"], url_path="reorder", permission_classes=[IsStaffOrAdmin])
    def reorder(self, request):
        """
        Accepts a list of category IDs or objects with {id, sort_order} to update display order.
        e.g., {"order": [3, 1, 2]} or {"items": [{"id": 3, "sort_order": 0}, ...]}
        """
        data = request.data
        if "order" in data and isinstance(data["order"], list):
            for index, cat_id in enumerate(data["order"]):
                MenuCategory.objects.filter(pk=cat_id).update(sort_order=index)
        elif "items" in data and isinstance(data["items"], list):
            for item in data["items"]:
                cat_id = item.get("id")
                sort_order = item.get("sort_order", 0)
                if cat_id is not None:
                    MenuCategory.objects.filter(pk=cat_id).update(sort_order=sort_order)
        return Response({"detail": "Categories reordered successfully."})

    @action(detail=True, methods=["post"], url_path="toggle-visibility", permission_classes=[IsStaffOrAdmin])
    def toggle_visibility(self, request, pk=None):
        category = self.get_object()
        category.is_visible = not category.is_visible
        category.save(update_fields=["is_visible", "updated_at"])
        return Response(MenuCategorySerializer(category).data)


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer

    def get_queryset(self):
        qs = MenuItem.objects.select_related("category_obj").prefetch_related("reviews")
        # Public users see only available items
        user = self.request.user
        is_staff_or_admin = (
            user.is_authenticated
            and (
                user.groups.filter(name__in=["staff", "admin"]).exists()
                or getattr(user, "is_staff", False)
                or getattr(user, "is_superuser", False)
            )
        )
        if not is_staff_or_admin:
            qs = qs.filter(is_available=True)

        # Filter by category if provided
        category = self.request.query_params.get("category")
        if category and category != "all":
            qs = qs.filter(Q(category=category) | Q(category_obj__slug=category))

        # Filter by category_id if provided
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_obj_id=category_id)

        # Filter by availability if provided
        avail = self.request.query_params.get("is_available")
        if avail is not None:
            if avail.lower() in ("true", "1"):
                qs = qs.filter(is_available=True)
            elif avail.lower() in ("false", "0"):
                qs = qs.filter(is_available=False)

        # Search by name
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search.strip())

        return qs.order_by("category_obj__sort_order", "category", "name")

    def get_permissions(self):
        if self.action in ("list", "retrieve", "popular"):
            return [AllowAny()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsStaffOrAdmin()]

    @action(detail=False, methods=["get"], url_path="popular", permission_classes=[AllowAny])
    def popular(self, request):
        """
        GET /api/menu/items/popular/?limit=3
        Returns available menu items ranked by actual quantities sold from completed and paid orders.
        """
        try:
            limit = int(request.query_params.get("limit", 3))
            limit = max(1, min(limit, 20))
        except (ValueError, TypeError):
            limit = 3

        valid_sales_filter = (
            ~Q(order_items__order__status="cancelled")
            & ~Q(order_items__order__payment_status__in=["REFUNDED", "FAILED", "EXPIRED"])
            & (
                Q(order_items__order__payment_status__in=["PAID", "SETTLED"])
                | Q(order_items__order__status__in=["preparing", "ready", "completed"])
            )
        )

        qs = (
            MenuItem.objects.filter(is_available=True)
            .select_related("category_obj")
            .prefetch_related("reviews")
            .annotate(
                sold_count=Coalesce(Sum("order_items__quantity", filter=valid_sales_filter), 0),
                sales_revenue=Coalesce(
                    Sum(
                        F("order_items__price") * F("order_items__quantity"),
                        filter=valid_sales_filter,
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    ),
                    Decimal("0.00"),
                ),
            )
            .order_by("-sold_count", "-sales_revenue", "name")[:limit]
        )

        serializer = self.get_serializer(qs, many=True)
        resp = Response(serializer.data)
        resp["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp["Pragma"] = "no-cache"
        return resp

    @action(detail=True, methods=["post"], url_path="toggle", permission_classes=[IsStaffOrAdmin])
    def toggle_availability(self, request, pk=None):
        item = self.get_object()
        item.is_available = not item.is_available
        item.save(update_fields=["is_available", "updated_at"])
        return Response(MenuItemSerializer(item).data)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer

    def get_queryset(self):
        qs = Review.objects.select_related("user", "menu_item")
        menu_item_id = (
            self.request.query_params.get("menu_item")
            or self.request.query_params.get("menu_item_id")
        )
        if menu_item_id:
            qs = qs.filter(menu_item_id=menu_item_id)
        return qs.order_by("-created_at")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        user = request.user
        menu_item_id = request.data.get("menu_item")
        if not menu_item_id:
            return Response(
                {"menu_item": "This field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if review already exists for this user and item -> update it!
        existing = Review.objects.filter(menu_item_id=menu_item_id, user=user).first()
        if existing:
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
