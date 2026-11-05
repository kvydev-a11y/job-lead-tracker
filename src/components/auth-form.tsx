"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Button, Input, Label } from "./field";
import { logIn, signUp } from "@/app/actions/auth";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSignup = mode === "signup";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isSignup ? await signUp(fd) : await logIn(fd);
      if (res.ok) router.push("/overview");
      else setError(res.error);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Briefcase className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Job &amp; Lead Tracker</span>
      </Link>

      <h1 className="text-xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isSignup ? "Your tracker is private to you." : "Log in to your tracker."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {isSignup && (
          <div>
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Alex" />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
          />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
