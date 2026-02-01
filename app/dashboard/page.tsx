"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, 
  Layers, SlidersHorizontal, ShieldCheck, Zap 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [noiseThreshold, setNoiseThreshold] = useState(0); // The "Tuner" state
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const niches = useMemo(() => districts.filter(d => d.slug !== 'lobby' && !d.parent_slug), [districts]);
  
  // Sidebar logic: Find sub-tiers for the current niche
  const currentTiers = useMemo(() => {
    if (!activeDistrict || activeDistrict.slug === 'lobby') return [];
    const parentSlug = activeDistrict.parent_slug || activeDistrict.slug;
    return districts.filter(d => d.parent_slug === parentSlug);
  }, [activeDistrict, districts]);

  const isNicheActive = useMemo(() => view === 'chat' && activeDistrict?.slug !== 'lobby', [view, activeDistrict]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);
    setProfile(pRes.data);
    setDistricts(dRes.data || []);
    setLoading(false);
  };

  const enterRoom = async (district: any) => {
    setView('chat');
    setActiveDistrict(district);
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", district.slug).order("created_at", { ascending: true }).limit(50);
    setMessages(data || []);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse uppercase tracking-[0.4em]">Establishing_Uplink</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* TOP NAVIGATION */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} /> <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button onClick={() => enterRoom(theLobby)} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}>
              <Globe size={16} /> Lobby
            </button>
          )}

          {niches.map(n => {
            const locked = profile.signal_score < n.min_score;
            return (
              <button key={n.slug} disabled={locked} onClick={() => enterRoom(n)} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'chat' && (activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug) ? 'text-white border-b-2 border-emerald-500 pb-1' : locked ? 'text-zinc-800' : 'text-zinc-600 hover:text-white'}`}>
                {locked && <Lock size={10} />} {n.name}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* TIERED SIDEBAR (NICHE ONLY) */}
        {isNicheActive && (
          <aside className="w-64 border-r border-white/5 bg-black p-6 flex flex-col animate-in slide-in-from-left">
            <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <Layers size={14} /> Available_Tiers
            </h2>
            <div className="space-y-3">
              {currentTiers.map(tier => {
                const isTierLocked = profile.signal_score < tier.min_score;
                return (
                  <button 
                    key={tier.slug}
                    disabled={isTierLocked}
                    onClick={() => enterRoom(tier)}
                    className={`w-full flex items-center justify-between p-3 rounded border transition-all 
                      ${activeDistrict.slug === tier.slug ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.02] border-white/5 text-zinc-500 hover:text-white'}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-tighter">{tier.name}</span>
                    {isTierLocked ? <Lock size={12} className="text-zinc-800" /> : <Zap size={12} className="text-emerald-500 shadow-glow" />}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* MAIN TERMINAL */}
        <main className="flex-1 overflow-y-auto bg-[#020202] flex flex-col">
          {view === 'admin' ? (
            /* DASHBOARD VIEW */
            <div className="max-w-4xl mx-auto p-12 space-y-12">
               <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Admin_Control</h1>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-lg">
                  <Wallet className="text-emerald-500 mb-4" size={24} />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spendable Signal</p>
                  <p className="text-3xl font-black text-white">{profile.signal_to_spend}</p>
                </div>
              </div>
            </div>
          ) : (
            /* CHAT VIEW WITH TUNER */
            <div className="h-full flex flex-col">
              {/* THE TUNER HUD */}
              <div className="px-8 py-3 bg-black border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal size={14} className="text-zinc-600" />
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Frequency_Tuner</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[8px] font-bold text-zinc-800">NOISE_FILTER</span>
                  <input 
                    type="range" min="0" max="5000" step="500" 
                    value={noiseThreshold}
                    onChange={(e) => setNoiseThreshold(parseInt(e.target.value))}
                    className="w-32 accent-emerald-500 h-1 bg-zinc-900 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] font-black text-emerald-500 tabular-nums">{noiseThreshold} SP</span>
                </div>
              </div>

              {/* MESSAGES */}
              <div className="flex-1 p-8 overflow-y-auto space-y-8 scrollbar-hide">
                {messages.filter(m => (m.profiles?.signal_score || 0) >= noiseThreshold).map((m) => (
                  <div key={m.id} className="max-w-3xl animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username} • {m.profiles?.signal_score}</p>
                    <p className="text-[15px] text-zinc-300 leading-relaxed">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              {/* BROADCAST INPUT */}
              <div className="p-8 border-t border-white/5">
                <form className="max-w-3xl mx-auto flex bg-white/5 border border-white/10 rounded overflow-hidden">
                  <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase placeholder:text-zinc-900" placeholder={`TRANSMIT_TO_${activeDistrict?.name?.toUpperCase()}...`} />
                  <button className="px-8 text-emerald-500 font-black text-xs uppercase hover:bg-emerald-500 hover:text-black transition-all">Broadcast</button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}