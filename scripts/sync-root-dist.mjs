import { cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await cp("codebase/dist", "dist", { recursive: true });
console.log("Synced codebase/dist -> dist for preview tooling.");
