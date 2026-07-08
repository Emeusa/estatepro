"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  CONFIRMATION_ACCOUNT_TYPE_STORAGE_KEY,
  CONFIRMATION_EMAIL_STORAGE_KEY,
  ConfirmationAccountType
} from "@/lib/auth-confirmation";

type ConfirmationState = {
  email: string;
  accountType: ConfirmationAccountType | null;
};

function readConfirmationState(): ConfirmationState {
  try {
    const email = window.sessionStorage.getItem(CONFIRMATION_EMAIL_STORAGE_KEY)?.trim() ?? "";
    const storedType = window.sessionStorage.getItem(CONFIRMATION_ACCOUNT_TYPE_STORAGE_KEY);
    const accountType = storedType === "agent" || storedType === "client" ? storedType : null;
    return { email, accountType };
  } catch {
    return { email: "", accountType: null };
  }
}

export function CheckEmailClient() {
  const [state, setState] = useState<ConfirmationState>({ email: "", accountType: null });

  useEffect(() => {
    setState(readConfirmationState());
  }, []);

  const registerHref = state.accountType === "agent" ? "/agents/register" : "/register";
  const title = state.email ? `Check ${state.email}` : "Check your email";

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-none stroke-current stroke-2">
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Confirm your account</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We sent a confirmation link to the email address you entered. Open that email and click the confirmation
          button before signing in.
        </p>

        {state.accountType === "agent" ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your agent profile can still be reviewed, but dashboard access requires email confirmation first.
          </p>
        ) : null}

        <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          If you do not see the email, check your spam or promotions folder. Use the same email address when you log in
          after confirmation.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary text-center" href="/login">
            Go to login
          </Link>
          <Link
            className="rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            href={registerHref}
          >
            Register with another email
          </Link>
        </div>
      </div>
    </section>
  );
}
