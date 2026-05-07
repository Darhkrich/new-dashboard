"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, registerUser } from "@/lib/api";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to create your account.";
}

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      const response = await registerUser({
        first_name: firstName,
        last_name: lastName,
        username: username.trim() || undefined,
        email,
        password,
      });

      setSuccessMessage(response.message || "Account created successfully.");
      toast.success("Account created. Check your email to verify it.");
      setPassword("");
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
          <h1 className="text-2xl font-semibold text-slate-950">Create Account</h1>
          <p className="text-sm text-slate-600">
            Create your account and confirm your email to finish setup.
          </p>
        </div>

        {successMessage ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>

            <Link href="/login" className={cn(buttonVariants(), "w-full")}>
              Back to login
            </Link>

            <Link
              href="/resend-verification"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Resend verification email
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
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>

            <Input
              placeholder="Username (optional)"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />

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
              {isSubmitting ? "Creating account..." : "Register"}
            </Button>
          </form>
        )}

        {!successMessage && (
          <p className="text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link href="/login" className="text-sky-700 hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
