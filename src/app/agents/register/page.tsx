import type { Metadata } from "next";

import { AgentRegisterForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = {
  title: "Agent Registration",
  robots: {
    index: false,
    follow: false
  }
};

export default function AgentRegisterPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Become a verified agent</h1>
        <p className="mt-2 text-sm text-slate-500">
          Submit your details with either NIN or CAC verification to start listing properties.
        </p>
      </div>
      <AgentRegisterForm />
    </section>
  );
}
