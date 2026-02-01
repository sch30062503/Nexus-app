"use client";

import { useState } from 'react';
import { Users, Zap, Award } from 'lucide-react';

interface UserProfile {
  referral_code: string;
  prestige_score: number;
  dividend_earned: number; // New field
}

export default function NexusSidebar({ userProfile }: { userProfile: UserProfile }) {
  const [copied, setCopied] = useState(false);

  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/signup?ref=${userProfile.referral_code}`
    : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-64 bg-black border-r border-emerald-500/20 p-4 flex flex-col h-screen font-mono">
      {/* 🏛️ PRESTIGE PANEL */}
      <div className="mb-6 p-3 border border-emerald-500/40 bg-emerald-500/5 rounded">
        <div className="flex items-center gap-2 mb-1">
          <Award size={12} className="text-emerald-500" />
          <h3 className="text-[10px] text-emerald-500/60 uppercase tracking-widest">Lifetime_Prestige</h3>
        </div>
        <p className="text-2xl font-black text-white">
          {(userProfile.prestige_score || 0).toLocaleString()}
        </p>
      </div>

      {/* 🟢 NETWORK STRENGTH (PASSIVE INCOME TRACKER) */}
      <div className="mb-8 p-3 border border-white/10 bg-white/5 rounded">
        <div className="flex items-center gap-2 mb-1">
          <Users size={12} className="text-cyan-500" />
          <h3 className="text-[10px] text-cyan-500/60 uppercase tracking-widest">Network_Dividends</h3>
        </div>
        <p className="text-xl font-black text-white">
          +{(userProfile.dividend_earned || 0).toLocaleString()}
          <span className="text-[10px] text-cyan-500 ml-2">PTS</span>
        </p>
        <p className="text-[8px] text-zinc-600 uppercase mt-1">Passive_Signal_Generated</p>
      </div>

      {/* 🔗 RECRUITMENT LINK */}
      <div className="mb-8">
        <h3 className="text-[10px] text-emerald-500/60 uppercase mb-2 tracking-widest flex items-center gap-2">
           <Zap size={10} /> Recruitment_Link
        </h3>
        <button 
          onClick={copyLink}
          className="w-full bg-zinc-900 border border-emerald-500/30 p-2 text-[11px] text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all truncate rounded"
        >
          {copied ? "COPIED_TO_CLIPBOARD" : (userProfile.referral_code || '...').toUpperCase()}
        </button>
        <p className="text-[9px] text-zinc-500 mt-2 leading-tight">
          Units recruited via this link yield <span className="text-emerald-500 font-bold">25% perpetual dividends</span> to your account.
        </p>
      </div>

      {/* 🛰️ SEASON COUNTDOWN */}
      <div className="mt-auto pt-4 border-t border-emerald-500/10">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-zinc-500 tracking-tighter uppercase">Season_01_End</span>
          <span className="text-orange-500 animate-pulse font-black">14H : 22M</span>
        </div>
      </div>
    </div>
  );
}