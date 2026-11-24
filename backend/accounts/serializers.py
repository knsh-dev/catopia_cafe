from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    pawPoints = serializers.IntegerField(source="paw_points", read_only=True)
    lifetimePawPoints = serializers.IntegerField(source="lifetime_paw_points", read_only=True)
    stampsCount = serializers.IntegerField(source="stamps_count", read_only=True)
    freeTreatsAvailable = serializers.IntegerField(source="free_treats_available", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "phone", "avatar", "loyalty_points",
            "paw_points", "pawPoints",
            "lifetime_paw_points", "lifetimePawPoints",
            "stamps_count", "stampsCount",
            "free_treats_available", "freeTreatsAvailable",
        ]
        read_only_fields = [
            "loyalty_points", "paw_points", "lifetime_paw_points",
            "stamps_count", "free_treats_available",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    role = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    phone = serializers.CharField(source="profile.phone", read_only=True)
    avatar = serializers.ImageField(source="profile.avatar", read_only=True)
    loyalty_points = serializers.SerializerMethodField()
    paw_points = serializers.SerializerMethodField()
    pawPoints = serializers.SerializerMethodField()
    lifetime_paw_points = serializers.SerializerMethodField()
    lifetimePawPoints = serializers.SerializerMethodField()
    stamps_count = serializers.IntegerField(source="profile.stamps_count", read_only=True)
    stampsCount = serializers.IntegerField(source="profile.stamps_count", read_only=True)
    free_treats_available = serializers.IntegerField(source="profile.free_treats_available", read_only=True)
    freeTreatsAvailable = serializers.IntegerField(source="profile.free_treats_available", read_only=True)
    member_since = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "full_name", "phone", "avatar", "loyalty_points",
            "paw_points", "pawPoints",
            "lifetime_paw_points", "lifetimePawPoints",
            "stamps_count", "stampsCount", "free_treats_available", "freeTreatsAvailable",
            "member_since", "profile", "role",
        ]
        read_only_fields = [
            "id", "username", "role", "member_since",
            "loyalty_points", "paw_points", "pawPoints", "lifetime_paw_points", "lifetimePawPoints",
            "stamps_count", "stampsCount", "free_treats_available", "freeTreatsAvailable",
        ]

    def get_loyalty_points(self, obj):
        prof = getattr(obj, "profile", None)
        if not prof:
            return 0
        return prof.paw_points or prof.loyalty_points

    def get_paw_points(self, obj):
        return self.get_loyalty_points(obj)

    def get_pawPoints(self, obj):
        return self.get_loyalty_points(obj)

    def get_lifetime_paw_points(self, obj):
        prof = getattr(obj, "profile", None)
        if not prof:
            return 0
        return prof.lifetime_paw_points or prof.paw_points or prof.loyalty_points

    def get_lifetimePawPoints(self, obj):
        return self.get_lifetime_paw_points(obj)

    def get_role(self, obj):
        groups = list(obj.groups.values_list("name", flat=True))
        if "admin" in groups or getattr(obj, "is_superuser", False):
            return "admin"
        if "staff" in groups or getattr(obj, "is_staff", False):
            return "staff"
        return "customer"

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.username

    def get_member_since(self, obj):
        return obj.date_joined.strftime("%B %Y")


class UserProfileDetailSerializer(UserSerializer):
    """Detailed profile data with stats for profile page."""
    stats = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["stats"]

    def get_stats(self, obj):
        from catroom.models import CatRoomReservation
        from orders.models import Order
        from django.utils import timezone

        today = timezone.localdate()
        upcoming_count = CatRoomReservation.objects.filter(
            customer=obj,
            date__gte=today,
            status__in=["pending_payment", "confirmed", "rescheduled"],
        ).count()

        orders_count = Order.objects.filter(customer=obj).count()
        prof = getattr(obj, "profile", None)
        points = (getattr(prof, "paw_points", 0) or getattr(prof, "loyalty_points", 0)) if prof else 0

        return {
            "paw_points": points,
            "upcoming_visits": upcoming_count,
            "cafe_orders": orders_count,
        }


class UserUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False, write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "name", "email", "phone", "avatar"]

    def validate_email(self, value):
        user = self.instance
        if User.objects.exclude(pk=user.pk).filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use by another account.")
        return value.lower()

    def validate_avatar(self, value):
        if value:
            # Max 2MB
            max_size = 2 * 1024 * 1024
            if value.size > max_size:
                raise serializers.ValidationError("Avatar image size cannot exceed 2MB.")

            # Type validation
            valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
            content_type = getattr(value, "content_type", "")
            if content_type and content_type not in valid_types:
                raise serializers.ValidationError("Only JPEG, PNG, and WebP images are supported.")
        return value

    def update(self, instance, validated_data):
        name = validated_data.pop("name", None)
        if name is not None:
            parts = name.strip().split(" ", 1)
            instance.first_name = parts[0]
            instance.last_name = parts[1] if len(parts) > 1 else ""

        if "first_name" in validated_data:
            instance.first_name = validated_data["first_name"]
        if "last_name" in validated_data:
            instance.last_name = validated_data["last_name"]
        if "email" in validated_data:
            instance.email = validated_data["email"]

        instance.save()

        profile, _ = Profile.objects.get_or_create(user=instance)
        if "phone" in validated_data:
            profile.phone = validated_data["phone"]
        if "avatar" in validated_data:
            profile.avatar = validated_data["avatar"]
        profile.save()
        instance.profile = profile

        return instance


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, data):
        new_pass = data.get("new_password")
        confirm_pass = data.get("confirm_password")
        if new_pass != confirm_pass:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        user = self.context["request"].user
        validate_password(new_pass, user=user)
        return data


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False)
    name = serializers.CharField(max_length=200, required=False)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value.lower()

    def validate(self, data):
        confirm_pass = data.get("confirm_password")
        if confirm_pass and data.get("password") != confirm_pass:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        email = validated_data["email"]
        username = validated_data.get("username")
        if not username:
            base_username = email.split("@")[0]
            candidate = base_username
            idx = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f"{base_username}{idx}"
                idx += 1
            username = candidate

        name = validated_data.get("name", "")
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")
        if name and not first_name:
            parts = name.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            first_name=first_name,
            last_name=last_name,
        )

        customer_group, _ = Group.objects.get_or_create(name="customer")
        user.groups.add(customer_group)

        phone = validated_data.get("phone", "")
        if phone:
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.phone = phone
            profile.save(update_fields=["phone"])
            user.profile = profile

        return user
