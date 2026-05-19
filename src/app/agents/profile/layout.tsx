import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Profile",
  robots: {
    index: false,
    follow: false
  }
};

export default function AgentProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
