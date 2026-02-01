"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock, Users, Trophy, Settings, Coins, Megaphone as MegaphoneIcon } from "lucide-react";
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
  const [filterQuery, setFilterQuery] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(1);
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });
  
  // USERNAME STATES
  const [newUsername, setNewUsername] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [copied, setCopied] = useState(false);

  // MEGAPHONE MODAL STATES
  const [showMegaModal, setShowMegaModal] = useState(false);
  const [megaBid, setMegaBid] = useState(0);
  const [megaMsg, setMegaMsg] = useState("");

  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const lastTap = useRef<number>(0);
  
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM", decayedPrice: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- IDENTITY TUNER LOGIC (FIXED 1000 COST) ---
  const updateIdentity = async () => {
    const CHANGE_COST = 1000;

    if (!newUsername || newUsername.length < 3) return triggerToast("ID_TOO_SHORT");
    if (newUsername.length > 15) return triggerToast("ID_TOO_LONG");
    
    if ((profile?.signal_score || 0) < CHANGE_COST) {
      return triggerToast("INSUFFICIENT_SIGNAL");
    }

    const { data: success, error } = await supabase.rpc('update_username_with_cost', {
      user_id: profile?.id,
      new_username: newUsername.toUpperCase(),
      change_cost: CHANGE_COST
    });
    
    if (success && !error) { 
        triggerToast(`IDENTITY_REWRITTEN_-_${CHANGE_COST}_PTS`); 
        setProfile(prev => prev ? { 
          ...prev, 
          username: newUsername.toUpperCase(),
          signal_score: (prev.signal_score || 0) - CHANGE_COST
        } : null); 
        setNewUsername(""); 
    } else {
        triggerToast("ID_TAKEN_OR_ERROR");
    }
  };

  // --- MEGAPHONE TAKEOVER LOGIC ---
  const handleTakeover = async () => {
    if (!profile || megaBid <= (megaphone.decayedPrice || 0)) {
      return triggerToast("BID_MUST_EXCEED_DECAY");
    }

    const { data, error } = await supabase.rpc('takeover_megaphone', {
      user_id: profile.id,
      new_message: megaMsg.toUpperCase(),
      bid_amount: megaBid
    });

    if (error) {
      triggerToast(error.message);
    } else {
      triggerToast("SIGNAL_BROADCASTED_GLOBALLY");
      setShowMegaModal(false);
      setMegaMsg("");
      setMegaBid(0);
      loadNexus(); 
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('nexus_referral', ref);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const syncReferralWithDB = async (userId: string) => {
    const pendingRef = localStorage.getItem('nexus_referral');
    if (pendingRef) {
      const { data: recruiter } = await supabase.from('profiles').select('id').eq('referral_code', pendingRef).single();
      if (recruiter && recruiter.id !== userId) {
        const { error } = await supabase.from('profiles').update({ referred_by: recruiter.id }).eq('id', userId).is('referred_by', null);
        if (!error) { localStorage.removeItem('nexus_referral'); triggerToast("REFERRAL_ESTABLISHED"); }
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nextMonday = new Date();
      nextMonday.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
      nextMonday.setHours(0, 0, 0, 0);
      const diff = nextMonday.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}H : ${mins}M : ${secs}S`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const copyReferral = () => {
    if (!profile?.referral_code) return;
    const link = `${window.location.origin}/signup?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    triggerToast("LINK_COPIED");
    setTimeout(() => setCopied(false), 2000);
  };

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) { setProfile(pData as Profile); syncReferralWithDB(session.user.id); }
    
    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) { setDistricts(dData); const target = activeDistrict || dData[0]; setActiveDistrict(target); fetchDistrictMessages(target.slug); }
    
    const { data: megaData } = await supabase.rpc('get_decayed_bid');
    if (megaData && megaData[0]) {
      setMegaphone({ 
        msg: megaData[0].current_message, 
        bid: megaData[0].bid_amount, 
        owner: megaData[0].owner_username,
        decayedPrice: megaData[0].decayed_price 
      });
    }
    setLoading(false);
  };

  const fetchDistrictMessages = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) { setMessages(data as any); extractTrendingTags(data as any); }
  };

  const extractTrendingTags = (msgs: Message[]) => {
    const counts: Record<string, number> = {};
    msgs.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach((tag: string) => { counts[tag.toLowerCase()] = (counts[tag.toLowerCase()] || 0) + 1; });
    });
    setTrendingTags(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6));
  };

  const handleDoubleTap = async (targetUserId: string) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (targetUserId === profile?.id) return triggerToast("CANNOT_BOOST_SELF");
      await supabase.rpc('increment_signal_with_dividend', { user_id: targetUserId, amount: 1 });
      triggerToast("SIGNAL_BOOSTED");
    }
    lastTap.current = now;
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

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    await supabase.from("messages").insert({ content: newMessage, profile_id: profile.id, district_slug: activeDistrict.slug, is_founder_msg: profile.is_founder });
    if (!profile.is_founder) {
      const points = feverMode ? 10 : 5;
      await supabase.rpc('increment_signal_with_dividend', { user_id: profile.id, amount: points });
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 text-xs uppercase tracking-widest">Syncing_Nexus...</div>;

  return (
    <div className={`h-[100dvh] flex flex-col font-mono bg-black text-zinc-400 overflow-hidden`}>
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/80 z-[70]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 text-emerald-500 lg:hidden"><Menu size={24} /></button>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">Nexus_Terminal</span>
            <span className="text-xs text-white font-black uppercase tracking-widest">{activeDistrict?.name}</span>
          </div>
        </div>
        <button onClick={() => setShowLeaderboard(!showLeaderboard)} className={`px-3 py-1 rounded text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${showLeaderboard ? 'bg-emerald-500 text-black border-emerald-500' : 'text-emerald-500 border-emerald-500/30'}`}>
          <Trophy size={10} /> {showLeaderboard ? "Close_Rank" : "Rankings"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className={`fixed inset-0 z-[80] lg:relative lg:translate-x-0 w-full sm:w-80 bg-black border-r border-white/5 flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-6 border-b border-white/5">
              <span className="text-xs font-black text-emerald-500 uppercase">Control_Center</span>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={20}/></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            
            {/* 🛠️ IDENTITY TUNER */}
            <div className="space-y-3 p-4 border border-white/10 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-2">
                  <Settings size={10} /> Identity_Tuner
                </p>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                  1000_SIGNAL
                </span>
              </div>
              <div className="flex gap-2">
                <input 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value.toUpperCase())}
                  placeholder={profile.username || "SET_ID..."}
                  className="flex-1 bg-black border border-white/10 p-2 text-[10px] text-white outline-none focus:border-emerald-500 rounded"
                />
                <button onClick={updateIdentity} className="bg-emerald-500 text-black px-3 py-2 text-[9px] font-black rounded uppercase hover:bg-emerald-400">Sync</button>
              </div>
            </div>

            {/* 📢 MEGAPHONE DISPLAY */}
            <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio size={10} className="text-emerald-500 animate-pulse" />
                  <h3 className="text-[10px] text-emerald-500 uppercase tracking-widest">Global_Signal</h3>
                </div>
                <div className="flex items-center gap-1">
                   <Clock size={8} className="text-zinc-600"/>
                   <span className="text-[8px] text-zinc-600 uppercase font-black">Decay_Active</span>
                </div>
              </div>
              <p className="text-[11px] text-white font-bold italic mb-2">"{megaphone.msg}"</p>
              <div className="flex justify-between items-end border-t border-white/5 pt-2 mb-3">
                <div className="flex flex-col">
                  <span className="text-[7px] text-zinc-600 uppercase">Min_Bid</span>
                  <span className="text-xs font-black text-emerald-400">{megaphone.decayedPrice || 10}</span>
                </div>
                <span className="text-[8px] text-zinc-700 font-black uppercase">BY: {megaphone.owner}</span>
              </div>
              <button 
                onClick={() => setShowMegaModal(true)}
                className="w-full py-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-[9px] font-black uppercase rounded hover:bg-emerald-500 hover:text-black transition-all"
              >
                Initiate_Takeover
              </button>
            </div>

            {/* DIVIDEND TRACKER */}
            <div className="p-4 border border-cyan-500/30 bg-cyan-500/5 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                    <Users size={10} className="text-cyan-500" />
                    <h3 className="text-[10px] text-cyan-500/60 uppercase tracking-widest">Network_Dividends</h3>
                </div>
                <p className="text-xl font-black text-white">+{profile.dividend_earned?.toLocaleString() || 0}</p>
            </div>

            {/* 🛰️ TRENDING HASHTAGS */}
            <div className="space-y-4">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-2">
                <Hash size={10} /> Trending_Signal
              </p>
              <div className="flex flex-wrap gap-2">
                {trendingTags.length > 0 ? trendingTags.map(tag => (
                  <button key={tag} onClick={() => {setFilterQuery(tag); setIsSidebarOpen(false);}} className={`text-[9px] border px-2 py-1 rounded font-bold transition-colors ${filterQuery === tag ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}>
                    {tag}
                  </button>
                )) : <span className="text-[8px] text-zinc-800 uppercase">Awaiting_Trends...</span>}
              </div>
            </div>

            {/* RECRUITMENT LINK */}
            <div className="space-y-3 p-4 border border-white/5 bg-white/5 rounded-xl">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-2">
                <Share2 size={10}/> Recruitment
              </p>
              <button onClick={copyReferral} className={`w-full p-3 text-[10px] font-black uppercase border transition-all rounded-lg flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-zinc-900 border-white/10 text-white'}`}>
                {copied ? "LINK_COPIED" : `ID: ${profile.referral_code?.toUpperCase() || '...'}`}
              </button>
            </div>

            {/* ZONES */}
            <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Active_Zones</p>
                {districts.map((d) => (
                    <button key={d.slug} onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded border text-[10px] font-black uppercase ${activeDistrict?.slug === d.slug ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'border-transparent text-zinc-500'}`}>
                      {d.name} <span className="text-[8px] opacity-30">{d.min_score}</span>
                    </button>
                ))}
            </div>
          </div>
        </aside>

        {/* MAIN TERMINAL */}
        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {showLeaderboard ? <Leaderboard /> : (
              <>
                {filterQuery && (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg mb-4">
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">FILTER_ACTIVE: {filterQuery}</span>
                    <button onClick={() => setFilterQuery("")} className="text-[9px] text-white font-black underline uppercase">Clear</button>
                  </div>
                )}
                
                {messages.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).map((msg) => (
                  <div key={msg.id} onClick={() => handleDoubleTap(msg.profile_id)} className="flex flex-col gap-1 max-w-[95%] cursor-pointer active:scale-[0.99] transition-transform">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-zinc-500 uppercase">{msg.profiles?.username || 'ANON'}</span>
                      <span className="text-[8px] text-zinc-800 uppercase">{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className={`p-4 rounded-xl border bg-white/[0.02] border-white/5 text-sm text-zinc-300`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </>
            )}
            <div ref={scrollRef} />
          </div>

          {!showLeaderboard && (
            <div className="p-4 lg:p-8 bg-black">
              <form onSubmit={sendMessage} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-1 focus-within:border-emerald-500/50">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="INPUT_SIGNAL..." className="flex-1 bg-transparent py-4 text-sm text-white outline-none uppercase font-bold" />
                  <button type="submit" className="p-2 bg-emerald-500 rounded-lg text-black"><ChevronUp size={20}/></button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* TAKEOVER MODAL */}
      {showMegaModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-emerald-500/30 bg-zinc-950 p-6 rounded-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                <MegaphoneIcon size={16}/> Global_Takeover
              </h2>
              <button onClick={() => setShowMegaModal(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black">Broadcast_Message</label>
                <input 
                  value={megaMsg} 
                  onChange={(e) => setMegaMsg(e.target.value)}
                  placeholder="ENTER_TRANSMISSION..."
                  className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-500 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-black">Bid_Amount (MIN: {megaphone.decayedPrice + 1})</label>
                <input 
                  type="number"
                  value={megaBid} 
                  onChange={(e) => setMegaBid(parseInt(e.target.value) || 0)}
                  className="w-full bg-black border border-white/10 p-3 text-sm text-emerald-500 font-black outline-none focus:border-emerald-500 rounded-lg"
                />
              </div>
            </div>

            <button 
              onClick={handleTakeover}
              className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              Execute_Broadcast
            </button>
          </div>
        </div>
      )}

      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-4 py-2 rounded text-[10px] font-black uppercase shadow-[0_0_30px_rgba(16,185,129,0.5)]">{toast}</div>}
    </div>
  );
}