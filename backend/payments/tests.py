import json
from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from catroom.models import CatRoomReservation
from loyalty.models import LoyaltyTransaction
from orders.models import Order
from payments.models import Payment

User = get_user_model()

MOCK_INVOICE = {
    "id": "test_invoice_id",
    "invoice_url": "https://checkout.xendit.co/test",
}

WEBHOOK_URL = "/api/payments/xendit/webhook/"
CHECKOUT_URL = "/api/payments/checkout/"


class PaymentTestBase(TestCase):
    """Shared setUp for payment tests."""

    def setUp(self):
        self.customer_group, _ = Group.objects.get_or_create(name="customer")
        self.staff_group, _ = Group.objects.get_or_create(name="staff")

        # Customer user
        self.customer = User.objects.create_user(
            username="customer1", password="pass1234", email="cust@test.com"
        )
        self.customer.groups.add(self.customer_group)

        # Another customer
        self.other_customer = User.objects.create_user(
            username="customer2", password="pass1234", email="cust2@test.com"
        )
        self.other_customer.groups.add(self.customer_group)

        # Staff user
        self.staff_user = User.objects.create_user(
            username="staffuser", password="pass1234", email="staff@test.com"
        )
        self.staff_user.groups.add(self.staff_group)

    def _create_order(self, customer=None, total=None):
        customer = customer or self.customer
        return Order.objects.create(
            customer=customer,
            subtotal=total or Decimal("500.00"),
            total=total or Decimal("500.00"),
            status="pending",
        )

    def _create_reservation(self, customer=None, expired=False):
        customer = customer or self.customer
        hold = timezone.now() + timedelta(minutes=15)
        if expired:
            hold = timezone.now() - timedelta(minutes=1)
        return CatRoomReservation.objects.create(
            customer=customer,
            date=date.today() + timedelta(days=1),
            slot_start=time(14, 0),
            visitors=2,
            fee=Decimal("600.00"),
            payment_option="full",
            amount_due=Decimal("600.00"),
            policy_acknowledged=True,
            status="pending_payment",
            hold_expires_at=hold,
        )

    def _create_paid_payment(self, order=None, reservation=None, customer=None):
        customer = customer or self.customer
        payment = Payment.objects.create(
            customer=customer,
            order=order,
            reservation=reservation,
            amount=Decimal("500.00"),
            method="xendit",
            status="paid",
            paid_at=timezone.now(),
            receipt_number="RCP-TEST12345",
        )
        return payment


class WebhookTokenRejectionTest(PaymentTestBase):
    """a) test_webhook_token_rejection -- POST to webhook with wrong token -> 403"""

    def test_webhook_token_rejection(self):
        resp = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({"status": "PAID", "external_id": "X"}),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN="wrong-token",
        )
        self.assertEqual(resp.status_code, 403)


class WebhookIdempotencyTest(PaymentTestBase):
    """b) test_webhook_idempotency -- Process a PAID webhook twice -> second time still 200, only 1 loyalty transaction"""

    def test_webhook_idempotency(self):
        order = self._create_order()
        payment = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
        )

        webhook_data = {
            "status": "PAID",
            "external_id": payment.reference_number,
        }

        # First call
        resp1 = self.client.post(
            WEBHOOK_URL,
            data=json.dumps(webhook_data),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp1.status_code, 200)

        # Second call (idempotent)
        resp2 = self.client.post(
            WEBHOOK_URL,
            data=json.dumps(webhook_data),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp2.status_code, 200)

        # Only 1 loyalty transaction
        self.assertEqual(LoyaltyTransaction.objects.filter(user=self.customer).count(), 1)


class CheckoutOrderSuccessTest(PaymentTestBase):
    """c) test_checkout_order_success -- Create pending order, checkout -> 201 with invoice_url"""

    @patch("payments.xendit_service.create_invoice", return_value=MOCK_INVOICE)
    def test_checkout_order_success(self, mock_invoice):
        order = self._create_order()
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "order", "id": order.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("invoice_url", resp.json())
        self.assertIn("payment_id", resp.json())
        self.assertIn("reference_number", resp.json())
        mock_invoice.assert_called_once()


class CheckoutReservationSuccessTest(PaymentTestBase):
    """d) test_checkout_reservation_success -- Create pending_payment reservation, checkout -> 201"""

    @patch("payments.xendit_service.create_invoice", return_value=MOCK_INVOICE)
    def test_checkout_reservation_success(self, mock_invoice):
        reservation = self._create_reservation()
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "reservation", "id": reservation.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("invoice_url", resp.json())
        mock_invoice.assert_called_once()


