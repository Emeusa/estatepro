"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";

function PasswordInput({
  name,
  placeholder,
  value,
  onChange
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className="input pr-20"
        name={name}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
            <path d="M9.4 5.5A10.7 10.7 0 0 1 12 5c5.4 0 9.3 4.7 10 7-.3 1-1.2 2.8-2.9 4.5" />
            <path d="M6.2 6.3C3.9 7.8 2.5 10.3 2 12c.7 2.3 4.6 7 10 7 1.5 0 2.9-.3 4.1-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function ResetPasswordClient() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Checking your reset link...");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sawRecoveryLinkRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hasRecoveryHash = hashParams.get("type") === "recovery" || Boolean(hashParams.get("access_token"));
        const hasRecoveryLink = Boolean(code || hasRecoveryHash);
        sawRecoveryLinkRef.current = hasRecoveryLink;

        if (!hasRecoveryLink) {
          setReady(false);
          setMessage("This reset link is invalid or expired. Request a new reset link from the login page.");
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
          window.history.replaceState(null, "", "/auth/reset-password");
        }

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (session) {
          setReady(true);
          setMessage("");
          return;
        }

        setReady(false);
        setMessage("This reset link is invalid or expired. Request a new reset link from the login page.");
      } catch {
        if (active) {
          setReady(false);
          setMessage("This reset link is invalid or expired. Request a new reset link from the login page.");
        }
      }
    }

    prepareRecoverySession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if ((event === "PASSWORD_RECOVERY" || session) && sawRecoveryLinkRef.current) {
        setReady(true);
        setMessage("");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Your password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      await supabase.auth.signOut();
      window.location.assign("/login?passwordReset=1");
    } catch {
      setMessage("Could not update your password. Request a new reset link and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Reset password</h1>
        <p className="mt-2 text-sm text-slate-500">Choose a new password for your C59 Estatehub account.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        {ready ? (
          <>
            <PasswordInput
              name="password"
              placeholder="New password"
              value={password}
              onChange={setPassword}
            />
            <PasswordInput
              name="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <button className="button-primary w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Updating password..." : "Update password"}
            </button>
          </>
        ) : null}
        {message ? <p className={`text-sm ${ready ? "text-rose-600" : "text-slate-600"}`}>{message}</p> : null}
        {!ready ? (
          <Link href="/login" className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">
            Back to login
          </Link>
        ) : null}
      </form>
    </section>
  );
}
