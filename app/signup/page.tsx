"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Zap, UserCircle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // New State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("nexus_referral", ref);
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (username.length < 3) {
      setError("ID_TOO_SHORT (MIN 3)");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Pass username to metadata so the DB trigger can grab it
        data: {
          username: username.toUpperCase(),
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center font-mono p-4">
      <div className="w-full max-w-sm border border-emerald-500/20 bg-emerald-500/5 p-8 rounded-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-emerald-500 rounded-full mb-4">
            <Zap size={24} className="text-black" />
          </div>
          <h1 className="text-xl font-black text-white tracking-[0.3em] uppercase">Initialize</h1>
          <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mt-2 text-center">
            New_Signal_Unit_Registration
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded text-red-500 text-[10px] uppercase font-bold text-center">
              {error}
            </div>
          )}

          {/* USERNAME FIELD */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-black ml-1">Identity_Handle</label>
            <input 
              type="text" 
              required
              placeholder="UNIQUE_ID..."
              className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-500 transition-all rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-black ml-1">Email_Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-500 transition-all rounded-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-black ml-1">Access_Key</label>
            <input 
              type="password" 
              required
              className="w-full bg-black border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-500 transition-all rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 text-black py-4 text-xs font-black uppercase rounded-lg hover:bg-emerald-400 active:scale-95 transition-all mt-4"
          >
            {loading ? "Syncing..." : "Activate_Signal"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-3">
          <button 
            onClick={() => router.push("/")}
            className="text-[10px] text-zinc-500 hover:text-emerald-500 uppercase font-black transition-colors flex items-center justify-center gap-2"
          >
            Already_Registered? <span className="text-emerald-500">Sign_In</span>
          </button>
        </div>
      </div>
    </div>
  );
}