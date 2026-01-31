"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type District = { slug: string; name: string; min_score: number; description: string; last_activity?: string };
type Profile = { id: string; email: string | null; username: string | null; signal_score: number | null; is_founder: boolean | null };
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profiles?: { username: string, signal_score: number } };
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
  const [isEditingDecree, setIsEditingDecree] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [globalSubjects, setGlobalSubjects] = useState<string[]>([]); 
  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });
  const [newUsername, setNewUsername] = useState("");
  
  // ECONOMY STATES
  const [megaphone, setMegaphone] = useState<Megaphone>({ msg: "WAITING FOR SIGNAL...", bid: 0, owner: "SYSTEM" });
  const [bidInput, setBidInput] = useState<number>(0);
  const [msgInput, setMsgInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
    if (pData) setProfile(pData as Profile);

    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      const target = activeDistrict || dData[0];
      setActiveDistrict(target);
      fetchDistrictMessages(target.slug);
    }

    const { data: megaData } = await supabase.from('global_megaphone').select('*').single();
    if (megaData) setMegaphone({ msg: megaData.current_message, bid: megaData.bid_amount, owner: megaData.owner_username });

    const { data: decreeData } = await supabase.from("decrees").select("content").eq("id", 1).single();
    if (decreeData) setDecree(decreeData.content);
    
    // FETCH GLOBAL TRENDS
    const { data: allMsgs } = await supabase.from("messages").select("content").limit(200);
    if (allMsgs) {
      const counts: Record<string, number> = {};
      allMsgs.forEach(m => {
        const tags = m.content.match(/#\w+/g);
        if (tags) tags.forEach((tag: string) => { counts[tag] = (counts[tag] || 0) + 1; });
      });
      setGlobalSubjects(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5));
    }
    setLoading(false);
  };

  const handleOverride = async () => {
    if (!msgInput || bidInput <= megaphone.bid) return triggerToast("BID TOO LOW");
    if ((profile?.signal_score || 0) < bidInput) return triggerToast("INSUFFICIENT SIGNAL");

    const { data: success } = await supabase.rpc('place_megaphone_bid', {
      user_id: profile?.id,
      new_msg: msgInput.toUpperCase(),
      new_bid: bidInput
    });

    if (success) {
      triggerToast("TRANSMISSION SEIZED");
      setMsgInput("");
      loadNexus();
    } else {
      triggerToast("OVERRIDE FAILED");
    }
  };

  const fetchDistrictMessages = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) {
      setMessages(data as any);
      extractTrendingTags(data as any);
    }
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
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== id));
      triggerToast("SIGNAL PURGED");
    }
  };

  const updateIdentity = async () => {
    if (!newUsername || newUsername.length < 3) return triggerToast("ID TOO SHORT");
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', profile?.id);
    if (!error) {
      triggerToast("IDENTITY ESTABLISHED");
      setProfile(prev => prev ? { ...prev, username: newUsername } : null);
      setNewUsername("");
    } else triggerToast("ID TAKEN");
  };

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!activeDistrict || !profile) return;
    
    // Message Subscription
    const channel = supabase.channel(`nexus-${activeDistrict.slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `district_slug=eq.${activeDistrict.slug}` }, 
        async (payload) => {
          const { data: uData } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => {
            const next = [...prev, { ...payload.new, profiles: uData } as Message];
            extractTrendingTags(next);
            return next;
          });
        }).subscribe();

    // Megaphone Subscription
    const megaSub = supabase.channel('megaphone-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_megaphone' }, (payload) => {
        setMegaphone({ msg: payload.new.current_message, bid: payload.new.bid_amount, owner: payload.new.owner_username });
      }).subscribe();

    const presenceChannel = supabase.channel('online-users');
    presenceChannel.on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presenceChannel.presenceState()).length))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && profile) await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
      });

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(megaSub);
      supabase.removeChannel(presenceChannel); 
    };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    await supabase.from("messages").insert({ content: newMessage, profile_id: profile.id, district_slug: activeDistrict.slug, is_founder_msg: profile.is_founder });
    if (!profile.is_founder) await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: feverMode ? 10 : 5 });
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center">ACCESSING ARCHITECT PANEL...</div>;

  return (
    <div className={`min-h-screen flex flex-col font-mono transition-colors duration-1000 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#050505]'} text-zinc-400 overflow-hidden`}>
      
      {/* 📢 THE GLOBAL MEGAPHONE TICKER */}
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 p-4 flex flex-col md:flex-row gap-4 items-center justify-between z-50">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-emerald-500 animate-pulse uppercase tracking-[0.2em]">Global_Transmission // Stake: {megaphone.bid}</span>
            <span className="text-[9px] text-zinc-600 font-bold tracking-widest">Sovereign: {megaphone.owner}</span>
          </div>
          <p className="text-sm text-white font-black italic tracking-tight uppercase">"{megaphone.msg}"</p>
        </div>
        
        <div className="flex gap-2 bg-black/50 p-2 border border-zinc-800 rounded">
          <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="OVERRIDE_MSG" className="bg-transparent text-[10px] outline-none w-40 text-emerald-400 font-bold" />
          <input type="number" onChange={(e) => setBidInput(parseInt(e.target.value))} placeholder={`MIN:${megaphone.bid + 1}`} className="bg-transparent text-[10px] outline-none w-20 border-l border-zinc-800 pl-2 text-white" />
          <button onClick={handleOverride} className="bg-emerald-500 text-black px-3 py-1 text-[10px] font-black hover:bg-white transition-all">BID</button>
        </div>
      </div>

      {/* GENESIS BAR */}
      <div className={`w-full py-2 px-4 border-b flex justify-between items-center ${feverMode ? 'bg-red-500/10 border-red-500' : 'bg-amber-500/5 border-amber-500/30'}`}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Genesis_Decree:</span>
          {isEditingDecree ? (
            <input value={decree} onChange={(e) => setDecree(e.target.value)} onBlur={async () => { await supabase.from("decrees").update({ content: decree }).eq("id", 1); setIsEditingDecree(false); }} className="bg-transparent border-b border-white/20 text-xs text-white outline-none w-96" autoFocus />
          ) : (
            <p className="text-xs text-zinc-300 italic">"{decree}"</p>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[9px] text-emerald-500 font-bold tracking-tighter animate-pulse">● {onlineCount} ONLINE</span>
          {profile.is_founder && <button onClick={() => setIsEditingDecree(true)} className="text-[9px] text-zinc-600 hover:text-white">[EDIT_DECREE]</button>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-80 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-6">
          <div className="p-4 border border-zinc-800 bg-black/40 rounded">
            <p className="text-[9px] text-zinc-600 mb-2 font-bold uppercase tracking-widest">Identity_Terminal</p>
            <div className="flex gap-2">
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toUpperCase())} placeholder={profile.username || "CLAIM_ID"} className="flex-1 bg-black border border-zinc-800 p-2 text-[10px] text-white outline-none focus:border-emerald-500/50" />
              <button onClick={updateIdentity} className="px-3 bg-zinc-900 text-[10px] hover:bg-emerald-500 hover:text-black transition-all">SYNC</button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black tracking-[0.3em] text-zinc-600 uppercase">Districts</p>
            {profile.is_founder && <button onClick={() => setShowSpawner(!showSpawner)} className="text-[10px] text-amber-500 font-bold underline">SPAWN</button>}
          </div>

          {showSpawner && (
            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded space-y-3">
               <p className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest">Global_Signal_Intel:</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {globalSubjects.map(s => <span key={s} className="text-[8px] bg-zinc-900 px-1 text-zinc-400 border border-zinc-800">{s}</span>)}
              </div>
              <input placeholder="District Name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, name: e.target.value})} />
              <input placeholder="slug-name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, slug: e.target.value})} />
              <input placeholder="Min Signal" type="number" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, min: parseInt(e.target.value)})} />
              <button onClick={async () => {
                await supabase.from('districts').insert({ name: newDist.name, slug: newDist.slug, min_score: newDist.min });
                setShowSpawner(false); loadNexus();
              }} className="w-full bg-amber-500 text-black py-2 text-[10px] font-black uppercase">Manifest Reality</button>
              <button onClick={async () => { if(confirm("EXECUTE PURGE?")) await supabase.rpc('collapse_dead_districts'); loadNexus(); }} className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-1 text-[8px] font-black uppercase">Collapse Dead Zones</button>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto space-y-2 pr-2">
            {districts.map((d) => {
              const isLocked = (profile.signal_score || 0) < d.min_score && !profile.is_founder;
              return (
                <button key={d.slug} disabled={isLocked} onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); }} className={`w-full text-left p-4 border transition-all rounded ${activeDistrict?.slug === d.slug ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-900'} ${isLocked ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:border-zinc-700'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black uppercase">{isLocked ? "RESTRICTED" : d.name}</span>
                    <span className="text-[8px] text-zinc-800">REQ: {d.min_score}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border border-zinc-900 bg-black/40 rounded">
            <p className="text-[9px] text-zinc-600 mb-3 uppercase font-bold tracking-[0.2em]">Live_Frequencies</p>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(tag => (
                <button key={tag} onClick={() => setFilterQuery(tag)} className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all">{tag}</button>
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-zinc-900 bg-black/40">
            <p className="text-[9px] text-zinc-600 mb-1 font-bold uppercase">{profile.username || 'CITIZEN'}_SIGNAL</p>
            <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
            {profile.is_founder && (
              <button onClick={() => setFeverMode(!feverMode)} className={`w-full mt-4 p-2 text-[9px] font-black border transition-all ${feverMode ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'border-red-900 text-red-900'}`}>FEVER_TOGGLE</button>
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <header className="p-6 border-b border-zinc-900 bg-black/95 flex justify-between items-center backdrop-blur-xl z-20">
            <span className="text-sm font-black uppercase text-white tracking-widest">{activeDistrict?.name}</span>
            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 px-4 py-1.5 rounded-full">
              <span className="text-[9px] text-emerald-500 font-black">TUNER:</span>
              <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Search signal..." className="bg-transparent outline-none text-[10px] text-zinc-200 w-32" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 space-y-4">
            {messages.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).map((msg) => (
              <div key={msg.id} className={`group border-l-2 py-2 px-5 transition-all ${msg.is_founder_msg ? 'border-amber-500 bg-amber-500/5 shadow-[inset_10px_0_15px_-10px_rgba(245,158,11,0.1)]' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex gap-4 items-center mb-1">
                  <span className={`text-[9px] font-black tracking-widest ${getTierColor(msg.profiles?.signal_score || 0, msg.is_founder_msg)}`}>
                    {msg.is_founder_msg ? 'GENESIS' : 'CITIZEN'} // {msg.profiles?.username || 'ANONYMOUS'}
                  </span>
                  {profile.is_founder && (
                    <button onClick={() => burnMessage(msg.id)} className="text-[7px] bg-red-900/20 text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white">BURN_SIGNAL</button>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${msg.is_founder_msg ? 'text-amber-100' : 'text-zinc-300'}`}>
                  {msg.content.split(' ').map((word, i) => word.startsWith('#') ? <span key={i} className="text-emerald-500 font-bold">{word} </span> : word + ' ')}
                </p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-8 border-t border-zinc-900 bg-black/90">
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} placeholder={isCooldown ? "TRANSMITTING..." : `INPUT SIGNAL...`} className="w-full bg-transparent outline-none text-sm text-emerald-400 font-bold placeholder:text-zinc-900" />
          </form>
        </main>
      </div>
      {toast && <div className="fixed bottom-24 right-10 bg-emerald-500 text-black px-4 py-2 text-[10px] font-black shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-bounce">{toast}</div>}
    </div>
  );
}