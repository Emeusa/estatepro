"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import {
  buildCheckEmailUrl,
  CONFIRMATION_ACCOUNT_TYPE_STORAGE_KEY,
  CONFIRMATION_EMAIL_STORAGE_KEY,
  ConfirmationAccountType
} from "@/lib/auth-confirmation";
import { getFriendlyAuthMessage } from "@/lib/auth-messages";
import { supabase } from "@/lib/supabase/client";
import { TurnstileFields, readBotFields } from "@/components/security/turnstile-fields";

type AccountResponse = {
  user: {
    role: "agent" | "client" | "admin";
  } | null;
};

type PasswordFieldProps = {
  name: string;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
};

function PasswordField({ name, placeholder, value, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className="input pr-20"
        name={name}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white"
    />
  );
}

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return null;
  }
  return next;
}

function redirectToCheckEmail(email: string, accountType: ConfirmationAccountType) {
  try {
    window.sessionStorage.setItem(CONFIRMATION_EMAIL_STORAGE_KEY, email);
    window.sessionStorage.setItem(CONFIRMATION_ACCOUNT_TYPE_STORAGE_KEY, accountType);
  } catch {
    // Users can still read the fallback instructions on the destination page.
  }
  window.location.assign(buildCheckEmailUrl(email, accountType));
}

async function getAccessToken() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Authentication token is missing.");
  }

  return session.access_token;
}

async function redirectByRole() {
  const token = await getAccessToken();
  const response = await apiRequest<AccountResponse>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.user) {
    throw new Error("Account profile was not found.");
  }

  const nextPath = getSafeNextPath();
  if (nextPath) {
    window.location.assign(nextPath);
    return;
  }

  if (response.user.role === "agent") {
    window.location.assign("/agents/dashboard");
    return;
  }

  if (response.user.role === "admin") {
    window.location.assign("/admin");
    return;
  }

  window.location.assign("/dashboard");
}

