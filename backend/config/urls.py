from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/users/", include("accounts.user_urls")),
    path("api/menu/", include("menu.urls")),
    path("api/cats/", include("cats.urls")),
    path("api/catroom/", include("catroom.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/loyalty/", include("loyalty.urls")),
    path("api/cafe/", include("config.cafe_urls")),
    path("api/admin/", include("accounts.admin_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
