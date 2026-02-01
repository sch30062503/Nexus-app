"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ChevronUp, Lock, LayoutGrid, Zap, User, 
  Settings, CreditCard, Activity, BarChart3, Wallet 
} from "lucide-react";

interface District { slug: string; name: string; min_score: number; parent_slug?: string; }
interface Profile { id: string; username: string | null; signal_score: number; signal_to_spend: number; }

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isDashboardMode, setIsDashboardMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const niches = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);
  const currentNiche = useMemo(() => {
    if (isDashboardMode || !activeDistrict) return null;
    return districts.find(d => d.slug === (activeDistrict.parent_slug || activeDistrict.slug));
  }, [activeDistrict, districts, isDashboardMode]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    
    if (pData) setProfile(pData as Profile);
    if (dData) setDistricts(dData);
    setLoading(false);
  };

  const enterNiche = async (district: District) => {
    setIsDashboardMode(false);
    setActiveDistrict(district);
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", district.slug).order("created_at", { ascending: true }).limit(50);
    if (data) setMessages(data);
  };

  useEffect(() => { loadData(); }, []);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 text-[10px] uppercase animate-pulse tracking-[0.5em]">System_Initializing</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- TOP HUD --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button 
          onClick={() => setIsDashboardMode(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${isDashboardMode ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {niches.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            const isActive = !isDashboardMode && (activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug);
            return (
              <button 
                key={n.slug}
                disabled={isLocked}
                onClick={() => enterNiche(n)}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all 
                  ${isActive ? 'text-white underline underline-offset-8 decoration-emerald-500' : isLocked ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {isLocked && <Lock size={10} />}
                {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="px-3 py-1 bg-zinc-900 rounded border border-white/5">
            <span className="text-[10px] font-black text-emerald-500">{profile.signal_score.toLocaleString()} SP</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- DYNAMIC SIDEBAR --- */}
        {!isDashboardMode && currentNiche && (
          <aside className="w-64 border-r border-white/5 bg-black p-6 flex flex-col animate-in fade-in slide-in-from-left duration-300">
            <div className="mb-8">
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Activity size={14} className="text-emerald-500" /> {currentNiche.name}
              </h2>
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded">
                <p className="text-[8px] text-zinc-500 uppercase">Sector Points</p>
                <p className="text-emerald-500 text-xs font-black tracking-widest">RANK: ELITE</p>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-[9px] font-black text-zinc-700 uppercase mb-4">Channels</p>
              <div className="space-y-1">
                {districts.filter(d => d.parent_slug === currentNiche.slug).map(sub => (
                  <button 
                    key={sub.slug}
                    onClick={() => enterNiche(sub)}
                    className={`w-full text-left text-[10px] p-2 rounded transition-all ${activeDistrict?.slug === sub.slug ? 'bg-white/5 text-white' : 'text-zinc-600 hover:text-white'}`}
                  >
                    # {sub.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 overflow-y-auto bg-[#020202]">
          {isDashboardMode ? (
            /* ADMIN SECTION / ACCOUNT OVERVIEW */
            <div className="max-w-4xl mx-auto p-12 space-y-12 animate-in fade-in zoom-in-95 duration-500">
              <header className="space-y-2">
                <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Account_Admin</h1>
                <p className="text-xs text-zinc-500">Manage your credentials and signal balance.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                  <Wallet className="text-emerald-500" size={24} />
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Signal to Spend</p>
                    <p className="text-xl font-black text-white">45,000</p>
                  </div>
                  <button className="w-full py-2 bg-emerald-500 text-black text-[10px] font-black uppercase rounded hover:bg-emerald-400 transition-colors">
                    Access Marketplace
                  </button>
                </div>
                
                <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                  <BarChart3 className="text-blue-500" size={24} />
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Lifetime Earned</p>
                    <p className="text-xl font-black text-white">{profile.signal_score.toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg space-y-4">
                  <User className="text-zinc-400" size={24} />
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Identity</p>
                    <p className="text-xl font-black text-white truncate">{profile.username || 'ANON'}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 border border-white/5 rounded-lg bg-black">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6">Recent Activity Log</h3>
                <div className="space-y-4 opacity-50 text-[10px]">
                  <p className="flex justify-between border-b border-white/5 pb-2"><span>Auth_Login_Success</span> <span>2026.02.01</span></p>
                  <p className="flex justify-between border-b border-white/5 pb-2"><span>Signal_Transmission_Lobby</span> <span>+10 SP</span></p>
                  <p className="flex justify-between border-b border-white/5 pb-2"><span>Access_Grant_Finance_Sector</span> <span>UNLOCKED</span></p>
                </div>
              </div>
            </div>
          ) : (
            /* TERMINAL MODE (Chat) */
            <div className="h-full flex flex-col">
              <div className="flex-1 p-8 overflow-y-auto space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="max-w-3xl">
                    <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username} • {m.profiles?.signal_score}</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="p-8">
                <form className="max-w-3xl flex bg-white/5 border border-white/10 rounded overflow-hidden">
                  <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder={`TRANSMIT TO ${activeDistrict?.name}...`} />
                  <button className="px-6 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all font-black text-xs uppercase">Send</button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}