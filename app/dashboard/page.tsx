"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

// --- Types ---
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
  profiles?: { email: string, signal_score: number }; // Added score to profile fetch
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
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Helper: Visual Weighting Logic ---
  const getMessageStyle = (score: number, isFounder: boolean) => {
    if (isFounder) return {
      container: "bg-amber-500/10 border-l-4 border-amber-500 py-3 px-4 my-2 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      name: "text-amber-400 font-black text-sm tracking-tighter uppercase",
      content: "text-amber-100 text-sm font-medium",
      badge: "GENESIS"
    };
    if (score >= 2000) return {
      container: "bg-emerald-500/5 border-l-2 border-emerald-500 py-2 px-3 my-1 animate-pulse",
      name: "text-emerald-400 font-bold text-xs uppercase",
      content: "text-emerald-50 text-xs",
      badge: "ALPHA"
    };
    if (score >= 500) return {
      container: "py-1 px-2 border-l border-emerald-900/50",
      name: "text-emerald-600 font-bold text-[10px]",
      content: "text-zinc-200 text-xs",
      badge: "SENTRY"
    };
    return {
      container: "py-1 px-2",
      name: "text-zinc-600 font-medium text-[10px]",
      content: "text-zinc-400 text-xs",
      badge: "CITIZEN"
    };
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, signal_score, is_founder")
      .eq("is_founder", false)
      .order("signal_score", { ascending: false })
      .limit(5);
    if (data) setLeaderboard(data as Profile[]);
  };

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return router.replace("/");

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData as Profile);

      const { data: decreeData } = await supabase.from("decrees").select("content").eq("id", 1).single();
      if (decreeData) setDecree(decreeData.content);

      // Fetch messages with profile scores for weighting
      const { data: msgData } = await supabase.from("messages").select("*, profiles(email, signal_score)").order("created_at", { ascending: true }).limit(25);
      if (msgData) setMessages(msgData as any);

      await fetchLeaderboard();
      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const msgChannel = supabase.channel("nexus-wall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        async (payload) => {
          const { data: userData } = await supabase.from("profiles").select("email, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev.slice(-24), { ...payload.new, profiles: userData } as Message]);
          fetchLeaderboard();
        })
      .subscribe();

    const feverChannel = supabase.channel('global-events')
      .on('broadcast', { event: 'FEVER_TOGGLE' }, (payload) => setFeverMode(payload.payload.active))
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(feverChannel);
    };
  }, [profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown) return;
    setIsCooldown(true);

    const { error } = await supabase.from("messages").insert({ 
      content: newMessage, 
      profile_id: profile.id, 
      is_founder_msg: profile.is_founder 
    });

    if (!error && !profile.is_founder) {
      const gain = feverMode ? 10 : 5;
      await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: gain });
      setProfile(prev => prev ? { ...prev, signal_score: (prev.signal_score || 0) + gain } : null);
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 1500);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse">Establishing Uplink...</div>;

  return (
    <div className={`min-h-screen transition-all duration-700 font-mono p-4 md:p-10 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#0a0a0a]'}`}>
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-2 border-2 bg-black text-[10px] font-bold tracking-widest uppercase border-emerald-500 text-emerald-500">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-4">
        {/* SIDEBAR */}
        <div className="space-y-4 md:col-span-1">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[9px] uppercase text-zinc-500 mb-1">Authenticated_As</p>
            <p className={`text-xs font-bold ${profile.is_founder ? 'text-amber-400' : 'text-emerald-400'}`}>
              {profile.email?.split('@')[0].toUpperCase()}
            </p>
            <p className="text-[18px] mt-2 text-white font-black">{profile.signal_score?.toLocaleString()}</p>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[9px] uppercase text-zinc-500 mb-3 tracking-widest text-center">Hall_of_Power</p>
            {leaderboard.map((user, i) => (
              <div key={user.id} className="flex justify-between text-[10px] mb-1">
                <span className="text-zinc-600">{i+1}.</span>
                <span className="text-zinc-400 uppercase">{user.email?.split('@')[0]}</span>
                <span className="text-emerald-500 font-bold">{user.signal_score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNAL WALL */}
        <div className="md:col-span-3 flex flex-col h-[700px] border border-zinc-800 bg-black/40 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Live_Signal_Feed</span>
            {feverMode && <span className="text-[9px] text-red-500 animate-pulse font-black">FEVER ACTIVE (2X)</span>}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {messages.map((msg) => {
              const style = getMessageStyle(msg.profiles?.signal_score || 0, msg.is_founder_msg);
              return (
                <div key={msg.id} className={`group transition-all rounded ${style.container}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={style.name}>
                      {style.badge} // {msg.profiles?.email?.split('@')[0]}
                    </span>
                    <span className="text-[8px] text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={style.content}>{msg.content}</p>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 bg-zinc-900/20">
            <input 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              disabled={isCooldown}
              placeholder={isCooldown ? "RECHARGING..." : "INPUT SIGNAL..."} 
              className="w-full bg-transparent border-none outline-none text-xs text-emerald-400 placeholder:text-zinc-800"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
