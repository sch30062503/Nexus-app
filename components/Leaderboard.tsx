"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, Zap } from "lucide-react";

type LeaderboardEntry = {
  username: string;
  signal_score: number;
  dividend_earned: number;
};

export default function Leaderboard() {
  const [topUnits, setTopUnits] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data } = await supabase
        .from("profiles")
        .select("username, signal_score, dividend_earned")
        .order("signal_score", { ascending: false })
        .limit(10);
      
      if (data) setTopUnits(data as LeaderboardEntry[]);
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  if (loading) return <div className="animate-pulse text-[10px] text-emerald-500 uppercase tracking-widest">Scanning_Frequencies...</div>;

  return (
    <div className="w-full bg-black border border-white/5 rounded-xl overflow-hidden font-mono">
      <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Trophy size={14} className="text-amber-500" /> Global_Ranking
        </h3>
        <span className="text-[9px] text-zinc-500 uppercase">Season_01</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] text-zinc-600 uppercase border-b border-white/5">
              <th className="p-4 font-black">Rank</th>
              <th className="p-4 font-black">Unit_ID</th>
              <th className="p-4 font-black text-right">Signal</th>
              <th className="p-4 font-black text-right">Passive</th>
            </tr>
          </thead>
          <tbody>
            {topUnits.map((unit, i) => (
              <tr key={unit.username} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                <td className="p-4 text-xs font-black text-zinc-500">#{i + 1}</td>
                <td className="p-4 text-xs font-black text-white uppercase tracking-tighter">
                  {unit.username || "ANON_UNIT"}
                </td>
                <td className="p-4 text-xs text-emerald-500 font-bold text-right">
                  {unit.signal_score?.toLocaleString()}
                </td>
                <td className="p-4 text-xs text-cyan-500 font-bold text-right">
                  +{unit.dividend_earned?.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}