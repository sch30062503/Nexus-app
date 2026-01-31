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
  const [filterQuery, setFilterQuery] = useState(""); // TUNER STATE
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(1);
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [decree, setDecree] = useState("");
  const [isEditingDecree, setIsEditingDecree] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- DISCOVERY LOGIC: Extract Hashtags ---
  const extractTrendingTags = (msgs: Message[]) => {
    const counts: Record<string, number> = {};
    msgs.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      tags?.forEach(tag => {
        const t = tag.toLowerCase();
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    setTrendingTags(sorted);
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
    setLoading(false);
  };

  const fetchDistrictMessages = async (slug: string) => {
    const { data } = await supabase.from("messages")
      .select("*, profiles(email, signal_score)")
      .eq("district_slug", slug)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data as any);
      extractTrendingTags(data as any);
    }
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
    return () => { supabase.removeChannel(channel); };
  }, [activeDistrict, profile]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, filterQuery]);

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

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center">Tuning Frequencies...</div>;

  return (
    <div className={`min-h-screen flex flex-col font-mono transition-colors duration-1000 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#050505]'} text-zinc-400 overflow-hidden`}>
      
      {/* DECREE BAR */}
      <div className={`w-full py-2 px-4 border-b flex justify-between items-center ${feverMode ? 'bg-red-500/10 border-red-500' : 'bg-amber-500/5 border-amber-500/30'}`}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Genesis_Decree:</span>
          <p className="text-xs text-zinc-300 italic">"{decree}"</p>
        </div>
        {profile.is_founder && <button onClick={() => setIsEditingDecree(true)} className="text-[9px] text-zinc-600 hover:text-white transition-colors">[EDIT_ARCHIVE]</button>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-80 border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black tracking-[0.3em] text-zinc-600 uppercase">Districts</p>
            {profile.is_founder && <button onClick={() => setShowSpawner(!showSpawner)} className="text-[10px] text-amber-500 font-bold underline">SPAWN</button>}
          </div>

          <nav className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {districts.map((d) => (
              <button key={d.slug} onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); setFilterQuery(""); }} 
                className={`w-full text-left p-4 border transition-all rounded ${activeDistrict?.slug === d.slug ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-900 opacity-40 hover:opacity-100 hover:border-zinc-700'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase">{d.name}</span>
                  <span className="text-[8px] opacity-50">SIG: {d.min_score}</span>
                </div>
              </button>
            ))}
          </nav>

          {/* TRENDING TAGS SECTION */}
          <div className="p-4 border border-zinc-900 bg-black/40 rounded">
            <p className="text-[9px] text-zinc-600 mb-3 uppercase tracking-widest font-bold">Live_Frequencies</p>
            <div className="flex flex-wrap gap-2">
              {trendingTags.length > 0 ? trendingTags.map(tag => (
                <button key={tag} onClick={() => setFilterQuery(tag)} className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all">
                  {tag}
                </button>
              )) : <span className="text-[10px] italic text-zinc-800">No active tags...</span>}
            </div>
          </div>

          <div className="p-5 border-t border-zinc-900 bg-black/40">
            <p className="text-[9px] text-zinc-600 mb-1 font-bold">SIGNAL_SCORE</p>
            <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
          </div>
        </aside>

        {/* MAIN FEED */}
        <main className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <header className="p-6 border-b border-zinc-900 bg-black/95 flex justify-between items-center backdrop-blur-xl z-20">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">Stream //</span>
              <span className="text-sm font-black uppercase text-white tracking-widest">{activeDistrict?.name}</span>
            </div>

            {/* THE TUNER UI */}
            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 px-4 py-1.5 rounded-full transition-all focus-within:border-emerald-500/50">
              <span className="text-[9px] text-emerald-500 font-black tracking-tighter">TUNER:</span>
              <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Search signal..." className="bg-transparent outline-none text-[10px] text-zinc-200 w-32" />
              {filterQuery && <button onClick={() => setFilterQuery("")} className="text-[9px] text-zinc-500 hover:text-white">×</button>}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 space-y-4">
            {messages
              .filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase()))
              .map((msg) => (
              <div key={msg.id} className={`group border-l-2 py-2 px-5 transition-all ${msg.is_founder_msg ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex gap-4 items-center mb-1">
                  <span className={`text-[9px] font-black tracking-widest ${msg.is_founder_msg ? 'text-amber-500' : 'text-zinc-500'}`}>
                    {msg.is_founder_msg ? 'GENESIS' : 'CITIZEN'} // {msg.profiles?.email?.split('@')[0].toUpperCase()}
                  </span>
                  <span className="text-[8px] text-zinc-900">{new Date(msg.created_at).toLocaleTimeString()}</span>
                </div>
                <p className={`text-sm leading-relaxed ${msg.is_founder_msg ? 'text-amber-100 font-medium' : 'text-zinc-300'}`}>
                  {msg.content.split(' ').map((word, i) => (
                    word.startsWith('#') ? <span key={i} className="text-emerald-500 font-bold">{word} </span> : word + ' '
                  ))}
                </p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-8 border-t border-zinc-900 bg-black/90">
            <div className="max-w-4xl mx-auto">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isCooldown} 
                placeholder={isCooldown ? "TRANSMITTING..." : `INPUT SIGNAL TO ${activeDistrict?.name.toUpperCase()}... (Use #tags to trend)`} 
                className="w-full bg-transparent outline-none text-sm text-emerald-400 font-bold placeholder:text-zinc-900" />
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}