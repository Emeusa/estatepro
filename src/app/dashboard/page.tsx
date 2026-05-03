"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

type ClientAccount = {
  user: {
    fullName: string;
    email: string;
    phone: string | null;
    role: "client" | "agent" | "admin";
  } | null;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<ClientAccount["user"] | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Loading your account...");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Sign in first to access your dashboard.");
        }
        return;
      }

      try {
        const response = await apiRequest<ClientAccount>("/api/auth/me", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (response.user?.role === "agent") {
          router.replace("/agents/dashboard");
          return;
        }
        if (response.user?.role === "admin") {
          router.replace("/admin");
          return;
        }
        if (active) {
          setAccount(response.user);
          setFullName(response.user?.fullName ?? "");
          setPhone(response.user?.phone ?? "");
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load your account.");
        }
      }
    }

    loadAccount();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadAccount();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMessage("Your session expired. Sign in again.");
      return;
    }

    try {
      const response = await apiRequest<ClientAccount>("/api/auth/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          fullName,
          phone: phone.trim() || undefined
        })
      });
      setAccount(response.user);
      setPhone(response.user?.phone ?? "");
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your profile.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!account) {
    return <p className="text-sm text-slate-500">{message}</p>;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{account.fullName}</h1>
          <p className="mt-2 text-sm text-slate-500">{account.email}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Account actions</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Update your profile details here or sign out of your account.
          </p>
          <button className="button-secondary mt-5" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
      <form onSubmit={saveProfile} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Edit profile</h2>
        <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <input
          className="input"
          placeholder="Phone number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <button className="button-primary">Save changes</button>
        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </form>
    </section>
  );
}
