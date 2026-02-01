"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, Activity } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Separate Lobby from Niches
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const niches = useMemo(() => districts.filter(d => d.slug !== 'lobby' && !d.parent_slug), [districts]);

  // Is a Niche active? (Determines if sidebar shows)
  const isNicheActive = useMemo(() => 
    view === 'chat' && activeDistrict && activeDistrict.slug !== 'lobby'
  , [view, activeDistrict]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);
    setProfile(pRes.data);
    setDistricts(dRes.data || []);
    setLoading(false);
  };

  const enterRoom = async (district: any) => {
    setView('chat');
    setActiveDistrict(district);
    const { data } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", district.slug).order("created_at", { ascending: true }).limit(50);
    setMessages(data || []);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse uppercase tracking-[0.4em]">Establishing_Uplink</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* TOP BAR */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button onClick={() => enterRoom(theLobby)} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}>
              <Globe size={16} /> The_Lobby
            </button>
          )}

          {niches.map(n => {
            const locked = profile.signal_score < n.min_score;
            return (
              <button key={n.slug} disabled={locked} onClick={() => enterRoom(n)} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'chat' && activeDistrict?.slug === n.slug ? 'text-white underline underline-offset-8 decoration-emerald-500' : locked ? 'text-zinc-800' : 'text-zinc-600 hover:text-white'}`}>
                {locked && <Lock size={10} />} {n.name}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR - ONLY FOR NICHES */}
        {isNicheActive && (
          <aside className="w-64 border-r border-white/5 bg-black p-6 flex flex-col animate-in slide-in-from-left duration-300">
            <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-6">{activeDistrict.name} Status</h2>
            <div className="space-y-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded">
                <p className="text-[8px] text-zinc-500 uppercase mb-1">Local Signal</p>
                <p className="text-white text-xs font-black">{profile.signal_score.toLocaleString()} SP</p>
              </div>
            </div>
          </aside>
        )}

        {/* MAIN AREA */}
        <main className="flex-1 overflow-y-auto bg-[#020202]">
          {view === 'admin' ? (
            <div className="max-w-4xl mx-auto p-12 space-y-8">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Admin_Panel</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-zinc-900/30 border border-white/5 rounded-lg">
                  <Wallet className="text-emerald-500 mb-2" size={24} />
                  <p className="text-[10px] text-zinc-500 uppercase">Spendable Balance</p>
                  <p className="text-xl font-black text-white">{profile.signal_to_spend}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 p-8 overflow-y-auto space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="max-w-3xl">
                    <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username} • {m.profiles?.signal_score}</p>
                    <p className="text-sm text-zinc-300">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
              <div className="p-8">
                <form className="max-w-3xl flex bg-white/5 border border-white/10 rounded overflow-hidden">
                  <input className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder="TRANSMIT..." />
                  <button className="px-6 text-emerald-500 font-black text-xs uppercase">Send</button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}