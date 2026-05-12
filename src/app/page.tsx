"use client";

import { useEffect } from "react";
import {
  ArrowRight,
  Play,
  SquarePen,
  Users,
  EyeOff,
  Gavel,
  MessageSquareQuote,
  ShieldQuestion,
  Check,
} from "lucide-react";

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.111.82-.261.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function Home() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    const cards = document.querySelectorAll<HTMLElement>(".card");
    const handlers: { el: HTMLElement; fn: (ev: MouseEvent) => void }[] = [];
    cards.forEach((card) => {
      const fn = (ev: MouseEvent) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((ev.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((ev.clientY - r.top) / r.height) * 100 + "%");
      };
      card.addEventListener("mousemove", fn);
      handlers.push({ el: card, fn });
    });

    return () => {
      io.disconnect();
      handlers.forEach(({ el, fn }) => el.removeEventListener("mousemove", fn));
    };
  }, []);

  return (
    <>
      {/* ============ NAV ============ */}
      <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <div className="nav-pill rounded-full px-2 py-2 flex items-center gap-1 w-full max-w-3xl">
          <a href="#" className="flex items-center gap-2 pl-3 pr-4 py-1.5">
            <div className="relative w-6 h-6">
              <div className="absolute inset-0 rounded-md bg-gradient-to-br from-violet-400 to-violet-700"></div>
              <div className="absolute inset-[3px] rounded-sm bg-[#07060d] flex items-center justify-center">
                <span className="mono text-[9px] text-violet-300">M</span>
              </div>
            </div>
            <span className="font-semibold tracking-tight">Metamorph</span>
          </a>
          <nav className="hidden md:flex items-center text-sm text-slate-300 gap-1 ml-2">
            <a href="#how" className="px-3 py-1.5 rounded-full hover:bg-white/5 transition">
              How it works
            </a>
            <a href="#use-cases" className="px-3 py-1.5 rounded-full hover:bg-white/5 transition">
              Use cases
            </a>
            <a href="#pricing" className="px-3 py-1.5 rounded-full hover:bg-white/5 transition">
              Pricing
            </a>
            <a href="#" className="px-3 py-1.5 rounded-full hover:bg-white/5 transition">
              Docs
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <a
              href="#"
              className="hidden sm:inline-flex text-sm px-3 py-1.5 rounded-full hover:bg-white/5 transition text-slate-300"
            >
              Sign in
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium btn-primary text-white px-4 py-1.5 rounded-full"
            >
              Start free
            </a>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 hero-glow hero-fade"></div>
        <div className="absolute inset-0 grain hero-fade opacity-60"></div>

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px] shadow-violet-400"></span>
              New
            </span>
            <span className="text-slate-500">/</span>
            <span>Anonymous peer review just shipped</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <h1 className="reveal display mt-8 text-[68px] sm:text-[88px] md:text-[112px] text-white">
            Your AI
            <br />
            <span className="inline-block bg-gradient-to-b from-white via-violet-200 to-violet-500 bg-clip-text text-transparent">
              Advisory Board
            </span>
          </h1>

          <p className="reveal mt-7 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            5 AI advisors debate your decisions from every angle. Catch blind spots. Get structured
            verdicts. Make better calls.
          </p>

          <div className="reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#pricing"
              className="btn-primary text-white font-medium px-6 py-3 rounded-full inline-flex items-center gap-2"
            >
              Start free
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#how"
              className="btn-ghost text-slate-200 font-medium px-6 py-3 rounded-full inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-violet-300" />
              See how it works
            </a>
          </div>

          <div className="reveal mt-6 text-xs text-slate-500 mono">
            no credit card · 5 free councils every month
          </div>

          {/* Hero device mock */}
          <div className="reveal mt-20 relative max-w-5xl mx-auto">
            <div className="device ring-violet p-3 sm:p-4 text-left">
              <div className="flex items-center gap-2 px-2 pb-3 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10"></div>
                </div>
                <div className="mx-auto mono text-[11px] text-slate-500 hidden sm:block">
                  council.app / decision / Q3-pricing-overhaul
                </div>
                <div className="text-[10px] mono text-violet-300 stamp">DELIBERATING</div>
              </div>

              <div className="grid grid-cols-12 gap-3 sm:gap-4 p-3 sm:p-4">
                <div className="col-span-12 md:col-span-4 space-y-3">
                  <div className="text-[10px] mono uppercase tracking-widest text-slate-500">
                    Decision Brief
                  </div>
                  <div className="text-base text-white leading-snug">
                    Should we move our enterprise tier from ₹49,000 to ₹79,000 to fund the new
                    compliance team?
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                      strategy
                    </span>
                    <span className="text-[10px] mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                      pricing
                    </span>
                    <span className="text-[10px] mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                      b2b
                    </span>
                  </div>
                  <div className="divider my-2"></div>
                  <div className="text-[10px] mono uppercase tracking-widest text-slate-500">
                    Council
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="adv pulse-1">A1</div>
                      <div className="text-sm text-slate-300">The Strategist</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="adv pulse-2">A2</div>
                      <div className="text-sm text-slate-300">The Skeptic</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="adv pulse-3">A3</div>
                      <div className="text-sm text-slate-300">The Operator</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="adv pulse-4">A4</div>
                      <div className="text-sm text-slate-300">The Customer Voice</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="adv pulse-5">A5</div>
                      <div className="text-sm text-slate-300">The Numbers</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-8">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 h-full relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-700/20 blur-3xl"></div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="adv adv-lg">CH</div>
                      <div>
                        <div className="text-[10px] mono uppercase tracking-widest text-slate-500">
                          Chairman&apos;s Verdict
                        </div>
                        <div className="text-white font-semibold">Conditional Proceed</div>
                      </div>
                      <div className="ml-auto stamp">4 of 5 concur</div>
                    </div>

                    <p className="text-slate-300 leading-relaxed text-sm">
                      Raise to <span className="text-white font-medium">₹64,900</span>, not ₹79,000
                      — the council surfaced pricing-elasticity risk in your mid-market segment
                      (cited by A2, A4). Tie the increase to a concrete compliance deliverable
                      announced 60 days in advance.
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-5">
                      <div className="rounded-lg border border-white/5 p-3">
                        <div className="text-[10px] mono uppercase text-slate-500">Confidence</div>
                        <div className="mt-1 text-white text-lg font-semibold">High</div>
                        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full w-[82%] bg-gradient-to-r from-violet-400 to-violet-600"></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 p-3">
                        <div className="text-[10px] mono uppercase text-slate-500">Dissent</div>
                        <div className="mt-1 text-white text-lg font-semibold">A2 · Skeptic</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">flagged churn risk</div>
                      </div>
                      <div className="rounded-lg border border-white/5 p-3">
                        <div className="text-[10px] mono uppercase text-slate-500">Blind spots</div>
                        <div className="mt-1 text-white text-lg font-semibold">2 surfaced</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">elasticity · comms</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal mt-20">
            <div className="text-xs mono text-slate-500 uppercase tracking-widest">
              Trusted by decision-makers at
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
              <span className="text-slate-400 font-semibold tracking-tight">Northwind Capital</span>
              <span className="text-slate-400 font-semibold tracking-tight italic">
                Lattice &amp; Co.
              </span>
              <span className="text-slate-400 font-semibold tracking-tight">FORGE/LAW</span>
              <span className="text-slate-400 font-semibold tracking-tight">Meridian Audit</span>
              <span className="text-slate-400 font-semibold tracking-tight">Halcyon Realty</span>
              <span className="text-slate-400 font-semibold tracking-tight">Atlas Health</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal max-w-2xl">
            <div className="eyebrow">How it works</div>
            <h2 className="display mt-3 text-4xl md:text-6xl text-white">
              A real boardroom,
              <br />
              without the calendar tetris.
            </h2>
            <p className="mt-5 text-slate-400 text-lg max-w-xl">
              Four steps. Five advisors. One verdict you can defend.
            </p>
          </div>

          <div className="reveal mt-16 relative">
            <div className="hidden md:block absolute top-6 left-[10%] right-[10%] flow-line"></div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 relative">
              {[
                {
                  Icon: SquarePen,
                  step: 1,
                  title: "Describe your decision",
                  body: "Paste context, attach docs, set constraints. Council understands what's actually at stake.",
                },
                {
                  Icon: Users,
                  step: 2,
                  title: "5 advisors deliberate",
                  body: "A strategist, skeptic, operator, customer voice, and analyst — each builds a position from their own lens.",
                },
                {
                  Icon: EyeOff,
                  step: 3,
                  title: "Anonymous peer review",
                  body: "Advisors critique each other blind. No groupthink, no anchoring — just sharper arguments.",
                },
                {
                  Icon: Gavel,
                  step: 4,
                  title: "Chairman's verdict",
                  body: "A synthesized call with confidence level, dissenting view, and the blind spots you almost missed.",
                },
              ].map(({ Icon, step, title, body }) => (
                <div key={step}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0f0c20] border border-white/10 flex items-center justify-center relative">
                      <Icon className="w-5 h-5 text-violet-300" />
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-semibold flex items-center justify-center">
                        {step}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-white font-semibold text-lg">{title}</div>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample deliberation */}
          <div className="reveal mt-20 grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="card p-5 lg:col-span-2">
              <div className="card-glow"></div>
              <div className="flex items-center gap-2 text-[11px] mono uppercase tracking-widest text-slate-500">
                <MessageSquareQuote className="w-3.5 h-3.5" /> Round 1 · Position
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="adv adv-lg shrink-0">A2</div>
                <div>
                  <div className="text-white font-medium">The Skeptic</div>
                  <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
                    &ldquo;60% price jump for a value prop we haven&apos;t shipped yet. Mid-market
                    churn risk is material. Stage the increase, or pre-sell the compliance roadmap
                    first.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-5 lg:col-span-2">
              <div className="card-glow"></div>
              <div className="flex items-center gap-2 text-[11px] mono uppercase tracking-widest text-slate-500">
                <ShieldQuestion className="w-3.5 h-3.5" /> Round 2 · Peer review (anon)
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="adv adv-lg shrink-0">??</div>
                <div>
                  <div className="text-white font-medium">Reviewer</div>
                  <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
                    &ldquo;Strategist&apos;s TAM argument is fine but ignores that current ACV
                    expansion is happening organically. The price hike isn&apos;t load-bearing for
                    the team hire.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-5 lg:col-span-1 tier-featured">
              <div className="flex items-center gap-2 text-[11px] mono uppercase tracking-widest text-violet-300">
                <Gavel className="w-3.5 h-3.5" /> Verdict
              </div>
              <div className="mt-3">
                <div className="text-white font-semibold text-2xl">₹64,900</div>
                <div className="text-slate-400 text-sm mt-1">Conditional proceed</div>
                <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[82%] bg-gradient-to-r from-violet-400 to-violet-600"></div>
                </div>
                <div className="text-[10px] mono mt-2 text-slate-500">CONFIDENCE 82%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ USE CASES ============ */}
      <section id="use-cases" className="relative py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal max-w-2xl">
            <div className="eyebrow">Use cases</div>
            <h2 className="display mt-3 text-4xl md:text-6xl text-white">
              Built for people who
              <br />
              defend their calls.
            </h2>
            <p className="mt-5 text-slate-400 text-lg max-w-xl">
              From boardroom bets to clinic floors — Council adapts its lens to the work in front
              of you.
            </p>
          </div>

          <div className="reveal mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                emoji: "🧭",
                title: "Strategic Decisions",
                subtitle: "For founders & operators",
                body: "Pricing changes, pivots, key hires — pressure-test the call before the all-hands.",
              },
              {
                emoji: "⚖️",
                title: "Contract Review",
                subtitle: "For lawyers & legal ops",
                body: "Five lenses on every clause: liability, commercial, redline, edge-case, enforcement.",
              },
              {
                emoji: "📈",
                title: "Investment Analysis",
                subtitle: "For investors & analysts",
                body: "Bull, bear, base, contrarian, and an operator's take — before you write the memo.",
              },
              {
                emoji: "🔍",
                title: "Audit Risk Assessment",
                subtitle: "For CAs & auditors",
                body: "Materiality, fraud surface, control gaps, regulator stance — debated, not checklisted.",
              },
              {
                emoji: "🏠",
                title: "Property Analysis",
                subtitle: "For real estate",
                body: "Yield, comps, structural risk, exit liquidity — one structured verdict per deal.",
              },
              {
                emoji: "🩺",
                title: "Practice Decisions",
                subtitle: "For doctors & clinicians",
                body: "Differential weighting, treatment trade-offs, patient-context lens — for the hard calls.",
              },
            ].map((u) => (
              <a key={u.title} href="#" className="card p-6 group">
                <div className="card-glow"></div>
                <div className="text-2xl">{u.emoji}</div>
                <div className="mt-5 text-white font-semibold text-lg">{u.title}</div>
                <div className="text-slate-400 text-sm mt-1.5">{u.subtitle}</div>
                <p className="text-slate-300 text-sm mt-4 leading-relaxed">{u.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="relative py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal max-w-2xl">
            <div className="eyebrow">Pricing</div>
            <h2 className="display mt-3 text-4xl md:text-6xl text-white">
              Start free.
              <br />
              Pay when it pays off.
            </h2>
            <p className="mt-5 text-slate-400 text-lg max-w-xl">
              Every plan includes the full 5-advisor council and anonymous peer review. No
              paywalled intelligence.
            </p>
          </div>

          <div className="reveal mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free */}
            <div className="card p-7 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold text-lg">Free</div>
                <span className="text-[10px] mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                  FOR INDIVIDUALS
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="display text-5xl text-white">₹0</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
              <p className="text-slate-400 text-sm mt-3">Try the full council on real decisions.</p>
              <ul className="mt-7 space-y-3 text-sm text-slate-300">
                {[
                  "5 councils per month",
                  "Basic decision templates",
                  "Anonymous peer review",
                  "Chairman's verdict",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <a href="#" className="btn-ghost mt-8 text-center font-medium px-5 py-3 rounded-full">
                Start free
              </a>
            </div>

            {/* Pro */}
            <div className="card tier-featured p-7 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] mono uppercase tracking-widest bg-violet-500 text-white px-2.5 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold text-lg">Pro</div>
                <span className="text-[10px] mono px-2 py-0.5 rounded border border-violet-400/40 text-violet-200">
                  FOR PROFESSIONALS
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="display text-5xl text-white">₹999</span>
                <span className="text-slate-400 text-sm">/month</span>
              </div>
              <p className="text-slate-300 text-sm mt-3">
                Everything you need to make this your daily tool.
              </p>
              <ul className="mt-7 space-y-3 text-sm text-slate-200">
                {[
                  "30 councils per month",
                  "All decision templates",
                  "PDF export & verdict reports",
                  "Searchable decision archive",
                  "Priority advisor models",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className="btn-primary mt-8 text-center text-white font-medium px-5 py-3 rounded-full"
              >
                Upgrade to Pro
              </a>
            </div>

            {/* Team */}
            <div className="card p-7 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold text-lg">Team</div>
                <span className="text-[10px] mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                  FOR FIRMS
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="display text-5xl text-white">₹4,999</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
              <p className="text-slate-400 text-sm mt-3">Make better calls — together.</p>
              <ul className="mt-7 space-y-3 text-sm text-slate-300">
                {[
                  "200 councils per month",
                  "5 seats included",
                  "Shared workspace & archive",
                  "Custom advisor personas",
                  "SSO & audit log",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <a href="#" className="btn-ghost mt-8 text-center font-medium px-5 py-3 rounded-full">
                Start Team trial
              </a>
            </div>
          </div>

          <p className="reveal mt-10 text-center text-xs text-slate-500 mono">
            Need more seats or on-prem deployment?{" "}
            <a href="#" className="text-violet-300 hover:underline">
              Talk to us →
            </a>
          </p>
        </div>
      </section>

      {/* ============ CTA STRIP ============ */}
      <section className="relative py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 reveal">
          <div className="relative rounded-3xl border border-white/10 overflow-hidden p-10 md:p-14">
            <div className="absolute inset-0 hero-glow opacity-80"></div>
            <div className="absolute inset-0 grain opacity-30"></div>
            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
              <div className="flex -space-x-2">
                <div className="adv adv-lg">A1</div>
                <div className="adv adv-lg">A2</div>
                <div className="adv adv-lg">A3</div>
                <div className="adv adv-lg">A4</div>
                <div className="adv adv-lg">A5</div>
              </div>
              <div className="flex-1">
                <h3 className="display text-3xl md:text-4xl text-white">Convene your council.</h3>
                <p className="text-slate-300 mt-2 text-base">
                  Five advisors. One verdict. Ten minutes. Free to try.
                </p>
              </div>
              <a
                href="#"
                className="btn-primary text-white font-medium px-6 py-3 rounded-full inline-flex items-center gap-2 shrink-0"
              >
                Start free
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
            <div className="col-span-2">
              <a href="#" className="flex items-center gap-2">
                <div className="relative w-6 h-6">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-br from-violet-400 to-violet-700"></div>
                  <div className="absolute inset-[3px] rounded-sm bg-[#07060d] flex items-center justify-center">
                    <span className="mono text-[9px] text-violet-300">M</span>
                  </div>
                </div>
                <span className="font-semibold tracking-tight">Metamorph</span>
              </a>
              <p className="mt-4 text-sm text-slate-400 max-w-xs leading-relaxed">
                Built with AI, designed for professionals.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <a
                  href="#"
                  className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center"
                >
                  <TwitterIcon className="w-4 h-4 text-slate-400" />
                </a>
                <a
                  href="#"
                  className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center"
                >
                  <LinkedinIcon className="w-4 h-4 text-slate-400" />
                </a>
                <a
                  href="#"
                  className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center"
                >
                  <GithubIcon className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>

            {[
              {
                label: "Product",
                links: [
                  ["How it works", "#how"],
                  ["Use cases", "#use-cases"],
                  ["Pricing", "#pricing"],
                  ["Changelog", "#"],
                ] as const,
              },
              {
                label: "Resources",
                links: [
                  ["Docs", "#"],
                  ["Templates", "#"],
                  ["Case studies", "#"],
                  ["API", "#"],
                ] as const,
              },
              {
                label: "Company",
                links: [
                  ["About", "#"],
                  ["Privacy", "#"],
                  ["Terms", "#"],
                  ["Contact", "#"],
                ] as const,
              },
            ].map((col) => (
              <div key={col.label}>
                <div className="text-[10px] mono uppercase tracking-widest text-slate-500">
                  {col.label}
                </div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-slate-300 hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 pt-6 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-500">
            <div>© 2025 Council Labs. All rights reserved.</div>
            <div className="mono">v0.9 · Made for decision-makers</div>
          </div>
        </div>
      </footer>
    </>
  );
}
