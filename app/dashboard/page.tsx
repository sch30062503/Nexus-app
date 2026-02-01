"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, Activity, Hash, Zap, Radio 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  
  // --- STATE ---
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- NAVIGATION CATEGORIES ---
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const nicheSectors = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  // --- CORE DATA LOADING ---
  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);

    if (pRes.data) setProfile(pRes.data);
    if (dRes.data) setDistricts(dRes.data);
    setLoading(false);
  };

  // --- LOBBY/CHAT LOGIC ---
  const enterRoom = async (district: any) => {
    setView('chat');
    setActiveDistrict(district);
    
    // Fetch initial messages
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(50);
    
    if (data) setMessages(data);

    // Setup Realtime Subscription
    const channel = supabase.channel(`room:${district.slug}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `district_slug=eq.${district.slug}` }, 
      async (payload) => {
        const { data: userProfile } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.user_id).single();
        const newMessageObj = { ...payload.new, profiles: userProfile };
        setMessages((prev) => [...prev, newMessageObj]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;

    // Use RPC to submit signal and earn points
    const { error } = await supabase.rpc('submit_signal', {
      user_id: profile.id,
      signal_content: newMessage,
      target_hub: activeDistrict.slug
    });

    if (!error) {
      setNewMessage("");
      // Refresh profile to update score after mining
      const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (data) setProfile(data);
    }
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse text-[10px] tracking-[0.5em]">
      SYNCING_SYSTEM_RESOURCES
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- MASTER NAVIGATION --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button 
          onClick={() => setView('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all 
            ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest text-shadow-glow">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button 
              onClick={() => enterRoom(theLobby)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all 
                ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {nicheSectors.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            return (
              <button 
                key={n.slug}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all
                  ${isLocked ? 'text-zinc-800 cursor-not-allowed' : 'text-zinc-600 hover:text-white'}`}
                disabled={isLocked}
                onClick={() => enterRoom(n)}
              >
                {isLocked && <Lock size={10} />} {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto text-right">
          <p className="text-[8px] font-black text-zinc-600 uppercase">Signal_Score</p>
          <p className="text-emerald-500 text-sm font-black tabular-nums">{profile.signal_score?.toLocaleString()}</p>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto bg-[#020202]">
        {view === 'admin' ? (
          /* --- DASHBOARD VIEW (LOCKED) --- */
          <div className="max-w-6xl mx-auto p-12 space-y-12 animate-in fade-in duration-700">
            <header className="flex justify-between items-end border-b border-white/5 pb-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Node_Operator</p>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username || "ANON_UNIT"}</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase font-black">System_Status</p>
                <p className="text-emerald-500 font-bold uppercase tracking-widest">Authorized</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Wallet className="text-emerald-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spendable_Signal</p>
                <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{profile.signal_to_spend || 0}</p>
              </div>

              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <BarChart3 className="text-blue-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Power_Level</p>
                <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{profile.signal_score || 0}</p>
              </div>

              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Activity className="text-purple-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Access_Progression</p>
                <div className="mt-4 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7]" style={{ width: '12%' }} />
                </div>
                <p className="text-[8px] text-zinc-600 mt-2 uppercase italic tracking-tighter">Mining required for niche access...</p>
              </div>
            </div>

            <div className="border border-white/5 bg-black/40 rounded-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/10">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Hash size={12} className="text-emerald-500" /> Recent_Network_Events
                </h3>
              </div>
              <div className="p-6 space-y-4 font-mono text-[10px]">
                <div className="flex justify-between items-center opacity-60 font-mono">
                  <span className="text-zinc-500">INIT // 00:00:00</span>
                  <span className="text-emerald-500">SYSTEM READY</span>
                  <span className="text-white uppercase">Identity_Linked</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* --- THE LOBBY (MINING ZONE) --- */
          <div className="h-full flex flex-col relative animate-in slide-in-from-bottom duration-500">
            
            {/* LOBBY HEADER HUD */}
            <div className="px-8 py-3 border-b border-white/5 bg-black/80 backdrop-blur-md flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Radio className="text-blue-400 animate-pulse" size={14} />
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live_Mining_Feed</span>
              </div>
              <div className="text-[9px] font-black text-zinc-700 uppercase">
                Nodes_Active: <span className="text-emerald-500">4,102</span>
              </div>
            </div>

            {/* MESSAGE FEED */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center opacity-20">
                  <p className="text-xs uppercase font-black tracking-widest">No signals detected in the Lobby...</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="max-w-4xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-black text-white/50 uppercase">{m.profiles?.username || 'ANON_UNIT'}</span>
                    <span className="text-[8px] font-bold text-emerald-500/20 tabular-nums tracking-tighter">[{m.profiles?.signal_score}]</span>
                  </div>
                  <div className="bg-white/[0.02] border-l border-white/5 p-4 rounded-r-md">
                    <p className="text-[15px] text-zinc-300 leading-relaxed font-medium selection:bg-emerald-500 selection:text-black">
                      {m.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            {/* TRANSMISSION INPUT */}
            <div className="p-8 border-t border-white/5 bg-black">
              <form onSubmit={transmitSignal} className="max-w-4xl mx-auto group">
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded-sm focus-within:border-emerald-500/50 focus-within:bg-emerald-500/[0.02] transition-all overflow-hidden shadow-2xl">
                  <div className="pl-4 text-zinc-700">
                    <Zap size={14} className="group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="TRANSMIT_SIGNAL_TO_MINE_POINTS..."
                    className="flex-1 bg-transparent p-5 text-xs text-white outline-none font-bold uppercase tracking-widest placeholder:text-zinc-800"
                  />
                  <button 
                    type="submit" 
                    className="h-full px-8 bg-zinc-900 border-l border-white/10 text-emerald-500 font-black text-xs uppercase hover:bg-emerald-500 hover:text-black transition-all active:scale-95"
                  >
                    Broadcast
                  </button>
                </div>
                <div className="flex justify-between mt-3 px-1">
                  <p className="text-[8px] text-zinc-600 uppercase font-black">Secure_Encryption: AES-256</p>
                  <p className="text-[8px] text-emerald-500/50 uppercase font-black">Earn +5 SP per unique signal</p>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}