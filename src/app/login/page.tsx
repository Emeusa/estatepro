import { LoginForm } from "@/components/forms/auth-forms";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Login</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to continue browsing, managing enquiries, or accessing your workspace.
        </p>
      </div>
      <LoginForm />
    </section>
  );
}
