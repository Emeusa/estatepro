import type { Metadata } from "next";

import { ResetPasswordClient } from "@/app/auth/reset-password/reset-password-client";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: {
    index: false,
    follow: false
  }
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
