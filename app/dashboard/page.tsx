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
  const [decree, setDecree] = useState("");
  const [isEditingDecree, setIsEditingDecree] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return router.replace("/");

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData as Profile);

      const { data: decreeData } = await supabase.from("decrees").select("content").eq("id", 1).single();
      if (decreeData) setDecree(decreeData.content);

      // Fetch initial messages
      const { data: msgData } = await supabase.from("messages").select("*, profiles(email)").order("created_at", { ascending: true }).limit(20);
      if (msgData) setMessages(msgData as any);

      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!profile) return;

    // Presence & Realtime Channels
    const decreeChannel = supabase.channel("decree-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "decrees" }, 
        (payload) => setDecree(payload.new.content))
      .subscribe();

    const msgChannel = supabase.channel("nexus-wall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        async (payload) => {
          const { data: userData } = await supabase.from("profiles").select("email").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev.slice(-19), { ...payload.new, profiles: userData } as Message]);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" },
        (payload) => setMessages((prev) => prev.filter(m => m.id !== payload.old.id)))
      .subscribe();

    // Presence Channel (Who is online)
    const presenceChannel = supabase.channel('online-users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(decreeChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [profile]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateDecree = async () => {
    await supabase.from("decrees").update({ content: decree }).eq("id", 1);
    setIsEditingDecree(false);
  };

  const burnMessage = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;
    await supabase.from("messages").insert({ content: newMessage, profile_id: profile.id, is_founder_msg: profile.is_founder });
    setNewMessage("");
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse">Establishing Uplink...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-zinc-300 md:p-10">
      <div className="mx-auto max-w-3xl">
        
        {/* DECREE */}
        <div className="mb-8 overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <div className="flex items-center justify-between bg-amber-500/10 px-4 py-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-500">Active Decree</span>
            {profile.is_founder && (
              <button onClick={() => isEditingDecree ? updateDecree() : setIsEditingDecree(true)} className="text-[9px] uppercase text-amber-500/70 hover:text-amber-500">
                {isEditingDecree ? "[SAVE_CHANGES]" : "[EDIT_DECREE]"}
              </button>
            )}
          </div>
          <div className="p-4 text-center">
            {isEditingDecree ? (
              <textarea value={decree} onChange={(e) => setDecree(e.target.value)} className="w-full bg-transparent border border-amber-500/30 p-2 text-sm text-amber-200 outline-none" rows={2} />
            ) : (
              <p className="text-sm font-medium italic tracking-wide text-amber-200">"{decree}"</p>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex items-center justify-between">
              <p className="text-[9px] uppercase text-zinc-500">Active Nodes</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm text-emerald-500 font-bold">{onlineCount}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col h-[450px] border border-zinc-800 rounded-lg bg-zinc-900/20">
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Signal_Wall.log</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="group flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-bold ${msg.is_founder_msg ? 'text-amber-500' : 'text-emerald-600'}`}>
                      [{msg.profiles?.email?.split('@')[0] || 'Unknown'}]:
                    </span>
                    <span className="ml-2 text-zinc-300">{msg.content}</span>
                  </div>
                  {profile.is_founder && (
                    <button onClick={() => burnMessage(msg.id)} className="hidden group-hover:block text-[9px] text-red-500/50 hover:text-red-500 uppercase">
                      [Burn]
                    </button>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900/40">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Broadcast a signal..." className="w-full bg-transparent border-none outline-none text-xs text-emerald-400" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
