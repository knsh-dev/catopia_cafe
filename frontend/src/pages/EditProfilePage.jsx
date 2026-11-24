import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
} from "lucide-react";

export default function EditProfilePage() {
  const { user, loading: authLoading, refetchUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Profile tab state
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password tab state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?redirect=/profile/edit");
    } else if (user) {
      setProfileForm({
        name: user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
        email: user.email || "",
        phone: user.phone || user.profile?.phone || "",
      });
      if (user.avatar || user.profile?.avatar) {
        setAvatarPreview(user.avatar || user.profile?.avatar);
      }
    }
  }, [user, authLoading, navigate]);

  // Handle avatar file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setProfileError("Image size must be less than 2MB.");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setProfileError("");
    }
  };

  // Submit profile details update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", profileForm.name);
      formData.append("email", profileForm.email);
      formData.append("phone", profileForm.phone);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      await api.patch("/api/users/me/", formData);
      await refetchUser();
      setProfileSuccess("Your profile details have been saved successfully.");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err) {
      const msg =
        err?.data?.email?.[0] ||
        err?.data?.avatar?.[0] ||
        err?.data?.detail ||
        "Failed to update profile. Please try again.";
      setProfileError(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  // Submit password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post("/api/users/me/password/", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      });

      setPasswordSuccess("Password updated successfully. Your session remains active.");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setTimeout(() => setPasswordSuccess(""), 4000);
    } catch (err) {
      const msg =
        err?.data?.current_password?.[0] ||
        err?.data?.new_password?.[0] ||
        err?.data?.confirm_password?.[0] ||
        err?.data?.detail ||
        "Failed to update password.";
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="bg-cream min-h-screen py-10 md:py-16 selection:bg-caramel/20">
      <div className="mx-auto max-w-2xl px-4">
        {/* Back Link */}
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-espresso hover:text-caramel">
          <Link to="/profile">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Profile
          </Link>
        </Button>

        <Card className="bg-white rounded-3xl border-[#EFEAE2] shadow-[0_8px_30px_rgb(61,43,31,0.06)] overflow-hidden">
          {/* Header */}
          <div className="p-7 sm:p-8 border-b border-border/60 bg-gradient-to-b from-[#FAF6F0] to-white">
            <p className="font-heading italic text-caramel text-sm">Account Settings</p>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-espresso tracking-tight mt-1">
              Edit Profile & Password
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage your personal information, profile photo, and security credentials.
            </p>
          </div>

          <CardContent className="p-7 sm:p-8">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-sm mx-auto mb-6">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  <span>Profile Details</span>
                </TabsTrigger>
                <TabsTrigger value="password" className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Change Password</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PROFILE DETAILS */}
              <TabsContent value="profile" className="space-y-6 focus-visible:outline-none">
                {profileSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                {profileError && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  {/* Avatar Upload with live preview */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-[#FAF6F0] border border-border/70">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar Preview"
                          className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-caramel/30"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-caramel text-white font-heading font-bold text-2xl flex items-center justify-center border-2 border-white shadow-md">
                          {user?.first_name?.[0] || user?.username?.[0] || "C"}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="text-center sm:text-left space-y-1">
                      <p className="text-xs font-semibold text-espresso">Profile Avatar</p>
                      <p className="text-[11px] text-muted-foreground">
                        JPG, PNG, or WebP. Max file size: 2MB.
                      </p>
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-full bg-white"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera className="h-3 w-3 mr-1.5" />
                          Upload photo
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="text-xs font-semibold text-espresso">
                      Full name
                    </Label>
                    <Input
                      id="edit-name"
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                      required
                      className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="text-xs font-semibold text-espresso">
                      Email address
                    </Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      required
                      className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-phone" className="text-xs font-semibold text-espresso">
                      Phone number
                    </Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+63 912 345 6789"
                      className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full py-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold text-sm shadow-[0_6px_25px_rgba(212,136,62,0.45)]"
                  >
                    {profileLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving changes...
                      </>
                    ) : (
                      "Save Profile Details"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 2: CHANGE PASSWORD */}
              <TabsContent value="password" className="space-y-6 focus-visible:outline-none">
                {passwordSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="current_password" className="text-xs font-semibold text-espresso">
                      Current password
                    </Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                        placeholder="Enter your current password"
                        required
                        className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-espresso p-1 cursor-pointer transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password" className="text-xs font-semibold text-espresso">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-espresso p-1 cursor-pointer transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password" className="text-xs font-semibold text-espresso">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))}
                        placeholder="Re-enter your new password"
                        required
                        className="h-11 rounded-2xl border-border/80 bg-[#FAF6F0] focus:bg-white text-xs px-3.5 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-espresso p-1 cursor-pointer transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Hint */}
                  <div className="p-3.5 rounded-2xl bg-caramel/5 border border-caramel/20 flex items-start gap-2.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-caramel shrink-0 mt-0.5" />
                    <span>
                      Password must be at least 8 characters long and cannot be too similar to your username or email.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold text-sm shadow-[0_6px_25px_rgba(212,136,62,0.45)]"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating password...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
