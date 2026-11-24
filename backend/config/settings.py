"""
Django settings for Catopia Café.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-dev-key-change-in-production")
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
if DEBUG:
    for host in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]"):
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)

# ---------- Apps ----------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local
    "accounts",
    "menu",
    "orders",
    "catroom",
    "cats",
    "payments",
    "loyalty",
]

# ---------- Middleware ----------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------- Database ----------
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- Auth ----------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------- i18n ----------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

# ---------- Static & Media ----------
STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------- DRF ----------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ---------- CORS / CSRF ----------
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]
if DEBUG:
    for default_origin in ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"):
        if default_origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(default_origin)

CORS_ALLOW_CREDENTIALS = True

from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = list(default_headers) + [
    "cache-control",
    "pragma",
    "x-csrftoken",
    "x-requested-with",
]

CSRF_TRUSTED_ORIGINS = list(set(
    CORS_ALLOWED_ORIGINS + [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
))
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # React needs to read it
if DEBUG:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
else:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ---------- Cafe Settings (configurable via env) ----------
CAFE_NAME = os.getenv("CAFE_NAME", "Catopia Café")
CAFE_ADDRESS = os.getenv("CAFE_ADDRESS", "[ADDRESS]")
CAFE_PHONE = os.getenv("CAFE_PHONE", "[PHONE]")
CAFE_EMAIL = os.getenv("CAFE_EMAIL", "[EMAIL]")
CAFE_LATITUDE = os.getenv("CAFE_LATITUDE", "[LAT]")
CAFE_LONGITUDE = os.getenv("CAFE_LONGITUDE", "[LNG]")
CAFE_OPENING_HOUR = int(os.getenv("CAFE_OPENING_HOUR", "10"))
CAFE_CLOSING_HOUR = int(os.getenv("CAFE_CLOSING_HOUR", "21"))
CATROOM_HOURLY_RATE = os.getenv("CATROOM_HOURLY_RATE", "[HOURLY_RATE]")
CATROOM_MAX_VISITORS = int(os.getenv("CATROOM_MAX_VISITORS", "10"))
CATROOM_MIN_DEPOSIT = os.getenv("CATROOM_MIN_DEPOSIT", "[MIN_DEPOSIT]")
CATROOM_HOLD_MINUTES = int(os.getenv("CATROOM_HOLD_MINUTES", "15"))
CATROOM_CANCEL_CUTOFF_HOURS = int(os.getenv("CATROOM_CANCEL_CUTOFF_HOURS", "24"))

# ---------- Xendit ----------
XENDIT_SECRET_KEY = os.getenv("XENDIT_SECRET_KEY", "")
XENDIT_WEBHOOK_TOKEN = os.getenv("XENDIT_WEBHOOK_TOKEN", "")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
LOYALTY_POINTS_PER_PESO = int(os.getenv("LOYALTY_POINTS_PER_PESO", "1"))

# ---------- Resend Email API ----------
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Catopia Café <onboarding@resend.dev>").strip()


