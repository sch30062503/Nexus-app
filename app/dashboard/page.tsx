"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  signal_score: number | null;
  is_founder: boolean | null;
};

type Message = {
  id: string;
  content: string;
  created_at: string;
  profile_id: string;
  is_founder_msg: boolean;
  profiles?: { email: string };
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Auth Sync
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return router.replace("/");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData) setProfile(profileData as Profile);
      setLoading(false);
    };
    load();
  }, [router]);

  // 2. Realtime Messages Logic
  useEffect(() => {
    if (!profile) return;

    // Initial Fetch
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles(email)")
        .order("created_at", { ascending: true })
        .limit(20);
      if (data) setMessages(data as any);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel("nexus-wall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        async (payload) => {
          const { data: userData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", payload.new.profile_id)
            .single();
          
          const msgWithProfile = { ...payload.new, profiles: userData } as Message;
          setMessages((prev) => [...prev.slice(-19), msgWithProfile]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    await supabase.from("messages").insert({
      content: newMessage,
      profile_id: profile.id,
      is_founder_msg: profile.is_founder
    });
    setNewMessage("");
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse">Establishing Uplink...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-zinc-300 md:p-10">
      <div className="mx-auto max-w-3xl">
        {/* Header - Compact */}
        <div className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
          <span className="text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">Node::{profile.email?.split('@')[0]}</span>
          <button onClick={() => supabase.auth.signOut().then(() => router.push("/"))} className="text-[10px] text-zinc-600 hover:text-red-400 uppercase">Disconnect</button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Stats Sidebar */}
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${profile.is_founder ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
              <p className="text-[9px] uppercase text-zinc-500 mb-1">Status</p>
              <p className={`text-xs font-bold ${profile.is_founder ? 'text-amber-400' : 'text-emerald-400'}`}>
                {profile.is_founder ? "GENESIS FOUNDER" : "CITIZEN"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-[9px] uppercase text-zinc-500 mb-1">Signal Score</p>
              <p className="text-xl text-emerald-400">{profile.signal_score}</p>
            </div>
          </div>

          {/* Main Signal Wall */}
          <div className="md:col-span-2 flex flex-col h-[500px] border border-zinc-800 rounded-lg bg-zinc-900/20">
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 flex justify-between">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Signal_Wall.log</span>
              <span className="text-[10px] text-emerald-500/50 animate-pulse">LIVE</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className="text-xs">
                  <span className={`font-bold ${msg.is_founder_msg ? 'text-amber-500' : 'text-emerald-600'}`}>
                    [{msg.profiles?.email?.split('@')[0] || 'Unknown'}]:
                  </span>
                  <span className="ml-2 text-zinc-300 break-words">{msg.content}</span>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={sendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900/40">
              <input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Broadcast a signal..."
                className="w-full bg-transparent border-none outline-none text-xs text-emerald-400 placeholder:text-zinc-700"
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
