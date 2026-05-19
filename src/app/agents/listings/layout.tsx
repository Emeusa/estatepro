import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Listings",
  robots: {
    index: false,
    follow: false
  }
};

export default function AgentListingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
