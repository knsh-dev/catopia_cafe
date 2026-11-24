import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import RootLayout from "@/components/layout/RootLayout";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import MenuPage from "@/pages/MenuPage";
import MenuItemDetailPage from "@/pages/MenuItemDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import CatRoomPage from "@/pages/CatRoomPage";
import MyReservationsPage from "@/pages/MyReservationsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import PaymentFailedPage from "@/pages/PaymentFailedPage";
import ReceiptPage from "@/pages/ReceiptPage";
import ProfilePage from "@/pages/ProfilePage";
import EditProfilePage from "@/pages/EditProfilePage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ErrorBoundary>
            <Routes>
              {/* Standalone full-screen Admin Dashboard for Staff/Admin */}
              <Route path="/admin" element={<AdminDashboardPage />} />

              <Route element={<RootLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/menu/:id" element={<MenuItemDetailPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/cart" element={<Navigate to="/checkout" replace />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />

                {/* Redirect /cats to the Resident Cats section on /catroom */}
                <Route path="/cats" element={<Navigate to="/catroom#our-cats" replace />} />
                <Route path="/catroom" element={<CatRoomPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/edit" element={<EditProfilePage />} />
                <Route path="/reservations" element={<MyReservationsPage />} />
                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/payment/failed" element={<PaymentFailedPage />} />
                <Route path="/payment/:paymentId/receipt" element={<ReceiptPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-cream">
      <div className="text-center space-y-2">
        <h1 className="font-heading text-3xl font-bold text-espresso">{title}</h1>
        <p className="text-muted-foreground">Coming in a later phase.</p>
      </div>
    </div>
  );
}
