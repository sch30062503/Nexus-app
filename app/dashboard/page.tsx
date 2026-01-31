"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type District = { slug: string; name: string; min_score: number; description: string };
type Profile = { id: string; email: string | null; signal_score: number | null; is_founder: boolean | null };
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profiles?: { email: string, signal_score: number } };

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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

    const { data: decreeData } = await supabase.from("decrees").select("content").eq("id", 1).single();
    if (decreeData) setDecree(decreeData.content);
    
    const { data: allMsgs } = await supabase.from("messages").select("content").limit(200);
    if (allMsgs) {
      const counts: Record<string, number> = {};
      allMsgs.forEach(m => {
        const tags = m.content.match(/#\w+/g);
        if (tags) {
          tags.forEach((tag: string) => { counts[tag] = (counts[tag] || 0) + 1; });
        }
      });
      setGlobalSubjects(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5));
    }

    setLoading(false);
  };

  const fetchDistrictMessages = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(email, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) {
      setMessages(data as any);
      extractTrendingTags(data as any);
    }
  };

  const extractTrendingTags = (msgs: Message[]) => {
    const counts: Record<string, number> = {};
    msgs.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) {
        tags.forEach((tag: string) => {
          const t = tag.toLowerCase();
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });
    setTrendingTags(Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5));
  };

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!activeDistrict || !profile) return;
    const channel = supabase.channel(`nexus-${activeDistrict.slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `district_slug=eq.${activeDistrict.slug}` }, 
        async (payload) => {
          const { data: uData } = await supabase.from("profiles").select("email, signal_score").eq("id", payload.new.profile_id).single();
          setMessages((prev) => {
            const next = [...prev, { ...payload.new, profiles: uData } as Message];
            extractTrendingTags(next);
            return next;
          });
        }).subscribe();

    const feverChannel = supabase.channel('global-events').on('broadcast', { event: 'FEVER_TOGGLE' }, (payload) => setFeverMode(payload.payload.active)).subscribe();

    const presenceChannel = supabase.channel('online-users');
    presenceChannel.on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presenceChannel.presenceState()).length)).subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && profile) await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
    });

    return () => { supabase.removeChannel(channel); supabase.removeChannel(feverChannel); supabase.removeChannel(presenceChannel); };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, filterQuery]);

  const toggleFever = () => {
    const newState = !feverMode;
    setFeverMode(newState);
    supabase.channel('global-events').send({ type: 'broadcast', event: 'FEVER_TOGGLE', payload: { active: newState } });
    triggerToast(newState ? "FEVER ENGAGED" : "FEVER EXPIRED");
  };

  const spawnDistrict = async () => {
    if (!newDist.slug || !newDist.name) return triggerToast("MISSING DATA");
    const { error } = await supabase.from('districts').insert({
      name: newDist.name, slug: newDist.slug, min_score: newDist.min, description: newDist.desc
    });
    if (!error) {
      triggerToast("REALITY MANIFESTED");
      setShowSpawner(false);
      loadNexus();
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isCooldown || !activeDistrict) return;
    setIsCooldown(true);
    await supabase.from("messages").insert({ content: newMessage, profile_id: profile.id, district_slug: activeDistrict.slug, is_founder_msg: profile.is_founder });
    if (!profile.is_founder) {
      await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: feverMode ? 10 : 5 });
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center">ACCESSING ARCHITECT PANEL...</div>;

  return (
    <div className={`min-h-screen flex flex-col font-mono transition-colors duration-1000 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#050505]'} text-zinc-400 overflow-hidden`}>
      
      <div className={`w-full py-2 px-4 border-b flex justify-between items-center ${feverMode ? 'bg-red-500/10 border-red-500' : 'bg-amber-500/5 border-amber-500/30'}`}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Genesis_Decree:</span>
          {isEditingDecree ? (
            <input value={decree} onChange={(e) => setDecree(e.target.value)} onBlur={async () => { await supabase.from("decrees").update({ content: decree }).eq("id", 1); setIsEditingDecree(false); }} className="bg-transparent border-b border-white/20 text-xs text-white outline-none w-96" autoFocus />
          ) : (
            <p className="text-xs text-zinc-300 italic">"{decree}"</p>
          )}
        </div>
        {profile.is_founder && <button onClick={() => setIsEditingDecree(true)} className="text-[9px] text-zinc-600 hover:text-white">[EDIT]</button>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black tracking-[0.3em] text-zinc-600 uppercase">Districts</p>
            {profile.is_founder && <button onClick={() => setShowSpawner(!showSpawner)} className="text-[10px] text-amber-500 font-bold underline">SPAWN</button>}
          </div>

          {showSpawner && (
            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded space-y-3">
              <p className="text-[8px] text-amber-500/60 font-black uppercase">Global_Signal_Intel:</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {globalSubjects.map(s => <span key={s} className="text-[8px] bg-zinc-900 px-1 text-zinc-400 border border-zinc-800">{s}</span>)}
              </div>
              <input placeholder="District Name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, name: e.target.value})} />
              <input placeholder="slug-name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, slug: e.target.value})} />
              <input placeholder="Min Signal" type="number" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, min: parseInt(e.target.value)})} />
              <button onClick={spawnDistrict} className="w-full bg-amber-500 text-black py-2 text-[10px] font-black uppercase">Finalize Reality</button>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {districts.map((d) => {
              // GATEKEEPER LOGIC: Locked if score too low, unless Founder
              const isLocked = (profile.signal_score || 0) < d.min_score && !profile.is_founder;
              
              return (
                <button key={d.slug} 
                  disabled={isLocked}
                  onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); setFilterQuery(""); }} 
                  className={`w-full text-left p-4 border transition-all rounded relative group
                    ${activeDistrict?.slug === d.slug ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-900'}
                    ${isLocked ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:border-zinc-700 opacity-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-black uppercase ${isLocked ? 'blur-[2px]' : ''}`}>
                      {isLocked ? "RESTRICTED_AREA" : d.name}
                    </span>
                    <span className="text-[8px] text-zinc-800">REQ: {d.min_score}</span>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[7px] text-red-600 font-black tracking-widest bg-black px-1">LOCKED</span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border border-zinc-900 bg-black/40 rounded">
            <p className="text-[9px] text-zinc-600 mb-3 uppercase font-bold tracking-[0.2em]">Live_Frequencies</p>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(tag => (
                <button key={tag} onClick={() => setFilterQuery(tag)} className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all">
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border border-zinc-800 bg-zinc-900/20 rounded">
            <p className="text-[9px] text-zinc-500 mb-3 uppercase text-center font-bold">Presence_Grid</p>
            <div className="flex flex-wrap justify-center gap-2">
              <div className={`h-4 w-4 border border-amber-500 text-amber-500 flex items-center justify-center text-[8px] ${feverMode ? 'animate-ping' : ''}`}>⬢</div>
              {Array.from({ length: Math.max(0, onlineCount - 1) }).map((_, i) => (
                <div key={i} className="h-4 w-4 border border-emerald-500/30 text-emerald-500/50 flex items-center justify-center text-[8px] animate-pulse">⬡</div>
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-zinc-900 bg-black/40">
            <p className="text-[9px] text-zinc-600 mb-1 font-bold">SIGNAL_SCORE</p>
            <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
            {profile.is_founder && (
              <button onClick={toggleFever} className={`w-full mt-4 p-2 text-[9px] font-black border transition-all ${feverMode ? 'bg-red-600 border-red-500 text-white' : 'border-red-900/50 text-red-900 hover:text-red-600 hover:border-red-600'}`}>FEVER_TOGGLE</button>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <header className="p-6 border-b border-zinc-900 bg-black/95 flex justify-between items-center backdrop-blur-xl z-20">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">Stream //</span>
              <span className="text-sm font-black uppercase text-white tracking-widest">{activeDistrict?.name}</span>
            </div>

            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 px-4 py-1.5 rounded-full transition-all focus-within:border-emerald-500/50">
              <span className="text-[9px] text-emerald-500 font-black">TUNER:</span>
              <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Search signal..." className="bg-transparent outline-none text-[10px] text-zinc-200 w-32" />
              {filterQuery && <button onClick={() => setFilterQuery("")} className="text-[9px] text-zinc-500 hover:text-white">×</button>}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 space-y-4">
            {messages.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).map((msg) => (
              <div key={msg.id} className={`group border-l-2 py-2 px-5 transition-all ${msg.is_founder_msg ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex gap-4 items-center mb-1">
                  <span className={`text-[9px] font-black tracking-widest ${msg.is_founder_msg ? 'text-amber-500' : 'text-zinc-500'}`}>
                    {msg.is_founder_msg ? 'GENESIS' : 'CITIZEN'} // {msg.profiles?.email?.split('@')[0].toUpperCase()}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${msg.is_founder_msg ? 'text-amber-100' : 'text-zinc-300'}`}>
                  {msg.content.split(' ').map((word, i) => word.startsWith('#') ? <span key={i} className="text-emerald-500 font-bold">{word} </span> : word + ' ')}
                </p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-8 border-t border-zinc-900 bg-black/90">
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} 
              placeholder={isCooldown ? "TRANSMITTING..." : `INPUT SIGNAL...`} 
              className="w-full bg-transparent outline-none text-sm text-emerald-400 font-bold placeholder:text-zinc-900" />
          </form>
        </main>
      </div>
      {toast && (
        <div className="fixed bottom-24 right-10 bg-emerald-500 text-black px-4 py-2 text-[10px] font-black animate-bounce shadow-[0_0_20px_rgba(16,185,129,0.5)]">
          {toast}
        </div>
      )}
    </div>
  );
}