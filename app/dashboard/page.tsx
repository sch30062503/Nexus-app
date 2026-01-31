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
  profiles?: { email: string, signal_score: number };
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
    const { data } = await supabase.from("profiles").select("id, email, signal_score, is_founder").eq("is_founder", false).order("signal_score", { ascending: false }).limit(5);
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
      const { data: msgData } = await supabase.from("messages").select("*, profiles(email, signal_score)").order("created_at", { ascending: true }).limit(25);
      if (msgData) setMessages(msgData as any);
      await fetchLeaderboard();
      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const msgChannel = supabase.channel("nexus-wall").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        async (payload) => {
          const { data: userData } = await supabase.from("profiles").select("email, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev.slice(-24), { ...payload.new, profiles: userData } as Message]);
          fetchLeaderboard();
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => setMessages((prev) => prev.filter(m => m.id !== payload.old.id)))
      .subscribe();

    const feverChannel = supabase.channel('global-events').on('broadcast', { event: 'FEVER_TOGGLE' }, (payload) => setFeverMode(payload.payload.active)).subscribe();
    const presenceChannel = supabase.channel('online-users');
    presenceChannel.on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presenceChannel.presenceState()).length)).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
      });

    return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(feverChannel); supabase.removeChannel(presenceChannel); };
  }, [profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const toggleFever = () => {
    const newState = !feverMode;
    setFeverMode(newState);
    supabase.channel('global-events').send({ type: 'broadcast', event: 'FEVER_TOGGLE', payload: { active: newState } });
    triggerToast(newState ? "FEVER ENGAGED" : "FEVER EXPIRED");
  };

  const updateDecree = async () => {
    await supabase.from("decrees").update({ content: decree }).eq("id", 1);
    setIsEditingDecree(false);
    triggerToast("DECREE UPDATED");
  };

  const burnMessage = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
    triggerToast("SIGNAL PURGED");
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown) return;
    setIsCooldown(true);
    const { error } = await supabase.from("messages").insert({ content: newMessage, profile_id: profile.id, is_founder_msg: profile.is_founder });
    if (!error && !profile.is_founder) {
      const gain = feverMode ? 10 : 5;
      await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: gain });
      setProfile(prev => prev ? { ...prev, signal_score: (prev.signal_score || 0) + gain } : null);
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 1500);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center uppercase tracking-widest">Establishing Uplink...</div>;

  return (
    <div className={`min-h-screen transition-all duration-700 font-mono flex flex-col ${feverMode ? 'bg-[#1a0505]' : 'bg-[#0a0a0a]'}`}>
      {/* GLOBAL DECREE BAR */}
      <div className={`w-full py-2 px-4 border-b flex justify-between items-center transition-colors ${feverMode ? 'bg-red-500/20 border-red-500' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <div className="flex gap-4 items-center overflow-hidden">
          <span className={`text-[9px] font-black uppercase tracking-widest ${feverMode ? 'text-red-400' : 'text-amber-500'}`}>Global_Decree:</span>
          {isEditingDecree ? (
            <input value={decree} onChange={(e) => setDecree(e.target.value)} className="bg-transparent border-b border-white/20 text-[11px] text-white outline-none w-[400px]" onBlur={updateDecree} autoFocus />
          ) : (
            <p className="text-[11px] text-white/80 italic truncate">"{decree}"</p>
          )}
        </div>
        {profile.is_founder && <button onClick={() => setIsEditingDecree(true)} className="text-[9px] text-zinc-500 hover:text-white transition-colors">[MOD_DECREE]</button>}
      </div>

      <div className="flex-1 flex overflow-hidden p-4 md:p-8 gap-6 max-w-7xl mx-auto w-full">
        {/* SIDEBAR */}
        <aside className="w-64 flex flex-col gap-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[9px] uppercase text-zinc-500 mb-1">Authenticated</p>
            <p className={`text-xs font-bold ${profile.is_founder ? 'text-amber-400' : 'text-emerald-400'}`}>{profile.email?.split('@')[0].toUpperCase()}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl text-white font-black">{profile.signal_score?.toLocaleString()}</span>
              <span className="text-[9px] text-zinc-600 uppercase">Signal</span>
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col items-center">
            <p className="text-[9px] uppercase text-zinc-500 mb-3 tracking-widest">Presence_Grid</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className={`h-6 w-6 flex items-center justify-center border rounded ${feverMode ? 'border-red-500 text-red-500 animate-ping' : 'border-amber-500 text-amber-500'}`}>⬢</div>
              {Array.from({ length: Math.max(0, onlineCount - 1) }).map((_, i) => (
                <div key={i} className="h-6 w-6 flex items-center justify-center border border-emerald-500/30 text-emerald-500/50 animate-pulse rounded text-[8px]">⬡</div>
              ))}
            </div>
            <p className="text-[8px] text-zinc-600 uppercase">{onlineCount} Active Nodes</p>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[9px] uppercase text-zinc-500 mb-3 tracking-widest text-center">Hall_of_Power</p>
            {leaderboard.map((user, i) => (
              <div key={user.id} className="flex justify-between text-[10px] mb-2 items-center">
                <span className="text-zinc-600 font-bold">#0{i+1}</span>
                <span className="text-zinc-400 uppercase truncate max-w-[60px]">{user.email?.split('@')[0]}</span>
                <span className="text-emerald-500 font-bold">{user.signal_score}</span>
              </div>
            ))}
          </div>

          {profile.is_founder && (
            <button onClick={toggleFever} className={`mt-auto rounded border p-4 text-[10px] uppercase font-black tracking-[0.2em] transition-all ${feverMode ? 'border-zinc-700 bg-zinc-800 text-zinc-500 shadow-none' : 'border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]'}`}>
              {feverMode ? "TERMINATE FEVER" : "INITIATE FEVER"}
            </button>
          )}
        </aside>

        {/* MAIN WALL */}
        <main className="flex-1 flex flex-col border border-zinc-800 bg-black/40 rounded-lg overflow-hidden relative shadow-2xl">
          <div className={`p-4 border-b border-zinc-800 flex justify-between items-center ${feverMode ? 'bg-red-950/20' : 'bg-zinc-900/50'}`}>
            <span className="text-[10px] uppercase tracking-[0.5em] text-zinc-500">Live_Signal_Feed</span>
            {toast && <span className="text-[10px] font-bold text-white uppercase animate-pulse">{toast}</span>}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {messages.map((msg) => {
              const style = getMessageStyle(msg.profiles?.signal_score || 0, msg.is_founder_msg);
              return (
                <div key={msg.id} className={`group relative transition-all rounded ${style.container}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={style.name}><span className="opacity-40 mr-1">&gt;</span>{style.badge} // {msg.profiles?.email?.split('@')[0]}</span>
                    {profile.is_founder && (
                      <button onClick={() => burnMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-[8px] bg-red-600 text-white px-2 py-0.5 rounded uppercase font-bold transition-all">Burn</button>
                    )}
                  </div>
                  <p className={style.content}>{msg.content}</p>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 bg-black/60">
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} placeholder={isCooldown ? "ACCESSING NEXT SIGNAL..." : "TRANSMIT DATA..."} className="w-full bg-transparent border-none outline-none text-xs text-emerald-400 placeholder:text-zinc-800 font-bold tracking-wider" />
          </form>
        </main>
      </div>
    </div>
  );
}
