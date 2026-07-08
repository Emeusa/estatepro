import type { Metadata } from "next";

import { CheckEmailClient } from "@/app/auth/check-email/check-email-client";

export const metadata: Metadata = {
  title: "Check Your Email",
  robots: {
    index: false,
    follow: false
  }
};

export default function CheckEmailPage() {
  return <CheckEmailClient />;
}
