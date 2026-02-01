"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock, Users, Trophy, Settings, Coins, Megaphone as MegaphoneIcon, Timer, Activity, Flame, Lock, Trash2, ShieldCheck, ChevronRight } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";

// ... (Types remain the same as your snippet)

export default function DashboardPage() {
  const router = useRouter(); // Simplified router access
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM", decayedPrice: 0 });
  const [presenceCounts, setPresenceCounts] = useState<Record<string, number>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- NEW FUNNEL LOGIC ---
  
  // 1. Separate the Global Lobby from the Niche Sectors
  const funnel = useMemo(() => {
    const lobby = districts.find(d => d.slug === 'lobby' || d.min_score === 0);
    const sectors = districts.filter(d => !d.parent_slug && d.slug !== lobby?.slug);
    return { lobby, sectors };
  }, [districts]);

  // 2. Identify Sub-Rooms (Tiers) for the currently active Sector
  const activeTiers = useMemo(() => {
    if (!activeDistrict) return [];
    // If we are in a sub-room, find its siblings. If in a sector, find its children.
    const parentSlug = activeDistrict.parent_slug || activeDistrict.slug;
    return districts.filter(d => d.parent_slug === parentSlug);
  }, [districts, activeDistrict]);

  // --- DATA LOADING ---
  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) setProfile(pData as Profile);
    
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      const initialDist = dData.find(d => d.slug === 'lobby') || dData[0];
      setActiveDistrict(initialDist);
      fetchMsgs(initialDist.slug);
    }
    setLoading(false);
  };

  const fetchMsgs = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) setMessages(data as any);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    
    const { data, error } = await supabase.rpc('submit_signal', { 
      user_id: profile.id, 
      signal_content: newMessage, 
      target_hub: activeDistrict.slug 
    });

    if (!error) {
      setProfile(p => p ? {...p, signal_score: (p.signal_score || 0) + data.awarded} : null);
      setNewMessage("");
    }
    setTimeout(() => setIsCooldown(false), 800);
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 text-xs animate-pulse">SYNCHRONIZING_NETWORK_HUBS...</div>;

  return (
    <div className="h-[100dvh] flex flex-col font-mono bg-black text-zinc-400 overflow-hidden">
      
      {/* GLOBAL TICKER */}
      <div className="bg-emerald-500 text-black py-1 px-4 flex justify-between items-center z-[100]">
        <span className="text-[10px] font-black uppercase flex items-center gap-1">
          <Radio size={12}/> BROADCAST: {megaphone.msg}
        </span>
        <span className="text-[10px] font-black uppercase">{timeLeft}</span>
      </div>

      {/* --- RESTRUCTURED NAVIGATION --- */}
      <div className="flex flex-col border-b border-white/5 bg-black/80 z-[70]">
        
        {/* TOP LEVEL: LOBBY & SECTORS */}
        <div className="flex items-center gap-4 p-4 overflow-x-auto no-scrollbar border-b border-white/5">
          {/* Always show Lobby */}
          {funnel.lobby && (
            <button 
              onClick={() => { setActiveDistrict(funnel.lobby!); fetchMsgs(funnel.lobby!.slug); }}
              className={`flex-shrink-0 px-4 py-2 rounded border-2 font-black text-[10px] uppercase transition-all
                ${activeDistrict?.slug === funnel.lobby.slug ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/10 text-zinc-500'}`}
            >
              [ 00 ] GENERAL_LOBBY
            </button>
          )}

          {/* Show Niche Sectors */}
          {funnel.sectors.map(sector => {
            const isLocked = profile.signal_score < 500;
            const isActive = activeDistrict?.slug === sector.slug || activeDistrict?.parent_slug === sector.slug;
            return (
              <button 
                key={sector.slug}
                disabled={isLocked}
                onClick={() => { setActiveDistrict(sector); fetchMsgs(sector.slug); }}
                className={`flex-shrink-0 px-4 py-2 rounded border-2 font-black text-[10px] uppercase transition-all flex items-center gap-2
                  ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 
                    isLocked ? 'border-white/5 text-zinc-800 grayscale cursor-not-allowed' : 'border-white/10 text-zinc-500 hover:border-white/20'}`}
              >
                {isLocked && <Lock size={10} />}
                {sector.name}
              </button>
            );
          })}
        </div>

        {/* SUB LEVEL: GATED TIERS (Only shows if inside a niche sector) */}
        {activeDistrict?.slug !== 'lobby' && activeTiers.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-2 bg-zinc-900/50">
            <span className="text-[8px] font-black text-blue-500/50 uppercase tracking-widest">Gated_Tiers:</span>
            {activeTiers.map(tier => {
              const isLocked = profile.signal_score < tier.min_score;
              return (
                <button
                  key={tier.slug}
                  disabled={isLocked}
                  onClick={() => { setActiveDistrict(tier); fetchMsgs(tier.slug); }}
                  className={`text-[9px] font-black px-2 py-1 rounded transition-all uppercase
                    ${activeDistrict?.slug === tier.slug ? 'text-white underline underline-offset-4' : 
                      isLocked ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}
                >
                  {tier.name} {isLocked && `[REQ: ${tier.min_score}]`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col relative bg-black">
          
          {/* CURRENT ROOM INFO */}
          <div className="px-6 py-2 bg-white/5 flex justify-between items-center border-b border-white/5">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${activeDistrict?.slug === 'lobby' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <span className="text-[10px] font-black text-white uppercase">{activeDistrict?.name}</span>
             </div>
             <span className="text-[9px] text-zinc-500">POPULATION: {presenceCounts[activeDistrict?.slug || ''] || 0}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {filteredMessages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1 max-w-[95%] group">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-500 uppercase">{msg.profiles?.username || 'ANON'}</span>
                  <span className="text-[8px] text-zinc-800 uppercase bg-white/5 px-1 rounded">{msg.profiles?.signal_score?.toLocaleString()}</span>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <p className="text-sm text-zinc-300">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          {/* INPUT AREA */}
          <div className="p-4 lg:p-8 bg-black">
            <form onSubmit={sendMessage} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-1">
              <input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder={`TRANSMIT TO ${activeDistrict?.name}...`} 
                className="flex-1 bg-transparent py-4 text-sm text-white outline-none uppercase font-bold" 
              />
              <button type="submit" className="p-2 rounded-lg bg-emerald-500 text-black"><ChevronUp size={20}/></button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}