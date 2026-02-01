"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Zap, User, Share2, Wallet } from "lucide-react";

type LeaderboardEntry = {
  username: string;
  signal_score: number;
  weekly_points: number; // NEW
  dividend_earned: number;
};

export default function Leaderboard() {
  const [topUnits, setTopUnits] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; score: number; weekly: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const shareRank = async () => {
    if (!userRank) return;
    
    // NEW: Use weekly_points for the "flex" cost check
    if (userRank.weekly < 50) return alert("INSUFFICIENT_WEEKLY_SIGNAL_TO_FLEX");

    const message = `REACHED_RANK_#${userRank.rank}_OF_${userRank.total}_WITH_${userRank.weekly}_WEEKLY_SIGNAL`;
    
    // Spending 50 weekly points to broadcast rank
    const { data: success } = await supabase.rpc('spend_weekly_points', {
      user_id: (await supabase.auth.getUser()).data.user?.id,
      amount: 50 
    });

    if (success) {
      await supabase.rpc('takeover_megaphone', {
        user_id: (await supabase.auth.getUser()).data.user?.id,
        new_message: message,
        bid_amount: 50
      });
      alert("RANK_BROADCASTED_TO_THE_NEXUS");
    }
  };

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Fetch Top 10 - SORT BY WEEKLY_POINTS NOW
      const { data: topData } = await supabase
        .from("profiles")
        .select("username, signal_score, weekly_points, dividend_earned")
        .order("weekly_points", { ascending: false }) // KEY CHANGE: Rank by weekly activity
        .limit(10);
      
      if (topData) setTopUnits(topData as LeaderboardEntry[]);

      // 2. Fetch Exact Rank via RPC (Update your SQL RPC to use weekly_points if needed)
      if (session?.user) {
        const { data: rankData } = await supabase.rpc('get_user_rank', { 
          target_user_id: session.user.id 
        });

        const { data: profileData } = await supabase
          .from("profiles")
          .select("signal_score, weekly_points")
          .eq("id", session.user.id)
          .single();

        if (rankData && rankData[0] && profileData) {
          setUserRank({ 
            rank: Number(rankData[0].rank), 
            score: profileData.signal_score,
            weekly: profileData.weekly_points, // NEW
            total: Number(rankData[0].total_users)
          });
        }
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  if (loading) return <div className="animate-pulse text-[10px] text-emerald-500 uppercase tracking-widest p-10 text-center">Scanning_Hierarchy...</div>;

  return (
    <div className="w-full h-full flex flex-col font-mono relative">
      <div className="bg-black border border-white/5 rounded-xl overflow-hidden flex-1 overflow-y-auto mb-24 scrollbar-hide">
        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Trophy size={14} className="text-amber-500" /> Weekly_Leaderboard
          </h3>
          <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Competing_For_Shares</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] text-zinc-600 uppercase border-b border-white/5">
                <th className="p-4 font-black">Rank</th>
                <th className="p-4 font-black">Unit_ID</th>
                <th className="p-4 font-black text-right">Weekly_Sig</th>
                <th className="p-4 font-black text-right">Nexus_Rank</th>
              </tr>
            </thead>
            <tbody>
              {topUnits.map((unit, i) => (
                <tr key={unit.username} className="border-b border-white/[0.02] hover:bg-white/[0.05] transition-all group">
                  <td className={`p-4 text-xs font-black ${i < 3 ? 'text-amber-500' : 'text-zinc-500'}`}>#{i + 1}</td>
                  <td className="p-4 text-xs font-black text-white uppercase tracking-tighter group-hover:text-emerald-400">
                    {unit.username || "ANON_UNIT"}
                  </td>
                  <td className="p-4 text-xs text-blue-400 font-bold text-right">
                    {unit.weekly_points?.toLocaleString()}
                  </td>
                  <td className="p-4 text-xs text-emerald-500/50 font-bold text-right">
                    {unit.signal_score?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📍 PERSONAL RANK HUD */}
      {userRank && (
        <div className="absolute bottom-4 left-0 right-0 px-4 z-50">
          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-[0_0_40px_rgba(37,99,235,0.4)] flex items-center justify-between border-t border-white/20">
            <div className="flex items-center gap-3">
              <div className="bg-black/20 p-2 rounded-lg">
                <Trophy size={18} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[8px] font-black uppercase opacity-60 tracking-tighter">Weekly_Standing</span>
                <span className="text-xl font-black italic">#{userRank.rank} <span className="text-[10px] opacity-50 not-italic">/ {userRank.total}</span></span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <button 
                onClick={shareRank}
                className="bg-black/20 hover:bg-black/30 p-2 rounded-lg transition-colors flex items-center gap-2 group"
                title="Broadcast Rank (Costs 50 Weekly)"
              >
                <Share2 size={16} className="group-hover:scale-110 transition-transform"/>
              </button>
              <div className="flex flex-col items-end leading-none">
                <span className="text-[8px] font-black uppercase opacity-60 tracking-tighter">Spendable_Signal</span>
                <span className="text-xl font-black">{userRank.weekly?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}