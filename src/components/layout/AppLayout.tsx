import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Bell, Smartphone, Settings, FileText,
  LogOut, Zap, Home, Menu, X, ShieldAlert, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLiveData } from "@/store/liveDataStore";
import { useAlerts } from "@/store/alertsStore";
import { format, formatDistanceToNow } from "date-fns";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navByRole: Record<string, NavItem[]> = {
  consumer: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ussd", label: "USSD Simulator", icon: Smartphone },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  municipality: [
    { to: "/municipality", label: "Network", icon: Building2 },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: "/ussd", label: "USSD Simulator", icon: Smartphone },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  technician: [
    { to: "/technician", label: "My Jobs", icon: Wrench },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
};

const roleLabel = { consumer: "Consumer", municipality: "Municipality", technician: "Technician" };
const roleBadgeColor = {
  consumer: "bg-[#EBF5FF] text-[#005EB8]",
  municipality: "bg-emerald-50 text-emerald-700",
  technician: "bg-amber-50 text-amber-700",
};

const alertConfig = {
  critical: { Icon: ShieldAlert,   border: "border-l-red-400",    iconClass: "text-red-500",   bg: "bg-red-50",      label: "Critical" },
  warning:  { Icon: AlertTriangle, border: "border-l-amber-400",  iconClass: "text-amber-500", bg: "bg-amber-50",    label: "Warning" },
  info:     { Icon: CheckCircle,   border: "border-l-[#005EB8]",  iconClass: "text-[#005EB8]", bg: "bg-[#EBF5FF]",  label: "Info" },
} as const;

/* ─── Expandable alert row ─────────────────────────────────── */
function AlertRow({
  a,
  onDismiss,
}: {
  a: { id: string; severity: "critical" | "warning" | "info"; description: string; meterId: string; createdAt: string };
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const c = alertConfig[a.severity];

  return (
    <div className={`border-l-4 ${c.border} ${c.bg} rounded-r-xl overflow-hidden`}>
      {/* Collapsed row */}
      <button
        className="w-full text-left p-3 flex items-start gap-2.5"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <c.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.iconClass}`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
            {a.description}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        }
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-black/5">
          <div className="space-y-1.5 mt-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Severity:</span>
              <span className={`font-bold uppercase ${c.iconClass}`}>{c.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Meter ID:</span>
              <span className="font-mono">{a.meterId}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Time:</span>
              <span>{format(new Date(a.createdAt), "dd MMM yyyy, HH:mm")}</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed mt-1">{a.description}</div>
          </div>
          <button
            onClick={onDismiss}
            className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors"
          >
            Dismiss alert
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const connected = useLiveData((s) => s.connected);
  const alerts  = useAlerts((s) => s.alerts);
  const dismiss = useAlerts((s) => s.dismiss);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [now, setNow] = useState(new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  if (!user) return null;

  const items = navByRole[user.role];
  const RoleIcon = user.role === "consumer" ? Home : user.role === "municipality" ? Building2 : Wrench;
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const unreadCount = alerts.length;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-100 fixed inset-y-0 left-0 z-30 shadow-sm">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#005EB8] grid place-items-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">WattWise</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Energy Gateway</div>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeColor[user.role]}`}>
            <RoleIcon className="w-3 h-3" />
            {roleLabel[user.role]}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[#EBF5FF] text-[#005EB8]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#005EB8]" : "text-slate-400"}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
            <span className={connected ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
              {connected ? "Live · Serial bridge" : "Bridge offline"}
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 group">
            <div className="w-7 h-7 rounded-full bg-[#005EB8] grid place-items-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-100 z-50 flex flex-col shadow-xl transition-transform duration-200 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#005EB8] grid place-items-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">WattWise</span>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {items.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-[#EBF5FF] text-[#005EB8]" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#005EB8]" : "text-slate-400"}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-100">
          <button
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            className="flex items-center gap-2 text-sm text-red-500 font-medium"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-100 sticky top-0 z-20 flex items-center px-4 md:px-6 gap-3 shadow-sm">
          <button
            className="md:hidden text-slate-500 hover:text-slate-800 mr-1"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-sm font-semibold text-slate-900 truncate">{title}</h1>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live clock */}
            <div className="font-mono text-xs text-slate-400 tabular-nums hidden sm:block">
              {format(now, "HH:mm:ss")} SAST
            </div>
            {/* Connection dot */}
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
            {/* Notification bell */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-9 h-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 hover:text-slate-800 transition-colors ml-1"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 flex justify-around py-2 z-30 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
        {items.slice(0, 5).map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-[#005EB8]" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Notifications panel ── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/25 z-40 transition-opacity duration-200 ${
          notifOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setNotifOpen(false)}
        aria-hidden="true"
      />
      {/* Slide-in panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ${
          notifOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Notifications"
      >
        {/* Panel header */}
        <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setNotifOpen(false)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto p-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 grid place-items-center mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-700">You're all clear</p>
              <p className="text-sm text-slate-400 mt-1">No active notifications right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Tap an alert to expand
              </p>
              {alerts.map((a) => (
                <AlertRow key={a.id} a={a} onDismiss={() => dismiss(a.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer — dismiss all */}
        {alerts.length > 0 && (
          <div className="border-t border-slate-100 p-4 flex-shrink-0">
            <button
              onClick={() => alerts.forEach((a) => dismiss(a.id))}
              className="w-full text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors py-2"
            >
              Dismiss all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
