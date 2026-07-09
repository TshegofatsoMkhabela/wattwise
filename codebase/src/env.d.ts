/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  // Copilot Studio agent via Direct Line (see src/lib/directline.ts).
  readonly VITE_DIRECTLINE_TOKEN_URL?: string;
  readonly VITE_DIRECTLINE_SECRET?: string;
  readonly VITE_DIRECTLINE_DOMAIN?: string;
  readonly VITE_AGENT_MODE?: "mock" | "live";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
