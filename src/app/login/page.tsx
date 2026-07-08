import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/forms/auth-forms";
import { LoginNotice } from "@/app/login/login-notice";

export const metadata: Metadata = {
  title: "Login",
  robots: {
    index: false,
    follow: false
  }
};

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Login</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to continue browsing, managing enquiries, or accessing your workspace.
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <LoginForm />
    </section>
  );
}
