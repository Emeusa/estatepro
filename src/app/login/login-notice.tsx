"use client";

import { useSearchParams } from "next/navigation";

import { getLoginConfirmationMessage } from "@/lib/auth-confirmation";

export function LoginNotice() {
  const searchParams = useSearchParams();
  const message = getLoginConfirmationMessage(searchParams.get("confirmed"));

  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      {message}
    </div>
  );
}
