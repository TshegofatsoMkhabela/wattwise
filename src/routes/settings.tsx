import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { User as UserIcon, Cpu, Bell } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · WattWise" }] }),
  component: () => (
    <AppLayout title="Settings">
      <SettingsPage />
    </AppLayout>
  ),
});

const tabs = [
  { id: "account", label: "Account", Icon: UserIcon },
  { id: "hardware", label: "Hardware", Icon: Cpu },
  { id: "notifications", label: "Notifications", Icon: Bell },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<typeof tabs[number]["id"]>("account");
  return (
    <div className="max-w-3xl">
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 transition-colors ${
              tab === t.id
                ? "border-[#005EB8] text-[#005EB8]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}>
            <t.Icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "account" && <AccountTab />}
      {tab === "hardware" && <HardwareTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}

function AccountTab() {
  const user = useAuthStore((s) => s.user);
  return (
    <Card>
      <CardTitle>Account</CardTitle>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EBF5FF] text-[#005EB8] grid place-items-center text-xl font-bold border-2 border-[#005EB8]/20">
            {user?.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <button className="text-xs text-[#005EB8] hover:underline font-medium">Upload photo</button>
        </div>
        <Field label="Full name" defaultValue={user?.name} />
        <Field label="Email" defaultValue={user?.email} type="email" />
        <Field label="Phone number" defaultValue="+27 82 555 0101" />
        <div className="text-xs">
          <span className="text-slate-400">Role: </span>
          <span className="font-semibold capitalize text-slate-700">{user?.role}</span>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">Change password</div>
          <Field label="Current password" type="password" />
          <Field label="New password" type="password" />
        </div>
        <SaveButton onClick={() => toast.success("Account saved")}>Save changes</SaveButton>
      </div>
    </Card>
  );
}

function HardwareTab() {
  const [threshold, setThreshold] = useState(45);
  return (
    <Card>
      <CardTitle>Hardware configuration</CardTitle>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="COM port" defaultValue="COM3" />
          <div>
            <Label>Baud rate</Label>
            <select defaultValue="9600" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30">
              {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => toast.success("Serial bridge connected · NX-Gateway v2.1")}
          className="text-xs border border-[#005EB8]/30 text-[#005EB8] px-3 py-1.5 rounded-lg hover:bg-[#EBF5FF] transition-colors font-medium">
          Test connection
        </button>

        <div className="border-t border-slate-100 pt-4">
          <Field label="Baseline watts" defaultValue="1950" type="number" />
          <div>
            <Label>Deviation threshold ({threshold}%)</Label>
            <input
              type="range" min={10} max={100} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#005EB8]" />
          </div>
          <div className="mt-3">
            <Label>Sample interval</Label>
            <select defaultValue="1000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30">
              <option value="500">500 ms</option>
              <option value="1000">1 s</option>
              <option value="2000">2 s</option>
              <option value="5000">5 s</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <Field label="EskomSePush API key" placeholder="esp_xxxxxxxxxxxx" type="password" />
        </div>

        <SaveButton onClick={() => toast.success("Hardware settings saved")}>Save hardware settings</SaveButton>
      </div>
    </Card>
  );
}

function NotificationsTab() {
  const user = useAuthStore((s) => s.user);
  return (
    <Card>
      <CardTitle>Notifications</CardTitle>
      <div className="space-y-4">
        <Toggle label="Email alerts for critical tamper events" defaultChecked />
        <Toggle label="SMS alerts (charges may apply)" />
        <Field label="SMS phone number" defaultValue="+27 82 555 0101" />
        <Toggle label="Browser push notifications" defaultChecked />
        {user?.role === "municipality" && (
          <Toggle label="USSD push broadcast (municipality only)" defaultChecked />
        )}
        <div>
          <Label>Notification frequency</Label>
          <select defaultValue="immediately" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30">
            <option value="immediately">Immediately</option>
            <option value="15min">Every 15 minutes</option>
            <option value="hourly">Hourly digest</option>
          </select>
        </div>
        <SaveButton onClick={() => toast.success("Notification preferences saved")}>Save preferences</SaveButton>
      </div>
    </Card>
  );
}

/* ─── Shared primitives ──────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
      {children}
    </label>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        {...props}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8]"
      />
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <button onClick={() => setOn(!on)} className="flex items-center justify-between w-full text-left text-sm text-slate-700">
      <span>{label}</span>
      <span className={`w-10 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ml-4 ${on ? "bg-[#005EB8]" : "bg-slate-200"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function SaveButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#005EB8] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#003F8A] transition-colors shadow-sm"
    >
      {children}
    </button>
  );
}
