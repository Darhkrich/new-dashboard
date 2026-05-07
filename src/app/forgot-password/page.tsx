"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, forgotPassword } from "@/lib/api";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to send the reset request.";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email);
      setMessage(response.message || "If the account exists, a reset email was sent.");
      toast.success("Password reset request sent.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-950">Forgot Password</h1>
          <p className="text-sm text-slate-600">
            Request a secure password reset link for your account.
          </p>
        </div>

        {message ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
            <Link href="/login" className={cn(buttonVariants(), "w-full")}>
              Back to login
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-600">
          Remembered your password?{" "}
          <Link href="/login" className="text-sky-700 hover:underline">
            Back to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
