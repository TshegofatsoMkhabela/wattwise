import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User } from "@/types";

interface AuthState {
  user: User | null;
  login: (email: string, role: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email, role) =>
        set({
          user: {
            id: "U-001",
            name: role === "consumer" ? "Casious Mookamedi" : role === "municipality" ? "Thandi Mokoena (Ops)" : "Sipho Maluleke",
            email,
            role,
            meterId: role === "consumer" ? "NXM-001-TZN" : undefined,
          },
        }),
      logout: () => set({ user: null }),
    }),
    { name: "nexmotion-auth" }
  )
);