async function signInWithBotFields(email: string, password: string, botFields: ReturnType<typeof readBotFields>) {
  const response = await apiRequest<{
    session: { accessToken: string; refreshToken: string };
  }>("/api/auth/login", {
    method: "POST",
    retries: 0,
    body: JSON.stringify({
      email,
      password,
      ...botFields
    })
  });

  const { error } = await supabase.auth.setSession({
    access_token: response.session.accessToken,
    refresh_token: response.session.refreshToken
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetMessageType, setResetMessageType] = useState<"error" | "success">("success");
  const [showResetForm, setShowResetForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setMessage("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      await signInWithBotFields(normalizeEmailInput(email), password, readBotFields(form));
      await redirectByRole();
    } catch (error) {
      setMessage(getFriendlyAuthMessage(error, "We could not sign you in. Please try again."));
      setIsSubmitting(false);
    }
  }

  async function onResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isResetSubmitting) {
      return;
    }

    setResetMessage("");
    setResetMessageType("success");
    setIsResetSubmitting(true);
    const form = new FormData(event.currentTarget);
    const targetEmail = normalizeEmailInput(resetEmail || email);

    try {
      const response = await apiRequest<{ message: string }>("/api/auth/password-reset", {
        method: "POST",
        retries: 0,
        body: JSON.stringify({
          email: targetEmail,
          ...readBotFields(form)
        })
      });
      setResetMessage(response.message);
      setResetMessageType("success");
    } catch (error) {
      setResetMessage(getFriendlyAuthMessage(error, "We could not send reset instructions. Please try again."));
      setResetMessageType("error");
    } finally {
      setIsResetSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => {
            const nextEmail = e.target.value.toLowerCase();
            setEmail(nextEmail);
            if (!resetEmail) {
              setResetEmail(nextEmail);
            }
          }}
        />
        <PasswordField name="password" placeholder="Password" value={password} onChange={setPassword} />
        <div className="flex justify-end">
          <button
            className="text-sm font-semibold text-teal-700 transition hover:text-teal-900"
            type="button"
            onClick={() => {
              setShowResetForm((current) => !current);
              setResetEmail((current) => current || email);
              setResetMessage("");
            }}
          >
            Forgot password?
          </button>
        </div>
        <TurnstileFields />
        <button className="button-primary inline-flex w-full items-center justify-center gap-2" disabled={isSubmitting}>
          {isSubmitting ? <ButtonSpinner /> : null}
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
      </form>

      {showResetForm ? (
        <form onSubmit={onResetSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-bold text-slate-950">Reset your password</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Enter your account email. If it is registered, we will send a password reset link.
            </p>
          </div>
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
          />
          <TurnstileFields />
          <button className="button-primary inline-flex w-full items-center justify-center gap-2" disabled={isResetSubmitting}>
            {isResetSubmitting ? <ButtonSpinner /> : null}
            {isResetSubmitting ? "Sending..." : "Send reset link"}
          </button>
          {resetMessage ? (
            <p className={`text-sm ${resetMessageType === "success" ? "text-emerald-700" : "text-rose-600"}`}>
              {resetMessage}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function ClientRegisterForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setMessage("");
    setMessageType("error");

    if (password.length < 6) {
      setMessage("Your password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = normalizeEmailInput(form.get("email")?.toString() ?? "");
    setIsSubmitting(true);

    try {
      const phone = form.get("phone")?.toString().trim() ?? "";
      await apiRequest("/api/auth/register", {
        method: "POST",
        retries: 0,
        body: JSON.stringify({
          email,
          password,
          fullName: undefined,
          phone: phone || null,
          ...readBotFields(form)
        })
      });
      event.currentTarget.reset();
      setPassword("");
      setConfirmPassword("");
      redirectToCheckEmail(email, "client");
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "We could not create your account. Please try again.";
      setMessage(getFriendlyAuthMessage(error, fallback));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <input
        className="input"
        name="email"
        placeholder="Email"
        type="email"
        onChange={(e) => {
          e.currentTarget.value = e.currentTarget.value.toLowerCase();
        }}
      />
      <input className="input" name="phone" placeholder="Phone number (optional)" />
      <PasswordField name="password" placeholder="Password" value={password} onChange={setPassword} />
      <PasswordField
        name="confirmPassword"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />
      <TurnstileFields />
      <button className="button-primary inline-flex w-full items-center justify-center gap-2" disabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : null}
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Want to list properties?
        <Link href="/agents/register" className="ml-1 font-medium text-teal-700">
          Register as an agent
        </Link>
      </p>
      {message ? <p className={`text-sm ${messageType === "success" ? "text-emerald-700" : "text-rose-600"}`}>{message}</p> : null}
    </form>
  );
}

export function AgentRegisterForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setMessage("");
    setMessageType("error");

    if (password.length < 6) {
      setMessage("Your password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = normalizeEmailInput(form.get("email")?.toString() ?? "");
    const ninNumber = form.get("ninNumber")?.toString().trim() ?? "";
    const acceptedLegalTerms = form.get("acceptedLegalTerms") === "on";
    if (!/^\d{11}$/.test(ninNumber)) {
      setMessage("Your NIN must be exactly 11 digits.");
      return;
    }

    if (!acceptedLegalTerms) {
      setMessage("Please agree to the Terms and Conditions and Privacy Policy before creating an agent account.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("/api/agents/register", {
        method: "POST",
        retries: 0,
        body: JSON.stringify({
          email,
          password,
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          ninNumber,
          acceptedLegalTerms,
          ...readBotFields(form)
        })
      });
      event.currentTarget.reset();
      setPassword("");
      setConfirmPassword("");
      redirectToCheckEmail(email, "agent");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      const fallback = error instanceof Error ? error.message : "We could not create the agent account. Please try again.";
      setMessage(getFriendlyAuthMessage(error, fallback));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <input className="input" name="fullName" placeholder="Full name" />
      <input
        className="input"
        name="email"
        placeholder="Email"
        type="email"
        onChange={(e) => {
          e.currentTarget.value = e.currentTarget.value.toLowerCase();
        }}
      />
      <input className="input" name="phone" placeholder="Phone e.g. 08031234567" />
      <input className="input" name="ninNumber" inputMode="numeric" maxLength={11} placeholder="NIN number (11 digits)" />
      <PasswordField name="password" placeholder="Password" value={password} onChange={setPassword} />
      <PasswordField
        name="confirmPassword"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />
      <TurnstileFields />
      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <input
          name="acceptedLegalTerms"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="font-bold text-teal-700 underline">
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-bold text-teal-700 underline">
            Privacy Policy
          </Link>
          , including the agent listing, fraud prevention, verification, and reporting rules.
        </span>
      </label>
      <button className="button-primary inline-flex w-full items-center justify-center gap-2" disabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : null}
        {isSubmitting ? "Creating agent account..." : "Create agent account"}
      </button>
      {message ? <p className={`text-sm ${messageType === "success" ? "text-emerald-700" : "text-rose-600"}`}>{message}</p> : null}
    </form>
  );
}
