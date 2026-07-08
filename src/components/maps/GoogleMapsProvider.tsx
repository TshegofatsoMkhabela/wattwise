import { APIProvider } from "@vis.gl/react-google-maps";
import { MapPinOff } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface GoogleMapsContextValue {
  configured: boolean;
  mapId: string;
  loadError: string | null;
}

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() ?? "";

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  configured: false,
  mapId: "",
  loadError: null,
});

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const configured = Boolean(apiKey && mapId);
  const value = useMemo(() => ({ configured, mapId, loadError }), [configured, loadError]);

  if (!apiKey) {
    return <GoogleMapsContext.Provider value={value}>{children}</GoogleMapsContext.Provider>;
  }

  return (
    <GoogleMapsContext.Provider value={value}>
      <APIProvider
        apiKey={apiKey}
        region="ZA"
        language="en"
        authReferrerPolicy="origin"
        onError={(error) => {
          console.error("Google Maps failed to load", error);
          setLoadError(error instanceof Error ? error.message : "Google Maps failed to load.");
        }}
      >
        {children}
      </APIProvider>
    </GoogleMapsContext.Provider>
  );
}

// This hook shares the provider's load state with map components.
// eslint-disable-next-line react-refresh/only-export-components
export function useGoogleMapsConfig() {
  return useContext(GoogleMapsContext);
}

export function GoogleMapFallback({ message }: { message?: string }) {
  return (
    <div className="h-full min-h-60 w-full bg-navy rounded-xl grid place-items-center px-6 text-center text-white">
      <div>
        <MapPinOff className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-3 text-sm font-semibold">Map unavailable</div>
        <div className="mt-1 max-w-md text-xs text-slate-300">
          {message ??
            "Add VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_MAP_ID to .env.local, then restart the development server."}
        </div>
      </div>
    </div>
  );
}
