import { AdvancedMarker, InfoWindow, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card-basic";
import type { Job, Meter } from "@/types";
import { GoogleMapFallback, useGoogleMapsConfig } from "./GoogleMapsProvider";
import { SOWETO_GENERAL, SOWETO_CAMPUS_YWCA } from "@/lib/locations";

interface LocatedJob {
  job: Job;
  meter: Meter;
}

function FitMapToJobs({ jobs }: { jobs: LocatedJob[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || jobs.length === 0) return;

    const timer = setTimeout(() => {
      const latitudes = jobs.map(({ meter }) => meter.lat);
      const longitudes = jobs.map(({ meter }) => meter.lng);
      
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
          map.panToBounds(bounds, 56);
          return;
        }
        currentZoom += 1;
        map.setZoom(currentZoom);
      }, 250);
      
    }, 800);

    return () => clearTimeout(timer);
  }, [jobs, map]);

  return null;
}

export function TechnicianJobMap({ jobs, meters }: { jobs: Job[]; meters: Meter[] }) {
  const { configured, mapId, loadError } = useGoogleMapsConfig();
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locatedJobs = useMemo(
    () =>
      jobs.flatMap((job) => {
        const meter = meters.find((candidate) => candidate.id === job.meterId);
        return meter ? [{ job, meter }] : [];
      }),
    [jobs, meters],
  );
  const selected = locatedJobs.find(({ job }) => job.id === selectedId) ?? null;

  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardTitle
        hint={`${locatedJobs.length} located active job${locatedJobs.length === 1 ? "" : "s"}`}
      >
        Job map
      </CardTitle>
      <div className="relative overflow-hidden rounded-xl" style={{ height: 280 }}>
        {!configured || loadError ? (
          <GoogleMapFallback message={loadError ?? undefined} />
        ) : !mounted ? (
          <div
            className="h-full w-full animate-pulse bg-navy rounded-xl"
            aria-label="Loading map"
          />
        ) : locatedJobs.length === 0 ? (
          <GoogleMapFallback message="No active jobs have a meter location yet." />
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
            <FitMapToJobs jobs={locatedJobs} />
            {locatedJobs.map(({ job, meter }) => {
              const color = job.severity === "critical" ? "#EF4444" : "#F59E0B";
              return (
                <AdvancedMarker
                  key={job.id}
                  position={{ lat: meter.lat, lng: meter.lng }}
                  title={`${job.id} — ${job.address}`}
                  onClick={() => setSelectedId(job.id)}
                  zIndex={job.severity === "critical" ? 20 : 10}
                >
                  <Pin background={color} borderColor="#FFFFFF" glyphColor="#0B1628" />
                </AdvancedMarker>
              );
            })}

            {selected && (
              <InfoWindow
                position={{ lat: selected.meter.lat, lng: selected.meter.lng }}
                onCloseClick={() => setSelectedId(null)}
                shouldFocus={false}
              >
                <div className="min-w-52 text-navy">
                  <div className="font-mono text-xs font-semibold text-teal-600">
                    {selected.job.id}
                  </div>
                  <div className="mt-1 text-sm font-medium">{selected.job.address}</div>
                  <div className="mt-2 text-xs capitalize text-slate-600">
                    {selected.job.severity} · {selected.job.status.replace("_", " ")}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selected.meter.lat},${selected.meter.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs font-semibold text-teal-600 hover:underline"
                  >
                    Navigate with Google Maps
                  </a>
                </div>
              </InfoWindow>
            )}
          </Map>
        )}
      </div>
    </Card>
  );
}
