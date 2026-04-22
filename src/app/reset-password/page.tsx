"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, resetPassword } from "@/lib/api";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to reset your password.";
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordShell mode="loading" message="Preparing reset form..." />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  if (!uid || !token) {
    return (
      <ResetPasswordShell
        mode="error"
        message="This password reset link is incomplete or invalid."
      />
    );
  }

  return <ResetPasswordForm uid={uid} token={token} />;
}

function ResetPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(uid, token, newPassword);
      setSuccessMessage(response.message || "Password reset successful.");
      toast.success("Password reset successful.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successMessage) {
    return <ResetPasswordShell mode="success" message={successMessage} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-950">Reset Password</h1>
          <p className="text-sm text-slate-600">
            Choose a new password for your account.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset password"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Return to{" "}
          <Link href="/login" className="text-sky-700 hover:underline">
            login
          </Link>
        </p>
      </Card>
    </div>
  );
}

function ResetPasswordShell({
  mode,
  message,
}: {
  mode: "loading" | "success" | "error";
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-950">Reset Password</h1>
          <p className="text-sm text-slate-600">{message}</p>
        </div>

        {mode !== "loading" && (
          <Link href="/login" className={cn(buttonVariants(), "w-full")}>
            Back to login
          </Link>
        )}
      </Card>
    </div>
  );
}
