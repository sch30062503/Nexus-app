"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, Activity, Hash, Zap 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Nav categories
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const nicheSectors = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

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

  useEffect(() => { loadNexus(); }, []);

  if (loading || !profile) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse text-[10px] tracking-[0.5em]">
      SYNCING_USER_DATA
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
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button 
              onClick={() => { setView('chat'); setActiveDistrict(theLobby); }}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all 
                ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {nicheSectors.map(n => (
            <button 
              key={n.slug}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-800 cursor-not-allowed"
              disabled
            >
              <Lock size={10} /> {n.name}
            </button>
          ))}
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto bg-[#020202]">
        {view === 'admin' ? (
          /* DASHBOARD VIEW */
          <div className="max-w-6xl mx-auto p-12 space-y-12 animate-in fade-in duration-700">
            
            {/* 1. IDENTITY HEADER */}
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

            {/* 2. STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 bg-zinc-900/30 border border-white/5 hover:border-emerald-500/30 transition-all">
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

            {/* 3. ACTIVITY LOG */}
            <div className="border border-white/5 bg-black/40 rounded-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/10">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Hash size={12} className="text-emerald-500" /> Recent_Network_Events
                </h3>
              </div>
              <div className="p-6 space-y-4 font-mono text-[10px]">
                <div className="flex justify-between items-center opacity-60">
                  <span className="text-zinc-500">2026.02.01 // 12:00:00</span>
                  <span className="text-emerald-500">+100 SP</span>
                  <span className="text-white uppercase">Profile_Initialization_Bonus</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SIMPLE LOBBY REDIRECT MSG */
          <div className="h-full flex flex-col items-center justify-center p-20 space-y-4">
            <p className="text-xs uppercase tracking-widest font-black text-white">Entering The Lobby...</p>
            <p className="text-[10px] text-zinc-500 max-w-sm text-center">Prepare your signals. This is where your power begins.</p>
          </div>
        )}
      </main>
    </div>
  );
}