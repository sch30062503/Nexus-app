"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type District = { slug: string; name: string; min_score: number; description: string; last_activity?: string };
type Profile = { id: string; email: string | null; username: string | null; signal_score: number | null; is_founder: boolean | null };
type Message = { id: string; content: string; created_at: string; district_slug: string; is_founder_msg: boolean; profiles?: { username: string, signal_score: number } };

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [filterQuery, setFilterQuery] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [decree, setDecree] = useState("");
  const [isEditingDecree, setIsEditingDecree] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showSpawner, setShowSpawner] = useState(false);
  const [newDist, setNewDist] = useState({ name: '', slug: '', min: 0, desc: '' });
  const [newUsername, setNewUsername] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // SIGNAL TIER LOGIC
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

    const { data: decreeData } = await supabase.from("decrees").select("content").eq("id", 1).single();
    if (decreeData) setDecree(decreeData.content);
    
    setLoading(false);
  };

  const fetchDistrictMessages = async (slug: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", slug).order("created_at", { ascending: true }).limit(100);
    if (data) setMessages(data as any);
  };

  // FOUNDER BURNING LOGIC
  const burnMessage = async (id: string) => {
    if (!profile?.is_founder) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== id));
      triggerToast("SIGNAL PURGED");
    }
  };

  const purgeInactiveDistricts = async () => {
    if (!profile?.is_founder || !confirm("EXECUTE GLOBAL PURGE?")) return;
    const { error } = await supabase.rpc('collapse_dead_districts');
    if (!error) { triggerToast("INACTIVE REALITIES COLLAPSED"); loadNexus(); }
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
      await supabase.rpc('increment_signal_score', { user_id: profile.id, amount: feverMode ? 10 : 5 });
    }
    setNewMessage("");
    setTimeout(() => setIsCooldown(false), 800);
  };

  if (loading || !profile) return <div className="p-10 font-mono text-emerald-500 animate-pulse text-center">ACCESSING ARCHITECT PANEL...</div>;

  return (
    <div className={`min-h-screen flex flex-col font-mono transition-colors duration-1000 ${feverMode ? 'bg-[#1a0505]' : 'bg-[#050505]'} text-zinc-400 overflow-hidden`}>
      
      {/* TOP BAR */}
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
              <input placeholder="District Name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, name: e.target.value})} />
              <input placeholder="slug-name" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, slug: e.target.value})} />
              <input placeholder="Min Signal" type="number" className="w-full bg-black border border-zinc-800 p-2 text-[10px]" onChange={e => setNewDist({...newDist, min: parseInt(e.target.value)})} />
              <button onClick={async () => {
                await supabase.from('districts').insert({ name: newDist.name, slug: newDist.slug, min_score: newDist.min });
                setShowSpawner(false); loadNexus();
              }} className="w-full bg-amber-500 text-black py-2 text-[10px] font-black uppercase">Manifest</button>
              <button onClick={purgeInactiveDistricts} className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-1 text-[8px] font-black uppercase">Collapse Dead Zones</button>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto space-y-2 pr-2">
            {districts.map((d) => (
              <button key={d.slug} onClick={() => { setActiveDistrict(d); fetchDistrictMessages(d.slug); }} className={`w-full text-left p-4 border transition-all rounded ${activeDistrict?.slug === d.slug ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-900 opacity-60'}`}>
                <span className="text-[11px] font-black uppercase">{d.name}</span>
                <p className="text-[8px] text-zinc-600">REQ: {d.min_score}</p>
              </button>
            ))}
          </nav>

          <div className="p-5 border-t border-zinc-900 bg-black/40">
            <p className="text-[9px] text-zinc-600 mb-1 font-bold uppercase">{profile.username || 'CITIZEN'}_SIGNAL</p>
            <p className="text-3xl font-black text-white tracking-tighter">{profile.signal_score?.toLocaleString()}</p>
            {profile.is_founder && (
              <button onClick={() => setFeverMode(!feverMode)} className={`w-full mt-4 p-2 text-[9px] font-black border ${feverMode ? 'bg-red-600 text-white border-red-400' : 'border-red-900 text-red-900'}`}>FEVER_TOGGLE</button>
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col relative bg-black">
          <header className="p-6 border-b border-zinc-900 flex justify-between items-center backdrop-blur-xl z-20">
            <span className="text-sm font-black uppercase text-white tracking-widest">{activeDistrict?.name}</span>
            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 px-4 py-1.5 rounded-full">
              <span className="text-[9px] text-emerald-500 font-black">TUNER:</span>
              <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Search signal..." className="bg-transparent outline-none text-[10px] text-zinc-200 w-32" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-10 space-y-4">
            {messages.filter(m => m.content.toLowerCase().includes(filterQuery.toLowerCase())).map((msg) => (
              <div key={msg.id} className="group border-l-2 py-2 px-5 border-zinc-800 hover:border-zinc-600 transition-all relative">
                <div className="flex gap-4 items-center mb-1">
                  <span className={`text-[9px] font-black tracking-widest ${getTierColor(msg.profiles?.signal_score || 0, msg.is_founder_msg)}`}>
                    {msg.is_founder_msg ? 'GENESIS' : 'CITIZEN'} // {msg.profiles?.username || 'ANONYMOUS'}
                  </span>
                  {profile.is_founder && (
                    <button onClick={() => burnMessage(msg.id)} className="text-[7px] bg-red-900/20 text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-all">BURN_SIGNAL</button>
                  )}
                </div>
                <p className="text-sm text-zinc-300">{msg.content}</p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-8 border-t border-zinc-900">
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="INPUT SIGNAL..." className="w-full bg-transparent outline-none text-sm text-emerald-400 font-bold" />
          </form>
        </main>
      </div>
      {toast && <div className="fixed bottom-24 right-10 bg-emerald-500 text-black px-4 py-2 text-[10px] font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse">{toast}</div>}
    </div>
  );
}