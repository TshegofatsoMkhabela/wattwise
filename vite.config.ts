import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// When served behind the reverse proxy, Vite's HMR socket must point the browser
// back at the single public port (APP_PORT), not the internal 5173.
const appPort = Number(process.env.APP_PORT) || undefined;

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    ...(appPort ? { hmr: { clientPort: appPort } } : {}),
  },
  // Production preview server (what Docker runs). No HMR socket, so the app
  // behaves identically on every PC regardless of host/IP/port. allowedHosts
  // is open because the browser reaches it through the Caddy proxy by whatever
  // host/LAN IP each machine uses.
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
});
