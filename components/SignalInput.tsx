"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Send, Zap } from "lucide-react";

export default function SignalInput({ userId }: { userId: string }) {
  const [textInput, setTextInput] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // 1. Visual Countdown Logic
  useEffect(() => {
    if (cooldownLeft > 0) {
      const timer = setInterval(() => {
        setCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownLeft]);

  // 2. The Refined Submission Logic
  const handleSendSignal = async () => {
    if (!textInput.trim() || cooldownLeft > 0) return;

    // Call the hardened RPC
    const { data, error } = await supabase.rpc('submit_signal', {
      user_id: userId,
      signal_content: textInput
    });

    if (error) {
      console.error("RPC_ERROR:", error.message);
      return;
    }

    // 3. Handle Database Response
    if (data?.success) {
      setCooldownLeft(60); // Start 60s local cooldown
      setTextInput("");
      console.log(`SIGNAL_ACCEPTED: +${data.points_awarded} PTS`);
    } else if (data?.message === 'COOLDOWN_ACTIVE') {
      // If local state got out of sync, the DB corrects it here
      setCooldownLeft(Math.ceil(data.retry_after));
      alert(`STATION_OVERHEATED: WAIT ${Math.ceil(data.retry_after)}s`);
    }
  };

  return (
    <div className="p-4 bg-black border-t border-white/10">
      <div className="relative max-w-2xl mx-auto">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          disabled={cooldownLeft > 0}
          onKeyDown={(e) => e.key === "Enter" && handleSendSignal()}
          placeholder={cooldownLeft > 0 ? `COOLING_DOWN... ${cooldownLeft}s` : "TRANSMIT_SIGNAL..."}
          className="w-full bg-zinc-900 border border-white/20 rounded-lg py-3 px-4 text-emerald-500 font-mono focus:outline-none focus:border-emerald-500 transition-all disabled:opacity-50"
        />
        <button
          onClick={handleSendSignal}
          disabled={cooldownLeft > 0 || !textInput.trim()}
          className="absolute right-2 top-2 p-2 bg-emerald-600 text-black rounded-md hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all"
        >
          {cooldownLeft > 0 ? <Zap size={18} className="animate-pulse" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
useEffect(() => {
  const channel = supabase
    .channel('system_status')
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'system_settings',
      filter: 'key=eq.fever_mode'
    }, (payload) => {
      const active = payload.new.value_bool;
      if (active) {
        alert("🚨 FEVER_MODE_INITIALIZED: 2X_SIGNAL_STRENGTH_ACTIVE");
        // You could also set a global state here to turn the UI orange
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);