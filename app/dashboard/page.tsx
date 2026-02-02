"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, X, Landmark, Trophy, Users, ShieldAlert, RefreshCcw, Plus, Megaphone, ChevronRight, Pin, TrendingUp, FilterX 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat' | 'leaderboard'>('admin');
  const [loading, setLoading] = useState(true);
  
  const [signalFilter, setSignalFilter] = useState<string | null>(null);
  const [globalBroadcast, setGlobalBroadcast] = useState<any>(null);
  const [districtBroadcast, setDistrictBroadcast] = useState<any>(null);
  const [tierBroadcast, setTierBroadcast] = useState<any>(null);
  const [storeTarget, setStoreTarget] = useState<{scope: string, id: string, name: string} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const isFinanceSector = useMemo(() => activeDistrict?.slug === 'finance' || activeDistrict?.slug?.startsWith('finance-'), [activeDistrict]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);
  const isBoosted = useMemo(() => newMessage.includes("#") || signalFilter, [newMessage, signalFilter]);

  const filteredMessages = useMemo(() => {
    if (!signalFilter) return messages;
    return messages.filter(m => m.content.toLowerCase().includes(signalFilter.toLowerCase()));
  }, [messages, signalFilter]);

  const trendingTags = useMemo(() => {
    const tags: Record<string, number> = {};
    messages.forEach(m => {
      const found = m.content.match(/#\w+/g);
      if (found) found.forEach((t: string) => tags[t] = (tags[t] || 0) + 1);
    });
    return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [messages]);

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);

    if (pRes.data) setProfile(pRes.data);
    if (dRes.data) {
      setDistricts(dRes.data);
      if (!activeDistrict) {
        const lobby = dRes.data.find(d => d.slug === 'lobby');
        if (lobby) setActiveDistrict(lobby);
      }
    }
    loadBroadcasts();
    setLoading(false);
  };

  const loadBroadcasts = async () => {
    const { data } = await supabase
      .from('nexus_broadcasts')
      .select('*, profiles(username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      setGlobalBroadcast(data.find(b => b.scope === 'global') || null);
      const currentDistrictSlug = activeDistrict?.parent_slug || activeDistrict?.slug;
      setDistrictBroadcast(data.find(b => b.scope === 'district' && b.target_slug === currentDistrictSlug) || null);
      setTierBroadcast(data.find(b => b.scope === 'tier' && b.target_slug === activeDistrict?.slug) || null);
    }
  };

  const enterRoom = async (district: any) => {
    if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
    }

    setMessages([]);
    setSignalFilter(null); 
    setView('chat');
    setActiveDistrict(district);
    
    const { data: history } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true })
      .limit(100);
      
    if (history) setMessages(history);

    const channel = supabase.channel(`room_${district.slug}`).on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages', 
      filter: `district_slug=eq.${district.slug}` 
    }, async (payload) => {
      const { data: senderProfile } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.user_id).single();
      setMessages((prev) => prev.find(m => m.id === payload.new.id) ? prev : [...prev, { ...payload.new, profiles: senderProfile }]);
    }).subscribe();
    
    channelRef.current = channel;
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;
    let finalContent = newMessage;
    if (signalFilter && !finalContent.includes(signalFilter)) finalContent = `${finalContent} ${signalFilter}`;
    const points = finalContent.includes("#") ? 5 : 3;
    setNewMessage("");
    await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id, signal_content: finalContent, target_hub: activeDistrict.slug, points_to_add: points
    });
    loadNexus();
  };

  const executePurchase = async (scope: string, price: number, targetSlug: string | null) => {
    if (targetSlug === 'lobby') return alert("Lobby is protected.");
    const content = prompt(`Enter ${scope} message:`);
    if (!content) return;
    const { error } = await supabase.rpc('purchase_broadcast', {
      buyer_id: profile.id, b_content: content, b_scope: scope, b_target: targetSlug, price: price
    });
    if (error) alert(error.message);
    else { setStoreTarget(null); loadNexus(); }
  };

  // Critical fix: Re-subscribe whenever moving into chat view or changing rooms
  useEffect(() => {
    if (view === 'chat' && activeDistrict) {
        enterRoom(activeDistrict);
    }
  }, [view, activeDistrict?.slug]);

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { loadBroadcasts(); }, [activeDistrict, view]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filteredMessages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center text-emerald-500 font-mono text-[10px]">RECALIBRATING...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      {globalBroadcast && (
        <div className="h-8 bg-emerald-600 text-white flex items-center px-6 gap-4 shrink-0 z-[100]">
          <Megaphone size={12} className="animate-pulse" />
          <span className="text-[10px] font-bold truncate flex-1 uppercase tracking-widest">{globalBroadcast.content}</span>
        </div>
      )}

      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 justify-between z-50 shrink-0">
        <div className="flex items-center gap-8">
          <button onClick={() => setView('admin')} className={`flex items-center justify-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 bg-emerald-500/5' : 'hover:text-white'}`}>
            <LayoutGrid size={16} /> <span className="text-xs font-black uppercase tracking-widest text-white">Dashboard</span>
          </button>
          <div className="flex items-center gap-6 border-l border-white/10 pl-8">
            {districts.filter(d => !d.parent_slug).map(d => (
              <button key={d.slug} disabled={profile.signal_score < d.min_score} onClick={() => enterRoom(d)} className={`text-[10px] font-black uppercase transition-all ${activeDistrict?.slug === d.slug && view === 'chat' ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900/50 border border-white/5 rounded">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Weekly_Total</p>
          <p className="text-sm font-black text-white">{profile.signal_score?.toLocaleString() || 0}</p>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {view === 'admin' ? (
          <div className="h-full max-w-6xl mx-auto p-12 overflow-y-auto space-y-12">
             <header className="border-b border-white/5 pb-8">
                <h2 className="text-4xl font-black text-white uppercase">{profile.username}</h2>
                <div className="px-4 py-2 bg-zinc-900 border border-white/5 rounded inline-block mt-4">
                  <p className="text-[8px] text-zinc-500 uppercase font-black">Vault_Signal</p>
                  <p className="text-xl font-black text-emerald-500">{profile.vault_signal?.toLocaleString()}</p>
                </div>
             </header>

             {/* FULL DASHBOARD SHOP RESTORED */}
             <section className="space-y-6">
                {!storeTarget ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button onClick={() => setStoreTarget({scope: 'tier', id: '', name: ''})} className="p-8 border border-white/5 bg-zinc-900/20 text-left hover:border-emerald-500/40 group">
                      <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">Tier_Ping</p>
                      <p className="text-2xl font-black text-white group-hover:text-emerald-500">-100</p>
                    </button>
                    
                    <button 
                      disabled={profile.signal_score < 500}
                      onClick={() => setStoreTarget({scope: 'district', id: '', name: ''})} 
                      className={`p-8 border border-white/5 text-left transition-all ${profile.signal_score >= 500 ? 'bg-zinc-900/20 hover:border-blue-500/40 group' : 'opacity-20 grayscale cursor-not-allowed'}`}
                    >
                      <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">{profile.signal_score < 500 && <Lock size={10} className="inline mr-2"/>}District_Pulse</p>
                      <p className="text-2xl font-black text-white group-hover:text-blue-500">-500</p>
                    </button>

                    <button 
                      disabled={profile.signal_score < 1000}
                      onClick={() => executePurchase('global', 2000, null)} 
                      className={`p-8 border border-emerald-500/20 text-left transition-all ${profile.signal_score >= 1000 ? 'bg-emerald-500/5 hover:bg-emerald-500/10 group' : 'opacity-20 grayscale cursor-not-allowed'}`}
                    >
                      <p className="text-[10px] font-black text-emerald-500 uppercase mb-2">{profile.signal_score < 1000 && <Lock size={10} className="inline mr-2"/>}Global_Broadcast</p>
                      <p className="text-2xl font-black text-white">-2,000</p>
                    </button>
                  </div>
                ) : (
                  <div className="bg-zinc-900/50 border border-emerald-500/20 p-8 rounded">
                     <div className="flex justify-between items-center mb-6">
                        <p className="text-xs font-black text-white uppercase tracking-widest">Select Target Sector: {storeTarget.scope}</p>
                        <button onClick={() => setStoreTarget(null)} className="text-[10px] text-zinc-500 uppercase font-black underline">Abort</button>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {districts.filter(d => (storeTarget.scope === 'district' ? !d.parent_slug : d.parent_slug) && d.slug !== 'lobby').map(d => (
                          <button key={d.slug} onClick={() => executePurchase(storeTarget.scope, storeTarget.scope === 'district' ? 500 : 100, d.slug)} className="p-4 border border-white/10 bg-black text-[10px] font-black uppercase text-zinc-400 hover:border-white/30">{d.name}</button>
                        ))}
                     </div>
                  </div>
                )}
             </section>
          </div>
        ) : (
          <div className="h-full flex relative">
            {isFinanceSector && (
              <aside className="w-64 border-r border-white/5 bg-black flex flex-col shrink-0">
                <div className="p-4 border-b border-white/5 bg-zinc-900/30 text-[10px] font-black text-zinc-500 uppercase tracking-widest">District_Tiers</div>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {subTiers.map(tier => {
                    const isLocked = profile.finance_xp < tier.min_score;
                    const progress = Math.min(100, Math.round((profile.finance_xp / tier.min_score) * 100));
                    const circumference = 2 * Math.PI * 12;
                    const strokeDashoffset = circumference - (progress / 100) * circumference;
                    return (
                      <button key={tier.slug} disabled={isLocked} onClick={() => enterRoom(tier)} className={`w-full relative flex items-center gap-4 p-3 border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' : isLocked ? 'border-white/5 opacity-40' : 'border-white/5 text-zinc-600 hover:text-white'}`}>
                        <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90">
                            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray={circumference} style={{ strokeDashoffset }} className={isLocked ? "text-zinc-700" : "text-emerald-500"} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">{isLocked ? <Lock size={10} /> : <Zap size={10} />}</div>
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase truncate">{tier.name}</p>
                          {isLocked && <p className="text-[8px] font-bold text-zinc-500 uppercase">{progress}% (Target: {tier.min_score})</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
            
            <div className="flex-1 flex flex-col bg-black relative">
              <div className="px-8 py-3 border-b border-white/5 flex justify-between items-center bg-black/50 z-10">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                  <Hash size={12} className="text-emerald-500" /> {activeDistrict?.name}
                </span>
                {signalFilter && (
                  <button onClick={() => setSignalFilter(null)} className="flex items-center gap-2 px-3 py-1 border border-red-500/40 text-red-500 text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">
                    <FilterX size={12} /> CLEAR_FILTER
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {filteredMessages.map((m) => (
                  <div key={m.id} className="group border-l border-white/5 pl-4 hover:border-emerald-500/30 transition-all">
                    <p className="text-[10px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username}</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <div className="p-8 border-t border-white/5 bg-black flex flex-col items-center">
                <form onSubmit={transmitSignal} className="w-full max-w-3xl flex bg-white/5 border border-white/10 mb-3">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase tracking-wider" placeholder="TRANSMIT_SIGNAL..." />
                  <button type="submit" className="px-10 bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black transition-all">Send</button>
                </form>
                <div className={`text-[10px] font-black uppercase transition-all duration-500 ${isBoosted ? 'text-emerald-500 animate-pulse' : 'text-zinc-500'}`}>
                  Transmission Worth {isBoosted ? '5' : '3'} Signal {signalFilter && `(Tuned to ${signalFilter})`}
                </div>
              </div>
            </div>

            <aside className="w-64 border-l border-white/5 bg-black flex flex-col shrink-0">
               <div className="p-4 bg-zinc-900/50 border-b border-white/5 min-h-[100px]">
                  <p className="text-[9px] font-black text-zinc-500 uppercase mb-3 flex items-center gap-2 tracking-widest">
                    <Radio size={12} className="text-blue-500" /> District_Pulse
                  </p>
                  {districtBroadcast && <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded text-[10px] text-blue-400 font-bold">{districtBroadcast.content}</div>}
               </div>
               <div className="p-6 space-y-6">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2"><TrendingUp size={14}/> Frequencies</p>
                  <div className="space-y-4">
                    {trendingTags.map(([tag, count]) => (
                      <div key={tag} onClick={() => setSignalFilter(tag === signalFilter ? null : tag)} className={`flex justify-between items-center group cursor-pointer p-2 rounded transition-all ${signalFilter === tag ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5'}`}>
                        <p className={`text-[11px] font-black uppercase ${signalFilter === tag ? 'text-emerald-500' : 'text-white'}`}>{tag}</p>
                        <p className="text-[9px] font-black text-zinc-700">{count}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}