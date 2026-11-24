import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  Gift,
  Heart,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  PawPrint,
  AlertCircle,
} from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (form.password !== form.confirm_password) {
      setErrors({ confirm_password: "Passwords do not match." });
      return;
    }

    if (form.password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      navigate(redirect);
    } catch (err) {
      if (err.data && typeof err.data === "object") {
        setErrors(err.data);
      } else {
        setErrors({ general: "Registration failed. Please check your information." });
      }
    } finally {
      setLoading(false);
    }
  };

  const loginLink =
    redirect !== "/"
      ? `/login?redirect=${encodeURIComponent(redirect)}`
      : "/login";

  const getError = (field) => {
    const val = errors[field];
    if (Array.isArray(val)) return val[0];
    return val || "";
  };

  return (
    <div className="bg-cream min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 md:py-20 selection:bg-caramel/20">
      <div className="mx-auto max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left Column: Create Account Card */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-7 sm:p-10 shadow-[0_8px_30px_rgb(61,43,31,0.06)] border border-[#EFEAE2]">
          <div className="space-y-1.5 mb-7">
            <p className="font-heading italic text-caramel text-base">
              Join the club
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-espresso tracking-tight">
              Create Account
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed pt-1">
              Become a Catopia Café member. It&apos;s free, and your first paw points are just a latte away.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-espresso">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Olivia Bennett"
                required
                autoComplete="name"
                className="h-10 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
              />
              {getError("name") && (
                <p className="text-[11px] text-red-600 font-medium">{getError("name")}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-espresso">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-10 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
              />
              {getError("email") && (
                <p className="text-[11px] text-red-600 font-medium">{getError("email")}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-espresso">
                Phone <span className="text-muted-foreground/80 font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+63 912 345 6789"
                autoComplete="tel"
                className="h-10 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
              />
              {getError("phone") && (
                <p className="text-[11px] text-red-600 font-medium">{getError("phone")}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-espresso">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-10 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-espresso p-1 cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {getError("password") && (
                <p className="text-[11px] text-red-600 font-medium">{getError("password")}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-xs font-semibold text-espresso">
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  className="h-10 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-espresso p-1 cursor-pointer transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {getError("confirm_password") && (
                <p className="text-[11px] text-red-600 font-medium">{getError("confirm_password")}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold text-sm shadow-[0_6px_25px_rgba(212,136,62,0.45)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1.5">
              Already a member?{" "}
              <Link to={loginLink} className="text-caramel font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        {/* Right Column: Visual Composition with perks card */}
        <div className="hidden lg:flex flex-col items-center justify-center lg:col-span-6 relative">
          <div className="absolute top-2 right-12 text-caramel/25 select-none pointer-events-none">
            <PawPrint className="h-8 w-8 rotate-12" />
          </div>
          <div className="absolute top-10 left-10 text-caramel/20 select-none pointer-events-none">
            <Sparkles className="h-7 w-7" />
          </div>

          <div className="relative w-80 h-80 rounded-full overflow-hidden border-8 border-white shadow-xl bg-latte/40">
            <img
              src="https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=700&auto=format&fit=crop&q=80"
              alt="Cozy sleeping cats in cafe"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative -mt-16 mr-[-4rem] bg-white rounded-2xl p-5 shadow-[0_10px_35px_rgba(61,43,31,0.12)] border border-[#EFEAE2] space-y-3 max-w-xs z-10">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-caramel/15 text-caramel flex items-center justify-center shrink-0 mt-0.5">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-espresso/90 font-medium leading-snug">
                Reserve and manage 1-hour Cat Room visits
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-caramel/15 text-caramel flex items-center justify-center shrink-0 mt-0.5">
                <Gift className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-espresso/90 font-medium leading-snug">
                Earn 1 paw point on every ₱10 you spend
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-caramel/15 text-caramel flex items-center justify-center shrink-0 mt-0.5">
                <Heart className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-espresso/90 font-medium leading-snug">
                Keep a list of your favorite resident cats
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
