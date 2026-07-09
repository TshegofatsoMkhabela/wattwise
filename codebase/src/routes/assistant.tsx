import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PromptInput } from "@/components/ui/ai-chat-input";
import {
  isMockAgentMode,
  useCopilotAgent,
  waitLabel,
  type AgentStatus,
  type ChatMessage,
} from "@/lib/directline";
import {
  Sparkles,
  Zap,
  ShoppingCart,
  Lightbulb,
  AlertTriangle,
  FileText,
  BarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "Assistant · WattWise" }] }),
  component: () => (
    <AppLayout title="Energy Assistant">
      <AssistantChat />
    </AppLayout>
  ),
});

const SUGGESTIONS = [
  {
    icon: ShoppingCart,
    label: "Buy electricity units",
    prompt: "I'd like to buy electricity units.",
  },
  { icon: Zap, label: "Why is my usage high?", prompt: "Why is my electricity usage high today?" },
  {
    icon: Lightbulb,
    label: "Tips to save money",
    prompt: "Give me tips to lower my electricity bill.",
  },
  {
    icon: AlertTriangle,
    label: "Report a fault",
    prompt: "I want to report a fault with my meter.",
  },
  {
    icon: FileText,
    label: "Generate consumption report",
    prompt: "Generate a consumption report for last month.",
  },
  {
    icon: Zap,
    label: "Generate tamper report",
    prompt: "Generate a tamper report for Q4 2025.",
  },
  {
    icon: BarChart,
    label: "Load-shedding report",
    prompt: "Generate a load-shedding impact report for December.",
  },
];

function AssistantChat() {
  const {
    status,
    messages,
    awaitingReply,
    awaitingSince,
    timedOut,
    error,
    sendMessage,
    retryLast,
  } = useCopilotAgent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  // While a reply is pending, tick once a second so the escalating wait copy
  // ("Working on it…" → "Still working…") stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!awaitingReply) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [awaitingReply]);
  const waitElapsed = awaitingSince ? Date.now() - awaitingSince : 0;

  // Keep the conversation pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, awaitingReply]);

  return (
    // Cap the whole assistant surface to the viewport (max 100vh); the message
    // list is the only thing that scrolls, and the composer stays pinned.
    <div className="flex flex-col h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-6.5rem)] max-h-[100dvh] -mt-1">
      {/* Status strip */}
      <div className="flex items-center justify-between gap-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#005EB8] grid place-items-center flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">WattWise Assistant</div>
            <div className="text-[11px] text-slate-400 truncate">
              {isMockAgentMode ? "Demo orchestrator agents" : "Powered by Copilot Studio"}
            </div>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Message scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin rounded-2xl border border-slate-100 bg-white shadow-sm px-3 sm:px-5 py-4"
      >
        {isEmpty ? (
          <EmptyState onPick={sendMessage} disabled={status === "connecting"} />
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {awaitingReply && <TypingIndicator label={waitLabel(waitElapsed)} />}
          </div>
        )}
      </div>

      {error && status === "error" && (
        <p className="text-[11px] text-red-500 mt-2 flex-shrink-0 text-center">{error}</p>
      )}

      {timedOut && (
        <div className="flex justify-center mt-2 flex-shrink-0">
          <button
            onClick={retryLast}
            className="text-xs font-semibold text-[#005EB8] hover:text-[#003F8A] border border-blue-100 bg-[#EBF5FF] rounded-full px-4 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Composer pinned to the bottom */}
      <div className="flex-shrink-0 pt-3 flex justify-center">
        <PromptInput
          className="!max-w-xl"
          placeholder="Message the assistant…"
          disabled={status === "connecting"}
          onSubmit={(value) => sendMessage(value)}
        />
      </div>
    </div>
  );
}

/* ─── Status pill ──────────────────────────────────────────── */
function StatusPill({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { label: string; dot: string; text: string; bg: string }> = {
    online: {
      label: "Connected",
      dot: "bg-emerald-400 animate-pulse",
      text: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    connecting: {
      label: "Connecting…",
      dot: "bg-amber-400 animate-pulse",
      text: "text-amber-600",
      bg: "bg-amber-50",
    },
    error: { label: "Offline", dot: "bg-red-400", text: "text-red-600", bg: "bg-red-50" },
    unconfigured: {
      label: "Not connected",
      dot: "bg-slate-300",
      text: "text-slate-500",
      bg: "bg-slate-100",
    },
  };
  const c = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0",
        c.bg,
        c.text,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

/* ─── Empty state with suggestion chips ────────────────────── */
function EmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-[#EBF5FF] grid place-items-center mb-4">
        <Sparkles className="w-7 h-7 text-[#005EB8]" />
      </div>
      <h2 className="text-base font-bold text-slate-900">How can I help with your energy?</h2>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">
        Ask about your usage, buy units, or get money-saving tips — by text or voice.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-md">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              disabled={disabled}
              onClick={() => onPick(s.prompt)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-[#EBF5FF] hover:border-blue-100 hover:text-[#005EB8] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Icon className="w-4 h-4 text-[#005EB8] flex-shrink-0" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Message bubble ───────────────────────────────────────── */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
          isUser
            ? "bg-[#005EB8] text-white rounded-br-md"
            : "bg-slate-50 text-slate-800 border border-slate-100 rounded-bl-md",
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

/* ─── Typing indicator ─────────────────────────────────────── */
function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex justify-start">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        {label ? <span className="text-[11px] text-slate-400">{label}</span> : null}
      </div>
    </div>
  );
}
