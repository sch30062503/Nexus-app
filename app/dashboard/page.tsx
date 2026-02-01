"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Radio, User, Wallet, ChevronUp, Globe, Activity, BarChart3 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Logic to separate the Public Lobby from Gated Niches
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const gatedNiches = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    
    if (pData) setProfile(pData);
    if (dData) setDistricts(dData);
    setLoading(false);
  };

  const switchChannel = async (district: any) => {
    setView('chat');
    setActiveDistrict(district);
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 text-[10px] animate-pulse uppercase tracking-[0.5em]">Establishing_Uplink</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- HUD NAVIGATION --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        
        {/* 1. ADMIN BASE */}
        <button 
          onClick={() => setView('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest text-shadow-glow">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        {/* 2. THE LOBBY (Always Open) */}
        {theLobby && (
          <button 
            onClick={() => switchChannel(theLobby)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
          >
            <Globe size={16} />
            <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
          </button>
        )}

        {/* 3. GATED NICHES */}
        <div className="flex items-center gap-6 ml-4">
          {gatedNiches.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            const isActive = view === 'chat' && (activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug);
            return (
              <button 
                key={n.slug}
                disabled={isLocked}
                onClick={() => switchChannel(n)}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all 
                  ${isActive ? 'text-white border-b-2 border-emerald-500 pb-1' : isLocked ? 'text-zinc-800 cursor-not-allowed' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {isLocked && <Lock size={10} />}
                {n.name}
              </button>
            );
          })}
        </div>

        {/* 4. SCORE HUD */}
        <div className="ml-auto text-right">
          <p className="text-[8px] font-black text-zinc-600 uppercase">Power_Level</p>
          <p className="text-emerald-500 text-sm font-black tracking-tighter tabular-nums">{profile.signal_score.toLocaleString()}</p>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* MAIN VIEWPORT */}
        <main className="flex-1 overflow-y-auto bg-[#020202]">
          {view === 'admin' ? (
            /* --- DASHBOARD MODE --- */
            <div className="max-w-4xl mx-auto p-12 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 border border-white/5 bg-zinc-900/20 rounded-lg space-y-6">
                  <header>
                    <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest">User_Profile</h2>
                    <p className="text-2xl font-black text-white uppercase">{profile.username || 'ANON_USER'}</p>
                  </header>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold">
                      <span className="text-zinc-500">Signal Balance</span>
                      <span className="text-white">{profile.signal_to_spend} SP</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '40%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-8 border border-white/5 bg-zinc-900/20 rounded-lg flex flex-col justify-center text-center">
                  <p className="text-[10px] font-black text-zinc-600 uppercase mb-2 text-center">Sector Unlock Status</p>
                  <p className="text-xs text-zinc-400">Head to <span className="text-blue-400 font-bold">The Lobby</span> to earn points and unlock premium sectors.</p>
                </div>
              </div>
            </div>
          ) : (
            /* --- TERMINAL/CHAT MODE --- */
            <div className="h-full flex flex-col">
              <div className="flex-1 p-8 overflow-y-auto space-y-6">
                {messages.length === 0 && (
                  <p className="text-[10px] text-zinc-800 uppercase text-center mt-20">No signals detected in this sector...</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="max-w-3xl flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-600 uppercase group-hover:text-emerald-500 transition-colors">{m.profiles?.username}</span>
                      <span className="text-[7px] text-zinc-800">[{m.profiles?.signal_score}]</span>
                    </div>
                    <p className="text-[14px] text-zinc-300 leading-relaxed font-medium">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              {/* MESSAGE INPUT */}
              <div className="p-8 bg-black">
                <form className="max-w-3xl mx-auto flex bg-white/5 border border-white/10 rounded overflow-hidden">
                  <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder={`TRANSMIT SIGNAL...`} />
                  <button className="px-6 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all font-black text-xs uppercase">Broadcast</button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}