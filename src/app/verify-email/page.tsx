"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ApiError, verifyEmail } from "@/lib/api";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to verify your email.";
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailShell status="loading" message="Verifying your email address..." />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const hasRequiredParams = Boolean(uid && token);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    if (!hasRequiredParams || !uid || !token) {
      return;
    }

    const verificationUid = uid;
    const verificationToken = token;
    let cancelled = false;

    async function runVerification() {
      try {
        const response = await verifyEmail(verificationUid, verificationToken);
        if (!cancelled) {
          setStatus("success");
          setMessage(response.message || "Email verified successfully.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(getErrorMessage(error));
        }
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [hasRequiredParams, token, uid]);

  const resolvedStatus = hasRequiredParams ? status : "error";
  const resolvedMessage = hasRequiredParams
    ? message
    : "This verification link is incomplete.";

  return <VerifyEmailShell status={resolvedStatus} message={resolvedMessage} />;
}

function VerifyEmailShell({
  status,
  message,
}: {
  status: "loading" | "success" | "error";
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md space-y-5 p-6 text-center">
        <div className="flex justify-center">
          {status === "loading" ? (
            <LoaderCircle className="h-12 w-12 animate-spin text-sky-600" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          ) : (
            <XCircle className="h-12 w-12 text-red-600" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">Email Verification</h1>
          <p className="text-sm text-slate-600">{message}</p>
        </div>

        <Link
          href="/login"
          className={cn(buttonVariants(), "w-full")}
        >
          {status === "success" ? "Continue to login" : "Back to login"}
        </Link>
      </Card>
    </div>
  );
}
