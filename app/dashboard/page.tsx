"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronUp, Lock, Hash, Zap, Radio } from "lucide-react";

// --- CONTRACTS ---
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

  // --- CLEANER LOGIC ---
  const sectors = useMemo(() => districts.filter(d => !d.parent_slug), [districts]);
  const subRooms = useMemo(() => 
    districts.filter(d => d.parent_slug === (activeDistrict?.parent_slug || activeDistrict?.slug))
  , [districts, activeDistrict]);

  const score = profile?.signal_score || 0;

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

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-white text-[10px] tracking-[0.5em] animate-pulse">LOADING_NEXUS</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-zinc-500 font-mono overflow-hidden selection:bg-emerald-500 selection:text-black">
      
      {/* 1. MINIMAL HUD */}
      <header className="p-6 flex justify-between items-end border-b border-white/[0.03]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]" />
            <span className="text-white text-xs font-black uppercase tracking-widest">Signal_System</span>
          </div>
          <div className="text-[9px] font-bold uppercase tracking-tighter opacity-40">
            {activeDistrict?.parent_slug ? `${activeDistrict.parent_slug} / ${activeDistrict.name}` : activeDistrict?.name}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] uppercase font-black opacity-30 block">Power_Level</span>
          <span className="text-white text-lg font-black tracking-tighter tabular-nums">{score.toLocaleString()}</span>
        </div>
      </header>

      {/* 2. GHOST NAVIGATION */}
      <nav className="px-6 py-4 flex gap-8 overflow-x-auto no-scrollbar border-b border-white/[0.03] bg-[#030303]">
        {sectors.map(s => {
          const isLocked = score < s.min_score;
          const isActive = activeDistrict?.slug === s.slug || activeDistrict?.parent_slug === s.slug;
          return (
            <button 
              key={s.slug}
              disabled={isLocked}
              onClick={() => { setActiveDistrict(s); fetchChat(s.slug); }}
              className={`group flex flex-col items-start gap-1 transition-all ${isLocked ? 'opacity-10' : 'opacity-100'}`}
            >
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500' : 'text-zinc-500 group-hover:text-white'}`}>
                {s.name}
              </span>
              <div className={`h-[1px] w-full transition-all ${isActive ? 'bg-emerald-500' : 'bg-transparent'}`} />
            </button>
          );
        })}
      </nav>

      {/* 3. CHAT FEED (Zen Mode) */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-10 scrollbar-hide">
          {messages.map((m) => (
            <div key={m.id} className="max-w-3xl mx-auto w-full group">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-[10px] font-black text-white uppercase">{m.profiles?.username || 'ANON'}</span>
                <span className="text-[8px] font-bold text-zinc-800 tabular-nums">[{m.profiles?.signal_score}]</span>
              </div>
              <p className="text-[15px] text-zinc-400 leading-relaxed tracking-tight group-hover:text-zinc-200 transition-colors">
                {m.content}
              </p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* 4. SUB-LEVEL TIERS (Floating Tooltip style) */}
        {activeDistrict?.slug !== 'lobby' && subRooms.length > 0 && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex gap-4 px-6 py-2 bg-zinc-900/80 backdrop-blur-md rounded-full border border-white/5">
            {subRooms.map(r => (
              <button
                key={r.slug}
                onClick={() => { setActiveDistrict(r); fetchChat(r.slug); }}
                className={`text-[9px] font-black uppercase ${activeDistrict?.slug === r.slug ? 'text-emerald-500' : 'text-zinc-500'}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        {/* 5. MINIMAL INPUT */}
        <div className="p-8 bg-black">
          <form onSubmit={transmit} className="max-w-3xl mx-auto flex items-center border-b border-white/10 focus-within:border-emerald-500 transition-all">
            <input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="TYPE_SIGNAL..."
              className="flex-1 bg-transparent py-4 text-sm text-white outline-none font-bold placeholder:text-zinc-900 uppercase tracking-widest"
            />
            <button type="submit" className="text-zinc-800 hover:text-emerald-500 transition-colors">
              <ChevronUp size={20} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}