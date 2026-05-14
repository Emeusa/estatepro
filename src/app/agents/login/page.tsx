import type { Metadata } from "next";

import { LoginForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = {
  title: "Agent Login",
  robots: {
    index: false,
    follow: false
  }
};

export default function AgentLoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Login</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in and you will be redirected to the correct dashboard for your account.
        </p>
      </div>
      <LoginForm />
    </section>
  );
}
