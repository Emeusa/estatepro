import type { Metadata } from "next";

import { Header } from "@/components/layout/header";

import "./globals.css";

export const metadata: Metadata = {
  title: "EstatePro",
  description: "Fast and mobile-first property listing marketplace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
