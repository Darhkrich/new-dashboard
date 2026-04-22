"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  login,
  setStoredSession,
  verifyTwoFactorLogin,
  type AuthSession,
} from "@/lib/api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function completeLogin(session: AuthSession) {
    setStoredSession(session);
    toast.success("Connected to the upgraded backend.");
    router.push("/dashboard");
  }

  async function handlePasswordLogin() {
    setIsSubmitting(true);

    try {
      const response = await login(email, password);

      if ("user_id" in response) {
        setPendingUserId(response.user_id);
        toast.info(response.message || "Enter your one-time password to continue.");
        return;
      }

      await completeLogin({
        user: response.user,
        accessToken: response.access,
        refreshToken: response.refresh,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to sign in."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpLogin() {
    if (!pendingUserId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await verifyTwoFactorLogin(pendingUserId, otp);
      await completeLogin({
        user: response.user,
        accessToken: response.access,
        refreshToken: response.refresh,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to verify the login code."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-950">Admin Login</h1>
          <p className="text-sm text-slate-600">
            Sign in with your admin credentials.
          </p>
        </div>

        {!pendingUserId ? (
          <>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePasswordLogin();
              }}
            >
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login"}
              </Button>
            </form>

            <div className="flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="text-sky-700 hover:underline">
                Forgot password?
              </Link>
              <Link href="/resend-verification" className="text-sky-700 hover:underline">
                Resend verification
              </Link>
            </div>

            <p className="text-center text-sm text-slate-600">
              Need an account?{" "}
              <Link href="/register" className="text-sky-700 hover:underline">
                Create one
              </Link>
            </p>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOtpLogin();
            }}
          >
            <Input
              inputMode="numeric"
              placeholder="One-time password"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
            />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Verify code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingUserId(null);
                  setOtp("");
                }}
              >
                Back
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
