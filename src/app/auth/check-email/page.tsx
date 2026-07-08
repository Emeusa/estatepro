import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckEmailClient } from "@/app/auth/check-email/check-email-client";

export const metadata: Metadata = {
  title: "Check Your Email",
  robots: {
    index: false,
    follow: false
  }
};

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailClient />
    </Suspense>
  );
}
