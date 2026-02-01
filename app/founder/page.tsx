"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldAlert, BarChart3, Users, Zap, ArrowDownCircle } from "lucide-react";

export default function FounderDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      // Security Check: Ensure user is a founder
      const { data: { session } } = await supabase.auth.getSession();
      const { data: p } = await supabase.from("profiles").select("is_founder").eq("id", session?.user.id).single();
      
      if (!p?.is_founder) return window.location.href = "/dashboard";

      const { data } = await supabase.rpc('get_founder_metrics');
      if (data) setMetrics(data[0]);
      setLoading(false);
    }
    fetchMetrics();
  }, []);

  if (loading) return <div className="bg-black h-screen p-10 font-mono text-orange-500">AUTHENTICATING_FOUNDER_LEVEL_ACCESS...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6 lg:p-12">
      <div className="flex items-center gap-4 mb-12 border-b border-orange-500/20 pb-6">
        <ShieldAlert size={32} className="text-orange-500 animate-pulse" />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Founder_Command_Center</h1>
          <p className="text-xs text-orange-500/60 font-black">SYSTEM_ECONOMY_OVERWATCH_V1.0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Total Points in Circulation */}
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <Zap className="text-blue-400" size={20} />
            <span className="text-[10px] bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded">WEEKLY_VOLUME</span>
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase mb-1">Total_Weekly_Signal</p>
          <p className="text-3xl font-black">{metrics?.total_weekly_points?.toLocaleString()}</p>
        </div>

        {/* Metric 2: Active Participants */}
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <Users className="text-emerald-400" size={20} />
            <span className="text-[10px] bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded">PARTICIPATION</span>
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase mb-1">Active_Units_This_Week</p>
          <p className="text-3xl font-black">{metrics?.active_users_weekly?.toLocaleString()}</p>
        </div>

        {/* Metric 3: Points Burned (Spending) */}
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <ArrowDownCircle className="text-red-400" size={20} />
            <span className="text-[10px] bg-red-400/10 text-red-400 px-2 py-0.5 rounded">ECONOMY_DRAIN</span>
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase mb-1">Total_Signal_Burned</p>
          <p className="text-3xl font-black text-red-400">-{metrics?.total_megaphone_spend?.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-12 p-8 border border-orange-500/20 bg-orange-500/5 rounded-3xl">
        <h2 className="text-sm font-black uppercase mb-4 text-orange-500">Estimated_Payout_Logic</h2>
        <div className="space-y-4">
            <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                <span className="text-zinc-500 uppercase">Current_Points_Value</span>
                <span>$ {(metrics?.total_weekly_points * 0.0001).toFixed(2)} USD <span className="text-[10px] opacity-40">(at $0.0001 per pt)</span></span>
            </div>
            <p className="text-[10px] text-zinc-600 italic">This data is only visible to you. Use this to determine the weekly "Share Pot" before the Monday reset.</p>
        </div>
      </div>
    </div>
  );
}