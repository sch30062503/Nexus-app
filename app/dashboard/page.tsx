"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, ChevronUp, Wallet, BarChart3, Activity, Hash, Zap, Radio, TrendingUp, X, DollarSign, Layers 
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
  const nicheSectors = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);

  // FINANCE TIER LOGIC
  const financeTiers = useMemo(() => 
    districts.filter(d => d.slug.includes('finance') || d.parent_slug === 'finance'), 
  [districts]);
  
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

    if (error) {
      console.error("TRANSMISSION_ERROR:", error);
      alert(`System Error: ${error.message}`);
    } else {
      setNewMessage("");
      const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (data) setProfile(data);
    }
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filteredMessages]);

  if (loading || !profile) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse text-[10px] tracking-[0.5em]">
      SYNCING_SYSTEM_RESOURCES
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* HEADER NAVIGATION */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button 
          onClick={() => setView('admin')} 
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          <span className="text-xs font-black uppercase tracking-widest text-shadow-glow">Dashboard</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button 
              onClick={() => enterRoom(theLobby)} 
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 bg-blue-400/5' : 'hover:text-white'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-black uppercase tracking-widest">The_Lobby</span>
            </button>
          )}

          {nicheSectors.map(n => {
            const isLocked = profile.signal_score < n.min_score;
            if (n.slug.includes('-tier-')) return null; // Hide sub-tiers from top nav
            return (
              <button 
                key={n.slug} 
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isLocked ? 'text-zinc-800 cursor-not-allowed' : 'text-zinc-600 hover:text-white'} ${activeDistrict?.slug === n.slug && view === 'chat' ? 'text-emerald-400' : ''}`} 
                disabled={isLocked} 
                onClick={() => enterRoom(n)}
              >
                {isLocked && <Lock size={10} />} {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto text-right">
          <p className="text-[8px] font-black text-zinc-600 uppercase">Signal_Score</p>
          <p className="text-emerald-500 text-sm font-black tabular-nums">{profile.signal_score?.toLocaleString()}</p>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden bg-[#020202]">
        {view === 'admin' ? (
          /* --- DASHBOARD VIEW (LOCKED/NON-INTERACTIVE) --- */
          <div className="h-full overflow-y-auto max-w-6xl mx-auto p-12 space-y-12 animate-in fade-in duration-700">
            <header className="flex justify-between items-end border-b border-white/5 pb-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Node_Operator</p>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username || "ANON_UNIT"}</h2>
              </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Wallet className="text-emerald-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Spendable_Signal</p>
                <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{profile.signal_to_spend || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <BarChart3 className="text-blue-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Power_Level</p>
                <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{profile.signal_score || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Activity className="text-purple-500 mb-6" size={28} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Finance_Progression</p>
                <p className="text-xs text-zinc-400 mt-1 mb-4 uppercase">Sector XP: {profile.finance_xp || 0}</p>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7]" style={{ width: `${Math.min(100, (profile.finance_xp / 1000) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* --- CHAT/DISTRICT INTERFACE --- */
          <div className={`h-full flex relative animate-in slide-in-from-bottom duration-500 ${isFinanceSector ? 'bg-[#050505]' : ''}`}>
            
            {/* FINANCE TIER BAR (Only visible in Finance Hub) */}
            {isFinanceSector && (
              <aside className="w-52 border-r border-white/5 bg-black flex flex-col p-4 gap-4 animate-in slide-in-from-left">
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Layers size={14} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Finance_Tiers</span>
                  </div>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Local_XP: {profile.finance_xp || 0}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  {financeTiers.map(tier => {
                    const isLocked = (profile.finance_xp || 0) < tier.min_score;
                    const progress = Math.min(100, ((profile.finance_xp || 0) / tier.min_score) * 100);
                    
                    return (
                      <button
                        key={tier.slug}
                        disabled={isLocked}
                        onClick={() => enterRoom(tier)}
                        className={`text-left p-3 rounded border transition-all ${
                          activeDistrict.slug === tier.slug 
                          ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]' 
                          : isLocked ? 'border-zinc-900 text-zinc-800' : 'border-white/5 text-zinc-600 hover:text-white'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold uppercase truncate">{tier.name}</span>
                          {isLocked && <Lock size={8} />}
                        </div>
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${isLocked ? 'bg-zinc-800' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* MAIN CHAT AREA */}
            <div className="flex-1 flex flex-col border-r border-white/5 relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]">
              
              <div className={`px-8 py-3 border-b border-white/5 bg-black/80 backdrop-blur-md flex items-center justify-between ${isFinanceSector ? 'border-b-emerald-900/30' : ''}`}>
                <div className="flex items-center gap-3">
                  {isFinanceSector ? <DollarSign className="text-emerald-500 animate-pulse" size={14} /> : <Radio className="text-blue-400 animate-pulse" size={14} />}
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                    {activeDistrict.name}
                  </span>
                </div>
                {activeHashtag && (
                  <button onClick={() => setActiveHashtag(null)} className="text-[8px] flex items-center gap-1 text-zinc-500 hover:text-white uppercase font-black">
                    <X size={10} /> Clear_Filter
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="max-w-2xl mx-auto p-8 space-y-8">
                  {filteredMessages.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1.5 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase ${isFinanceSector ? 'text-emerald-500/50' : 'text-white/50'}`}>{m.profiles?.username || 'ANON_UNIT'}</span>
                        <span className="text-[8px] font-bold text-zinc-700 tabular-nums">[{m.profiles?.signal_score}]</span>
                      </div>
                      <div className={`bg-white/[0.02] border-l p-4 rounded-r-sm ${isFinanceSector ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : 'border-white/10'}`}>
                        <p className={`text-[15px] leading-relaxed font-medium ${isFinanceSector ? 'text-emerald-50/90 font-mono tracking-tight' : 'text-zinc-300'}`}>{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </div>

              {/* INPUT FORM */}
              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-2xl mx-auto">
                  <div className={`relative flex items-center bg-white/5 border rounded-sm transition-all overflow-hidden ${isFinanceSector ? 'border-emerald-500/20 focus-within:border-emerald-500' : 'border-white/10 focus-within:border-emerald-500/50'}`}>
                    <div className="pl-4 text-zinc-700">{isFinanceSector ? <TrendingUp size={14} className="text-emerald-500" /> : <Zap size={14} />}</div>
                    <input 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      placeholder={isFinanceSector ? "EXECUTE_TRADE_SIGNAL..." : "TRANSMIT_SIGNAL..."} 
                      className="flex-1 bg-transparent p-5 text-xs text-white outline-none font-bold uppercase tracking-widest placeholder:text-zinc-800" 
                    />
                    <button 
                      type="submit" 
                      className={`px-8 border-l font-black text-xs uppercase transition-all ${isFinanceSector ? 'bg-emerald-600 text-black border-emerald-500 hover:bg-white' : 'bg-zinc-900 border-white/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}
                    >
                      {isFinanceSector ? 'Commit' : 'Broadcast'}
                    </button>
                  </div>
                  
                  <div className="flex justify-between mt-2">
                    <p className={`text-[8px] uppercase font-black transition-all duration-300 ${currentReward === 5 ? 'text-emerald-400 animate-pulse' : 'text-zinc-700'}`}>
                      {currentReward === 5 ? '>>> HIGH_VALUE_SIGNAL_DETECTED' : '>>> STANDARD_SIGNAL_PROTOCOL'}
                    </p>
                    <p className="text-[8px] text-zinc-500 uppercase font-bold">
                      Potential_Yield: <span className={currentReward === 5 ? 'text-emerald-500' : 'text-zinc-400'}>{currentReward} SP</span>
                    </p>
                  </div>
                </form>
              </div>
            </div>

            {/* RIGHT SIDEBAR (Trending) */}
            <aside className="w-80 bg-black p-6 flex flex-col gap-8">
              <div className="space-y-4">
                <div className={`flex items-center gap-2 ${isFinanceSector ? 'text-emerald-500' : 'text-blue-500'}`}><Hash size={16} /><h3 className="text-[11px] font-black uppercase tracking-widest">{isFinanceSector ? 'Market_Tags' : 'Trending_Signals'}</h3></div>
                <div className="space-y-2 overflow-y-auto max-h-[60vh] scrollbar-hide">
                  {trendingTags.map(([tag, count]) => (
                    <button key={tag} onClick={() => setActiveHashtag(tag)} className={`w-full flex justify-between items-center p-3 rounded-sm border transition-all ${activeHashtag === tag ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white'}`}>
                      <span className="text-[10px] font-bold tracking-widest">{tag}</span>
                      <span className="text-[8px] font-black tabular-nums opacity-50">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`mt-auto p-4 border rounded ${isFinanceSector ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-blue-500/20 bg-blue-500/[0.02]'}`}>
                <p className={`text-[9px] font-black uppercase mb-2 ${isFinanceSector ? 'text-emerald-400' : 'text-blue-400'}`}>{isFinanceSector ? 'Finance Protocol' : 'Mining Protocol'}</p>
                <div className="space-y-1 text-[9px] uppercase font-bold">
                  <div className="flex justify-between"><span className="text-zinc-500">Generic Chat</span><span className="text-zinc-300">3 SP</span></div>
                  <div className="flex justify-between"><span className="text-emerald-500">Hashtag Tagged</span><span className="text-emerald-500">5 SP</span></div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}