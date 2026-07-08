import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import { Zap, Shield, Eye, TrendingDown, ArrowRight, CheckCircle2, Phone, BarChart3, ChevronRight } from "lucide-react";
import heroBg from "@/assets/hero-bg.png";
import partner1 from "@/assets/partner1.png";
import partner2 from "@/assets/partner2.png";
import partner4 from "@/assets/partner4.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "WattWise — Smart Energy Gateway" }] }),
  component: LandingOrRedirect,
});

function LandingOrRedirect() {
  const user = useAuthStore((s) => s.user);
  if (user) {
    const target =
      user.role === "consumer" ? "/dashboard" : user.role === "municipality" ? "/municipality" : "/technician";
    return <Navigate to={target} />;
  }
  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Partners />
        <Stats />
        <Problems />
        <Roles />
        <HowItWorks />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────── */
function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gov-blue grid place-items-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">WattWise</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
          <a href="#how-it-works" className="hover:text-gov-blue transition-colors">How it works</a>
          <a href="#roles" className="hover:text-gov-blue transition-colors">Who it's for</a>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-gov-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gov-blue-dark transition-colors"
        >
          Sign in <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}

/* ─── Hero ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden text-white">
      {/* Joburg night-lights photo */}
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="eager"
      />

      {/* Subtle dark vignette — keeps text readable without blue cast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.50) 55%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 lg:py-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
            Powering<br />Accountability.<br />
            <span className="text-white/80">Every Rand. Every Household.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/75 leading-relaxed max-w-xl">
            Real-time electricity monitoring, tamper detection, and load-shedding
            awareness — built for Gauteng's households, municipalities, and field technicians.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white text-[#003F8A] font-bold px-6 py-3 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow-lg"
            >
              Sign in to Gateway <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-white/20 transition-colors"
            >
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Partners ticker ────────────────────────────────────── */
const PARTNERS = [partner1, partner2, partner4];

function Partners() {
  // 6× copies so first half (3 sets) always exceeds the widest viewport.
  // No px-* padding on the track — padding was creating a visible double-gap
  // at the seam where the end-padding of set N met the start-padding of set N+1.
  const track = Array.from({ length: 6 }, () => PARTNERS).flat();

  return (
    <section className="bg-white border-y border-slate-100 py-6 overflow-hidden">
      <p className="text-center text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-5">
        Official partners &amp; integrations
      </p>

      {/* Mask: fade edges to white */}
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        {/* No px-8 — padding was the source of the gap at the loop seam */}
        <div
          className="flex w-max gap-14 items-center"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {track.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Partner ${(i % PARTNERS.length) + 1}`}
              className="h-12 w-auto object-contain select-none"
              draggable={false}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ──────────────────────────────────────────────── */
function Stats() {
  const items = [
    { value: "24", label: "Meters monitored" },
    { value: "3", label: "Municipal areas" },
    { value: "99.1%", label: "System uptime" },
    { value: "R52k", label: "Savings this month" },
  ];
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {items.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl md:text-4xl font-extrabold text-gov-blue tabular-nums">{value}</div>
              <div className="mt-1.5 text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Problems ───────────────────────────────────────────── */
function Problems() {
  const issues = [
    {
      Icon: Zap,
      title: "Load shedding disrupts lives",
      body: "South Africans face up to 12 hours of outages per day. WattWise gives you a live countdown and appliance checklist so you're never caught off-guard.",
    },
    {
      Icon: Shield,
      title: "Meter tampering costs billions",
      body: "Municipal losses from tampered meters exceed R10 billion annually. Our hardware detects magnetic interference in real-time and alerts technicians within seconds.",
    },
    {
      Icon: TrendingDown,
      title: "Billing disputes are invisible",
      body: "Households can't see their consumption pattern in real-time. WattWise gives every household a live dashboard, USSD access, and transparent usage history.",
    },
  ];
  return (
    <section className="py-16 md:py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">South Africa's energy challenges — solved</h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            WattWise was built specifically for the realities of the South African grid.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {issues.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-gov-blue-light grid place-items-center mb-4">
                <Icon className="w-5 h-5 text-gov-blue" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Roles ──────────────────────────────────────────────── */
function Roles() {
  const roles = [
    {
      emoji: null,
      Icon: Eye,
      role: "Household Consumer",
      headline: "Your meter. Your data.",
      features: [
        "Live watt-by-watt usage tracking",
        "Instant tamper & anomaly alerts",
        "USSD access — works without data",
        "Estimated cost in Rands, in real-time",
      ],
      cta: "Sign in as Consumer",
    },
    {
      Icon: BarChart3,
      role: "Municipality Operator",
      headline: "Every meter in your area.",
      features: [
        "Network-wide health dashboard",
        "Critical, warning & offline status",
        "One-click technician dispatch",
        "Historical billing & anomaly reports",
      ],
      cta: "Sign in as Municipality",
      featured: true,
    },
    {
      Icon: Phone,
      role: "Field Technician",
      headline: "Your jobs. Your route.",
      features: [
        "Assigned job queue with priority",
        "Meter address & GPS context",
        "Photo evidence upload",
        "On-site status updates",
      ],
      cta: "Sign in as Technician",
    },
  ];
  return (
    <section id="roles" className="py-16 md:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">Built for every role in the chain</h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            One platform — three purpose-built views.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {roles.map(({ Icon, role, headline, features, cta, featured }) => (
            <div
              key={role}
              className={`rounded-2xl p-7 flex flex-col border transition-shadow hover:shadow-lg ${
                featured
                  ? "bg-gov-blue text-white border-gov-blue shadow-xl shadow-blue-200"
                  : "bg-white text-slate-900 border-slate-100 shadow-sm"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl grid place-items-center mb-4 ${featured ? "bg-white/15" : "bg-gov-blue-light"}`}>
                <Icon className={`w-5 h-5 ${featured ? "text-white" : "text-gov-blue"}`} />
              </div>
              <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${featured ? "text-blue-200" : "text-gov-blue"}`}>
                {role}
              </div>
              <h3 className="text-xl font-extrabold mb-4">{headline}</h3>
              <ul className="space-y-2.5 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? "text-blue-200" : "text-gov-blue"}`} />
                    <span className={featured ? "text-blue-50" : "text-slate-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`mt-6 inline-flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl transition-colors ${
                  featured
                    ? "bg-white text-gov-blue hover:bg-blue-50"
                    : "bg-gov-blue text-white hover:bg-gov-blue-dark"
                }`}
              >
                {cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ───────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Meter connects via GSM",
      body: "Each household meter is fitted with a NX-Gateway v2.1 device using a SIM800L GSM module — no fibre required. Works anywhere there's a cell signal.",
    },
    {
      n: "02",
      title: "Data streams in real-time",
      body: "Wattage, voltage, tamper events, and anomalies are pushed every second to the WattWise platform. Your municipality sees it all — simultaneously.",
    },
    {
      n: "03",
      title: "Everyone acts immediately",
      body: "Consumers see their dashboard. Municipalities spot anomalies. Technicians get dispatched — often before the household even notices a problem.",
    },
  ];
  return (
    <section id="how-it-works" className="py-16 md:py-20 bg-[#EBF5FF]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">How WattWise works</h2>
          <p className="mt-3 text-slate-500">From copper wire to dashboard in under a second.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map(({ n, title, body }, i) => (
            <div key={n} className="relative bg-white rounded-2xl p-7 border border-blue-100 shadow-sm">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 w-8 text-blue-300 z-10">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
              <div className="text-4xl font-extrabold text-blue-100 mb-3 tabular-nums">{n}</div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Banner ─────────────────────────────────────────── */
function CtaBanner() {
  return (
    <section className="py-16 md:py-20 bg-[#003F8A] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 grid place-items-center mx-auto mb-6">
          <Zap className="w-6 h-6 text-blue-200" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold">Ready to take control of your energy?</h2>
        <p className="mt-4 text-blue-200 text-lg">
          Join the households and municipalities across Gauteng already using WattWise.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 bg-white text-[#003F8A] font-bold px-8 py-3.5 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow-lg"
        >
          Get started now <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gov-blue grid place-items-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">WattWise</span>
        </div>
        <p className="text-xs text-center">
          Developed for the Gauteng Province Hackathon 2025 · Built with GSM, React &amp; love for the people of South Africa.
        </p>
        <div className="flex items-center gap-4 text-xs">
          <a href="/login" className="hover:text-white transition-colors">Sign in</a>
          <span>·</span>
          <span>© 2025 WattWise</span>
        </div>
      </div>
    </footer>
  );
}
