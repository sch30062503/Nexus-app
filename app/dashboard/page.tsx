"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, User, Wallet, BarChart3, Activity 
} from "lucide-react";

// --- TYPES ---
interface District { slug: string; name: string; min_score: number; parent_slug?: string; }
interface Profile { id: string; username: string | null; signal_score: number; signal_to_spend: number; }

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- NAVIGATION LOGIC ---
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const nicheSectors = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    
    if (pData) setProfile(pData as Profile);
    if (dData) setDistricts(dData);
    setLoading(false);
  };

  const enterChannel = async (district: District) => {
    setView('chat');
    setActiveDistrict(district);
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 text-[10px] uppercase animate-pulse tracking-[0.4em]">Establishing_Uplink</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- TOP HUD --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        
        {/* DASHBOARD (ADMIN) */}
        <button 
          onClick={() => setView('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        {/* THE LOBBY (PUBLIC) */}
        {theLobby && (
          <button 
            onClick={() => enterChannel(theLobby)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
          >
            <Globe size={16} />
            <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
          </button>
        )}

        {/* NICHES (GATED) */}
        <div className="flex items-center gap-6">
          {nicheSectors.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            const isActive = view === 'chat' && (activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug);
            return (
              <button 
                key={n.slug}
                disabled={isLocked}
                onClick={() => enterChannel(n)}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all 
                  ${isActive ? 'text-white border-b-2 border-emerald-500 pb-1' : isLocked ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {isLocked && <Lock size={10} />}
                {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto">
          <span className="text-emerald-500 text-sm font-black tabular-nums">{profile.signal_score.toLocaleString()} SP</span>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto bg-[#020202]">
        {view === 'admin' ? (
          /* DASHBOARD VIEW (PREVIOUSLY LIKED) */
          <div className="max-w-4xl mx-auto p-12 space-y-12">
            <header className="space-y-2">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Account_Admin</h1>
              <p className="text-xs text-zinc-500">Identity: {profile.username || 'ANONYMOUS_UNIT'}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                <Wallet className="text-emerald-500" size={24} />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Signal to Spend</p>
                  <p className="text-xl font-black text-white">{profile.signal_to_spend?.toLocaleString() || 0}</p>
                </div>
              </div>
              <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                <BarChart3 className="text-blue-500" size={24} />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Power Level</p>
                  <p className="text-xl font-black text-white">{profile.signal_score.toLocaleString()}</p>
                </div>
              </div>
              <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                <Activity className="text-purple-500" size={24} />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Status</p>
                  <p className="text-xl font-black text-white uppercase">Active</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TERMINAL VIEW (CHAT) */
          <div className="h-full flex flex-col">
            <div className="flex-1 p-8 overflow-y-auto space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="max-w-3xl">
                  <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username} • {m.profiles?.signal_score}</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{m.content}</p>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <div className="p-8">
              <form className="max-w-3xl flex bg-white/5 border border-white/10 rounded overflow-hidden">
                <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder={`TRANSMIT TO ${activeDistrict?.name}...`} />
                <button className="px-6 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all font-black text-xs uppercase">Broadcast</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}