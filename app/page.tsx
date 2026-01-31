"use client";

import { useEffect, useState } from "react";

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

export default function Home() {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      {/* Terminal window */}
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-emerald-500/30 bg-[#0d1117] shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
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

          {/* Enter the Nexus button — glowing green, subtle pulse */}
          <div className="mt-8 flex justify-center">
            <a
              href="#"
              className="nexus-enter-btn inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-mono text-sm font-medium uppercase tracking-widest text-emerald-400 transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              Enter the Nexus
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
