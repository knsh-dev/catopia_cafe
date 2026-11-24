from django.urls import path
from . import admin_views
from payments.views import SyncPaymentsView

urlpatterns = [
    path("overview/", admin_views.admin_overview_view, name="admin-overview"),
    path("customers/", admin_views.admin_customers_view, name="admin-customers"),
    path("customers/<int:pk>/adjust-points/", admin_views.admin_adjust_points_view, name="admin-adjust-points"),
    path("customers/<int:pk>/role/", admin_views.admin_change_role_view, name="admin-change-role"),
    path("payments/sync/", SyncPaymentsView.as_view(), name="admin-payments-sync"),
]
