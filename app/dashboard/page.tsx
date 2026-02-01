"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock, Users, Trophy, Settings, Coins, Megaphone as MegaphoneIcon, Timer, Activity, Flame } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";

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

export default function DashboardPage() {
  const router = useRouter();
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
  
  // --- NEW: FREQUENCY & FILTER STATES ---
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

  const lastTap = useRef<number>(0);
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM", decayedPrice: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- NEW: LOGIC - FREQUENCY POPULATION & HEATMAP ---
  const frequencyMap = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach(tag => {
        const t = tag.toUpperCase();
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }, [messages]);

  // --- NEW: LOGIC - FILTERED MESSAGES (Combines Frequency Tuning + Search) ---
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      const content = m.content.toUpperCase();
      const matchesSearch = content.includes(filterQuery.toUpperCase());
      const matchesFrequency = activeFrequency ? content.includes(`#${activeFrequency.toUpperCase()}`) : true;
      return matchesSearch && matchesFrequency;
    });
  }, [messages, filterQuery, activeFrequency]);

  // --- FEVER MODE REALTIME SYNC ---
  useEffect(() => {
    const fetchFeverState = async () => {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'fever_mode').single();
      if (data) setFeverMode(data.value.active);
    };
    fetchFeverState();
    const channel = supabase.channel('global_fever')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.fever_mode' }, 
      (payload) => {
        setFeverMode(payload.new.value.active);
        triggerToast(payload.new.value.active ? "GLOBAL_FEVER_ACTIVE" : "FEVER_COOLDOWN");
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleFever = async () => {
    if (!profile?.is_founder) return triggerToast("ACCESS_DENIED");
    await supabase.from('system_settings').update({ value: { active: !feverMode } }).eq('key', 'fever_mode');
  };

  // --- IDENTITY TUNER ---
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

  // --- MEGAPHONE ---
  const handleTakeover = async () => {
    if (!profile || megaBid <= (megaphone.decayedPrice || 0)) return triggerToast("BID_MUST_EXCEED_DECAY");
    const { error } = await supabase.rpc('takeover_megaphone', {
      user_id: profile.id,
      new_message: megaMsg.toUpperCase(),
      bid_amount: megaBid
    });
    if (!error) { triggerToast("SIGNAL_BROADCASTED"); setShowMegaModal(false); loadNexus(); }
  };

  // --- MESSAGING WITH AUTO-FREQUENCY ---
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;

    let content = newMessage;
    // Auto-tag with frequency if user is tuned in
    if (activeFrequency && !content.toUpperCase().includes(`#${activeFrequency}`)) {
      content = `${newMessage} #${activeFrequency}`;
    }

    setIsCooldown(true);
    await supabase.from("messages").insert({ content, profile_id: profile.id, district_slug: activeDistrict.slug, is_founder_msg: profile.is_founder });
    
    if (!profile.is_founder) {
      const points = feverMode ? 10 : 5;
      await supabase.rpc('increment_signal_with_dividend', { user_id: profile.id, amount: points });
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  // --- CORE LOADING ---
  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) setProfile(pData as Profile);
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) { setDistricts(dData); const target = activeDistrict || dData[0]; setActiveDistrict(target); fetchMsgs(target.slug); }
    const { data: megaData } = await supabase.rpc('get_decayed_bid');
    if (megaData?.[0]) setMegaphone({ msg: megaData[0].current_message, bid: megaData[0].bid_amount, owner: megaData[0].owner_username, decayedPrice: megaData[0].decayed_price });
    setLoading(false);
  };

  const fetchMsgs = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) {
      setMessages(data as any);
      const counts: Record<string, number> = {};
      data.forEach((m: any) => {
        const tags = m.content.match(/#\w+/g);
        if (tags) tags.forEach((t: string) => counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1);
      });
      setTrendingTags(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6));
    }
  };

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!activeDistrict || !profile) return;
    const channel = supabase.channel(`nexus-${activeDistrict.slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `district_slug=eq.${activeDistrict.slug}` }, 
        async (payload) => {
          const { data: uData } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => [...prev, { ...payload.new, profiles: uData } as Message]);
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filteredMessages]);

  const copyReferral = () => {
    const link = `${window.location.origin}/signup?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    triggerToast("LINK_COPIED");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 text-xs uppercase">Syncing_Nexus...</div>;

  return (
    <div className={`h-[100dvh] flex flex-col font-mono bg-black text-zinc-400 overflow-hidden ${feverMode ? 'ring-inset ring-4 ring-orange-500/10' : ''}`}>
      
      {/* 🏁 HUD */}
      <div className={`${feverMode ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'} text-black py-1 px-4 flex justify-between items-center z-[100]`}>
        <span className="text-[10px] font-black uppercase flex items-center gap-1">
          {feverMode ? <Zap size={12} fill="black"/> : <Radio size={12}/>} 
          {feverMode ? "FEVER_ACTIVE_-_2X_BOOST" : `BROADCAST: ${megaphone.msg}`}
        </span>
        <div className="flex items-center gap-4 bg-black/10 px-2 py-0.5 rounded text-[10px] font-black">
           <Timer size={12}/> {timeLeft}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className={`fixed inset-0 z-[80] lg:relative lg:translate-x-0 w-full sm:w-80 bg-black border-r border-white/5 flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-6 border-b border-white/5">
              <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Control_Center</span>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={20}/></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            
            {/* ⚡ FOUNDER TRIGGER */}
            {profile?.is_founder && (
              <div className="p-4 border border-orange-500/50 bg-orange-500/5 rounded-xl space-y-3">
                <p className="text-[10px] text-orange-500 font-black uppercase flex items-center gap-2"><ShieldAlert size={12}/> System_Override</p>
                <button onClick={toggleFever} className={`w-full py-2 text-[9px] font-black uppercase rounded transition-all ${feverMode ? 'bg-orange-500 text-black' : 'bg-zinc-900 text-orange-500 border border-orange-500/30'}`}>
                  {feverMode ? "Kill_Fever" : "Trigger_Fever"}
                </button>
              </div>
            )}

            {/* 📡 FREQUENCY TUNER (DYNAMIC FILTER) */}
            <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-blue-400 font-black uppercase flex items-center gap-2"><Target size={12} /> Frequency_Tuner</p>
                {activeFrequency && <button onClick={() => setActiveFrequency(null)} className="text-[8px] text-zinc-500 underline uppercase">Reset</button>}
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 text-[10px] font-bold">#</span>
                <input 
                  value={activeFrequency || ""} 
                  onChange={(e) => setActiveFrequency(e.target.value.replace('#', '').toUpperCase())} 
                  placeholder="ALL_SIGNALS..." 
                  className="w-full bg-black border border-blue-500/20 p-2 pl-5 text-[10px] text-blue-400 outline-none focus:border-blue-500 rounded font-bold" 
                />
              </div>
            </div>

            {/* 🔥 SIGNAL HEATMAP */}
            <div className="space-y-4">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Activity size={10} /> Signal_Heatmap</p>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(frequencyMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => (
                  <button key={tag} onClick={() => { setActiveFrequency(tag.replace('#','')); setIsSidebarOpen(false); }} className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5 hover:border-blue-500/30 group transition-all">
                    <span className="text-[9px] font-bold text-zinc-400 group-hover:text-blue-400">{tag}</span>
                    <div className="flex items-center gap-2">
                      {count > 5 && <Flame size={10} className="text-orange-500 animate-pulse" />}
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-zinc-900 rounded text-emerald-500">{count} Signals</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* IDENTITY TUNER */}
            <div className="p-4 border border-white/10 bg-white/5 rounded-xl space-y-3">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Settings size={10} /> Identity_Tuner</p>
              <div className="flex gap-2">
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toUpperCase())} placeholder={profile.username || "ID..."} className="flex-1 bg-black border border-white/10 p-2 text-[10px] text-white outline-none rounded" />
                <button onClick={updateIdentity} className="bg-emerald-500 text-black px-3 py-1 text-[9px] font-black rounded uppercase">Sync</button>
              </div>
            </div>

            {/* ZONES */}
            <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-600 uppercase">Active_Zones</p>
                {districts.map((d) => (
                    <button key={d.slug} onClick={() => { setActiveDistrict(d); fetchMsgs(d.slug); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded border text-[10px] font-black uppercase ${activeDistrict?.slug === d.slug ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'border-transparent text-zinc-500'}`}>
                      {d.name} <span className="opacity-30">{d.min_score}</span>
                    </button>
                ))}
            </div>

            {/* RECRUITMENT */}
            <div className="p-4 border border-white/5 bg-white/5 rounded-xl space-y-3">
              <p className="text-[10px] text-zinc-600 font-black uppercase flex items-center gap-2"><Share2 size={10}/> Recruitment</p>
              <button onClick={copyReferral} className={`w-full p-3 text-[10px] font-black uppercase border transition-all rounded-lg flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-white'}`}>
                {copied ? "LINK_COPIED" : `ID: ${profile.referral_code?.toUpperCase() || '...'}`}
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN TERMINAL */}
        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {showLeaderboard ? <Leaderboard /> : (
              <>
                {/* ACTIVE FILTER OVERLAY */}
                {(activeFrequency || filterQuery) && (
                  <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg mb-4">
                    <span className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      LOCKED: {activeFrequency ? `#${activeFrequency}` : 'SEARCH_MODE'}
                    </span>
                    <button onClick={() => {setActiveFrequency(null); setFilterQuery("");}} className="text-[9px] text-white font-black underline">RESET</button>
                  </div>
                )}
                
                {filteredMessages.map((msg) => {
                  // Check if this specific message contains a "Hot" hashtag
                  const hasHotTag = msg.content.match(/#\w+/g)?.some(tag => frequencyMap[tag.toUpperCase()] > 5);
                  return (
                    <div key={msg.id} onClick={() => handleDoubleTap(msg.profile_id)} className={`flex flex-col gap-1 max-w-[95%] cursor-pointer group transition-all`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase group-hover:text-emerald-500">{msg.profiles?.username || 'ANON'}</span>
                        <span className="text-[8px] text-zinc-800 uppercase">{new Date(msg.created_at).toLocaleTimeString()}</span>
                        {msg.is_founder_msg && <span className="text-[8px] bg-emerald-500 text-black px-1 font-black">FOUNDER</span>}
                      </div>
                      <div className={`p-4 rounded-xl border transition-all ${hasHotTag ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] bg-blue-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                        <p className={`text-sm ${hasHotTag ? 'text-blue-100 font-medium' : 'text-zinc-300'}`}>{msg.content}</p>
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
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={activeFrequency ? `REPLYING_TO_#${activeFrequency}...` : "INPUT_SIGNAL..."} className="flex-1 bg-transparent py-4 text-sm text-white outline-none uppercase font-bold" />
                  <button type="submit" className={`p-2 rounded-lg text-black ${activeFrequency ? 'bg-blue-500' : 'bg-emerald-500'}`}><ChevronUp size={20}/></button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* MEGAPHONE MODAL */}
      {showMegaModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-emerald-500/30 bg-zinc-950 p-6 rounded-2xl space-y-6">
            <h2 className="text-emerald-500 font-black uppercase flex items-center gap-2"><MegaphoneIcon size={16}/> Global_Takeover</h2>
            <div className="space-y-4">
              <input value={megaMsg} onChange={(e) => setMegaMsg(e.target.value)} placeholder="ENTER_TRANSMISSION..." className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none rounded-lg" />
              <input type="number" value={megaBid} onChange={(e) => setMegaBid(parseInt(e.target.value) || 0)} className="w-full bg-black border border-white/10 p-3 text-sm text-emerald-500 font-black outline-none rounded-lg" />
            </div>
            <button onClick={handleTakeover} className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase">Execute_Broadcast</button>
            <button onClick={() => setShowMegaModal(false)} className="w-full text-[10px] text-zinc-600 uppercase font-black">Abort_Mission</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500 text-black px-4 py-2 rounded text-[10px] font-black uppercase shadow-xl">{toast}</div>}
    </div>
  );
}