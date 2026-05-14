import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default function AgentDashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
