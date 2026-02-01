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
  const mainHubs = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);
  
  const isFinanceSector = activeDistrict?.slug === 'finance' || activeDistrict?.slug.startsWith('finance-');
  
  const hasHashtag = useMemo(() => /#\w+/.test(newMessage), [newMessage]);
  const currentReward = hasHashtag || activeHashtag ? 5 : 3;

  // Localized Trending
  const localizedTrending = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [messages]);

  // Filtered Message Stream
  const filteredMessages = useMemo(() => {
    if (!activeHashtag) return messages;
    return messages.filter(m => m.content.includes(activeHashtag));
  }, [messages, activeHashtag]);

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
    // CRITICAL FIX: Reset filter immediately on room entry to prevent "tag bleed"
    setActiveHashtag(null);
    setView('chat');
    setActiveDistrict(district);
    
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

    let finalContent = newMessage;
    if (activeHashtag && !finalContent.includes(activeHashtag)) {
      finalContent = `${finalContent} ${activeHashtag}`;
    }

    const { error } = await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id,
      signal_content: finalContent,
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
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filteredMessages]);

  if (loading || !profile) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse text-[10px]">
      SYNCING_RESOURCES...
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* NAV BAR */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button 
          onClick={() => { setView('admin'); setActiveHashtag(null); }} 
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button 
              onClick={() => enterRoom(theLobby)} 
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5 shadow-[0_0_10px_rgba(96,165,250,0.1)]' : 'hover:text-white'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {mainHubs.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            return (
              <button 
                key={n.slug} 
                disabled={isLocked} 
                onClick={() => enterRoom(n)} 
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isLocked ? 'text-zinc-800' : 'text-zinc-600 hover:text-white'} ${activeDistrict?.slug === n.slug && view === 'chat' ? 'text-emerald-400' : ''}`}
              >
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

      <main className="flex-1 overflow-hidden bg-[#020202]">
        {view === 'admin' ? (
          /* DASHBOARD (REMAINS UNCHANGED) */
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12 overflow-y-auto">
            <header className="border-b border-white/5 pb-10">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Node_Operator</p>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username}</h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Finance_XP</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.finance_xp || 0}</p>
              </div>
            </div>
          </div>
        ) : (
          /* CHAT INTERFACE */
          <div className="h-full flex relative">
            
            {isFinanceSector && (
              <aside className="w-52 border-r border-white/5 bg-black flex flex-col p-4 gap-4 animate-in slide-in-from-left">
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-2 text-emerald-500"><Layers size={14} /><span className="text-[9px] font-black uppercase tracking-tighter">Finance_Tiers</span></div>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Local_XP: {profile.finance_xp || 0}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {subTiers.map(tier => {
                    const isLocked = (profile.finance_xp || 0) < tier.min_score;
                    const progress = Math.min(100, ((profile.finance_xp || 0) / tier.min_score) * 100);
                    return (
                      <button 
                        key={tier.slug} 
                        disabled={isLocked} 
                        onClick={() => enterRoom(tier)} 
                        className={`text-left p-3 rounded border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' : isLocked ? 'border-zinc-900 text-zinc-800' : 'border-white/5 text-zinc-600 hover:text-white'}`}
                      >
                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold uppercase truncate">{tier.name}</span>{isLocked && <Lock size={8} />}</div>
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} /></div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            <div className="flex-1 flex flex-col relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]">
              
              <div className="px-8 py-3 border-b border-white/5 bg-black/80 backdrop-blur-md flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  {isFinanceSector ? <DollarSign className="text-emerald-500" size={14} /> : <Radio className="text-blue-400" size={14} />}
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{activeDistrict?.name}</span>
                </div>
                {activeHashtag && (
                  <button onClick={() => setActiveHashtag(null)} className="text-[9px] flex items-center gap-1.5 text-emerald-500 hover:text-white uppercase font-black animate-pulse">
                    <X size={12} /> Clear_Filter [{activeHashtag}]
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="max-w-2xl mx-auto p-8 space-y-8">
                  {filteredMessages.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1.5 animate-in fade-in">
                      <div className="flex items-center gap-2 opacity-50">
                        <span className="text-[10px] font-black uppercase text-white">{m.profiles?.username}</span>
                        <span className="text-[8px] font-bold">[{m.profiles?.signal_score}]</span>
                      </div>
                      <div className={`bg-white/[0.02] border-l p-4 ${isFinanceSector ? 'border-emerald-500/20' : 'border-white/10'}`}>
                        <p className="text-[15px] text-zinc-300 leading-relaxed font-medium">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-2xl mx-auto">
                  <div className={`flex items-center bg-white/5 border rounded-sm transition-all ${isFinanceSector ? 'border-emerald-500/20 focus-within:border-emerald-500' : 'border-white/10 focus-within:border-emerald-500/50'}`}>
                    <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-5 text-xs text-white outline-none font-bold uppercase tracking-widest placeholder:text-zinc-800" placeholder="TRANSMIT_SIGNAL..." />
                    <button type="submit" className="px-8 h-full bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black transition-all">Broadcast</button>
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <p className={`text-[8px] uppercase font-black transition-all duration-300 ${hasHashtag ? 'text-emerald-400 animate-pulse' : 'text-zinc-700'}`}>
                      {hasHashtag ? '>>> HIGH_VALUE_INTEL_DETECTED' : '>>> STANDARD_SIGNAL'}
                    </p>
                    <p className={`text-[8px] uppercase font-black ${hasHashtag ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      Yield: {currentReward} SP
                    </p>
                  </div>
                </form>
              </div>
            </div>

            <aside className="w-80 bg-black border-l border-white/5 p-6 flex flex-col gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-500"><Hash size={16} /><h3 className="text-[11px] font-black uppercase tracking-widest">Trending_Local</h3></div>
                <div className="space-y-2">
                  {localizedTrending.map(([tag, count]) => (
                    <button 
                      key={tag} 
                      onClick={() => setActiveHashtag(tag)} 
                      className={`w-full flex justify-between items-center p-3 rounded-sm border transition-all ${activeHashtag === tag ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'}`}
                    >
                      <span className="text-[10px] font-bold tracking-widest">{tag}</span>
                      <span className="text-[8px] font-black opacity-30">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={`mt-auto p-4 border rounded ${isFinanceSector ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-blue-500/20 bg-blue-500/[0.02]'}`}>
                <p className="text-[9px] font-black uppercase mb-2 text-zinc-500">Yield_Protocol</p>
                <div className="space-y-1 text-[9px] font-bold uppercase">
                  <div className="flex justify-between"><span>Base</span><span className="text-zinc-300">3 SP</span></div>
                  <div className="flex justify-between text-emerald-500"><span>Intel Tag</span><span>5 SP</span></div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}