import type { Metadata } from "next";

import { ClientRegisterForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = {
  title: "Create Account",
  robots: {
    index: false,
    follow: false
  }
};

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign up as a client to save time, manage your activity, and contact agents faster.
        </p>
      </div>
      <ClientRegisterForm />
    </section>
  );
}
