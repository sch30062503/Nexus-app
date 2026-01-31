"use client";

import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setMouse({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    setMouse({
      x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
      y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
    });
  }, []);
  const nodes = [
    "Technology",
    "Programming",
    "DevOps",
    "Security",
    "AI/ML",
    "Web Dev",
    "Systems",
    "Open Source",
  ];

  const posts = [
    {
      id: 1,
      title: "Building real-time systems with minimal latency",
      node: "Systems",
      excerpt:
        "A deep dive into event-driven architecture and why your message queue choice matters more than you think.",
      score: 2847,
      comments: 142,
      signalStrength: 5,
      author: {
        name: "Jordan Chen",
        role: "Senior Systems Engineer",
        verifiedSkills: ["Distributed Systems", "Event-Driven Architecture", "Kafka"],
      },
    },
    {
      id: 2,
      title: "Rust in production: one year later",
      node: "Programming",
      excerpt:
        "We migrated our core services to Rust. Here's what we learned about performance, safety, and team velocity.",
      score: 1923,
      comments: 89,
      signalStrength: 4,
      author: {
        name: "Sam Rivera",
        role: "Staff Engineer",
        verifiedSkills: ["Rust", "Systems Programming", "Performance"],
      },
    },
    {
      id: 3,
      title: "Zero-trust networking without the complexity",
      node: "Security",
      excerpt:
        "Practical steps to implement zero-trust principles in a mid-size infra without burning the budget.",
      score: 1567,
      comments: 67,
      signalStrength: 3,
      author: {
        name: "Alex Kim",
        role: "Security Architect",
        verifiedSkills: ["Zero Trust", "Network Security", "IAM"],
      },
    },
    {
      id: 4,
      title: "Why we're betting on WebAssembly at the edge",
      node: "Web Dev",
      excerpt:
        "Edge compute is having a moment. WASM might be the missing piece for truly portable, fast workloads.",
      score: 2104,
      comments: 203,
      signalStrength: 5,
      author: {
        name: "Morgan Lee",
        role: "Principal Engineer",
        verifiedSkills: ["WebAssembly", "Edge Compute", "Rust"],
      },
    },
    {
      id: 5,
      title: "Kubernetes operators: when to build, when to buy",
      node: "DevOps",
      excerpt:
        "After building three custom operators, here's our framework for deciding build vs. adopt.",
      score: 987,
      comments: 44,
      signalStrength: 2,
      author: {
        name: "Casey Walsh",
        role: "Platform Engineer",
        verifiedSkills: ["Kubernetes", "Go", "Operators"],
      },
    },
  ];

  const topPostCodeSnippet = `// Event-driven consumer — minimal latency path
await queue.subscribe(async (event) => {
  const payload = decode(event);
  await pipeline.process(payload);
});`;

  return (
    <div
      className="relative min-h-screen bg-[#0a0a0a] text-zinc-100"
      onMouseMove={onMouseMove}
    >
      {/* Cursor-following radial gradient — very subtle */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(circle 900px at ${mouse.x}px ${mouse.y}px, rgba(99, 102, 241, 0.035) 0%, transparent 65%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10">
      {/* Hero — Neo-minimal */}
      <header className="relative border-b border-zinc-800/40 bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-500/90">
              Nexus
            </p>
            <h1 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
              Welcome to the internet, fixed.
            </h1>
            <p className="mt-6 text-base leading-relaxed text-zinc-500">
              A place for technical discourse. No algorithms. No engagement
              bait. Just signal.
            </p>
          </div>
        </div>
      </header>

      {/* Main Bento Layout */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex gap-10">
          {/* Sidebar — Glassmorphism */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-8 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
              <h2 className="mb-5 text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-500">
                Nodes
              </h2>
              <nav className="flex flex-col gap-px">
                {nodes.map((node) => (
                  <a
                    key={node}
                    href="#"
                    className="rounded-lg px-3 py-2.5 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-indigo-400"
                  >
                    {node}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Central Feed */}
          <main className="min-w-0 flex-1">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-500">
                Feed
              </h2>
              <span className="text-[11px] text-zinc-600">
                Latest · Technical
              </span>
            </div>

            <div className="grid gap-5">
              {posts.map((post, i) => (
                <article
                  key={post.id}
                  className="group rounded-2xl border border-zinc-800/40 bg-zinc-950/50 p-6 transition-all duration-200 hover:border-zinc-700/50"
                >
                  {/* Quick View — code snippet on top post only */}
                  {i === 0 && (
                    <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4 font-mono text-[12px] leading-relaxed">
                      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-indigo-500/80">
                        Quick View
                      </p>
                      <pre className="overflow-x-auto font-mono text-zinc-300">
                        <code>{topPostCodeSnippet}</code>
                      </pre>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                          {post.node}
                        </span>
                        {/* Signal Strength meter — glows on post hover */}
                        <div
                          className="flex gap-0.5"
                          title={`Signal ${post.signalStrength}/5`}
                        >
                          {[1, 2, 3, 4, 5].map((bar) => (
                            <span
                              key={bar}
                              className={`h-3 w-1 rounded-full transition-all duration-200 ${
                                bar <= post.signalStrength
                                  ? "bg-indigo-500 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.45)]"
                                  : "bg-zinc-700/50"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {/* Author + Verified badge + Skill Card on hover */}
                      <div className="relative mb-3 flex flex-wrap items-center gap-2">
                        <div className="group/author relative inline-flex items-center gap-2">
                          <span className="cursor-default text-[13px] text-zinc-400 transition-colors group-hover/author:text-indigo-400">
                            {post.author.name}
                          </span>
                          <span className="text-[11px] text-zinc-600">
                            · {post.author.role}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                            title="High Domain Authority"
                          >
                            Verified
                          </span>
                          {/* Skill Card popup on author name hover */}
                          <div className="invisible absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5 opacity-0 shadow-xl backdrop-blur-md transition-all duration-150 group-hover/author:visible group-hover/author:opacity-100">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                              Verified skills
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {post.author.verifiedSkills.map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-300"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-white transition-colors group-hover:text-zinc-100">
                        <a
                          href="#"
                          className="focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded"
                        >
                          {post.title}
                        </a>
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                        {post.excerpt}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-5 text-[11px] text-zinc-500 sm:flex-col sm:gap-1.5 sm:text-right">
                      <span className="text-indigo-400/90">
                        {post.score.toLocaleString()} pts
                      </span>
                      <span>{post.comments} comments</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Bento accent cards — neo-minimal */}
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800/40 bg-zinc-950/30 p-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Trending in Nodes
                </p>
                <p className="mt-3 text-xl font-medium text-white">
                  Join the conversation.
                </p>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Create an account to post, comment, and curate your feed.
                </p>
                <a
                  href="#"
                  className="mt-4 inline-block text-[12px] font-medium text-indigo-500 hover:text-indigo-400"
                >
                  Sign up →
                </a>
              </div>
              <div className="rounded-2xl border border-zinc-800/40 bg-zinc-950/30 p-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Community
                </p>
                <p className="mt-3 text-xl font-medium text-white">
                  No ads. No tracking.
                </p>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Nexus is built for readers and writers who value quality.
                </p>
                <a
                  href="#"
                  className="mt-4 inline-block text-[12px] font-medium text-indigo-500 hover:text-indigo-400"
                >
                  Learn more →
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>
      </div>
    </div>
  );
}
