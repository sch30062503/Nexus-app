"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const FOUNDER_HOLD_MS = 3000;
const MANIFESTO_LINES = [
  "",
  "THE THREE LAWS OF NEXUS",
  "══════════════════════════════════════",
  "",
  "Law 1: Proof of Skill.",
  "No participation without verified expertise.",
  "",
  "Law 2: Automated Democracy.",
  "Code governs, people contribute.",
  "",
  "Law 3: Signal over Noise.",
  "Quality is the only currency.",
  "",
  "> _",
];

const CHAR_DELAY_MS = 45;
const LINE_DELAY_MS = 80;

const CHALLENGE =
  "System Diagnostic: Node A connects to B. Node B connects to C. If Node B is offline, can Node A communicate with Node C?";

type ModalPhase = "challenge" | "granted" | "denied";

function playTerminalSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "square";
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    playBeep(880, 0, 0.08);
    playBeep(880, 0.12, 0.08);
    playBeep(660, 0.24, 0.15);
  } catch {
    // ignore
  }
}

export default function Home() {
  const router = useRouter();
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<ModalPhase>("challenge");
  const [shakeTrigger, setShakeTrigger] = useState(0);

  const [founderMode, setFounderMode] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const founderHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth States
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = localStorage.getItem("founder_status");
    setFounderMode(status === "true");
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.replace("/dashboard");
      }
    };
    checkSession();
  }, [router]);

  const activateFounderMode = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("founder_status", "true");
    localStorage.setItem("signal_score", "10000");
    setFounderMode(true);
    playTerminalSound();
    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), 450);
  }, []);

  useEffect(() => {
    if (lineIndex >= MANIFESTO_LINES.length) {
      setIsComplete(true);
      return;
    }
    const line = MANIFESTO_LINES[lineIndex];
    if (charIndex <= line.length) {
      const t = setTimeout(() => {
        setCurrentLine(line.slice(0, charIndex));
        if (charIndex < line.length) {
          setCharIndex((c) => c + 1);
        } else {
          setDisplayedLines((prev) => [...prev, line]);
          setCurrentLine("");
          setCharIndex(0);
          setLineIndex((l) => l + 1);
        }
      }, charIndex === 0 ? LINE_DELAY_MS : CHAR_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [lineIndex, charIndex]);

  useEffect(() => {
    const id = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  const openModal = () => {
    setModalOpen(true);
    setModalPhase(founderMode ? "granted" : "challenge");
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalPhase("challenge");
    setAuthError(null);
    setSignUpSuccess(false);
  };

  const handleAnswer = (answer: string) => {
    if (answer === "No") {
      setModalPhase("granted");
    } else {
      setModalPhase("denied");
      setShakeTrigger((t) => t + 1);
    }
  };

  const getSignalScore = useCallback(() => {
    if (typeof window === "undefined") return 0;
    if (founderMode) return 10000;
    const stored = localStorage.getItem("signal_score");
    return stored ? parseInt(stored, 10) : 0;
  }, [founderMode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          const signalScore = getSignalScore();
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email ?? email,
            signal_score: signalScore,
            is_founder: founderMode
          });
        }
        setSignUpSuccess(true);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className={`flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 ${glitchActive ? "nexus-glitch" : ""}`}>
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-emerald-500/30 bg-[#0d1117] shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span 
            className="ml-2 cursor-default select-none font-mono text-[11px] uppercase tracking-widest text-zinc-500"
            onPointerDown={() => { founderHoldTimer.current = setTimeout(activateFounderMode, FOUNDER_HOLD_MS) }}
            onPointerUp={() => { if(founderHoldTimer.current) clearTimeout(founderHoldTimer.current) }}
          >
            nexus://manifesto
          </span>
        </div>

        <div className="p-6 font-mono text-sm text-zinc-300">
          <div className="min-h-[320px]">
            {displayedLines.map((line, i) => <div key={i} className="text-emerald-400/90">{line || "\u00A0"}</div>)}
            <div className="flex items-start gap-0.5">
              <span className="text-emerald-400/90">{currentLine}</span>
              <span className={`inline-block h-4 w-0.5 bg-emerald-400 ${showCursor ? "opacity-100" : "opacity-0"}`}>|</span>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button onClick={openModal} className="relative inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-mono text-sm tracking-widest text-emerald-400 hover:bg-emerald-500/20">
              Enter the Nexus
              <span className={`absolute -right-1 -top-1 rounded border px-1.5 py-0.5 text-[9px] ${founderMode ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-amber-500 bg-amber-500/20 text-amber-400'}`}>
                {founderMode ? "Founder" : "Logic Gate"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeModal}>
          <div key={shakeTrigger} className={`w-full max-w-lg rounded-lg border border-zinc-600 bg-[#0d1117] shadow-2xl ${modalPhase === "denied" ? "animate-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-900/90 px-4 py-2.5">
              <span className="font-mono text-[11px] uppercase text-zinc-500">nexus://diagnostic</span>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            <div className="p-6 font-mono text-sm">
              {modalPhase === "challenge" && (
                <>
                  <p className="mb-2 text-[10px] uppercase text-emerald-500/80 tracking-widest">Challenge</p>
                  <p className="mb-6 text-zinc-300">{CHALLENGE}</p>
                  <div className="flex gap-3">
                    {["Yes", "No", "Depends"].map(ans => (
                      <button key={ans} onClick={() => handleAnswer(ans === "No" ? "No" : "Wrong")} className="rounded border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-700">{ans}</button>
                    ))}
                  </div>
                </>
              )}

              {modalPhase === "granted" && (
                <>
                  <div className="mb-6 flex border-b border-zinc-800">
                    <button onClick={() => setIsLoginMode(true)} className={`pb-2 px-4 text-xs tracking-widest transition-all ${isLoginMode ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-zinc-500'}`}>LOGIN</button>
                    <button onClick={() => setIsLoginMode(false)} className={`pb-2 px-4 text-xs tracking-widest transition-all ${!isLoginMode ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-zinc-500'}`}>SIGN UP</button>
                  </div>
                  
                  {signUpSuccess ? (
                    <p className="text-emerald-400">Account created. Initializing session...</p>
                  ) : (
                    <form onSubmit={handleAuth} className="flex flex-col gap-4">
                      {authError && <p className="text-[11px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{authError}</p>}
                      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-zinc-200 focus:border-emerald-500/50 outline-none" />
                      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-zinc-200 focus:border-emerald-500/50 outline-none" />
                      <button type="submit" disabled={authLoading} className="rounded border border-emerald-500/50 bg-emerald-500/20 py-2 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50">
                        {authLoading ? "Processing..." : isLoginMode ? "Initialize Session" : "Create Node"}
                      </button>
                    </form>
                  )}
                </>
              )}

              {modalPhase === "denied" && (
                <div className="text-center">
                  <p className="mb-4 text-red-400">Signal Too Weak. Access Denied.</p>
                  <button onClick={() => setModalPhase("challenge")} className="rounded border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-700">Try again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}