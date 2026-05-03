import { AgentRegisterForm } from "@/components/forms/auth-forms";

export default function AgentRegisterPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Become a verified agent</h1>
        <p className="mt-2 text-sm text-slate-500">
          Submit your details and verification documents to start listing properties.
        </p>
      </div>
      <AgentRegisterForm />
    </section>
  );
}
