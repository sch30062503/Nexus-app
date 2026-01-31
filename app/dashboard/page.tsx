"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  signal_score: number | null;
  is_founder: boolean | null;
};

/** Mask the part before @ (local part only). e.g. "john" → "jo***" */
function maskEmailLocal(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  if (local.length <= 2) return `${local}***`;
  return `${local.slice(0, 2)}***`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardSync, setLeaderboardSync] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, signal_score, is_founder")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profileData) {
        router.replace("/");
        return;
      }

      setProfile(profileData as Profile);
      setLoading(false);
    };

    load();
  }, [router]);

  useEffect(() => {
    if (!profile) return;

    const fetchLeaderboard = async () => {
      setLeaderboardSync(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, signal_score, is_founder")
        .order("signal_score", { ascending: false })
        .limit(5);

      if (!error && data) {
        setLeaderboard(data as Profile[]);
      }
      setLeaderboardLoading(false);
      setLeaderboardSync(false);
    };

    fetchLeaderboard();
  }, [profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] font-mono text-emerald-400/80">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const isFounder = profile.is_founder === true;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 font-mono text-zinc-300">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
          <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-500/90">
            nexus://dashboard
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border border-zinc-600 bg-zinc-900/80 px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            Logout
          </button>
        </div>

        {/* Security Clearance card */}
        <div
          className={`rounded-lg border p-6 ${
            isFounder
              ? "border-amber-500/60 bg-amber-500/5 shadow-[0_0_24px_rgba(245,158,11,0.15)]"
              : "border-zinc-700/80 bg-zinc-900/30"
          }`}
        >
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Security Clearance
          </p>
          <p
            className={`text-xl font-medium uppercase tracking-wider ${
              isFounder ? "text-amber-400" : "text-emerald-400/90"
            }`}
          >
            {isFounder ? "GENESIS FOUNDER" : "CLEARED"}
          </p>
        </div>

        {/* Signal score */}
        <div className="mt-6 rounded-lg border border-zinc-700/80 bg-zinc-900/30 p-6">
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Signal
          </p>
          <p className="text-3xl font-medium tabular-nums text-emerald-400">
            {profile.signal_score ?? 0}
          </p>
        </div>

        {/* Global Leaderboard */}
        <div className="mt-6 rounded-lg border border-zinc-700/80 bg-zinc-900/30 p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              Global Leaderboard
            </p>
            {leaderboardSync && (
              <span className="nexus-sync-pulse text-[10px] uppercase tracking-wider text-emerald-500/80">
                Syncing…
              </span>
            )}
          </div>
          {leaderboardLoading ? (
            <p className="text-[11px] text-zinc-500">Loading leaderboard…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {leaderboard.map((entry, i) => {
                const isFounderRow = entry.is_founder === true;
                return (
                  <li
                    key={entry.id}
                    className="nexus-leaderboard-row flex items-center justify-between border-b border-zinc-800/60 py-2.5 pr-2 text-[13px]"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="tabular-nums text-zinc-500">#{i + 1}</span>
                    <span
                      className={`min-w-0 flex-1 truncate px-3 ${
                        isFounderRow ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      {maskEmailLocal(entry.email)}
                    </span>
                    <span
                      className={`tabular-nums font-medium ${
                        isFounderRow ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {entry.signal_score ?? 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Email (optional) */}
        {profile.email && (
          <p className="mt-6 text-[11px] text-zinc-500">
            <span className="text-zinc-600">Logged in as </span>
            {profile.email}
          </p>
        )}
      </div>
    </div>
  );
}
