"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ChevronUp, Radio, Zap, Hash, Lock, ChevronRight, 
  Activity, Target, Shield, Users, Trophy 
} from "lucide-react";

// --- CONTRACTS ---
interface District { slug: string; name: string; min_score: number; parent_slug?: string; }
interface Profile { id: string; username: string | null; signal_score: number; }
interface Message { id: string; content: string; profiles?: { username: string | null, signal_score: number } }

export default function DashboardPage() {
  const router = useRouter();
  
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- DERIVED UI STATES (The Funnel) ---
  const { lobby, sectors } = useMemo(() => ({
    lobby: districts.find(d => d.slug === 'lobby' || d.min_score === 0),
    sectors: districts.filter(d => !d.parent_slug && d.slug !== 'lobby' && d.min_score > 0)
  }), [districts]);

  const subRooms = useMemo(() => {
    if (!activeDistrict) return [];
    const parentSlug = activeDistrict.parent_slug || activeDistrict.slug;
    return districts.filter(d => d.parent_slug === parentSlug);
  }, [districts, activeDistrict]);

  const score = profile?.signal_score || 0;
  const unlockProgress = Math.min((score / 500) * 100, 100);

  // --- ACTIONS ---
  const loadInitialData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) setProfile(pData as Profile);
    
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      const start = dData.find(d => d.slug === 'lobby') || dData[0];
      setActiveDistrict(start);
      fetchChat(start.slug);
    }
    setLoading(false);
  };

  const fetchChat = async (slug: string) => {
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", slug)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data as any);
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;
    
    const { error } = await supabase.rpc('submit_signal', { 
      user_id: profile.id, 
      signal_content: newMessage, 
      target_hub: activeDistrict.slug 
    });

    if (!error) {
      setNewMessage("");
      // Logic for score updates would go here
    }
  };

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 tracking-tighter animate-pulse">BOOTING_NEXUS_OS...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-500 font-mono overflow-hidden">
      
      {/* 1. TOP HUD */}
      <header className="border-b border-white/5 bg-black p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Signal_Live</span>
        </div>
        <div className="flex gap-6 items-center">
          <div className="text-right">
            <p className="text-[8px] uppercase font-bold text-zinc-600">Your_Score</p>
            <p className="text-emerald-500 text-xs font-black">{score.toLocaleString()}</p>
          </div>
          <button className="p-2 border border-white/10 rounded hover:bg-white/5"><Trophy size={14}/></button>
        </div>
      </header>

      {/* 2. PROGRESS BAR */}
      <div className="bg-black/50 px-4 py-1.5 flex items-center gap-4 border-b border-white/5">
        <span className="text-[7px] font-black uppercase text-zinc-500">Sector_Unlock</span>
        <div className="flex-1 h-[2px] bg-zinc-900 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${unlockProgress}%` }} />
        </div>
        <span className="text-[8px] font-black text-emerald-500">{unlockProgress.toFixed(0)}%</span>
      </div>

      {/* 3. MULTI-LEVEL NAVIGATION */}
      <nav className="border-b border-white/5 bg-black">
        {/* Level 1: Lobby & Sectors */}
        <div className="flex items-center gap-2 p-3 overflow-x-auto no-scrollbar">
          {lobby && (
            <button 
              onClick={() => { setActiveDistrict(lobby); fetchChat(lobby.slug); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all
                ${activeDistrict?.slug === lobby.slug ? 'bg-white text-black' : 'text-zinc-600 hover:text-white'}`}
            >
              Lobby
            </button>
          )}
          {sectors.map(s => {
            const locked = score < 500;
            const active = activeDistrict?.slug === s.slug || activeDistrict?.parent_slug === s.slug;
            return (
              <button 
                key={s.slug}
                disabled={locked}
                onClick={() => { setActiveDistrict(s); fetchChat(s.slug); }}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 transition-all
                  ${active ? 'bg-emerald-500 text-black' : locked ? 'opacity-20 cursor-not-allowed' : 'text-zinc-600 hover:text-white'}`}
              >
                {locked && <Lock size={10} />} {s.name}
              </button>
            );
          })}
        </div>

        {/* Level 2: Gated Rooms (Conditional) */}
        {activeDistrict?.slug !== 'lobby' && subRooms.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-2 bg-zinc-900/30 border-t border-white/5">
            <span className="text-[8px] font-black text-zinc-700 uppercase">Sub_Channels:</span>
            {subRooms.map(r => {
              const locked = score < r.min_score;
              return (
                <button
                  key={r.slug}
                  disabled={locked}
                  onClick={() => { setActiveDistrict(r); fetchChat(r.slug); }}
                  className={`text-[9px] font-black uppercase flex items-center gap-1
                    ${activeDistrict?.slug === r.slug ? 'text-emerald-400 underline' : locked ? 'text-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  #{r.name} {locked && `[${r.min_score}]`}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* 4. TERMINAL CHAT */}
      <main className="flex-1 flex flex-col bg-black">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.map((m) => (
            <div key={m.id} className="max-w-2xl mx-auto w-full group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black text-emerald-500/50 uppercase">{m.profiles?.username || 'ANON'}</span>
                <div className="h-[1px] flex-1 bg-white/5" />
                <span className="text-[8px] text-zinc-800 font-bold">{m.profiles?.signal_score}</span>
              </div>
              <p className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors leading-relaxed">
                {m.content}
              </p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* 5. INPUT COMMAND */}
        <div className="p-4 border-t border-white/5 bg-black">
          <form onSubmit={transmitSignal} className="max-w-2xl mx-auto flex items-center gap-4">
            <span className="text-emerald-500 font-black text-xs">{'>'}</span>
            <input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`COMMAND_${activeDistrict?.name?.toUpperCase()}...`}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white font-bold placeholder:text-zinc-800 uppercase"
            />
            <button type="submit" className="text-zinc-700 hover:text-emerald-500 transition-colors">
              <ChevronUp size={20} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}