class CheckoutWrongOwnerTest(PaymentTestBase):
    """e) test_checkout_wrong_owner -- User A tries to checkout User B's order -> 404"""

    @patch("payments.xendit_service.create_invoice", return_value=MOCK_INVOICE)
    def test_checkout_wrong_owner(self, mock_invoice):
        order = self._create_order(customer=self.other_customer)
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "order", "id": order.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)
        mock_invoice.assert_not_called()


class CheckoutExpiredHoldTest(PaymentTestBase):
    """f) test_checkout_expired_hold -- Reservation with expired hold -> 400"""

    @patch("payments.xendit_service.create_invoice", return_value=MOCK_INVOICE)
    def test_checkout_expired_hold(self, mock_invoice):
        reservation = self._create_reservation(expired=True)
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "reservation", "id": reservation.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        mock_invoice.assert_not_called()


class WebhookPaidConfirmsReservationTest(PaymentTestBase):
    """g) test_webhook_paid_confirms_reservation -- PAID webhook -> reservation.status becomes 'confirmed'"""

    def test_webhook_paid_confirms_reservation(self):
        reservation = self._create_reservation()
        payment = Payment.objects.create(
            customer=self.customer,
            reservation=reservation,
            amount=reservation.amount_due,
            method="xendit",
            status="pending",
        )

        resp = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({
                "status": "PAID",
                "external_id": payment.reference_number,
            }),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp.status_code, 200)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, "confirmed")


class WebhookPaidAwardsLoyaltyTest(PaymentTestBase):
    """h) test_webhook_paid_awards_loyalty -- PAID webhook -> LoyaltyTransaction created with correct points"""

    def test_webhook_paid_awards_loyalty(self):
        order = self._create_order(total=Decimal("300.00"))
        payment = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
        )

        self.client.post(
            WEBHOOK_URL,
            data=json.dumps({
                "status": "PAID",
                "external_id": payment.reference_number,
            }),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )

        lt = LoyaltyTransaction.objects.get(user=self.customer)
        expected_points = int(Decimal("300.00") // 10)
        self.assertEqual(lt.points, expected_points)

        # Order payment_status and status should also be updated
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "PAID")
        self.assertEqual(order.status, "preparing")


class WebhookExpiredCancelsReservationTest(PaymentTestBase):
    """i) test_webhook_expired_cancels_reservation -- EXPIRED webhook -> reservation cancelled"""

    def test_webhook_expired_cancels_reservation(self):
        reservation = self._create_reservation()
        payment = Payment.objects.create(
            customer=self.customer,
            reservation=reservation,
            amount=reservation.amount_due,
            method="xendit",
            status="pending",
        )

        resp = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({
                "status": "EXPIRED",
                "external_id": payment.reference_number,
            }),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp.status_code, 200)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, "cancelled")
        payment.refresh_from_db()
        self.assertEqual(payment.status, "expired")


class ReceiptOwnerAccessTest(PaymentTestBase):
    """j) test_receipt_owner_access -- Owner can GET receipt of paid payment"""

    def test_receipt_owner_access(self):
        order = self._create_order()
        payment = self._create_paid_payment(order=order)
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.get(f"/api/payments/{payment.pk}/receipt/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["receipt_number"], "RCP-TEST12345")


class ReceiptOtherUserDeniedTest(PaymentTestBase):
    """k) test_receipt_other_user_denied -- Non-owner non-staff gets 403"""

    def test_receipt_other_user_denied(self):
        order = self._create_order()
        payment = self._create_paid_payment(order=order)
        self.client.login(username="customer2", password="pass1234")

        resp = self.client.get(f"/api/payments/{payment.pk}/receipt/")
        self.assertEqual(resp.status_code, 403)


class ReceiptUnpaidRejectedTest(PaymentTestBase):
    """l) test_receipt_unpaid_rejected -- Receipt for pending payment -> 400"""

    def test_receipt_unpaid_rejected(self):
        order = self._create_order()
        payment = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
        )
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.get(f"/api/payments/{payment.pk}/receipt/")
        self.assertEqual(resp.status_code, 400)


class RefundByStaffTest(PaymentTestBase):
    """m) test_refund_by_admin -- Admin can refund paid payment; staff is denied"""

    @patch("payments.xendit_service.create_refund", return_value={"id": "refund_123"})
    def test_refund_by_staff(self, mock_refund):
        order = self._create_order()
        payment = self._create_paid_payment(order=order)

        # Staff user is denied (Admin only)
        self.client.login(username="staffuser", password="pass1234")
        resp = self.client.post(f"/api/payments/{payment.pk}/refund/")
        self.assertEqual(resp.status_code, 403)

        # Admin user is authorized
        admin_group, _ = Group.objects.get_or_create(name="admin")
        admin_user = User.objects.create_user(
            username="adminuser", password="pass1234", email="admin@test.com"
        )
        admin_user.groups.add(admin_group)
        self.client.login(username="adminuser", password="pass1234")

        resp = self.client.post(
            f"/api/payments/{payment.pk}/refund/",
            {"audit_note": "Guest cancellation approved"},
        )
        self.assertEqual(resp.status_code, 200)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "refunded")
        self.assertEqual(payment.audit_note, "Guest cancellation approved")


