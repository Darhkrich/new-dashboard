"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  changeCurrentUserEmail,
  changeCurrentUserPassword,
  clearStoredSession,
  runWithSession,
  setupTwoFactor,
  syncCurrentSession,
  updateCurrentUserProfile,
  verifyTwoFactorSetup,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to update your profile.";
}

export default function SettingsPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [twoFactorQrCode, setTwoFactorQrCode] = useState<string | null>(null);
  const [twoFactorQrMimeType, setTwoFactorQrMimeType] = useState("image/png");
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorSetupLoading, setTwoFactorSetupLoading] = useState(false);
  const [twoFactorVerifyLoading, setTwoFactorVerifyLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const session = await syncCurrentSession();
        if (!cancelled) {
          setFirstName(session.user.first_name || "");
          setLastName(session.user.last_name || "");
          setEmail(session.user.email || "");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfileSave() {
    setProfileLoading(true);

    try {
      const { data: user } = await runWithSession((accessToken) =>
        updateCurrentUserProfile(accessToken, {
          first_name: firstName,
          last_name: lastName,
        }),
      );

      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      await syncCurrentSession();
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleEmailChange() {
    if (!newEmail.trim()) {
      toast.error("Enter a new email address first.");
      return;
    }

    setEmailLoading(true);

    try {
      const { data } = await runWithSession((accessToken) =>
        changeCurrentUserEmail(accessToken, newEmail.trim()),
      );

      const session = await syncCurrentSession();
      setEmail(session.user.email || "");
      setNewEmail("");
      toast.success(data.message || "Email updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordChange() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);

    try {
      const { data } = await runWithSession((accessToken) =>
        changeCurrentUserPassword(accessToken, currentPassword, newPassword),
      );

      clearStoredSession();
      toast.success(data.message || "Password updated successfully. Please sign in again.");
      router.replace("/login");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPasswordLoading(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleGenerateTwoFactor() {
    setTwoFactorSetupLoading(true);

    try {
      const { data } = await runWithSession((accessToken) => setupTwoFactor(accessToken));
      setTwoFactorQrCode(data.qr_code);
      setTwoFactorQrMimeType(data.qr_code_mime_type || "image/png");
      setTwoFactorSecret(data.secret);
      setTwoFactorOtp("");
      toast.success("2FA setup generated. Scan the QR code and verify it.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTwoFactorSetupLoading(false);
    }
  }

  async function handleVerifyTwoFactor() {
    if (!twoFactorOtp.trim()) {
      toast.error("Enter the one-time code from your authenticator app.");
      return;
    }

    setTwoFactorVerifyLoading(true);

    try {
      const { data } = await runWithSession((accessToken) =>
        verifyTwoFactorSetup(accessToken, twoFactorOtp.trim()),
      );
      toast.success(data.message || "Two-factor authentication enabled.");
      setTwoFactorOtp("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTwoFactorVerifyLoading(false);
    }
  }

  if (initialLoading) {
    return <div className="p-6 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep your profile, sign-in details, and verification preferences up to date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Update the name shown across the operations workspace.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex justify-end border-t p-4">
          <Button onClick={() => void handleProfileSave()} disabled={profileLoading}>
            {profileLoading ? "Saving..." : "Save Profile"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>Change the email address tied to your secure account.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Email</label>
            <Input value={email} disabled />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Email</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex justify-end border-t p-4">
          <Button onClick={() => void handleEmailChange()} disabled={emailLoading}>
            {emailLoading ? "Updating..." : "Change Email"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Uses `POST /api/v1/auth/change-password/` and then sends you back to login.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex justify-end border-t p-4">
          <Button onClick={() => void handlePasswordChange()} disabled={passwordLoading}>
            {passwordLoading ? "Updating..." : "Change Password"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Uses `POST /api/v1/auth/2fa/setup/` and `POST /api/v1/auth/2fa/verify/` to
            enable authenticator-based login protection.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Generate a setup secret, scan the QR code in your authenticator app, then
            enter the one-time password to finish enabling 2FA on this account.
          </p>

          {twoFactorQrCode && (
            <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-[220px_1fr]">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <Image
                  src={`data:${twoFactorQrMimeType};base64,${twoFactorQrCode}`}
                  alt="2FA QR code"
                  width={180}
                  height={180}
                  unoptimized
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Manual Setup Secret</label>
                  <Input value={twoFactorSecret ?? ""} readOnly />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Authenticator Code</label>
                  <Input
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorOtp}
                    onChange={(event) => setTwoFactorOtp(event.target.value)}
                  />
                </div>

                <Button onClick={() => void handleVerifyTwoFactor()} disabled={twoFactorVerifyLoading}>
                  {twoFactorVerifyLoading ? "Verifying..." : "Enable 2FA"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-4 flex justify-end border-t p-4">
          <Button onClick={() => void handleGenerateTwoFactor()} disabled={twoFactorSetupLoading}>
            {twoFactorSetupLoading ? "Generating..." : "Generate 2FA Setup"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
