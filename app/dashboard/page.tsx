"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LayoutGrid, Lock, Globe, Wallet, BarChart3, Activity, Hash, Zap, Radio, X, Landmark, Trophy, Users, DollarSign, Layers 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  
  // --- STATE ---
  const [profile, setProfile] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<'admin' | 'chat' | 'leaderboard'>('admin');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // --- DERIVED DATA & ECONOMY ---
  const weeklyTarget = 10000;
  const weeklyProgress = useMemo(() => {
    if (!profile) return 0;
    return Math.min(100, ((profile.signal_to_spend || 0) / weeklyTarget) * 100);
  }, [profile]);

  const theLobby = useMemo(() => districts.find(d => d.slug === 'lobby'), [districts]);
  const mainHubs = useMemo(() => districts.filter(d => !d.parent_slug && d.slug !== 'lobby'), [districts]);
  const subTiers = useMemo(() => districts.filter(d => d.parent_slug === 'finance'), [districts]);
  const isFinanceSector = activeDistrict?.slug === 'finance' || activeDistrict?.slug.startsWith('finance-');
  
  const filteredMessages = useMemo(() => {
    if (!activeHashtag) return messages;
    return messages.filter(m => m.content.includes(activeHashtag));
  }, [messages, activeHashtag]);

  const localizedTrending = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(m => {
      const tags = m.content.match(/#\w+/g);
      if (tags) tags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [messages]);

  // --- CORE FUNCTIONS ---
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

  const loadLeaderboard = async () => {
    setView('leaderboard');
    const { data } = await supabase
      .from("profiles")
      .select("username, signal_to_spend, signal_score, vault_signal")
      .order("signal_to_spend", { ascending: false }).limit(20);
    if (data) setLeaderboard(data);
  };

  const enterRoom = async (district: any) => {
    if (channelRef.current) await supabase.removeChannel(channelRef.current);
    setMessages([]);
    setActiveHashtag(null);
    setView('chat');
    setActiveDistrict(district);
    
    const { data: history } = await supabase.from("messages")
      .select("*, profiles(username, signal_score)")
      .eq("district_slug", district.slug)
      .order("created_at", { ascending: true }).limit(50);
    
    if (history) setMessages(history);

    const channel = supabase.channel(`room_${district.slug}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `district_slug=eq.${district.slug}` 
      }, 
      async (payload) => {
        const { data: senderProfile } = await supabase.from("profiles").select("username, signal_score").eq("id", payload.new.user_id).single();
        setMessages((prev) => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, { ...payload.new, profiles: senderProfile }];
        });
      }).subscribe();
    channelRef.current = channel;
  };

  const transmitSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgToLink = newMessage.trim();
    if (!msgToLink || !profile || !activeDistrict) return;

    setNewMessage("");

    const { error } = await supabase.rpc('submit_weighted_signal', {
      user_id: profile.id,
      signal_content: activeHashtag && !msgToLink.includes(activeHashtag) ? `${msgToLink} ${activeHashtag}` : msgToLink,
      target_hub: activeDistrict.slug,
      points_to_add: (/#\w+/.test(msgToLink) || activeHashtag) ? 5 : 3
    });

    if (!error) {
      const { data: up } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (up) setProfile(up);
    }
  };

  useEffect(() => { loadNexus(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filteredMessages]);

  if (loading || !profile) return <div className="h-screen bg-black flex items-center justify-center text-emerald-500 font-mono text-[10px]">SYNCING_ECONOMY...</div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#020202] text-zinc-400 font-mono overflow-hidden">
      
      {/* GLOBAL NAV */}
      <nav className="h-16 flex items-center border-b border-white/5 bg-black px-6 gap-8 z-50">
        <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'admin' ? 'text-emerald-500 bg-emerald-500/5' : 'hover:text-white'}`}>
          <LayoutGrid size={16} /> <span className="text-xs font-black uppercase">Dashboard</span>
        </button>

        <button onClick={loadLeaderboard} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${view === 'leaderboard' ? 'text-blue-400 bg-blue-400/5' : 'hover:text-white'}`}>
          <Users size={16} /> <span className="text-xs font-black uppercase">Ranks</span>
        </button>

        <div className="w-[1px] h-6 bg-white/10" />

        <div className="flex items-center gap-6">
          {theLobby && (
            <button onClick={() => enterRoom(theLobby)} className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${activeDistrict?.slug === 'lobby' && view === 'chat' ? 'text-blue-400 border border-blue-400/20 shadow-[0_0_10px_rgba(96,165,250,0.1)]' : 'hover:text-white'}`}>
              <Globe size={16} /> <span className="text-xs font-black uppercase">Lobby</span>
            </button>
          )}

          {mainHubs.map(d => (
            <button key={d.slug} disabled={profile.signal_score < d.min_score} onClick={() => enterRoom(d)} className={`text-[10px] font-black uppercase transition-all ${activeDistrict?.slug === d.slug && view === 'chat' ? 'text-emerald-400 underline underline-offset-8' : 'text-zinc-600 hover:text-white'}`}>
              {profile.signal_score < d.min_score && <Lock size={10} className="inline mr-1" />} {d.name}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-8 border-l border-white/5 pl-8">
           <div className="text-right">
              <p className="text-[7px] font-black text-zinc-600 uppercase">Weekly_Pot</p>
              <p className="text-white text-xs font-black tabular-nums">{profile.signal_to_spend?.toLocaleString()}</p>
           </div>
           <div className="text-right">
              <p className="text-[7px] font-black text-emerald-600 uppercase">Global_Status</p>
              <p className="text-emerald-500 text-xs font-black tabular-nums">{profile.signal_score?.toLocaleString()}</p>
           </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {/* VIEW: ADMIN */}
        {view === 'admin' && (
          <div className="h-full max-w-6xl mx-auto p-12 space-y-12 overflow-y-auto">
            <header className="flex justify-between items-end border-b border-white/5 pb-10">
              <div>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.4em]">Node_Operator</p>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{profile.username}</h2>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-600 font-black uppercase">Weekly_Harvest_Target</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981]" style={{ width: `${weeklyProgress}%` }} />
                  </div>
                  <span className="text-xs font-black text-white">{profile.signal_to_spend || 0} / 10k</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-8 bg-zinc-900/30 border border-white/5 group hover:border-emerald-500/20 transition-all">
                <Wallet className="text-emerald-500 mb-6 group-hover:scale-110 transition-all" size={24} />
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Weekly_Pot</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.signal_to_spend || 0}</p>
                <p className="text-[8px] text-zinc-700 mt-2 font-black">RESET: SUN 00:00</p>
              </div>
              <div className="p-8 bg-black border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] group">
                <Landmark className="text-emerald-400 mb-6 group-hover:rotate-12 transition-all" size={24} />
                <p className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-widest">Permanent_Vault</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.vault_signal || 0}</p>
                <p className="text-[8px] text-emerald-700 mt-2 font-black uppercase tracking-tighter">Harvested_Dividends</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <BarChart3 className="text-blue-500 mb-6" size={24} />
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Global_Status</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.signal_score || 0}</p>
              </div>
              <div className="p-8 bg-zinc-900/30 border border-white/5">
                <Activity className="text-purple-500 mb-6" size={24} />
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Finance_XP</p>
                <p className="text-4xl font-black text-white tabular-nums">{profile.finance_xp || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: LEADERBOARD */}
        {view === 'leaderboard' && (
          <div className="h-full max-w-4xl mx-auto p-12 overflow-y-auto">
             <h3 className="text-2xl font-black text-white uppercase mb-8 flex items-center gap-4">
               <Trophy className="text-yellow-500" /> Weekly_Race_To_10K
             </h3>
             <div className="border border-white/5 bg-black/50">
                <div className="grid grid-cols-4 p-4 border-b border-white/10 text-[10px] font-black uppercase text-zinc-500">
                  <span>Operator</span>
                  <span className="text-right">Weekly_Pot</span>
                  <span className="text-right">Vault</span>
                  <span className="text-right">Status</span>
                </div>
                {leaderboard.map((user, i) => (
                  <div key={user.username} className={`grid grid-cols-4 p-4 border-b border-white/5 items-center ${user.username === profile.username ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-white font-bold text-sm">#{i+1} {user.username}</span>
                    <span className={`text-right font-black ${user.signal_to_spend >= 10000 ? 'text-emerald-400' : 'text-zinc-500'}`}>{user.signal_to_spend?.toLocaleString()}</span>
                    <span className="text-right text-zinc-600 text-[10px]">{user.vault_signal?.toLocaleString()}</span>
                    <span className="text-right">
                      {user.signal_to_spend >= 10000 ? <span className="text-[8px] bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded font-black">HARVEST_READY</span> : <span className="text-[8px] text-zinc-800 font-black">GRINDING</span>}
                    </span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* VIEW: CHAT */}
        {view === 'chat' && (
          <div className="h-full flex relative">
            {isFinanceSector && (
              <aside className="w-56 border-r border-white/5 bg-black flex flex-col p-4 gap-4">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <Layers size={14} /><span className="text-[9px] font-black uppercase tracking-tighter">Finance_Tiers</span>
                </div>
                <div className="flex flex-col gap-2">
                  {subTiers.map(tier => {
                    const isLocked = (profile.finance_xp || 0) < tier.min_score;
                    const progress = Math.min(100, ((profile.finance_xp || 0) / (tier.min_score || 1)) * 100);
                    return (
                      <button key={tier.slug} disabled={isLocked} onClick={() => enterRoom(tier)} className={`text-left p-3 rounded border transition-all ${activeDistrict.slug === tier.slug ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]' : isLocked ? 'border-zinc-900 text-zinc-800' : 'border-white/5 text-zinc-600 hover:text-white hover:bg-white/5'}`}>
                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold uppercase truncate">{tier.name}</span>{isLocked && <Lock size={8} />}</div>
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            <div className="flex-1 flex flex-col relative bg-black bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]">
              <div className="px-8 py-3 border-b border-white/5 bg-black/80 flex items-center justify-between z-10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Radio className={isFinanceSector ? 'text-emerald-500' : 'text-blue-400'} size={14} />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{activeDistrict?.name}</span>
                </div>
                {activeHashtag && (
                  <button onClick={() => setActiveHashtag(null)} className="text-[9px] flex items-center gap-1.5 text-emerald-500 hover:text-white uppercase font-black">
                    <X size={12} /> Clear_Filter [{activeHashtag}]
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="max-w-2xl mx-auto p-8 space-y-8">
                  {filteredMessages.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2 opacity-50">
                        <span className="text-[10px] font-black uppercase text-white">{m.profiles?.username}</span>
                        <span className="text-[8px] font-bold">[{m.profiles?.signal_score}]</span>
                      </div>
                      <div className={`bg-white/[0.02] border-l-2 p-4 ${isFinanceSector ? 'border-emerald-500/20' : 'border-blue-500/20'}`}>
                        <p className="text-[15px] text-zinc-300 leading-relaxed font-medium">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black">
                <form onSubmit={transmitSignal} className="max-w-2xl mx-auto">
                  <div className={`flex items-center bg-white/5 border rounded-sm transition-all focus-within:border-emerald-500/50 ${isFinanceSector ? 'border-emerald-500/10' : 'border-white/10'}`}>
                    <input 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      className="flex-1 bg-transparent p-5 text-xs text-white outline-none font-bold uppercase tracking-wider" 
                      placeholder="TRANSMIT_SIGNAL..." 
                    />
                    <button type="submit" className="px-8 h-full bg-zinc-900 text-emerald-500 font-black text-[10px] uppercase border-l border-white/10 hover:bg-emerald-500 hover:text-black transition-all">Broadcast</button>
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
                      <span className="text-[10px] font-bold">{tag}</span>
                      <span className="text-[8px] font-black opacity-30">{count}</span>
                    </button>
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