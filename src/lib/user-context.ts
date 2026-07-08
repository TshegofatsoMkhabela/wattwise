import { useAuthStore } from "../store/authStore";
import type { Role } from "../types";

export interface UserIdentity {
  role: Role;
  roleLabel: string;
  email: string;
  username: string;
  mobile: string;
  consumerId: string;
  meterNumber: string;
  utilityAccount: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  consumer: "Consumer/Household",
  municipality: "Government/Municipality",
  technician: "Technician",
};

/** 
 * Formats a block of text prepended to every chat message containing
 * the user's role and all identity variables from the environment/authStore.
 */
export function formatAgentMessageContext(ctx: UserIdentity): string {
  const parts = [];
  parts.push(`[${ROLE_LABELS[ctx.role]}]`);
  if (ctx.username) parts.push(`Username: ${ctx.username}`);
  if (ctx.email) parts.push(`Email: ${ctx.email}`);
  if (ctx.mobile) parts.push(`Mobile: ${ctx.mobile}`);
  if (ctx.consumerId) parts.push(`Consumer ID: ${ctx.consumerId}`);
  if (ctx.meterNumber) parts.push(`Meter: ${ctx.meterNumber}`);
  if (ctx.utilityAccount) parts.push(`Utility Account: ${ctx.utilityAccount}`);
  
  return parts.join(" | ");
}

/**
 * Full context block sent as `channelData.userContext` on every activity.
 * The agent can read this without parsing the message text.
 * Prefers active authStore user fields over static env vars.
 */
export function getAgentContext(): UserIdentity {
  const authUser = useAuthStore.getState().user;
  const role = authUser?.role ?? "consumer";

  return {
    role,
    roleLabel: ROLE_LABELS[role],
    email: authUser?.email || (import.meta.env.VITE_USER_EMAIL ?? "").trim(),
    username: authUser?.name || (import.meta.env.VITE_USER_USERNAME ?? "").trim(),
    mobile: (import.meta.env.VITE_USER_MOBILE ?? "").trim(),
    consumerId: (import.meta.env.VITE_USER_CONSUMER_ID ?? "").trim(),
    meterNumber:
      role === "consumer" && authUser?.meterId
        ? authUser.meterId
        : (import.meta.env.VITE_USER_METER_NUMBER ?? "").trim(),
    utilityAccount: (import.meta.env.VITE_USER_UTILITY_ACCOUNT ?? "").trim(),
  };
}
