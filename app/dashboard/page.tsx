"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type District = { slug: string; name: string; min_score: number; description: string; sector: string };
type Profile = { id: string; email: string | null; signal_score: number | null; is_founder: boolean | null };
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profiles?: { email: string, signal_score: number } };

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [heatMap, setHeatMap] = useState<{word: string, count: number}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Spawner State
  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Topic Heat Map Logic ---
  const generateHeatMap = (msgs: Message[]) => {
    const stopWords = new Set(['the', 'and', 'this', 'that', 'with', 'your', 'have', 'just', 'what', 'for']);
    const counts: Record<string, number> = {};
    
    msgs.forEach(m => {
      const words = m.content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
      words.forEach(w => {
        if (w.length > 2 && !stopWords.has(w)) {
          counts[w] = (counts[w] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setHeatMap(sorted);
  };

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");

    const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (pData) setProfile(pData as Profile);

    const { data: dData } = await supabase.from("districts").select("*").order('min_score', { ascending: true });
    if (dData) {
      setDistricts(dData);
      const initialDist = dData[0];
      setActiveDistrict(initialDist);
      
      const { data: mData } = await supabase.from("messages").select("*, profiles(email, signal_score)").eq("district_slug", initialDist.slug).order("created_at", { ascending: true }).limit(50);
      if (mData) {
        setMessages(mData as any);
        if (initialDist.slug === 'plaza') generateHeatMap(mData as any);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadNexus(); }, []);

  useEffect(() => {
    if (!activeDistrict || !profile) return;
    const channel = supabase.channel(`nexus-${activeDistrict.slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `district_slug=eq.${activeDistrict.slug}` }, 
        async (payload) => {
          const { data: uData } = await supabase.from("profiles").select("email, signal_score").eq("id", payload.new.profile_id).single();
          const newMsg = { ...payload.new, profiles: uData } as Message;
          setMessages((prev) => {
            const updated = [...prev, newMsg];
            if (activeDistrict.slug === 'plaza') generateHeatMap(updated);
            return updated;
          });
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const spawnDistrict = async () => {
    const { error } = await supabase.from('districts').insert({
      name: newDist.name, slug: newDist.slug, min_score: newDist.min, description: newDist.desc
    });
    if (!error) {
      triggerToast("DISTRICT MANIFESTED");
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
      await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: 5 });
      setProfile(prev => prev ? { ...prev, signal_score: (prev.signal_score || 0) + 5 } : null);
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 1000);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center">SYNCING MULTIVERSE...</div>;

  return (
    <div className="min-h-screen flex font-mono bg-[#050505] text-zinc-400 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black tracking-[0.3em] text-zinc-600 uppercase">Districts</p>
          {profile.is_founder && <button onClick={() => setShowSpawner(!showSpawner)} className="text-[10px] text-amber-500 font-bold hover:bg-amber-500/10 px-2 py-1 rounded transition-all">[+ SPAWN]</button>}
        </div>

        {/* HEAT MAP (FOUNDER ONLY) */}
        {profile.is_founder && activeDistrict?.slug === 'plaza' && (
          <div className="p-4 rounded border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-[9px] uppercase text-emerald-500 font-bold mb-3 tracking-widest">Plaza_Signal_Heat</p>
            <div className="space-y-2">
              {heatMap.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-1 bg-emerald-500" style={{ width: `${(item.count / heatMap[0].count) * 100}%` }} />
                  <span className="text-[10px] text-zinc-300 uppercase">{item.word}</span>
                </div>
              ))}
              {heatMap.length === 0 && <p className="text-[9px] text-zinc-600 italic">Gathering data...</p>}
            </div>
          </div>
        )}

        {showSpawner && (
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded space-y-2 animate-in fade-in slide-in-from-top-4">
            <input placeholder="Name (e.g. Gaming)" className="w-full bg-black border border-zinc-800 p-2 text-[10px] outline-none" onChange={e => setNewDist({...newDist, name: e.target.value})} />
            <input placeholder="Slug (e.g. gaming)" className="w-full bg-black border border-zinc-800 p-2 text-[10px] outline-none" onChange={e => setNewDist({...newDist, slug: e.target.value})} />
            <input placeholder="Min Signal" type="number" className="w-full bg-black border border-zinc-800 p-2 text-[10px] outline-none" onChange={e => setNewDist({...newDist, min: parseInt(e.target.value)})} />
            <button onClick={spawnDistrict} className="w-full bg-amber-500 text-black py-2 text-[10px] font-black uppercase hover:bg-amber-400">Spawn Reality</button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {districts.map((d) => (
            <button 
              key={d.slug} 
              onClick={() => {
                if (!profile.is_founder && (profile.signal_score || 0) < d.min_score) return triggerToast(`LOCKED: NEED ${d.min_score} SIGNAL`);
                setActiveDistrict(d);
              }}
              className={`w-full text-left p-4 border transition-all rounded group ${activeDistrict?.slug === d.slug ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-900 opacity-60 hover:opacity-100 hover:border-zinc-700'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[11px] font-black uppercase ${activeDistrict?.slug === d.slug ? 'text-white' : 'text-zinc-500'}`}>{d.name}</span>
                <span className="text-[9px] text-zinc-700">SIG: {d.min_score}</span>
              </div>
              <p className="text-[10px] text-zinc-600 italic truncate group-hover:text-zinc-400 transition-colors">{d.description}</p>
            </button>
          ))}
        </nav>

        <div className="p-5 border-t border-zinc-900 bg-black/40">
          <p className="text-[9px] text-zinc-600 mb-1 uppercase tracking-widest font-bold">Signal_Strength</p>
          <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-1 ${profile.is_founder ? 'text-amber-500' : 'text-emerald-500'}`}>{profile.is_founder ? 'GENESIS_LEVEL' : 'CITIZEN_LEVEL'}</p>
        </div>
      </aside>

      {/* MAIN WALL */}
      <main className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <header className="p-6 border-b border-zinc-900 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-[0.3em]">Location //</span>
            <span className="text-sm font-black uppercase tracking-widest text-white">{activeDistrict?.name}</span>
          </div>
          {toast && <span className="text-[10px] font-black text-amber-500 animate-pulse">{toast}</span>}
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`group border-l-2 py-2 px-5 transition-all ${msg.is_founder_msg ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
              <div className="flex gap-4 items-center mb-1">
                <span className={`text-[9px] font-black tracking-widest ${msg.is_founder_msg ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {msg.is_founder_msg ? 'GENESIS' : 'CITIZEN'} // {msg.profiles?.email?.split('@')[0].toUpperCase()}
                </span>
                <span className="text-[8px] text-zinc-800">{new Date(msg.created_at).toLocaleTimeString()}</span>
              </div>
              <p className={`text-sm leading-relaxed ${msg.is_founder_msg ? 'text-amber-100 font-medium' : 'text-zinc-300'}`}>{msg.content}</p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={sendMessage} className="p-8 border-t border-zinc-900 bg-black/90 z-10">
          <div className="max-w-4xl mx-auto flex items-center gap-4 border border-zinc-800 bg-zinc-950/50 p-1 rounded">
            <input 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              disabled={isCooldown}
              placeholder={isCooldown ? "RECHARGING..." : `INPUT SIGNAL TO ${activeDistrict?.name.toUpperCase()}...`} 
              className="flex-1 bg-transparent p-3 outline-none text-xs text-emerald-400 font-bold placeholder:text-zinc-900"
            />
          </div>
        </form>
      </main>
    </div>
  );
}