class RefundNonStaffDeniedTest(PaymentTestBase):
    """n) test_refund_non_staff_denied -- Customer cannot refund"""

    def test_refund_non_staff_denied(self):
        order = self._create_order()
        payment = self._create_paid_payment(order=order)
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.post(f"/api/payments/{payment.pk}/refund/")
        self.assertEqual(resp.status_code, 403)


class PaymentStatusPollingTest(PaymentTestBase):
    """o) test_payment_status_polling -- Owner can GET payment status"""

    def test_payment_status_polling(self):
        order = self._create_order()
        payment = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
        )
        self.client.login(username="customer1", password="pass1234")

        resp = self.client.get(f"/api/payments/{payment.pk}/status/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "pending")


class CheckoutDeduplicationAndReuseTest(PaymentTestBase):
    """p) Test that clicking checkout multiple times reuses active invoice and never creates duplicate rows."""

    @patch("payments.xendit_service.create_invoice", return_value=MOCK_INVOICE)
    @patch("payments.xendit_service.get_invoice", return_value={"status": "PENDING", "invoice_url": "https://checkout.xendit.co/test"})
    def test_checkout_reuses_active_invoice_no_duplicates(self, mock_get_invoice, mock_create_invoice):
        order = self._create_order()
        self.client.login(username="customer1", password="pass1234")

        # First checkout -> 201 Created
        resp1 = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "order", "id": order.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp1.status_code, 201)
        self.assertEqual(Payment.objects.filter(order=order).count(), 1)

        # Second checkout while invoice is active PENDING -> reuses existing invoice, no new row!
        resp2 = self.client.post(
            CHECKOUT_URL,
            data=json.dumps({"type": "order", "id": order.pk}),
            content_type="application/json",
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["invoice_url"], "https://checkout.xendit.co/test")
        self.assertEqual(Payment.objects.filter(order=order).count(), 1)


class WebhookConfirmationDeduplicationTest(PaymentTestBase):
    """q) When payment is confirmed PAID via webhook, orphaned pending rows for that order/reservation are deleted."""

    def test_webhook_paid_deletes_duplicate_pending_rows(self):
        order = self._create_order()
        payment_primary = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
            reference_number="CATOPIA-PRIMARY",
        )
        payment_duplicate = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
            reference_number="CATOPIA-DUPLICATE",
        )
        self.assertEqual(Payment.objects.filter(order=order).count(), 2)

        resp = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({
                "status": "PAID",
                "external_id": payment_primary.reference_number,
            }),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp.status_code, 200)
        # Duplicate pending payment is cleaned up; primary payment is now PAID
        self.assertEqual(Payment.objects.filter(order=order).count(), 1)
        payment_primary.refresh_from_db()
        self.assertEqual(payment_primary.status, "paid")
        self.assertFalse(Payment.objects.filter(pk=payment_duplicate.pk).exists())


class PaymentSyncEndpointTest(PaymentTestBase):
    """r) Test admin sync endpoint /api/payments/sync/."""

    @patch("payments.xendit_service.get_invoice_by_external_id", return_value={})
    @patch("payments.xendit_service.get_invoice", return_value={"status": "PAID", "invoice_url": "https://test.url"})
    def test_sync_settles_and_deduplicates(self, mock_get_invoice, mock_get_external):
        order = self._create_order()
        p1 = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
            xendit_invoice_id="inv_123",
            reference_number="CATOPIA-SYNC-1",
        )
        p2 = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
            reference_number="CATOPIA-SYNC-2",
        )

        self.client.login(username="staffuser", password="pass1234")
        resp = self.client.post("/api/payments/sync/")
        self.assertEqual(resp.status_code, 200)
        p1.refresh_from_db()
        self.assertEqual(p1.status, "paid")
        self.assertFalse(Payment.objects.filter(pk=p2.pk).exists())

    def test_sync_requires_staff(self):
        self.client.login(username="customer1", password="pass1234")
        resp = self.client.post("/api/payments/sync/")
        self.assertEqual(resp.status_code, 403)


