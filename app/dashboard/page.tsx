"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock, Users, Trophy, Settings, Coins, Megaphone as MegaphoneIcon, Timer, Activity, Flame, Lock, Trash2 } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";

// --- TYPES ---
type District = { slug: string; name: string; min_score: number; description: string; last_activity?: string };
type Profile = { 
  id: string; 
  email: string | null; 
  username: string | null; 
  signal_score: number | null; 
  is_founder: boolean | null;
  prestige_score: number;
  referral_code: string;
  dividend_earned: number;
};
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profile_id: string; profiles?: { username: string, signal_score: number } };
type Megaphone = { msg: string; bid: number; owner: string; decayedPrice: number };
type FloatingPoint = { id: number; x: number; y: number };

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

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- CORE SYSTEM FUNCTIONS ---

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

  // --- DELETE FUNCTION ---
  const deleteMessage = async (messageId: string, authorId: string) => {
    // Permission check: Is user the author OR a founder?
    const canDelete = profile?.id === authorId || profile?.is_founder;
    
    if (!canDelete) return triggerToast("ACCESS_DENIED");

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      triggerToast("SIGNAL_DELETED");
    } else {
      triggerToast("DELETE_FAILED");
    }
  };

  const updateIdentity = async () => {
    const CHANGE_COST = 1000;
    if (!newUsername || newUsername.length < 3) return triggerToast("ID_TOO_SHORT");
    if ((profile?.signal_score || 0) < CHANGE_COST) return triggerToast("INSUFFICIENT_SIGNAL");
    const { data: success } = await supabase.rpc('update_username_with_cost', {
      user_id: profile?.id,
      new_username: newUsername.toUpperCase(),
      change_cost: CHANGE_COST
    });
    if (success) { 
        triggerToast(`IDENTITY_REWRITTEN`); 
        setProfile(prev => prev ? { ...prev, username: newUsername.toUpperCase(), signal_score: (prev.signal_score || 0) - CHANGE_COST } : null); 
        setNewUsername(""); 
    }
  };

  const handleDoubleTap = async (e: React.MouseEvent, targetUserId: string) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (targetUserId === profile?.id) return triggerToast("CANNOT_BOOST_SELF");
      const newPoint = { id: Date.now(), x: e.clientX, y: e.clientY };
      setFloatingPoints(prev => [...prev, newPoint]);
      setTimeout(() => setFloatingPoints(prev => prev.filter(p => p.id !== newPoint.id)), 800);
      await supabase.rpc('increment_signal_with_dividend', { user_id: targetUserId, amount: 1 });
      triggerToast("SIGNAL_BOOSTED");
    }
    lastTap.current = now;
  };

  const handleTakeover = async () => {
    if (!profile || megaBid <= (megaphone.decayedPrice || 0)) return triggerToast("BID_MUST_EXCEED_DECAY");
    if (megaBid > (profile.signal_score || 0)) return triggerToast("INSUFFICIENT_SIGNAL");
    const { error } = await supabase.rpc('takeover_megaphone', {
      user_id: profile.id,
      new_message: megaMsg.toUpperCase(),
      bid_amount: megaBid
    });
    if (!error) { 
      triggerToast("SIGNAL_BROADCASTED"); 
      setShowMegaModal(false); 
      setProfile(prev => prev ? { ...prev, signal_score: (prev.signal_score || 0) - megaBid } : null);
      loadNexus(); 
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    let content = newMessage;
    if (activeFrequency && !content.toUpperCase().includes(`#${activeFrequency}`)) content = `${newMessage} #${activeFrequency}`;
    setIsCooldown(true);
    const { error } = await supabase.from("messages").insert({ content, profile_id: profile.id, district_slug: activeDistrict.slug, is_founder_msg: profile.is_founder });
    if (!error && !profile.is_founder) {
      const pts = feverMode ? 10 : 5;
      setProfile(p => p ? {...p, signal_score: (p.signal_score || 0) + pts} : null);
      await supabase.rpc('increment_signal_with_dividend', { user_id: profile.id, amount: pts });
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  const toggleFever = async () => {
    if (!profile?.is_founder) return triggerToast("ACCESS_DENIED");
    await supabase.from('system_settings').update({ value: { active: !feverMode } }).eq('key', 'fever_mode');
  };

  // --- USE EFFECTS ---

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!profile || districts.length === 0) return;
    const activeChannels: any[] = [];
    districts.forEach(district => {
      const channel = supabase.channel(`presence:${district.slug}`, {
        config: { presence: { key: profile.id } }
      });
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setPresenceCounts(prev => ({ ...prev, [district.slug]: Object.keys(state).length }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            if (activeDistrict?.slug === district.slug) {
              await channel.track({ online_at: new Date().toISOString() });
            } else {
              await channel.untrack();
            }
          }
        });
      activeChannels.push(channel);
    });
    return () => {
      activeChannels.forEach(ch => {
        ch.untrack();
        supabase.removeChannel(ch);
      });
    };
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
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDistrict?.slug, profile?.id]);

  useEffect(() => {
    const channel = supabase.channel('global_fever')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.fever_mode' }, 
      (payload) => setFeverMode(payload.new.value.active)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  // --- MEMOIZED DATA ---

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

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 text-xs">Syncing_Nexus...</div>;

  return (
    <div className={`h-[100dvh] flex flex-col font-mono bg-black text-zinc-400 overflow-hidden ${feverMode ? 'ring-inset ring-4 ring-orange-500/20' : ''}`}>
      
      {floatingPoints.map(p => (
        <span key={p.id} style={{ left: p.x, top: p.y }} className="fixed pointer-events-none text-emerald-400 font-black text-[10px] animate-bounce z-[300] -translate-y-8">+1_SIGNAL</span>
      ))}

      <div className={`${feverMode ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'} text-black py-1 px-4 flex justify-between items-center z-[100]`}>
        <span className="text-[10px] font-black uppercase flex items-center gap-1">
          {feverMode ? <Zap size={12} fill="black"/> : <Radio size={12}/>} 
          {feverMode ? "FEVER_ACTIVE_-_2X_BOOST" : `BROADCAST: ${megaphone.msg}`}
        </span>
        <div className="flex items-center gap-4 bg-black/10 px-2 py-0.5 rounded text-[10px] font-black">
           <Timer size={12}/> {timeLeft}
        </div>
      </div>

      <div className="flex flex-col border-b border-white/5 bg-black/80 z-[70]">
        <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="p-1 text-emerald-500 lg:hidden"><Menu size={24} /></button>
              <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">Terminal_v3.0</span>
                  <span className="text-xs text-white font-black uppercase tracking-widest">SIGNAL_SCORE: {profile.signal_score?.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className={`px-3 py-1 rounded text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${showLeaderboard ? 'bg-emerald-500 text-black border-emerald-500' : 'text-emerald-500 border-emerald-500/30'}`}>
              <Trophy size={10} /> {showLeaderboard ? "Close_Rank" : "Rankings"}
            </button>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto no-scrollbar scroll-smooth">
            {districts.map((d) => {
                const isLocked = (profile.signal_score || 0) < d.min_score;
                const isActive = activeDistrict?.slug === d.slug;
                const count = districtActivity[d.slug] || 0;
                const liveUnits = presenceCounts[d.slug] || 0;
                const isHeat = liveUnits >= 100;

                return (
                    <button 
                        key={d.slug} 
                        disabled={isLocked}
                        onClick={() => { setActiveDistrict(d); fetchMsgs(d.slug); }} 
                        className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-full border text-[10px] font-black uppercase transition-all
                        ${isActive ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                          isLocked ? 'border-white/5 text-zinc-800 cursor-not-allowed opacity-50' : 'border-white/10 text-zinc-400 hover:border-emerald-500/50'}`}
                    >
                        {isLocked ? <Lock size={10}/> : <Users size={10} className={`${isActive ? "animate-pulse" : ""} ${isHeat ? "text-orange-500" : ""}`}/>}
                        <div className="flex flex-col items-start leading-none">
                            <span>{d.name}</span>
                            <span className={`text-[7px] mt-0.5 ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
                              {isLocked ? `REQ: ${d.min_score}` : (
                                <span className="flex gap-2">
                                  <b className={`${isHeat ? 'text-orange-500 animate-pulse' : isActive ? 'text-black' : 'text-emerald-400'}`}>{liveUnits} LIVE {isHeat && "🔥"}</b> 
                                  <span>| {count} SIGS</span>
                                </span>
                              )}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`fixed inset-0 z-[80] lg:relative lg:translate-x-0 w-full sm:w-80 bg-black border-r border-white/5 flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-6 border-b border-white/5">
              <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Control_Center</span>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={20}/></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            {profile?.is_founder && (
              <div className="p-4 border border-orange-500/50 bg-orange-500/5 rounded-xl space-y-3">
                <p className="text-[10px] text-orange-500 font-black uppercase flex items-center gap-2"><ShieldAlert size={12}/> System_Override</p>
                <button onClick={toggleFever} className={`w-full py-2 text-[9px] font-black uppercase rounded transition-all ${feverMode ? 'bg-orange-500 text-black' : 'bg-zinc-900 text-orange-500 border border-orange-500/30'}`}>
                  {feverMode ? "Kill_Fever" : "Trigger_Fever"}
                </button>
              </div>
            )}

            <div className="p-4 border border-white/10 bg-white/5 rounded-xl space-y-3">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Settings size={10} /> Identity_Tuner</p>
              <div className="flex gap-2">
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toUpperCase())} placeholder={profile.username || "SET_ID..."} className="flex-1 bg-black border border-white/10 p-2 text-[10px] text-white outline-none rounded" />
                <button onClick={updateIdentity} className="bg-emerald-500 text-black px-3 py-1 text-[9px] font-black rounded uppercase">Sync</button>
              </div>
              <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black italic">Cost: 1,000 Signal</p>
            </div>

            <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
              <h3 className="text-[10px] text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><MegaphoneIcon size={12}/> Global_Signal</h3>
              <p className="text-[11px] text-white font-bold italic mb-2">"{megaphone.msg}"</p>
              <button onClick={() => setShowMegaModal(true)} className="w-full py-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-[9px] font-black uppercase rounded">Takeover</button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Hash size={10} /> Trends_In_{activeDistrict?.name}</p>
              <div className="flex flex-wrap gap-2">
                {trendingTags.length > 0 ? trendingTags.map(tag => (
                  <button key={tag} onClick={() => {setFilterQuery(tag); setIsSidebarOpen(false);}} className={`text-[9px] border px-2 py-1 rounded font-bold transition-colors ${filterQuery === tag ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'}`}>
                    {tag}
                  </button>
                )) : <span className="text-[8px] text-zinc-800 font-black uppercase">No_Signal_Data</span>}
              </div>
            </div>

            <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl space-y-3">
              <p className="text-[10px] text-blue-400 font-black uppercase flex items-center gap-2"><Target size={12} /> Frequency_Tuner</p>
              <input value={activeFrequency || ""} onChange={(e) => setActiveFrequency(e.target.value.replace('#', '').toUpperCase())} placeholder="TUNE_IN..." className="w-full bg-black border border-blue-500/20 p-2 text-[10px] text-blue-400 outline-none rounded font-bold" />
            </div>

            <div className="p-4 border border-white/5 bg-white/5 rounded-xl space-y-3">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Share2 size={10}/> Recruitment</p>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${profile?.referral_code}`); triggerToast("LINK_COPIED"); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="w-full p-3 text-[10px] font-black uppercase border border-white/10 rounded-lg bg-zinc-900 text-white">
                {copied ? "ID_COPIED" : `ID: ${profile.referral_code?.toUpperCase()}`}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {showLeaderboard ? <Leaderboard /> : (
              <>
                {filteredMessages.map((msg) => {
                  const hasHotTag = msg.content.match(/#\w+/g)?.some(tag => frequencyMap[tag.toUpperCase()] > 5);
                  const canDelete = profile?.id === msg.profile_id || profile?.is_founder;

                  return (
                    <div key={msg.id} className="flex flex-col gap-1 max-w-[95%] group relative">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-zinc-500 uppercase">{msg.profiles?.username || 'ANON'}</span>
                          <span className="text-[8px] text-zinc-800 uppercase">{new Date(msg.created_at).toLocaleTimeString()}</span>
                        </div>
                        
                        {/* DELETE BUTTON - Only visible to Owner or Founder */}
                        {canDelete && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id, msg.profile_id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500/50 hover:text-red-500 transition-all ml-4"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      
                      <div 
                        onClick={(e) => handleDoubleTap(e, msg.profile_id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${hasHotTag ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}
                      >
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
            <div className="p-4 lg:p-8 bg-black">
              <form onSubmit={sendMessage} className={`flex items-center gap-2 bg-white/5 border rounded-2xl px-4 py-1 transition-all ${activeFrequency ? 'border-blue-500' : 'border-white/10'}`}>
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="INPUT_SIGNAL..." className="flex-1 bg-transparent py-4 text-sm text-white outline-none uppercase font-bold" />
                  <button type="submit" className={`p-2 rounded-lg text-black ${activeFrequency ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}><ChevronUp size={20}/></button>
              </form>
            </div>
          )}
        </main>
      </div>

      {showMegaModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-emerald-500/30 bg-zinc-950 p-6 rounded-2xl space-y-6">
            <h2 className="text-emerald-500 font-black uppercase flex items-center gap-2"><MegaphoneIcon size={16}/> Global_Takeover</h2>
            <div className="space-y-4">
              <input value={megaMsg} onChange={(e) => setMegaMsg(e.target.value)} placeholder="TRANSMISSION..." className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none rounded-lg" />
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500 uppercase">Min Bid: {(megaphone.decayedPrice || 0) + 1}</span>
                <input type="number" value={megaBid} onChange={(e) => setMegaBid(parseInt(e.target.value) || 0)} className="w-full bg-black border border-white/10 p-3 text-sm text-emerald-500 font-black outline-none rounded-lg" />
              </div>
            </div>
            <button onClick={handleTakeover} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase transition-transform active:scale-95">Execute</button>
            <button onClick={() => setShowMegaModal(false)} className="w-full text-[10px] text-zinc-600 uppercase font-black">Abort</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500 text-black px-4 py-2 rounded text-[10px] font-black uppercase shadow-[0_0_20px_rgba(16,185,129,0.5)]">{toast}</div>}
    </div>
  );
}