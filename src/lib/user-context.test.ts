import { describe, expect, it, vi, afterEach } from "vitest";
import { getRolePrefix, getAgentContext } from "./user-context";
import { useAuthStore } from "@/store/authStore";

describe("user-context", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    useAuthStore.setState({ user: null });
  });

  it("getRolePrefix returns correct label", () => {
    expect(getRolePrefix("consumer")).toBe("[Consumer/Household]");
    expect(getRolePrefix("municipality")).toBe("[Government/Municipality]");
    expect(getRolePrefix("technician")).toBe("[Technician]");
  });

  it("getAgentContext falls back to env vars when store is empty", () => {
    vi.stubEnv("VITE_USER_EMAIL", "env@test.com");
    vi.stubEnv("VITE_USER_USERNAME", "envuser");

    const ctx = getAgentContext();
    expect(ctx.role).toBe("consumer"); // fallback role
    expect(ctx.email).toBe("env@test.com");
    expect(ctx.username).toBe("envuser");
  });

  it("getAgentContext prefers authStore over env vars", () => {
    vi.stubEnv("VITE_USER_EMAIL", "env@test.com");
    vi.stubEnv("VITE_USER_USERNAME", "envuser");

    useAuthStore.setState({
      user: {
        id: "U-1",
        name: "Store User",
        email: "store@test.com",
        role: "technician",
      },
    });

    const ctx = getAgentContext();
    expect(ctx.role).toBe("technician");
    expect(ctx.roleLabel).toBe("Technician");
    expect(ctx.email).toBe("store@test.com");
    expect(ctx.username).toBe("Store User");
  });
});
