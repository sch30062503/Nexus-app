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
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [toast, setToast] = useState<string | null>(null); // NEW: Notification state
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, signal_score, is_founder")
      .eq("is_founder", false)
      .order("signal_score", { ascending: false })
      .limit(5);
    
    if (data) {
      // Logic for Founder Notification
      if (profile?.is_founder && leaderboard.length > 0) {
        const newTopUser = data[0];
        const oldTopUser = leaderboard[0];
        if (newTopUser.id !== oldTopUser.id && newTopUser.signal_score! > oldTopUser.signal_score!) {
          triggerToast(`NEW ALPHA DETECTED: ${newTopUser.email?.split('@')[0].toUpperCase()}`);
        }
      }
      setLeaderboard(data as Profile[]);
    }
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

      const { data: msgData } = await supabase.from("messages").select("*, profiles(email)").order("created_at", { ascending: true }).limit(20);
      if (msgData) setMessages(msgData as any);

      await fetchLeaderboard();
      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!profile) return;

    const feverChannel = supabase.channel('global-events')
      .on('broadcast', { event: 'FEVER_TOGGLE' }, (payload) => {
        setFeverMode(payload.payload.active);
        if (payload.payload.active) triggerToast("FEVER MODE ENGAGED");
      })
      .subscribe();

    const msgChannel = supabase.channel("nexus-wall")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        async (payload) => {
          const { data: userData } = await supabase.from("profiles").select("email").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev.slice(-19), { ...payload.new, profiles: userData } as Message]);
          fetchLeaderboard();
        })
      .subscribe();

    const presenceChannel = supabase.channel('online-users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(presenceChannel.presenceState()).length);
        fetchLeaderboard();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(feverChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [profile]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleFever = () => {
    const newState = !feverMode;
    setFeverMode(newState);
    supabase.channel('global-events').send({
      type: 'broadcast',
      event: 'FEVER_TOGGLE',
      payload: { active: newState },
    });
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
    const { error } = await supabase.from("messages").insert({ 
      content: newMessage, 
      profile_id: profile.id, 
      is_founder_msg: profile.is_founder 
    });

    if (!error) {
      const baseGain = 5;
      const multiplier = feverMode ? 2 : 1;
      const gainAmount = profile.is_founder ? 0 : baseGain * multiplier;
      if (gainAmount > 0) {
        await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: gainAmount });
        setProfile(prev => prev ? { ...prev, signal_score: (prev.signal_score || 0) + gainAmount } : null);
        fetchLeaderboard();
      }
    }

    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 2000);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse">Establishing Uplink...</div>;

  return (
    <div className={`min-h-screen transition-all duration-700 font-mono p-4 md:p-10 ${
      feverMode ? 'bg-[#1a0505] text-red-100' : 'bg-[#0a0a0a] text-zinc-300'
    }`}>
      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-6 py-2 border-2 text-[10px] font-bold tracking-[0.3em] uppercase ${
            feverMode ? 'bg-red-900 border-red-500 text-red-100 shadow-[0_0_20px_red]' : 'bg-zinc-900 border-emerald-500 text-emerald-500'
          }`}>
            {toast}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        {/* DECREE BLOCK */}
        <div className={`mb-8 overflow-hidden rounded-lg border transition-all duration-500 ${
          feverMode ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-amber-500/40 bg-amber-500/5'
        }`}>
          <div className={`flex items-center justify-between px-4 py-1 ${feverMode ? 'bg-red-500/20' : 'bg-amber-500/10'}`}>
            <span className={`text-[9px] font-bold uppercase tracking-[0.3em] ${feverMode ? 'text-red-400' : 'text-amber-500'}`}>
              {feverMode ? "FEVER MODE ACTIVE" : "Active Decree"}
            </span>
            {profile.is_founder && (
              <button onClick={() => isEditingDecree ? updateDecree() : setIsEditingDecree(true)} className="text-[9px] uppercase hover:opacity-80">
                {isEditingDecree ? "[SAVE]" : "[EDIT]"}
              </button>
            )}
          </div>
          <div className="p-4 text-center">
            {isEditingDecree ? (
              <textarea value={decree} onChange={(e) => setDecree(e.target.value)} className="w-full bg-transparent border border-zinc-800 p-2 text-sm outline-none" rows={2} />
            ) : (
              <p className={`text-sm font-medium italic ${feverMode ? 'text-red-200' : 'text-amber-200'}`}>"{decree}"</p>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {/* SIDEBAR */}
          <div className="space-y-4 md:col-span-1">
            <div className={`rounded-lg border p-4 ${feverMode ? 'border-red-500/50 bg-red-900/20' : 'border-zinc-800 bg-zinc-900/40'}`}>
              <p className="text-[9px] uppercase text-zinc-500 mb-1">Status</p>
              <p className={`text-xs font-bold ${feverMode ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {profile.is_founder ? "GENESIS FOUNDER" : "CITIZEN"}
              </p>
            </div>

            <div className={`rounded-lg border p-4 ${feverMode ? 'border-red-500/30 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/40'}`}>
              <p className="text-[9px] uppercase text-zinc-500 mb-3 tracking-widest text-center">Presence_Grid</p>
              <div className="grid grid-cols-4 gap-2">
                <div className={`h-8 flex items-center justify-center border rounded ${feverMode ? 'border-red-500 text-red-500 animate-ping' : 'border-amber-500 text-amber-500'}`}>⬢</div>
                {Array.from({ length: Math.max(0, onlineCount - 1) }).map((_, i) => (
                  <div key={i} className={`h-8 flex items-center justify-center border rounded animate-pulse ${feverMode ? 'border-red-400/30 text-red-400' : 'border-emerald-500/30 text-emerald-500'}`}>⬡</div>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${feverMode ? 'border-red-500/30 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/40'}`}>
              <p className="text-[9px] uppercase text-zinc-500 mb-3 tracking-widest text-center">Hall_of_Power</p>
              <div className="space-y-2">
                {leaderboard.map((user, index) => (
                  <div key={user.id} className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-600">0{index + 1}.</span>
                    <span className="truncate max-w-[60px]">{user.email?.split('@')[0].toUpperCase()}</span>
                    <span className={feverMode ? 'text-red-400' : 'text-emerald-500'}>{user.signal_score}</span>
                  </div>
                ))}
              </div>
            </div>

            {profile.is_founder && (
              <button onClick={toggleFever} className="w-full rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/20">
                {feverMode ? "End Fever" : "Trigger Fever"}
              </button>
            )}
          </div>

          {/* SIGNAL WALL */}
          <div className={`md:col-span-3 flex flex-col h-[600px] border rounded-lg ${feverMode ? 'border-red-500/40 bg-red-950/10' : 'border-zinc-800 bg-zinc-900/20'}`}>
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Signal_Wall.log</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="group flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-bold ${msg.is_founder_msg ? 'text-amber-500' : 'text-emerald-600'}`}>
                      [{msg.profiles?.email?.split('@')[0]}]:
                    </span>
                    <span className="ml-2 text-zinc-300">{msg.content}</span>
                  </div>
                  {profile.is_founder && (
                    <button onClick={() => burnMessage(msg.id)} className="hidden group-hover:block text-[9px] text-red-500 uppercase">[Burn]</button>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t border-zinc-800 bg-black/40">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} placeholder={isCooldown ? "RECHARGING..." : "Broadcast signal..."} className="w-full bg-transparent border-none outline-none text-xs text-emerald-400" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
