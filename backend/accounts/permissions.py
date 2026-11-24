from rest_framework.permissions import BasePermission


class IsCustomer(BasePermission):
    """Allow only users in the 'customer' group."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.groups.filter(name="customer").exists()
        )


class IsStaffMember(BasePermission):
    """Allow only users in the 'staff' group."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.groups.filter(name="staff").exists()
        )


class IsAdmin(BasePermission):
    """Allow only users in the 'admin' group or superusers."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.groups.filter(name="admin").exists()
                or request.user.is_superuser
            )
        )


class IsStaffOrAdmin(BasePermission):
    """Allow staff or admin."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.groups.filter(name__in=["staff", "admin"]).exists()
                or request.user.is_staff
                or request.user.is_superuser
            )
        )


class IsOwnerOrStaff(BasePermission):
    """
    Object-level: allow the object owner (obj.user or obj.customer)
    or staff/admin.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        owner = getattr(obj, "user", None) or getattr(obj, "customer", None)
        if owner and owner == user:
            return True
        return bool(
            user.groups.filter(name__in=["staff", "admin"]).exists()
            or user.is_staff
            or user.is_superuser
        )