class PaymentSortingAndPaginationTest(PaymentTestBase):
    """s) Test sorting and pagination on GET /api/payments/."""

    def setUp(self):
        super().setUp()
        self.client.login(username="staffuser", password="pass1234")
        # Create payments with different amounts and statuses
        for i in range(15):
            o = self._create_order(total=Decimal(100 + i * 10))
            st = "paid" if i % 2 == 0 else "pending"
            Payment.objects.create(
                customer=self.customer,
                order=o,
                amount=Decimal(100 + i * 10),
                method="xendit",
                status=st,
                reference_number=f"CATOPIA-SORT-{i}",
            )

    def test_pagination_page_size(self):
        resp = self.client.get("/api/payments/?page_size=10")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["results"]), 10)
        self.assertEqual(data["count"], 15)

    def test_sorting_amount_desc(self):
        resp = self.client.get("/api/payments/?sort=amount_desc&page_size=5")
        self.assertEqual(resp.status_code, 200)
        results = resp.json()["results"]
        amounts = [float(r["amount"]) for r in results]
        self.assertEqual(amounts, sorted(amounts, reverse=True))

    def test_sorting_amount_asc(self):
        resp = self.client.get("/api/payments/?sort=amount_asc&page_size=5")
        self.assertEqual(resp.status_code, 200)
        results = resp.json()["results"]
        amounts = [float(r["amount"]) for r in results]
        self.assertEqual(amounts, sorted(amounts))


@override_settings(
    RESEND_API_KEY="re_test_123456789",
    RESEND_FROM_EMAIL="Catopia Café <onboarding@resend.dev>",
)
class ResendReceiptEmailTests(PaymentTestBase):
    """t) Verify Resend API receipt emails are sent idempotently for both order and reservation payments."""

    @patch("payments.resend_service.httpx.post")
    def test_order_webhook_paid_sends_resend_receipt_email_once(self, mock_httpx_post):
        mock_httpx_post.return_value.status_code = 200
        mock_httpx_post.return_value.raise_for_status.return_value = None
        mock_httpx_post.return_value.json.return_value = {"id": "email_order_123"}

        self.customer.email = "customer.gmail@gmail.com"
        self.customer.save(update_fields=["email"])

        order = self._create_order(total=Decimal("340.00"))
        from orders.models import OrderItem
        OrderItem.objects.create(
            order=order,
            name="Catpuccino",
            price=Decimal("170.00"),
            quantity=2,
        )
        payment = Payment.objects.create(
            customer=self.customer,
            order=order,
            amount=order.total,
            method="xendit",
            status="pending",
        )

        resp = self.client.post(
            WEBHOOK_URL,
            data=json.dumps({
                "status": "PAID",
                "external_id": payment.reference_number,
            }),
            content_type="application/json",
            HTTP_X_CALLBACK_TOKEN=settings.XENDIT_WEBHOOK_TOKEN,
        )
        self.assertEqual(resp.status_code, 200)
        mock_httpx_post.assert_called_once()

        call_args = mock_httpx_post.call_args
        self.assertEqual(call_args[0][0], "https://api.resend.com/emails")
        sent_json = call_args[1]["json"]
        self.assertEqual(sent_json["to"], ["customer.gmail@gmail.com"])
        self.assertIn(f"Order #{order.pk}", sent_json["subject"])
        self.assertIn("Catpuccino", sent_json["html"])

        payment.refresh_from_db()
        self.assertTrue(payment.raw_payload.get("receipt_email_sent"))
        self.assertEqual(payment.raw_payload.get("resend_email_id"), "email_order_123")

        # Polling status or verify-payment afterwards must NOT send a duplicate email
        self.client.login(username="customer1", password="pass1234")
        self.client.get(f"/api/payments/{payment.pk}/status/")
        self.client.post(f"/api/orders/{order.pk}/verify-payment/")
        self.assertEqual(mock_httpx_post.call_count, 1)

    @patch("payments.resend_service.httpx.post")
    @patch("payments.xendit_service.get_invoice", return_value={"status": "PAID", "id": "inv_res_999"})
    def test_reservation_status_polling_paid_sends_resend_receipt_email(self, mock_get_inv, mock_httpx_post):
        mock_httpx_post.return_value.status_code = 200
        mock_httpx_post.return_value.raise_for_status.return_value = None
        mock_httpx_post.return_value.json.return_value = {"id": "email_res_456"}

        self.customer.email = "catlover@gmail.com"
        self.customer.save(update_fields=["email"])

        reservation = self._create_reservation()
        payment = Payment.objects.create(
            customer=self.customer,
            reservation=reservation,
            amount=reservation.amount_due,
            method="xendit",
            status="pending",
            xendit_invoice_id="inv_res_999",
        )

        self.client.login(username="customer1", password="pass1234")
        resp = self.client.get(f"/api/payments/{payment.pk}/status/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "paid")

        mock_httpx_post.assert_called_once()
        sent_json = mock_httpx_post.call_args[1]["json"]
        self.assertEqual(sent_json["to"], ["catlover@gmail.com"])
        self.assertIn(f"Cat Room Reservation #{reservation.pk}", sent_json["subject"])
        self.assertIn(str(reservation.date), sent_json["html"])

        payment.refresh_from_db()
        self.assertTrue(payment.raw_payload.get("receipt_email_sent"))

