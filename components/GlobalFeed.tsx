"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GlobalFeed({ activeHub }: { activeHub: string }) {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch existing messages for the selected Hub
    const fetchSignals = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('signals')
        .select(`
          id,
          content,
          created_at,
          points_awarded,
          profiles (username, signal_score)
        `)
        .eq('hub', activeHub)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setSignals(data);
      }
      setLoading(false);
    };

    fetchSignals();

    // 2. Real-time subscription for NEW messages in this Hub
    const channel = supabase
      .channel(`realtime_${activeHub}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'signals', filter: `hub=eq.${activeHub}` }, 
        async (payload) => {
          // Fetch the sender's profile to show their rank/username
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, signal_score')
            .eq('id', payload.new.user_id)
            .single();

          const newSignal = { ...payload.new, profiles: profile };
          setSignals((prev) => [newSignal, ...prev.slice(0, 29)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeHub]);

  if (loading) return <div className="p-4 animate-pulse text-zinc-600 font-mono">INITIALIZING_FEED...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 space-y-4 custom-scrollbar">
      {signals.length === 0 && (
        <div className="text-zinc-700 font-mono text-xs italic">
          NO_SIGNALS_DETECTED_IN_{activeHub}
        </div>
      )}
      
      {signals.map((sig) => (
        <div key={sig.id} className="border-l border-zinc-800 pl-4 py-1 hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">
              {sig.profiles?.username || "unidentified_unit"}
            </span>
            <span className="text-[9px] text-zinc-600">
              [{sig.profiles?.signal_score || 0} RP]
            </span>
            <span className="text-[9px] text-zinc-800">
              {new Date(sig.created_at).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-zinc-300 font-mono text-sm leading-relaxed">
            {sig.content}
          </p>
        </div>
      ))}
    </div>
  );
}