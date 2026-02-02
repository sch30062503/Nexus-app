"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, X, Landmark, Trophy, Users, ShieldAlert, RefreshCcw, Plus, Megaphone, ChevronRight, Pin 
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
  
  // Announcement states
  const [globalBroadcast, setGlobalBroadcast] = useState<any>(null);
  const [districtBroadcast, setDistrictBroadcast] = useState<any>(null);
  const [tierBroadcast, setTierBroadcast] = useState<any>(null);
  
  const [storeTarget, setStoreTarget] = useState<{scope: string, id: string, name: string} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const isFinanceSector = useMemo(() => activeDistrict?.slug === 'finance' || activeDistrict?.slug?.startsWith('finance-'), [activeDistrict]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);

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
    else {
      setStoreTarget(null);
      loadNexus();
    }
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
    const content = newMessage;
    setNewMessage("");
    await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id,
      signal_content: content,
      target_hub: activeDistrict.slug,
      points_to_add: 3
    });
    loadNexus();
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { loadBroadcasts(); }, [activeDistrict, view]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center text-emerald-500 font-mono text-[10px]">RECALIBRATING_NEXUS...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* GLOBAL SLOT */}
      {globalBroadcast && (
        <div className="h-8 bg-emerald-600 text-white flex items-center px-6 gap-4 shrink-0 z-[100]">
          <Megaphone size={12} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest">Global_Signal:</span>
          <span className="text-[10px] font-bold truncate flex-1">
             {globalBroadcast.content} — <span className="opacity-70">@{globalBroadcast.profiles?.username}</span>
          </span>
        </div>
      )}

      {/* DASHBOARD NAV */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50 shrink-0">
        <button onClick={() => {setView('admin'); setStoreTarget(null);}} className={`flex items-center justify-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} /> <span className="text-xs font-black uppercase tracking-widest text-white">Dashboard</span>
        </button>
        <div className="flex items-center gap-6 border-l border-white/10 pl-8">
          {districts.filter(d => !d.parent_slug).map(d => (
            <button key={d.slug} disabled={profile.signal_score < d.min_score} onClick={() => enterRoom(d)} className={`flex items-center justify-center text-[10px] font-black uppercase transition-all ${activeDistrict?.slug === d.slug && view === 'chat' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              {d.name}
            </button>
          ))}
        </div>
        <div className="ml-auto text-right">
          <p className="text-[8px] font-black text-emerald-500 uppercase">Vault_Access</p>
          <p className="text-xs font-bold text-white tracking-widest">{profile.vault_signal?.toLocaleString()}</p>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {view === 'admin' ? (
          /* DASHBOARD MAIN CONTENT */
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12 overflow-y-auto">
             <header className="border-b border-white/5 pb-8">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username}</h2>
                <p className="text-[10px] text-zinc-500 mt-2">Convert Vault Signal into Network Authority.</p>
             </header>

             <section className="space-y-6">
              {!storeTarget ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button onClick={() => setStoreTarget({scope: 'tier', id: '', name: ''})} className="p-8 border border-white/5 bg-zinc-900/20 text-left hover:border-emerald-500/40 transition-all group">
                    <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">Local_Tier_Pin</p>
                    <p className="text-2xl font-black text-white">-100</p>
                  </button>
                  <button onClick={() => setStoreTarget({scope: 'district', id: '', name: ''})} className="p-8 border border-white/5 bg-zinc-900/20 text-left hover:border-blue-500/40 transition-all group">
                    <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">District_Pulse</p>
                    <p className="text-2xl font-black text-white">-500</p>
                  </button>
                  <button onClick={() => executePurchase('global', 2000, null)} className="p-8 border border-emerald-500/20 bg-emerald-500/5 text-left hover:bg-emerald-500/10 transition-all group">
                    <p className="text-[10px] font-black text-emerald-500 uppercase mb-2">Global_Broadcast</p>
                    <p className="text-2xl font-black text-white">-2,000</p>
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-900/50 border border-emerald-500/20 p-8">
                   <div className="flex justify-between items-center mb-6">
                      <p className="text-xs font-black text-white uppercase">Select Target for {storeTarget.scope}</p>
                      <button onClick={() => setStoreTarget(null)} className="text-[10px] text-zinc-500 uppercase font-black underline">Cancel</button>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {districts.filter(d => storeTarget.scope === 'district' ? !d.parent_slug : d.parent_slug).map(d => (
                        <button key={d.slug} onClick={() => executePurchase(storeTarget.scope, storeTarget.scope === 'district' ? 500 : 100, d.slug)} className="p-4 border border-white/10 bg-black hover:border-white/30 text-[10px] font-black uppercase text-zinc-400">
                          {d.name}
                        </button>
                      ))}
                   </div>
                </div>
              )}
             </section>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-10 border-t border-white/5">
                <div className="p-8 bg-zinc-900/30 border border-white/5 text-center">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Weekly_Pot</p>
                  <p className="text-4xl font-black text-white">{profile.signal_to_spend || 0}</p>
                </div>
                <div className="p-8 bg-black border border-emerald-500/20 text-center">
                  <p className="text-[10px] text-emerald-500/50 font-bold uppercase mb-2">Vault_Total</p>
                  <p className="text-4xl font-black text-white">{profile.vault_signal || 0}</p>
                </div>
             </div>
          </div>
        ) : (
          /* CHAT INTERFACE */
          <div className="h-full flex relative">
            
            {/* DISTRICT SIDEBAR */}
            {isFinanceSector && (
              <aside className="w-64 border-r border-white/5 bg-black flex flex-col overflow-hidden">
                {/* DISTRICT SLOT */}
                <div className="p-4 bg-zinc-900/50 border-b border-white/5">
                  <p className="text-[9px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Finance_District</p>
                  {districtBroadcast && (
                    <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded">
                       <p className="text-[10px] text-blue-400 font-bold leading-tight">{districtBroadcast.content}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {subTiers.map(tier => (
                    <button key={tier.slug} disabled={profile.finance_xp < tier.min_score} onClick={() => enterRoom(tier)} className={`w-full text-left p-3 border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' : 'border-white/5 text-zinc-600'}`}>
                      <p className="text-[10px] font-black uppercase">{tier.name}</p>
                    </button>
                  ))}
                </div>
              </aside>
            )}
            
            {/* CHAT MAIN */}
            <div className="flex-1 flex flex-col bg-black relative">
              <div className="px-8 py-3 border-b border-white/5 flex justify-between items-center bg-black/50 backdrop-blur-md z-10">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                  <Hash size={12} className="text-emerald-500" /> {activeDistrict?.name}
                </span>
                <button onClick={() => setView('admin')} className="text-[9px] text-zinc-600 font-black hover:text-white uppercase">Exit_Room</button>
              </div>

              {/* TIER SLOT (PINNED MESSAGE) */}
              {tierBroadcast && (
                <div className="mx-8 mt-4 p-4 bg-zinc-900/80 border border-white/10 flex items-start gap-4">
                  <Pin size={14} className="text-emerald-500 shrink-0 mt-1 rotate-45" />
                  <div>
                    <p className="text-xs text-zinc-200 font-bold leading-relaxed">{tierBroadcast.content}</p>
                    <p className="text-[8px] text-emerald-500/50 mt-1 font-black uppercase">Pinned by {tierBroadcast.profiles?.username}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="group">
                    <p className="text-[10px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username}</p>
                    <p className="text-zinc-300 text-sm border-l border-white/5 pl-4">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-3xl mx-auto flex bg-white/5 border border-white/10">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder="ENTER_TRANSMISSION..." />
                  <button type="submit" className="px-10 bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black transition-all">Send</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}