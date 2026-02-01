"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronUp, Lock, Hash, Zap, Radio, LayoutGrid, ShieldCheck, TrendingUp } from "lucide-react";

interface District { slug: string; name: string; min_score: number; parent_slug?: string; }
interface Profile { id: string; username: string | null; signal_score: number; }
interface Message { id: string; content: string; profiles?: { username: string | null, signal_score: number } }

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Logic for the Top Bar vs Sidebar
  const lobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const niches = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);
  
  // The Sidebar only populates if we are in a niche or a sub-room of a niche
  const currentNiche = useMemo(() => {
    if (!activeDistrict || activeDistrict.slug === 'lobby') return null;
    return districts.find(d => d.slug === (activeDistrict.parent_slug || activeDistrict.slug));
  }, [activeDistrict, districts]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    
    if (pData) setProfile(pData as Profile);
    if (dData) {
      setDistricts(dData);
      const start = dData.find(d => d.slug === 'lobby') || dData[0];
      setActiveDistrict(start);
      fetchChat(start.slug);
    }
    setLoading(false);
  };

  const fetchChat = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(50);
    if (data) setMessages(data as any);
  };

  const transmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;
    const { error } = await supabase.rpc('submit_signal', { user_id: profile.id, signal_content: newMessage, target_hub: activeDistrict.slug });
    if (!error) setNewMessage("");
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-white text-[10px] animate-pulse uppercase tracking-[0.4em]">Establishing_Connection</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#050505] text-zinc-400 font-mono overflow-hidden">
      
      {/* --- TOP NAVIGATION BAR --- */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        {/* TOP LEFT: LOBBY */}
        <button 
          onClick={() => { setActiveDistrict(lobby!); fetchChat('lobby'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Lobby</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        {/* TOP CENTER: NICHES */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {niches.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            const isActive = activeDistrict?.slug === n.slug || activeDistrict?.parent_slug === n.slug;
            return (
              <button 
                key={n.slug}
                disabled={isLocked}
                onClick={() => { setActiveDistrict(n); fetchChat(n.slug); }}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter transition-all 
                  ${isActive ? 'text-white' : isLocked ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {isLocked && <Lock size={10} />}
                {n.name}
              </button>
            );
          })}
        </div>

        {/* TOP RIGHT: GLOBAL SCORE */}
        <div className="ml-auto text-right">
          <span className="text-[8px] font-black uppercase text-zinc-700 block">Total_Signal</span>
          <span className="text-emerald-500 text-sm font-black tracking-tighter tabular-nums">{profile.signal_score.toLocaleString()}</span>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- CONTEXTUAL SIDEBAR (Only shows for Niches) --- */}
        {currentNiche && (
          <aside className="w-64 border-r border-white/5 bg-black p-6 flex flex-col gap-8 animate-in slide-in-from-left duration-300">
            <div>
              <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">{currentNiche.name}_Sector</h2>
              <div className="space-y-4">
                <div className="p-3 bg-white/5 border border-white/5 rounded">
                  <span className="text-[8px] text-zinc-500 uppercase block mb-1">Local Rank</span>
                  <span className="text-white text-xs font-black">STRIKER [Tier 1]</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded">
                  <span className="text-[8px] text-zinc-500 uppercase block mb-1">Niche Points</span>
                  <span className="text-emerald-500 text-xs font-black">4,209 SP</span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <span className="text-[8px] font-black text-zinc-700 uppercase block mb-4">Internal_Nodes</span>
              <div className="flex flex-col gap-2">
                {districts.filter(d => d.parent_slug === currentNiche.slug).map(sub => (
                  <button 
                    key={sub.slug}
                    onClick={() => { setActiveDistrict(sub); fetchChat(sub.slug); }}
                    className={`text-left text-[10px] p-2 rounded transition-all ${activeDistrict?.slug === sub.slug ? 'bg-white/10 text-white font-bold' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    # {sub.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* --- MAIN TERMINAL --- */}
        <main className="flex-1 flex flex-col bg-[#020202]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {messages.map((m) => (
              <div key={m.id} className="max-w-3xl flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-white/40 uppercase">{m.profiles?.username || 'ANON'}</span>
                  <span className="text-[8px] font-bold text-emerald-500/20 tracking-tighter">{m.profiles?.signal_score}</span>
                </div>
                <p className="text-[14px] text-zinc-400 leading-relaxed font-medium">{m.content}</p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="p-6 border-t border-white/5">
            <form onSubmit={transmit} className="max-w-3xl flex items-center bg-white/5 border border-white/10 px-4 rounded focus-within:border-emerald-500/50 transition-all">
              <input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`SEND SIGNAL TO ${activeDistrict?.name?.toUpperCase()}...`}
                className="flex-1 bg-transparent py-4 text-xs text-white outline-none font-bold placeholder:text-zinc-800 uppercase tracking-widest"
              />
              <button type="submit" className="text-zinc-700 hover:text-emerald-500 transition-colors">
                <ChevronUp size={20} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}