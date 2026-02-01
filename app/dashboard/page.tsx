"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Menu, X, ChevronUp, Radio, Zap, ShieldAlert, Target, Hash, Share2, Award, Clock } from "lucide-react";

type District = { slug: string; name: string; min_score: number; description: string; last_activity?: string };
type Profile = { 
  id: string; 
  email: string | null; 
  username: string | null; 
  signal_score: number | null; 
  is_founder: boolean | null;
  prestige_score: number;
  referral_code: string;
};
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profile_id: string; profiles?: { username: string, signal_score: number } };
type Megaphone = { msg: string; bid: number; owner: string };

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
  const [decree, setDecree] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [globalSubjects, setGlobalSubjects] = useState<string[]>([]); 
  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });
  const [newUsername, setNewUsername] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState("");
  const [copied, setCopied] = useState(false);

  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const lastTap = useRef<number>(0);
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM" });
  const [bidInput, setBidInput] = useState<number>(0);
  const [msgInput, setMsgInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- REFERRAL CAPTURE LOGIC ---
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
      const { data: recruiter } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', pendingRef)
        .single();

      if (recruiter && recruiter.id !== userId) {
        const { error } = await supabase
          .from('profiles')
          .update({ referred_by: recruiter.id })
          .eq('id', userId)
          .is('referred_by', null);

        if (!error) {
          localStorage.removeItem('nexus_referral');
          triggerToast("REFERRAL_LINK_ESTABLISHED");
        }
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
    const link = `${window.location.origin}/dashboard?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    triggerToast("LINK COPIED");
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierColor = (score: number, isFounder: boolean) => {
    if (isFounder) return 'text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    if (score >= 10000) return 'text-red-500 font-bold';
    if (score >= 5000) return 'text-purple-400';
    if (score >= 1000) return 'text-cyan-400';
    return 'text-zinc-500';
  };

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) {
      setProfile(pData as Profile);
      syncReferralWithDB(session.user.id);
    }

    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      const target = activeDistrict || dData[0];
      setActiveDistrict(target);
      fetchDistrictMessages(target.slug);
    }

    const { data: megaData } = await supabase.from('global_megaphone').select('*').single();
    if (megaData) setMegaphone({ msg: megaData.current_message, bid: megaData.bid_amount, owner: megaData.owner_username });
    setLoading(false);
  };

  const handleOverride = async (customMsg?: string, customBid?: number) => {
    const finalMsg = customMsg || msgInput;
    const finalBid = customBid || bidInput;
    if (!finalMsg || finalBid <= megaphone.bid) return triggerToast("BID TOO LOW");
    if ((profile?.signal_score || 0) < finalBid) return triggerToast("INSUFFICIENT SIGNAL");
    const { data: success } = await supabase.rpc('place_megaphone_bid', { user_id: profile?.id, new_msg: finalMsg.toUpperCase(), new_bid: finalBid });
    if (success) { triggerToast("TRANSMISSION SEIZED"); setMsgInput(""); loadNexus(); }
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
    setTrendingTags(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5));
  };

  const burnMessage = async (id: string) => {
    if (!profile?.is_founder) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) { setMessages(prev => prev.filter(m => m.id !== id)); triggerToast("SIGNAL PURGED"); }
  };

  const updateIdentity = async () => {
    if (!newUsername || newUsername.length < 3) return triggerToast("ID TOO SHORT");
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', profile?.id);
    if (!error) { triggerToast("IDENTITY ESTABLISHED"); setProfile(prev => prev ? { ...prev, username: newUsername } : null); setNewUsername(""); }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchEnd.current = null;
      touchStart.current = e.targetTouches[0].clientX;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => { if (e.touches.length === 2) touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance < -70) setIsSidebarOpen(true);
  };

  // --- UPDATED DOUBLE TAP WITH DIVIDENDS ---
  const handleDoubleTap = async (targetUserId: string) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (targetUserId === profile?.id) return triggerToast("CANNOT BOOST SELF");
      
      await supabase.rpc('increment_signal_with_dividend', { 
        user_id: targetUserId, 
        amount: 1 
      });
      
      triggerToast("SIGNAL BOOSTED +1");
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

    const megaSub = supabase.channel('megaphone-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_megaphone' }, (payload) => {
        setMegaphone({ msg: payload.new.current_message, bid: payload.new.bid_amount, owner: payload.new.owner_username });
      }).subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(megaSub); };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- UPDATED SEND MESSAGE WITH DIVIDENDS ---
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    
    await supabase.from("messages").insert({ 
      content: newMessage, 
      profile_id: profile.id, 
      district_slug: activeDistrict.slug, 
      is_founder_msg: profile.is_founder 
    });

    if (!profile.is_founder) {
      const points = feverMode ? 10 : 5;
      await supabase.rpc('increment_signal_with_dividend', { 
        user_id: profile.id, 
        amount: points 
      });
    }

    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  const handleMobileBid = () => {
    const msg = prompt("ENTER OVERRIDE MESSAGE:");
    const bid = prompt(`CURRENT BID: ${megaphone.bid}. ENTER HIGHER BID:`);
    if (msg && bid) handleOverride(msg, parseInt(bid));
  };

  if (loading || !profile) return <div className="h-screen flex items-center justify-center bg-black font-mono text-emerald-500 animate-pulse text-xs uppercase tracking-[0.3em]">Syncing Nexus...</div>;

  return (
    <div 
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      className={`h-[100dvh] flex flex-col font-mono transition-colors duration-1000 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#050505]'} text-zinc-400 overflow-hidden select-none`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/80 backdrop-blur-md z-[70]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 text-emerald-500 lg:hidden active:scale-90 transition-transform"><Menu size={24} /></button>
          <div className="flex flex-col cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
            <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">Nexus_Terminal</span>
            <span className="text-xs text-white font-black uppercase tracking-[0.2em] truncate max-w-[140px]">{activeDistrict?.name || "Initializing..."}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-emerald-500 font-black animate-pulse uppercase tracking-tighter">● {onlineCount} Live</span>
          <span className="text-[11px] text-zinc-300 font-black">{profile.signal_score?.toLocaleString()} <span className="text-[7px] text-zinc-600">Pts</span></span>
        </div>
      </div>

      <div className="bg-emerald-500/5 border-b border-emerald-500/20 px-4 py-2 z-40">
        <div className="flex items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={12} className="text-emerald-500 animate-pulse flex-shrink-0" />
            <p className="text-[11px] text-white font-black italic uppercase truncate">"{megaphone.msg}"</p>
          </div>
          <button onClick={handleMobileBid} className="flex-shrink-0 bg-emerald-500 text-black px-2 py-0.5 text-[9px] font-black uppercase rounded">BID</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className={`fixed inset-0 z-[80] transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:relative lg:translate-x-0 lg:z-auto w-full sm:w-80 bg-black/95 backdrop-blur-xl border-r border-white/5 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-6 border-b border-white/5">
             <span className="text-xs font-black text-emerald-500 tracking-[0.2em] uppercase">Control_Center</span>
             <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 lg:hidden"><X size={20}/></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            <div className="mb-8 p-4 border border-emerald-500/40 bg-emerald-500/5 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                    <Award size={10} className="text-emerald-500" />
                    <h3 className="text-[10px] text-emerald-500/60 uppercase tracking-widest">Lifetime_Prestige</h3>
                </div>
                <p className="text-2xl font-black text-white">{profile.prestige_score?.toLocaleString() || 0}</p>
                <div className="h-1 bg-zinc-800 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '40%' }}></div>
                </div>
            </div>

            <div className="space-y-3 p-4 border border-white/5 bg-white/5 rounded-xl">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-2">
                <Share2 size={10}/> Recruit_New_Signal
              </p>
              <button 
                onClick={copyReferral}
                className={`w-full p-3 text-[10px] font-black uppercase border transition-all rounded-lg flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-zinc-900 border-white/10 text-white hover:border-emerald-500/50'}`}
              >
                {copied ? "COPIED" : `ID: ${profile.referral_code?.toUpperCase() || '...'}`}
              </button>
              <p className="text-[8px] text-zinc-500 text-center leading-tight uppercase">Earn 25% Dividends from units recruited via this code.</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Zones</p>
                {profile.is_founder && <button onClick={() => setShowSpawner(!showSpawner)} className="text-[10px] text-amber-500 underline font-black uppercase tracking-widest">Spawn</button>}
              </div>

              {showSpawner && (
                <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
                  <input placeholder="Name" className="w-full bg-black border border-white/10 p-2 text-[10px] rounded" onChange={e => setNewDist({...newDist, name: e.target.value})} />
                  <input placeholder="slug" className="w-full bg-black border border-white/10 p-2 text-[10px] rounded" onChange={e => setNewDist({...newDist, slug: e.target.value})} />
                  <input placeholder="Min Signal" type="number" className="w-full bg-black border border-white/10 p-2 text-[10px] rounded" onChange={e => setNewDist({...newDist, min: parseInt(e.target.value)})} />
                  <button onClick={async () => { await supabase.from('districts').insert({ name: newDist.name, slug: newDist.slug, min_score: newDist.min }); setShowSpawner(false); loadNexus(); }} className="w-full bg-amber-500 text-black py-2 text-[10px] font-black uppercase rounded">Manifest</button>
                </div>
              )}

              <nav className="space-y-1">
                {districts.map((d) => {
                  const isLocked = (profile.signal_score || 0) < d.min_score && !profile.is_founder;
                  return (
                    <button 
                      key={d.slug} disabled={isLocked} 
                      onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); setIsSidebarOpen(false); }} 
                      className={`w-full flex items-center justify-between p-4 rounded-lg border ${activeDistrict?.slug === d.slug ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'border-transparent text-zinc-500'}`}
                    >
                      <span className="text-xs font-black uppercase tracking-tighter">{d.name}</span>
                      {isLocked ? <Target size={12} className="text-zinc-800" /> : <span className="text-[8px] opacity-50">{d.min_score}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-2">
                <Hash size={10} /> Active_Frequencies
              </p>
              <div className="flex flex-wrap gap-2">
                {trendingTags.length > 0 ? trendingTags.map(tag => (
                  <button key={tag} onClick={() => {setFilterQuery(tag); setIsSidebarOpen(false);}} className="text-[10px] bg-emerald-500/5 border border-emerald-500/20 px-3 py-1 rounded text-emerald-500 font-bold hover:bg-emerald-500 hover:text-black transition-all">
                    {tag}
                  </button>
                )) : <span className="text-[9px] italic text-zinc-800 tracking-widest uppercase">Waiting for signal...</span>}
              </div>
            </div>
          </div>

          <div className="p-6 bg-black border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] text-zinc-600 mb-1 font-black uppercase tracking-widest">Weekly_Signal</p>
                <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
              </div>
              {profile.is_founder && <button onClick={() => setFeverMode(!feverMode)} className={`p-2 text-[8px] font-black border rounded ${feverMode ? 'bg-red-600 border-red-400 text-white' : 'border-red-900 text-red-900'}`}>FEVER</button>}
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-black border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-zinc-600 uppercase">
                <Clock size={10} /> Season_Reset
              </div>
              <span className="text-orange-500 animate-pulse tracking-widest">{timeLeft}</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-6 scrollbar-hide">
            {messages.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => handleDoubleTap(msg.profile_id)}
                className="group flex flex-col gap-1 max-w-[95%] active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black tracking-widest uppercase ${getTierColor(msg.profiles?.signal_score || 0, msg.is_founder_msg)}`}>
                    {msg.profiles?.username || 'ANON'}
                  </span>
                  <span className="text-[8px] text-zinc-700 font-bold uppercase">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className={`p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed border ${msg.is_founder_msg ? 'bg-amber-500/5 border-amber-500/20 text-amber-100' : 'bg-white/[0.03] border-white/5 text-zinc-300'}`}>
                  {msg.content.split(' ').map((word, i) => word.startsWith('#') ? <span key={i} className="text-emerald-500 font-black">{word} </span> : word + ' ')}
                </div>
                {profile.is_founder && <button onClick={(e) => { e.stopPropagation(); burnMessage(msg.id); }} className="text-[8px] text-red-500/40 hover:text-red-500 uppercase font-black self-start mt-1">Burn_Data</button>}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="p-4 lg:p-8 bg-gradient-to-t from-black via-black to-transparent">
            {filterQuery && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] text-emerald-500 font-black uppercase">Filtering by: {filterQuery}</span>
                <button onClick={() => setFilterQuery("")} className="text-[9px] text-zinc-600 underline uppercase">Clear</button>
              </div>
            )}
            <form onSubmit={sendMessage} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-1.5 focus-within:border-emerald-500/50 transition-all">
               <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} placeholder={isCooldown ? "TX..." : "INPUT SIGNAL..."} className="flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-800 uppercase font-bold" />
               <button type="submit" className="p-2.5 bg-emerald-500 rounded-xl text-black active:scale-90 transition-transform"><ChevronUp size={20} strokeWidth={3}/></button>
            </form>
          </div>
        </main>
      </div>

      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">[{toast}]</div>}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[75] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
}