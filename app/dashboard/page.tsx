"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, Activity, Hash 
} from "lucide-react";

// --- CORE TYPES ---
interface District { slug: string; name: string; min_score: number; parent_slug?: string; }
interface Profile { id: string; username: string | null; signal_score: number; signal_to_spend: number; }

export default function DashboardPage() {
  const router = useRouter();
  
  // State Management
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- NAVIGATION CATEGORIES ---
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const nicheSectors = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  // --- DATA INITIALIZATION ---
  const loadSystem = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    // Fetch User Profile & Hubs
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);

    if (pRes.data) setProfile(pRes.data as Profile);
    if (dRes.data) setDistricts(dRes.data as District[]);
    setLoading(false);
  };

  const enterHub = async (district: District) => {
    setView('chat');
    setActiveDistrict(district);
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  };

  useEffect(() => { loadSystem(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse uppercase tracking-[0.4em]">
      Initializing_Secure_Terminal
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- MASTER HUD NAVIGATION --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        
        {/* LEFT: ADMIN DASHBOARD */}
        <button 
          onClick={() => setView('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all 
            ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        {/* CENTER: LOBBY & NICHES */}
        <div className="flex items-center gap-6">
          {/* THE LOBBY */}
          {theLobby && (
            <button 
              onClick={() => enterHub(theLobby)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all 
                ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {/* DYNAMIC NICHES */}
          {nicheSectors.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            const isActive = view === 'chat' && (activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug);
            return (
              <button 
                key={n.slug}
                disabled={isLocked}
                onClick={() => enterHub(n)}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all 
                  ${isActive ? 'text-white border-b-2 border-emerald-500 pb-1' : isLocked ? 'text-zinc-800 cursor-not-allowed' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {isLocked && <Lock size={10} />}
                {n.name}
              </button>
            );
          })}
        </div>

        {/* RIGHT: GLOBAL STATS */}
        <div className="ml-auto flex items-center gap-6">
          <div className="text-right">
            <p className="text-[8px] font-black text-zinc-600 uppercase">Signal_Score</p>
            <p className="text-emerald-500 text-sm font-black tabular-nums">{profile.signal_score.toLocaleString()}</p>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- DYNAMIC SIDEBAR (Only for Niche Hubs) --- */}
        {!view.includes('admin') && activeDistrict?.slug !== 'lobby' && (
          <aside className="w-64 border-r border-white/5 bg-black p-6 flex flex-col gap-6 animate-in slide-in-from-left duration-300">
             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Niche_Status</h3>
                <div className="p-4 bg-white/5 rounded border border-white/5">
                    <p className="text-[8px] text-zinc-500 uppercase">Tier</p>
                    <p className="text-white text-xs font-black uppercase">Alpha_Contributor</p>
                </div>
             </div>
          </aside>
        )}

        {/* --- MAIN CONTENT WINDOW --- */}
        <main className="flex-1 overflow-y-auto bg-[#020202]">
          {view === 'admin' ? (
            /* ADMIN DASHBOARD VIEW */
            <div className="max-w-5xl mx-auto p-12 space-y-12 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-lg">
                  <Wallet className="text-emerald-500 mb-4" size={24} />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Spendable Signal</p>
                  <p className="text-3xl font-black text-white">{profile.signal_to_spend?.toLocaleString()}</p>
                </div>
                <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-lg">
                  <BarChart3 className="text-blue-500 mb-4" size={24} />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Network Rank</p>
                  <p className="text-3xl font-black text-white">#402</p>
                </div>
                <div className="p-8 bg-zinc-900/20 border border-white/5 rounded-lg">
                  <Activity className="text-purple-500 mb-4" size={24} />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">System Status</p>
                  <p className="text-3xl font-black text-white uppercase">Active</p>
                </div>
              </div>
            </div>
          ) : (
            /* TERMINAL CHAT VIEW */
            <div className="h-full flex flex-col relative">
              <div className="flex-1 p-8 overflow-y-auto space-y-8 scrollbar-hide">
                {messages.map((m) => (
                  <div key={m.id} className="max-w-3xl flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-white/40 uppercase">{m.profiles?.username}</span>
                      <span className="text-[8px] font-bold text-emerald-500/20 tracking-tighter">[{m.profiles?.signal_score}]</span>
                    </div>
                    <p className="text-[15px] text-zinc-300 leading-relaxed">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              {/* INPUT BAR */}
              <div className="p-8 border-t border-white/5 bg-black">
                <div className="max-w-3xl mx-auto flex bg-white/5 border border-white/10 rounded overflow-hidden">
                  <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase placeholder:text-zinc-800" placeholder="TRANSMIT_SIGNAL..." />
                  <button className="px-8 text-emerald-500 font-black text-xs uppercase hover:bg-emerald-500 hover:text-black transition-all">Broadcast</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}