import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Building2, Wrench, Zap, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · WattWise" }] }),
  component: LoginPage,
});

const roles: { id: Role; label: string; desc: string; Icon: typeof Home }[] = [
  { id: "consumer", label: "Household Consumer", desc: "View your meter & usage", Icon: Home },
  { id: "municipality", label: "Municipality Operator", desc: "Oversee your network", Icon: Building2 },
  { id: "technician", label: "Field Technician", desc: "Manage your job queue", Icon: Wrench },
];

function LoginPage() {
  const [email, setEmail] = useState("casious@wattwise.co.za");
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState<Role>("consumer");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, role);
    const target =
      role === "consumer" ? "/dashboard" : role === "municipality" ? "/municipality" : "/technician";
    navigate({ to: target });
  };

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-blue-100 border border-blue-50 overflow-hidden">

        {/* Blue top stripe */}
        <div className="bg-[#003F8A] px-8 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">WattWise</div>
            <div className="text-blue-200 text-[11px] uppercase tracking-widest leading-tight">Energy Gateway</div>
          </div>
        </div>

        <form onSubmit={submit} className="px-8 py-7 space-y-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to access your dashboard.</p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8] transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8] transition-colors"
            />
          </div>

          {/* Role selector */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">I am signing in as</div>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((r) => {
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      active
                        ? "border-[#005EB8] bg-[#EBF5FF] text-[#005EB8]"
                        : "border-slate-200 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <r.Icon className="w-5 h-5 mb-1.5" />
                    <div className="text-[11px] font-semibold leading-tight">{r.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block">{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-[#005EB8] hover:bg-[#003F8A] text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            Sign in to Gateway <ChevronRight className="w-4 h-4" />
          </button>

          <p className="text-[10.5px] text-slate-400 text-center leading-relaxed">
            By signing in you accept the WattWise data-use policy and consent to
            telemetry being shared with your local municipality.
          </p>
        </form>
      </div>


    </div>
  );
}
