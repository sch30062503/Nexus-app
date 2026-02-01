"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock, Users, Trophy, Settings, Coins, Megaphone as MegaphoneIcon, Timer, Activity, Flame, Lock, Trash2, ShieldCheck, ChevronRight } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";

// --- TYPES ---
type District = { slug: string; name: string; min_score: number; description: string; parent_slug?: string };
// ... (other types remain same)

export default function DashboardPage() {
  const router = useRef(useRouter()).current;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [activeFrequency, setActiveFrequency] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState(""); 
  const [newUsername, setNewUsername] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [copied, setCopied] = useState(false);
  const [showMegaModal, setShowMegaModal] = useState(false);
  const [megaBid, setMegaBid] = useState(0);
  const [megaMsg, setMegaMsg] = useState("");
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM", decayedPrice: 0 });
  const [floatingPoints, setFloatingPoints] = useState<FloatingPoint[]>([]);
  const [districtActivity, setDistrictActivity] = useState<Record<string, number>>({});
  const [presenceCounts, setPresenceCounts] = useState<Record<string, number>>({});

  const lastTap = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- LOGIC UPDATES ---

  // Organize Districts into Sectors (Topics) and Tiers (Levels)
  const sectorMap = useMemo(() => {
    const sectors: Record<string, { info: District | null, tiers: District[] }> = {};
    
    // 1. Identify Parents (Sectors)
    districts.filter(d => !d.parent_slug).forEach(d => {
      sectors[d.slug] = { info: d, tiers: [] };
    });

    // 2. Assign Children (Tiers)
    districts.filter(d => d.parent_slug).forEach(d => {
      if (sectors[d.parent_slug!]) {
        sectors[d.parent_slug!].tiers.push(d);
      }
    });

    return sectors;
  }, [districts]);

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) setProfile(pData as Profile);
    
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      if (!activeDistrict) {
        setActiveDistrict(dData[0]);
        fetchMsgs(dData[0].slug);
      }
    }

    const { data: countData } = await supabase.from("messages").select("district_slug");
    if (countData) {
      const counts: Record<string, number> = {};
      countData.forEach(m => counts[m.district_slug] = (counts[m.district_slug] || 0) + 1);
      setDistrictActivity(counts);
    }

    const { data: megaData } = await supabase.rpc('get_decayed_bid');
    if (megaData?.[0]) setMegaphone({ msg: megaData[0].current_message, bid: megaData[0].bid_amount, owner: megaData[0].owner_username, decayedPrice: megaData[0].decayed_price });
    
    setLoading(false);
  };

  // ... (fetchMsgs, deleteMessage, updateIdentity, handleDoubleTap, handleTakeover remain unchanged)

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMsgs = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) {
      setMessages(data as any);
      const tags: Record<string, number> = {};
      data.forEach((m: any) => {
        const matches = m.content.match(/#\w+/g);
        if (matches) matches.forEach((t: string) => tags[t.toLowerCase()] = (tags[t.toLowerCase()] || 0) + 1);
      });
      setTrendingTags(Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 6));
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    let targetHub = activeDistrict.slug;
    let content = newMessage;
    if (activeFrequency && !content.toUpperCase().includes(`#${activeFrequency}`)) content = `${newMessage} #${activeFrequency}`;

    const { data, error } = await supabase.rpc('submit_signal', { user_id: profile.id, signal_content: content, target_hub: targetHub });
    if (!error) {
        setProfile(p => p ? {...p, signal_score: (p.signal_score || 0) + data.awarded} : null);
        setNewMessage("");
    } else {
        triggerToast("TRANSMISSION_FAILED");
    }
    setTimeout(() => setIsCooldown(false), 800);
  };

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!profile || districts.length === 0) return;
    const activeChannels: any[] = [];
    districts.forEach(district => {
      const channel = supabase.channel(`presence:${district.slug}`, { config: { presence: { key: profile.id } } });
      channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setPresenceCounts(prev => ({ ...prev, [district.slug]: Object.keys(state).length }));
        }).subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            if (activeDistrict?.slug === district.slug) await channel.track({ online_at: new Date().toISOString() });
            else await channel.untrack();
          }
        });
      activeChannels.push(channel);
    });
    return () => { activeChannels.forEach(ch => { ch.untrack(); supabase.removeChannel(ch); }); };
  }, [districts, profile, activeDistrict?.slug]);

  useEffect(() => {
    if (!activeDistrict || !profile) return;
    const channel = supabase.channel(`nexus-${activeDistrict.slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `district_slug=eq.${activeDistrict.slug}` }, 
        async (payload) => {
          const { data: uData } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev, { ...payload.new, profiles: uData } as Message]);
          setDistrictActivity(prev => ({ ...prev, [activeDistrict.slug]: (prev[activeDistrict.slug] || 0) + 1 }));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDistrict?.slug, profile?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nextMonday = new Date();
      nextMonday.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
      nextMonday.setHours(0, 0, 0, 0);
      const diff = nextMonday.getTime() - now.getTime();
      setTimeLeft(`${Math.floor(diff / 36e5)}H : ${Math.floor((diff % 36e5) / 6e4)}M : ${Math.floor((diff % 6e4) / 1000)}S`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, filterQuery]);

  const frequencyMap = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach(tag => { counts[tag.toUpperCase()] = (counts[tag.toUpperCase()] || 0) + 1; });
    });
    return counts;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      const content = m.content.toUpperCase();
      const matchesSearch = content.includes(filterQuery.toUpperCase());
      const matchesFrequency = activeFrequency ? content.includes(`#${activeFrequency.toUpperCase()}`) : true;
      return matchesSearch && matchesFrequency;
    });
  }, [messages, filterQuery, activeFrequency]);

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 text-xs animate-pulse">SYNCHRONIZING_NETWORK_HUBS...</div>;

  return (
    <div className={`h-[100dvh] flex flex-col font-mono bg-black text-zinc-400 overflow-hidden ${feverMode ? 'ring-inset ring-4 ring-orange-500/20' : ''}`}>
      
      {floatingPoints.map(p => (
        <span key={p.id} style={{ left: p.x, top: p.y }} className="fixed pointer-events-none text-emerald-400 font-black text-[10px] animate-bounce z-[300] -translate-y-8">+SIGNAL</span>
      ))}

      {/* Top Ticker */}
      <div className={`${feverMode ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'} text-black py-1 px-4 flex justify-between items-center z-[100]`}>
        <span className="text-[10px] font-black uppercase flex items-center gap-1">
          {feverMode ? <Zap size={12} fill="black"/> : <Radio size={12}/>} 
          {feverMode ? "FEVER_ACTIVE_-_2X_BOOST" : `BROADCAST: ${megaphone.msg}`}
        </span>
        <div className="flex items-center gap-4 bg-black/10 px-2 py-0.5 rounded text-[10px] font-black">
           <Timer size={12}/> {timeLeft}
        </div>
      </div>

      {/* Header Info */}
      <div className="flex flex-col border-b border-white/5 bg-black/80 z-[70]">
        <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="p-1 text-emerald-500 lg:hidden"><Menu size={24} /></button>
              <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">Terminal_v3.0</span>
                  <span className="text-xs text-white font-black uppercase tracking-widest">SIGNAL: {profile.signal_score?.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className={`px-3 py-1 rounded text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${showLeaderboard ? 'bg-emerald-500 text-black border-emerald-500' : 'text-emerald-500 border-emerald-500/30'}`}>
              <Trophy size={10} /> {showLeaderboard ? "Close_Rank" : "Rankings"}
            </button>
        </div>

        {/* --- HIERARCHICAL HUB NAVIGATOR --- */}
        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[160px] no-scrollbar">
          {Object.entries(sectorMap).map(([sectorSlug, data]) => (
            <div key={sectorSlug} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 opacity-50">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">{data.info?.name}</span>
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[data.info!, ...data.tiers].map((hub) => {
                  const isLocked = (profile.signal_score || 0) < hub.min_score;
                  const isActive = activeDistrict?.slug === hub.slug;
                  const units = presenceCounts[hub.slug] || 0;
                  return (
                    <button 
                      key={hub.slug} 
                      disabled={isLocked}
                      onClick={() => { setActiveDistrict(hub); fetchMsgs(hub.slug); }} 
                      className={`flex-shrink-0 px-3 py-2 rounded border flex items-center gap-2 transition-all
                        ${isActive ? 'bg-emerald-500 border-emerald-500 text-black' : 
                          isLocked ? 'border-white/5 text-zinc-800 opacity-50 grayscale' : 'border-white/10 text-zinc-400 hover:border-emerald-500/40'}`}
                    >
                      {isLocked ? <Lock size={10}/> : isActive ? <ChevronRight size={10} className="animate-pulse"/> : <Hash size={10}/>}
                      <div className="flex flex-col items-start leading-none">
                        <span className="text-[10px] font-black uppercase">{hub.name}</span>
                        <span className="text-[7px] font-bold opacity-60 mt-0.5">{isLocked ? `REQ: ${hub.min_score}` : `${units} ACTIVE`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar and Main Content remain largely identical to previous version, logic preserved */}
        <aside className={`fixed inset-0 z-[80] lg:relative lg:translate-x-0 w-full sm:w-80 bg-black border-r border-white/5 flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* ... Sidebar contents (Identity, Megaphone, Trends) ... */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
              <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Control_Center</span>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={20}/></button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
             {/* Preservation of your Sidebar logic */}
             <div className="p-4 border border-white/10 bg-white/5 rounded-xl space-y-3">
               <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Settings size={10} /> Identity_Tuner</p>
               <div className="flex gap-2">
                 <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toUpperCase())} placeholder={profile.username || "SET_ID..."} className="flex-1 bg-black border border-white/10 p-2 text-[10px] text-white outline-none rounded" />
                 <button onClick={updateIdentity} className="bg-emerald-500 text-black px-3 py-1 text-[9px] font-black rounded uppercase">Sync</button>
               </div>
             </div>
             
             <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
               <h3 className="text-[10px] text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><MegaphoneIcon size={12}/> Global_Signal</h3>
               <p className="text-[11px] text-white font-bold italic mb-2">"{megaphone.msg}"</p>
               <button onClick={() => setShowMegaModal(true)} className="w-full py-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-[9px] font-black uppercase rounded">Takeover</button>
             </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {showLeaderboard ? <Leaderboard /> : (
              <>
                {filteredMessages.map((msg) => {
                  const hasHotTag = msg.content.match(/#\w+/g)?.some(tag => frequencyMap[tag.toUpperCase()] > 5);
                  const score = msg.profiles?.signal_score || 0;
                  return (
                    <div key={msg.id} className="flex flex-col gap-1 max-w-[95%] group relative">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase ${score >= 10000 ? 'text-purple-500' : 'text-emerald-500'}`}>{msg.profiles?.username || 'ANON'}</span>
                        <span className="text-[8px] text-zinc-800 uppercase bg-white/5 px-1 rounded">{score >= 10000 ? "NEXUS_ELITE" : "GRID_RUNNER"}</span>
                      </div>
                      <div onClick={(e) => handleDoubleTap(e, msg.profile_id)} className={`p-4 rounded-xl border transition-all cursor-pointer ${hasHotTag ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}>
                        <p className={`text-sm ${hasHotTag ? 'text-blue-100 font-bold' : 'text-zinc-300'}`}>{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </>
            )}
          </div>

          {!showLeaderboard && (
            <div className="p-4 lg:p-8 bg-black relative">
               {activeDistrict && (profile.signal_score || 0) < activeDistrict.min_score && (
                   <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                        <div className="space-y-4">
                             <ShieldCheck className="mx-auto text-red-500 animate-pulse" size={48} />
                             <h3 className="text-red-500 font-black tracking-widest uppercase">Clearance_Required</h3>
                             <p className="text-xs text-zinc-500 uppercase">You need {activeDistrict.min_score.toLocaleString()} Signal to unlock this hub</p>
                        </div>
                   </div>
               )}
              <form onSubmit={sendMessage} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-1">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="INPUT_SIGNAL..." className="flex-1 bg-transparent py-4 text-sm text-white outline-none uppercase font-bold" />
                  <button type="submit" className="p-2 rounded-lg bg-emerald-500 text-black"><ChevronUp size={20}/></button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Takeover and Toast logic preserved from original */}
      {showMegaModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
           {/* ... Modal Content ... */}
           <div className="w-full max-w-md border border-emerald-500/30 bg-zinc-950 p-6 rounded-2xl space-y-6 text-center">
              <h2 className="text-emerald-500 font-black uppercase">Global_Takeover</h2>
              <input value={megaMsg} onChange={(e) => setMegaMsg(e.target.value)} placeholder="MESSAGE..." className="w-full bg-black border border-white/10 p-3 text-white rounded-lg outline-none" />
              <input type="number" value={megaBid} onChange={(e) => setMegaBid(parseInt(e.target.value) || 0)} className="w-full bg-black border border-white/10 p-3 text-emerald-500 font-bold rounded-lg outline-none" />
              <button onClick={handleTakeover} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase">Execute</button>
              <button onClick={() => setShowMegaModal(false)} className="text-[10px] text-zinc-600 uppercase">Cancel</button>
           </div>
        </div>
      )}
      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500 text-black px-4 py-2 rounded text-[10px] font-black uppercase shadow-[0_0_20px_rgba(16,185,129,0.5)]">{toast}</div>}
    </div>
  );
}