"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, X, Landmark, Trophy, Users, ShieldAlert, RefreshCcw, Plus, Megaphone, ChevronRight, Pin, TrendingUp 
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
  
  const [globalBroadcast, setGlobalBroadcast] = useState<any>(null);
  const [districtBroadcast, setDistrictBroadcast] = useState<any>(null);
  const [tierBroadcast, setTierBroadcast] = useState<any>(null);
  const [storeTarget, setStoreTarget] = useState<{scope: string, id: string, name: string} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // --- LOGIC RESTORATION ---
  const isFinanceSector = useMemo(() => activeDistrict?.slug === 'finance' || activeDistrict?.slug?.startsWith('finance-'), [activeDistrict]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);
  
  const trendingTags = useMemo(() => {
    const tags: Record<string, number> = {};
    messages.forEach(m => {
      const found = m.content.match(/#\w+/g);
      if (found) found.forEach((t: string) => tags[t] = (tags[t] || 0) + 1);
    });
    return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [messages]);

  const canBroadcastGlobal = useMemo(() => {
    const highestTierRequirement = Math.max(...districts.map(d => d.min_score || 0));
    return (profile?.finance_xp || 0) >= highestTierRequirement;
  }, [profile, districts]);

  const canBroadcastDistrict = useMemo(() => {
    const tier2 = subTiers[1]; 
    return tier2 ? (profile?.finance_xp || 0) >= tier2.min_score : false;
  }, [profile, subTiers]);

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

  const executePurchase = async (scope: string, price: number, targetSlug: string | null) => {
    if (targetSlug === 'lobby') return alert("Lobby sector is a quiet zone.");

    const content = prompt(`Enter ${scope} message:`);
    if (!content) return;

    const { error } = await supabase.rpc('purchase_broadcast', {
      buyer_id: profile.id,
      b_content: content,
      b_scope: scope,
      b_target: targetSlug,
      price: price
    });

    if (error) alert(error.message);
    else { setStoreTarget(null); loadNexus(); }
  };

  const loadNexus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/");
    const [pRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("districts").select("*").order('min_score', { ascending: true })
    ]);
    if (pRes.data) setProfile(pRes.data);
    if (dRes.data) setDistricts(dRes.data);
    loadBroadcasts();
    setLoading(false);
  };

  const enterRoom = async (district: any) => {
    if (channelRef.current) await supabase.removeChannel(channelRef.current);
    setMessages([]);
    setView('chat');
    setActiveDistrict(district);
    const { data: history } = await supabase.from("messages").select("*, profiles(username, signal_score)").eq("district_slug", district.slug).order("created_at", { ascending: true }).limit(50);
    if (history) setMessages(history);
    const channel = supabase.channel(`room_${district.slug}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `district_slug=eq.${district.slug}` }, async (payload) => {
      const { data: senderProfile } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.user_id).single();
      setMessages((prev) => prev.find(m => m.id === payload.new.id) ? prev : [...prev, { ...payload.new, profiles: senderProfile }]);
    }).subscribe();
    channelRef.current = channel;
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !activeDistrict) return;
    const isHashtag = newMessage.includes("#");
    const points = isHashtag ? 5 : 3;
    const content = newMessage;
    setNewMessage("");
    await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id,
      signal_content: content,
      target_hub: activeDistrict.slug,
      points_to_add: points
    });
    loadNexus();
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { loadBroadcasts(); }, [activeDistrict, view]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center text-emerald-500 font-mono text-[10px]">RECALIBRATING_NEXUS...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* GLOBAL ANNOUNCEMENT */}
      {globalBroadcast && (
        <div className="h-8 bg-emerald-600 text-white flex items-center px-6 gap-4 shrink-0 z-[100]">
          <Megaphone size={12} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest">Global:</span>
          <span className="text-[10px] font-bold truncate flex-1">{globalBroadcast.content}</span>
        </div>
      )}

      {/* DASHBOARD NAV */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50 shrink-0">
        <button onClick={() => {setView('admin'); setStoreTarget(null);}} className={`flex items-center justify-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} /> <span className="text-xs font-black uppercase tracking-widest text-white">Dashboard</span>
        </button>
        <div className="flex items-center gap-6 border-l border-white/10 pl-8">
          {districts.filter(d => !d.parent_slug).map(d => (
            <button key={d.slug} disabled={profile.signal_score < d.min_score} onClick={() => enterRoom(d)} className={`flex items-center justify-center text-[10px] font-black uppercase transition-all ${activeDistrict?.slug === d.slug && view === 'chat' ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {view === 'admin' ? (
          /* ADMIN DASHBOARD - UNCHANGED CORE */
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12 overflow-y-auto">
             <header className="border-b border-white/5 pb-8">
                <h2 className="text-4xl font-black text-white uppercase">{profile.username}</h2>
             </header>

             <section className="space-y-6">
              {!storeTarget ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button onClick={() => setStoreTarget({scope: 'tier', id: '', name: ''})} className="p-8 border border-white/5 bg-zinc-900/20 text-left hover:border-emerald-500/40 group">
                    <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">Tier_Ping</p>
                    <p className="text-2xl font-black text-white">-100</p>
                  </button>
                  <button disabled={!canBroadcastDistrict} onClick={() => setStoreTarget({scope: 'district', id: '', name: ''})} className={`p-8 border text-left transition-all ${canBroadcastDistrict ? 'border-white/5 bg-zinc-900/20 hover:border-blue-500/40' : 'opacity-30 cursor-not-allowed'}`}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase mb-2 flex justify-between">District_Pulse {!canBroadcastDistrict && <Lock size={10} />}</p>
                    <p className="text-2xl font-black text-white">-500</p>
                  </button>
                  <button disabled={!canBroadcastGlobal} onClick={() => executePurchase('global', 2000, null)} className={`p-8 border text-left transition-all ${canBroadcastGlobal ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' : 'opacity-30 cursor-not-allowed'}`}>
                    <p className="text-[10px] font-black text-emerald-500 uppercase mb-2 flex justify-between">Global_Broadcast {!canBroadcastGlobal && <Lock size={10} />}</p>
                    <p className="text-2xl font-black text-white">-2,000</p>
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-900/50 border border-emerald-500/20 p-8">
                   <div className="flex justify-between items-center mb-6">
                      <p className="text-xs font-black text-white uppercase">Target {storeTarget.scope}</p>
                      <button onClick={() => setStoreTarget(null)} className="text-[10px] text-zinc-500 uppercase font-black underline">Back</button>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {districts.filter(d => (storeTarget.scope === 'district' ? !d.parent_slug : d.parent_slug) && d.slug !== 'lobby').map(d => {
                          const hasUnlocked = (profile.finance_xp || 0) >= d.min_score;
                          return (
                            <button key={d.slug} disabled={!hasUnlocked} onClick={() => executePurchase(storeTarget.scope, storeTarget.scope === 'district' ? 500 : 100, d.slug)} className={`p-4 border text-[10px] font-black uppercase transition-all ${hasUnlocked ? 'border-white/10 bg-black hover:border-white/30 text-zinc-400' : 'border-red-900/20 bg-black text-zinc-800'}`}>
                              {d.name}
                            </button>
                          );
                      })}
                   </div>
                </div>
              )}
             </section>
          </div>
        ) : (
          /* CHAT VIEW - RESTORED SIDEBARS */
          <div className="h-full flex relative">
            
            {/* LEFT SIDEBAR (TIERS) */}
            {isFinanceSector && (
              <aside className="w-64 border-r border-white/5 bg-black flex flex-col">
                <div className="p-4 border-b border-white/5 bg-zinc-900/30">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Finance_Tiers</p>
                </div>
                <div className="flex-1 p-4 space-y-2">
                  {subTiers.map(tier => (
                    <button key={tier.slug} disabled={profile.finance_xp < tier.min_score} onClick={() => enterRoom(tier)} className={`w-full text-left p-3 border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' : 'border-white/5 text-zinc-600'}`}>
                      <p className="text-[10px] font-black uppercase">{tier.name}</p>
                    </button>
                  ))}
                </div>
              </aside>
            )}
            
            {/* CHAT AREA */}
            <div className="flex-1 flex flex-col bg-black relative">
              <div className="px-8 py-3 border-b border-white/5 flex justify-between items-center bg-black/50 z-10">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                  <Hash size={12} className="text-emerald-500" /> {activeDistrict?.name}
                </span>
                <div className="flex items-center gap-4">
                  <div className="text-[9px] font-black text-zinc-600 uppercase">Worth: <span className={newMessage.includes("#") ? "text-emerald-500" : "text-white"}>{newMessage.includes("#") ? "+5" : "+3"} Signal</span></div>
                  <button onClick={() => setView('admin')} className="text-[9px] text-zinc-600 font-black hover:text-white uppercase ml-4">Exit</button>
                </div>
              </div>

              {tierBroadcast && (
                <div className="mx-8 mt-4 p-4 bg-zinc-900/80 border border-white/10 flex items-start gap-4 shadow-xl">
                  <Pin size={14} className="text-emerald-500 mt-1 rotate-45" />
                  <p className="text-xs text-zinc-200 font-bold leading-relaxed">{tierBroadcast.content}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="group border-l border-white/5 pl-4 hover:border-emerald-500/30 transition-all">
                    <p className="text-[10px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username}</p>
                    <p className="text-zinc-300 text-sm">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-3xl mx-auto flex bg-white/5 border border-white/10">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder="TRANSMIT_SIGNAL..." />
                  <button type="submit" className="px-10 bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black">Send</button>
                </form>
              </div>
            </div>

            {/* RIGHT SIDEBAR (HASHTAGS & DISTRICT PULSE) */}
            <aside className="w-64 border-l border-white/5 bg-black flex flex-col">
               <div className="p-4 bg-zinc-900/50 border-b border-white/5 min-h-[100px]">
                  <p className="text-[9px] font-black text-zinc-500 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <Radio size={12} className="text-blue-500" /> District_Pulse
                  </p>
                  {districtBroadcast ? (
                    <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded">
                       <p className="text-[10px] text-blue-400 font-bold leading-tight">{districtBroadcast.content}</p>
                    </div>
                  ) : (
                    <p className="text-[8px] text-zinc-700 italic">No active district signal...</p>
                  )}
               </div>
               <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <TrendingUp size={14} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Trending</p>
                  </div>
                  <div className="space-y-4">
                    {trendingTags.map(([tag, count]) => (
                      <div key={tag} className="flex justify-between items-center group cursor-pointer" onClick={() => setNewMessage(newMessage + " " + tag)}>
                        <p className="text-[11px] font-black text-white group-hover:text-emerald-500 transition-colors uppercase">{tag}</p>
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