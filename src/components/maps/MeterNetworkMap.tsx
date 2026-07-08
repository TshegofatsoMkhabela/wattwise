import { AdvancedMarker, InfoWindow, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card-basic";
import type { Meter, MeterStatus } from "@/types";
import { GoogleMapFallback, useGoogleMapsConfig } from "./GoogleMapsProvider";
import { SOWETO_GENERAL, SOWETO_CAMPUS_YWCA } from "@/lib/locations";

const statusColors: Record<MeterStatus, string> = {
  normal: "#00C9A7",
  warning: "#F59E0B",
  critical: "#EF4444",
  offline: "#94A3B8",
};

function FitMapToMeters({ meters }: { meters: Meter[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || meters.length === 0) return;

    const timer = setTimeout(() => {
      const latitudes = meters.map((meter) => meter.lat);
      const longitudes = meters.map((meter) => meter.lng);
      
      const bounds = new window.google.maps.LatLngBounds(
        { lat: Math.min(...latitudes), lng: Math.min(...longitudes) }, // SW
        { lat: Math.max(...latitudes), lng: Math.max(...longitudes) }  // NE
      );
      
      // 1. Smoothly pan to the center of the pins
      map.panTo(bounds.getCenter());
      
      // 2. Step the zoom smoothly to simulate a fly-in effect
      let currentZoom = map.getZoom() || 11;
      const targetZoom = 15;
      
      const zoomInterval = setInterval(() => {
        if (currentZoom >= targetZoom) {
          clearInterval(zoomInterval);
          // Final exact fit once we're close enough that it won't snap
          map.panToBounds(bounds, 48);
          return;
        }
        currentZoom += 1;
        map.setZoom(currentZoom);
      }, 250);
      
    }, 800);

    return () => clearTimeout(timer);
  }, [map, meters]);

  return null;
}

export function MeterNetworkMap({ meters }: { meters: Meter[] }) {
  const navigate = useNavigate();
  const { configured, mapId, loadError } = useGoogleMapsConfig();
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = meters.find((meter) => meter.id === selectedId) ?? null;

  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardTitle hint={`${meters.length} GPS-enabled meters`}>
        Network map — GPS meter locations
      </CardTitle>
      <div className="relative overflow-hidden rounded-xl" style={{ height: 360 }}>
        {!configured || loadError ? (
          <GoogleMapFallback message={loadError ?? undefined} />
        ) : !mounted ? (
          <div
            className="h-full w-full animate-pulse bg-navy rounded-xl"
            aria-label="Loading map"
          />
        ) : (
          <Map
            className="h-full w-full"
            mapId={mapId}
            defaultCenter={SOWETO_GENERAL}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            reuseMaps
          >
            <FitMapToMeters meters={meters} />
            {meters.map((meter) => (
              <AdvancedMarker
                key={meter.id}
                position={{ lat: meter.lat, lng: meter.lng }}
                title={`${meter.id} — ${meter.address}`}
                onClick={() => setSelectedId(meter.id)}
                zIndex={meter.status === "critical" ? 20 : meter.status === "warning" ? 10 : 1}
              >
                <Pin
                  background={statusColors[meter.status]}
                  borderColor="#FFFFFF"
                  glyphColor="#0B1628"
                  scale={meter.status === "critical" ? 1.15 : 1}
                />
              </AdvancedMarker>
            ))}

            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                onCloseClick={() => setSelectedId(null)}
                shouldFocus={false}
              >
                <div className="min-w-52 text-navy">
                  <div className="font-mono text-xs font-semibold text-teal-600">{selected.id}</div>
                  <div className="mt-1 text-sm font-medium">{selected.address}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    {Math.round(selected.currentDraw)} W · Last seen{" "}
                    {formatDistanceToNow(new Date(selected.lastSeenAt), { addSuffix: true })}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/meter/$meterId", params: { meterId: selected.id } })
                    }
                    className="mt-3 text-xs font-semibold text-teal-600 hover:underline"
                  >
                    View meter details
                  </button>
                </div>
              </InfoWindow>
            )}
          </Map>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-navy-800/90 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur">
          {(Object.entries(statusColors) as [MeterStatus, string][]).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 capitalize">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {status}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
