"use client";

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
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = localStorage.getItem("founder_status");
    setFounderMode(status === "true");
  }, []);

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
      const t = setTimeout(
        () => {
          setCurrentLine(line.slice(0, charIndex));
          if (charIndex < line.length) {
            setCharIndex((c) => c + 1);
          } else {
            setDisplayedLines((prev) => [...prev, line]);
            setCurrentLine("");
            setCharIndex(0);
            setLineIndex((l) => l + 1);
          }
        },
        charIndex === 0 ? LINE_DELAY_MS : CHAR_DELAY_MS
      );
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

  const handleFounderPointerDown = useCallback(() => {
    founderHoldTimer.current = setTimeout(activateFounderMode, FOUNDER_HOLD_MS);
  }, [activateFounderMode]);

  const handleFounderPointerUp = useCallback(() => {
    if (founderHoldTimer.current) {
      clearTimeout(founderHoldTimer.current);
      founderHoldTimer.current = null;
    }
  }, []);

  const handleFounderPointerLeave = useCallback(() => {
    if (founderHoldTimer.current) {
      clearTimeout(founderHoldTimer.current);
      founderHoldTimer.current = null;
    }
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setModalPhase("challenge");
    setSignUpSuccess(false);
    setSignUpError(null);
  };

  const handleAnswer = (answer: "Yes" | "No" | "Depends on Routing") => {
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

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSignUpError(null);
      setSignUpLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: signUpEmail,
          password: signUpPassword,
        });
        if (error) throw error;
        if (data.user) {
          const signalScore = getSignalScore();
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              email: data.user.email ?? signUpEmail,
              signal_score: signalScore,
            },
            { onConflict: "id" }
          );
        }
        setSignUpSuccess(true);
      } catch (err) {
        setSignUpError(
          err instanceof Error ? err.message : "Sign up failed. Try again."
        );
      } finally {
        setSignUpLoading(false);
      }
    },
    [signUpEmail, signUpPassword, getSignalScore]
  );

  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 ${glitchActive ? "nexus-glitch" : ""}`}
    >
      {/* Terminal window */}
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-emerald-500/30 bg-[#0d1117] shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        {/* Title bar — long-press 3s on title activates Founder's Backdoor */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span
            className="ml-2 cursor-default select-none font-mono text-[11px] uppercase tracking-widest text-zinc-500"
            role="button"
            tabIndex={0}
            onPointerDown={handleFounderPointerDown}
            onPointerUp={handleFounderPointerUp}
            onPointerLeave={handleFounderPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          >
            nexus://manifesto
          </span>
        </div>

        {/* Content */}
        <div className="border-t border-zinc-800/50 p-6 font-mono text-sm leading-relaxed text-zinc-300">
          <div className="min-h-[320px]">
            {displayedLines.map((line, i) => (
              <div key={i} className="text-emerald-400/90">
                {line || "\u00A0"}
              </div>
            ))}
            <div className="flex items-start gap-0.5">
              <span className="text-emerald-400/90">{currentLine}</span>
              <span
                className={`inline-block h-4 w-0.5 bg-emerald-400 transition-opacity duration-100 ${
                  showCursor ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden
              >
                |
              </span>
            </div>
          </div>

          {/* Enter the Nexus button — Logic Gate bypassed when founder mode */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={openModal}
              className="nexus-enter-btn group relative inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-mono text-sm font-medium uppercase tracking-widest text-emerald-400 transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              <span className="relative z-10">Enter the Nexus</span>
              {founderMode ? (
                <span className="absolute -right-1 -top-1 rounded border border-emerald-500/50 bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400/90">
                  Founder
                </span>
              ) : (
                <span className="absolute -right-1 -top-1 rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400/90">
                  Logic Gate
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal — dim background, terminal-style */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            key={shakeTrigger}
            className={`w-full max-w-lg overflow-hidden rounded-lg border border-zinc-600 bg-[#0d1117] shadow-2xl ${
              modalPhase === "denied" ? "nexus-modal-shake" : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal title bar */}
            <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-900/90 px-4 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                nexus://diagnostic
              </span>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 font-mono text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="border-t border-zinc-800/50 p-6 font-mono text-sm">
              {modalPhase === "challenge" && (
                <>
                  <p id="modal-title" className="mb-2 text-[10px] uppercase tracking-wider text-emerald-500/80">
                    Challenge
                  </p>
                  <p className="mb-6 leading-relaxed text-zinc-300">
                    {CHALLENGE}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleAnswer("Yes")}
                      className="rounded border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-700/80"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnswer("No")}
                      className="rounded border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnswer("Depends on Routing")}
                      className="rounded border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-700/80"
                    >
                      Depends on Routing
                    </button>
                  </div>
                </>
              )}

              {modalPhase === "granted" && (
                <>
                  <p className="mb-4 text-emerald-400">Access Granted</p>
                  <div className="rounded border border-zinc-700/80 bg-zinc-900/50 p-4">
                    {signUpSuccess ? (
                      <p className="text-sm text-emerald-400/90">
                        Check your email for a verification link.
                      </p>
                    ) : (
                      <>
                        <p className="mb-4 text-[11px] uppercase tracking-wider text-zinc-500">
                          Sign up
                        </p>
                        <form
                          className="flex flex-col gap-3"
                          onSubmit={handleSignUp}
                        >
                          {signUpError && (
                            <p className="text-[11px] text-red-400">
                              {signUpError}
                            </p>
                          )}
                          <label className="flex flex-col gap-1.5 text-[11px] text-zinc-500">
                            Email
                            <input
                              type="email"
                              placeholder="you@domain.com"
                              value={signUpEmail}
                              onChange={(e) => setSignUpEmail(e.target.value)}
                              required
                              className="rounded border border-zinc-600 bg-zinc-800/80 px-3 py-2 font-mono text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5 text-[11px] text-zinc-500">
                            Password
                            <input
                              type="password"
                              placeholder="••••••••"
                              value={signUpPassword}
                              onChange={(e) =>
                                setSignUpPassword(e.target.value)
                              }
                              required
                              className="rounded border border-zinc-600 bg-zinc-800/80 px-3 py-2 font-mono text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={signUpLoading}
                            className="mt-2 rounded border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {signUpLoading
                              ? "Creating account…"
                              : "Create account"}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </>
              )}

              {modalPhase === "denied" && (
                <>
                  <p className="mb-2 text-red-400/90">
                    Signal Too Weak. Access Denied.
                  </p>
                  <p className="mb-4 text-[11px] text-zinc-500">
                    Node A → B → C. With B offline, A cannot reach C.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalPhase("challenge")}
                    className="rounded border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-zinc-300 transition-colors hover:bg-zinc-700/80"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
