"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, X, Landmark, Trophy, Users, ShieldAlert, RefreshCcw, Plus, Megaphone 
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
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const isFinanceSector = useMemo(() => activeDistrict?.slug === 'finance' || activeDistrict?.slug?.startsWith('finance-'), [activeDistrict]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);
  const hasHighYieldTag = useMemo(() => /#\w+/.test(newMessage) || !!activeHashtag, [newMessage, activeHashtag]);
  const currentReward = hasHighYieldTag ? 5 : 3;
  const isDividendEligible = (profile?.signal_to_spend || 0) >= 10000;

  const loadBroadcasts = async () => {
    const { data } = await supabase
      .from('nexus_broadcasts')
      .select('*, profiles(username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const global = data.find(b => b.scope === 'global');
      const district = data.find(b => b.scope === 'district' && b.target_slug === (activeDistrict?.parent_slug || activeDistrict?.slug));
      const tier = data.find(b => b.scope === 'tier' && b.target_slug === activeDistrict?.slug);
      setActiveBroadcast(global || district || tier || null);
    } else {
      setActiveBroadcast(null);
    }
  };

  // --- REPAIRED BROADCAST CALL ---
  const buyBroadcast = async (scope: string, price: number) => {
    if ((profile.vault_signal || 0) < price) return alert("Insufficient Vault Signal");
    
    const content = prompt(`Enter your ${scope} announcement:`);
    if (!content) return;

    // Correctly define the target based on scope
    let target = null;
    if (scope === 'district') {
      target = activeDistrict?.parent_slug || activeDistrict?.slug;
    } else if (scope === 'tier') {
      target = activeDistrict?.slug;
    }

    // We send EVERY parameter explicitly to match the SQL signature exactly
    const { error } = await supabase.rpc('purchase_broadcast', {
      buyer_id: profile.id,
      b_content: content,
      b_scope: scope,
      b_target: target, // This was likely missing/undefined causing the cache error
      price: price
    });

    if (error) {
      console.error("RPC Error:", error);
      alert("Broadcast Failed: " + error.message);
    } else {
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
    setActiveHashtag(null);
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
      points_to_add: currentReward
    });
    loadNexus();
  };

  const triggerManualHarvest = async () => {
    if (!confirm("Confirm Weekly Harvest?")) return;
    const { error } = await supabase.rpc('weekly_nexus_harvest');
    if (!error) loadNexus();
  };

  const injectTestSignal = async (amount: number) => {
    await supabase.from('profiles').update({ signal_to_spend: (profile.signal_to_spend || 0) + amount }).eq('id', profile.id);
    loadNexus();
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { loadBroadcasts(); }, [activeDistrict]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center text-emerald-500 font-mono text-[10px]">RECALIBRATING_NEXUS...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {activeBroadcast && (
        <div className={`h-8 flex items-center px-6 gap-4 shrink-0 transition-colors ${
          activeBroadcast.scope === 'global' ? 'bg-emerald-600 text-white' : 
          activeBroadcast.scope === 'district' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-emerald-400'
        }`}>
          <Megaphone size={12} className="animate-bounce" />
          <span className="text-[9px] font-black uppercase tracking-widest">[{activeBroadcast.scope}_Alert]</span>
          <span className="text-[10px] font-bold truncate flex-1">
            <span className="opacity-70 mr-2">{activeBroadcast.profiles?.username}:</span>
            {activeBroadcast.content}
          </span>
          <span className="text-[8px] font-black opacity-50 uppercase">Active</span>
        </div>
      )}

      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50 shrink-0">
        <button onClick={() => setView('admin')} className={`flex items-center justify-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} /> <span className="text-xs font-black uppercase">Dashboard</span>
        </button>
        <div className="flex items-center gap-6 border-l border-white/10 pl-8">
          {districts.filter(d => !d.parent_slug).map(d => (
            <button key={d.slug} disabled={profile.signal_score < d.min_score} onClick={() => enterRoom(d)} className={`flex items-center justify-center text-[10px] font-black uppercase transition-all ${activeDistrict?.slug === d.slug && view === 'chat' ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {profile.signal_score < d.min_score && <Lock size={10} className="mr-1" />} {d.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-8 border-l border-white/5 pl-8">
           <div className="text-right">
              <p className="text-[7px] font-black text-zinc-600 uppercase">Weekly_Pot</p>
              <p className={`text-xs font-black ${isDividendEligible ? 'text-emerald-400' : 'text-white'}`}>{profile.signal_to_spend?.toLocaleString()}</p>
           </div>
           <div className="text-right">
              <p className="text-[7px] font-black text-emerald-600 uppercase">Global_Status</p>
              <p className="text-emerald-500 text-xs font-black">{profile.signal_score?.toLocaleString()}</p>
           </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {view === 'admin' ? (
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12 overflow-y-auto">
            <header className="flex justify-between items-end border-b border-white/5 pb-10">
              <div>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.4em]">Node_Operator</p>
                <h2 className="text-4xl font-black text-white uppercase">{profile.username}</h2>
              </div>
              <div className="text-right border-l border-white/5 pl-8">
                <p className="text-[9px] text-zinc-600 font-black uppercase">Vault_Signal</p>
                <p className="text-xl font-black text-emerald-500">{profile.vault_signal?.toLocaleString()}</p>
              </div>
            </header>

            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Nexus_Broadcast_Store</h3>
                <p className="text-[9px] text-zinc-600 font-bold uppercase italic">*Enter a district/tier chat to enable local pulse</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => buyBroadcast('tier', 100)} disabled={!activeDistrict} className={`p-6 border border-white/10 bg-black text-left hover:bg-white/5 transition-all group ${!activeDistrict ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}>
                  <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">Tier_Ping</p>
                  <div className="flex justify-between items-end">
                    <p className="text-xl font-black text-white group-hover:text-emerald-400">-100</p>
                    <span className="text-[8px] font-black uppercase text-zinc-700">Vault</span>
                  </div>
                </button>
                <button onClick={() => buyBroadcast('district', 500)} disabled={!activeDistrict} className={`p-6 border border-blue-500/20 bg-black text-left hover:bg-white/5 transition-all group ${!activeDistrict ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}>
                  <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">District_Pulse</p>
                  <div className="flex justify-between items-end">
                    <p className="text-xl font-black text-white group-hover:text-blue-400">-500</p>
                    <span className="text-[8px] font-black uppercase text-zinc-700">Vault</span>
                  </div>
                </button>
                <button onClick={() => buyBroadcast('global', 2000)} className="p-6 border border-emerald-500/30 bg-black text-left hover:bg-white/5 transition-all group">
                  <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">Global_Signal</p>
                  <div className="flex justify-between items-end">
                    <p className="text-xl font-black text-white group-hover:text-emerald-400">-2,000</p>
                    <span className="text-[8px] font-black uppercase text-zinc-700">Vault</span>
                  </div>
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-10 border-t border-white/5">
              <div className="p-8 bg-zinc-900/30 border border-white/5 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Weekly_Pot</p>
                <p className="text-4xl font-black text-white">{profile.signal_to_spend || 0}</p>
              </div>
              <div className="p-8 bg-black border border-emerald-500/20 text-center">
                <p className="text-[10px] text-emerald-500/50 font-bold uppercase mb-2">Permanent_Vault</p>
                <p className="text-4xl font-black text-white">{profile.vault_signal || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Global_Score</p>
                <p className="text-4xl font-black text-white">{profile.signal_score || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Finance_XP</p>
                <p className="text-4xl font-black text-white">{profile.finance_xp || 0}</p>
              </div>
            </div>

            <div className="mt-20 border border-red-500/10 bg-red-500/5 p-8 flex gap-4 items-center">
               <ShieldAlert size={16} className="text-red-500" />
               <button onClick={() => injectTestSignal(5000)} className="bg-white/5 border border-white/10 px-4 py-2 text-[9px] font-black uppercase">Add 5k Pot</button>
               <button onClick={triggerManualHarvest} className="bg-red-500/10 border border-red-500/20 px-4 py-2 text-[9px] font-black text-red-400 uppercase ml-auto">Force Harvest</button>
            </div>
          </div>
        ) : (
          <div className="h-full flex relative">
            {isFinanceSector && (
              <aside className="w-52 border-r border-white/5 bg-black flex flex-col p-4 gap-4">
                {subTiers.map(tier => (
                  <button key={tier.slug} disabled={profile.finance_xp < tier.min_score} onClick={() => enterRoom(tier)} className={`text-left p-3 rounded border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' : 'border-white/5 text-zinc-600'}`}>
                    <div className="text-[9px] font-bold uppercase truncate flex justify-between">{tier.name} {profile.finance_xp < tier.min_score && <Lock size={8} />}</div>
                    <div className="h-1 w-full bg-zinc-900 mt-2"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (profile.finance_xp / (tier.min_score || 1)) * 100)}%` }} /></div>
                  </button>
                ))}
              </aside>
            )}
            
            <div className="flex-1 flex flex-col bg-black relative">
              <div className="px-8 py-3 border-b border-white/5 flex justify-between items-center bg-black">
                <span className="text-[10px] font-black text-white uppercase">{activeDistrict?.name}</span>
                <button onClick={() => setView('admin')} className="text-[9px] text-zinc-600 font-bold hover:text-white uppercase">← Exit_Room</button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className="border-l-2 border-white/10 pl-4 py-1">
                    <p className="text-[10px] font-black text-zinc-600 uppercase mb-1">{m.profiles?.username} [{m.profiles?.signal_score}]</p>
                    <p className="text-zinc-300 text-sm">{m.content}</p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-2xl mx-auto flex bg-white/5 border border-white/10">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent p-4 text-xs text-white outline-none font-bold uppercase" placeholder="TRANSMIT..." />
                  <button type="submit" className="px-8 bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black">Send</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}