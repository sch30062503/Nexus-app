"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, TrendingUp, X, DollarSign, Layers 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  
  // --- STATE ---
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat'>('admin');
  const [loading, setLoading] = useState(true);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- DERIVED DATA ---
  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  
  // Main Hubs (Finance Hub, etc.) - These use 'signal_score' (Lobby points)
  const mainHubs = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  // Sub Tiers (Finance Seed, Finance Whale) - These use 'finance_xp'
  const subTiers = useMemo(() => 
    districts.filter(d => d.parent_slug === activeDistrict?.slug || d.parent_slug === 'finance'), 
  [districts, activeDistrict]);
  
  const isFinanceSector = activeDistrict?.slug.includes('finance');

  const hasHashtag = useMemo(() => /#\w+/.test(newMessage), [newMessage]);
  const currentReward = hasHashtag || activeHashtag ? 5 : 3;

  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [messages]);

  // --- CORE LOGIC ---
  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);

    if (pRes.data) setProfile(pRes.data);
    if (dRes.data) setDistricts(dRes.data);
    setLoading(false);
  };

  const enterRoom = async (district: any) => {
    setView('chat');
    setActiveDistrict(district);
    setActiveHashtag(null);
    
    const { data } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(100);
    
    if (data) setMessages(data);

    const channel = supabase.channel(`room:${district.slug}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `district_slug=eq.${district.slug}` 
      }, 
      async (payload) => {
        const uid = payload.new.user_id;
        const { data: userProfile } = await supabase.from("profiles").select("username, signal_score").eq("id", uid).single();
        const newMessageObj = { ...payload.new, profiles: userProfile };
        setMessages((prev) => [...prev, newMessageObj]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;

    const { error } = await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id,
      signal_content: newMessage,
      target_hub: activeDistrict.slug,
      points_to_add: currentReward
    });

    if (!error) {
      setNewMessage("");
      const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (data) setProfile(data);
    }
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse text-[10px]">SYNCING_RESOURCES...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* GLOBAL NAVIGATION */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button onClick={() => enterRoom(theLobby)} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}>
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {/* Hubs unlocked by Global Signal Score */}
          {mainHubs.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            return (
              <button key={n.slug} disabled={isLocked} onClick={() => enterRoom(n)} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isLocked ? 'text-zinc-800' : 'text-zinc-600 hover:text-white'} ${activeDistrict?.slug === n.slug ? 'text-emerald-400' : ''}`}>
                {isLocked && <Lock size={10} />} {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto text-right">
          <p className="text-[8px] font-black text-zinc-600 uppercase">Global_Signal</p>
          <p className="text-emerald-500 text-sm font-black tabular-nums">{profile.signal_score?.toLocaleString()}</p>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {view === 'admin' ? (
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12">
            <header className="border-b border-white/5 pb-10">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Node_Operator</p>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username}</h2>
            </header>
            <div className="grid grid-cols-3 gap-6">
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Wallet className="text-emerald-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spendable_Signal</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.signal_to_spend || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <BarChart3 className="text-blue-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Global_Score</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.signal_score || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Activity className="text-purple-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sector_XP (Finance)</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.finance_xp || 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex relative">
            {/* SECTOR SIDEBAR (Tiers unlocked by Finance XP) */}
            {isFinanceSector && (
              <aside className="w-52 border-r border-white/5 bg-black flex flex-col p-4 gap-4">
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Layers size={14} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Sector_Tiers</span>
                  </div>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Local_XP: {profile.finance_xp || 0}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  {subTiers.map(tier => {
                    const isLocked = (profile.finance_xp || 0) < tier.min_score;
                    const progress = Math.min(100, ((profile.finance_xp || 0) / tier.min_score) * 100);
                    return (
                      <button key={tier.slug} disabled={isLocked} onClick={() => enterRoom(tier)} className={`text-left p-3 rounded border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' : isLocked ? 'border-zinc-900 text-zinc-800' : 'border-white/5 text-zinc-600 hover:text-white'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold uppercase truncate">{tier.name}</span>
                          {isLocked && <Lock size={8} />}
                        </div>
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* CHAT AREA */}
            <div className="flex-1 flex flex-col">
              <div className="px-8 py-3 border-b border-white/5 bg-black/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isFinanceSector ? <DollarSign size={14} className="text-emerald-500" /> : <Radio size={14} className="text-blue-500" />}
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{activeDistrict.name}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2">
                    <div className="flex items-center gap-2 opacity-50">
                      <span className="text-[9px] font-black uppercase">{m.profiles?.username}</span>
                      <span className="text-[7px] font-bold tabular-nums">[{m.profiles?.signal_score}]</span>
                    </div>
                    <div className="bg-white/[0.01] border-l border-white/5 p-4 rounded-r-sm hover:bg-white/[0.03] transition-colors">
                      <p className="text-[14px] text-zinc-300 leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-2xl mx-auto">
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-sm overflow-hidden focus-within:border-emerald-500/50 transition-all">
                    <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase placeholder:text-zinc-800" placeholder="TRANSMIT_DATA..." />
                    <button type="submit" className="px-8 h-full bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black transition-all">Broadcast</button>
                  </div>
                </form>
              </div>
            </div>

            {/* TRENDING BAR */}
            <aside className="w-64 bg-black border-l border-white/5 p-6 space-y-6">
              <div className="flex items-center gap-2 text-zinc-500"><Hash size={14} /><h3 className="text-[10px] font-black uppercase tracking-widest">Trending</h3></div>
              <div className="space-y-2">
                {trendingTags.map(([tag, count]) => (
                  <div key={tag} className="flex justify-between items-center p-2 bg-white/5 rounded-sm border border-white/5">
                    <span className="text-[9px] font-bold text-zinc-400">{tag}</span>
                    <span className="text-[8px] font-black opacity-30">{count}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}