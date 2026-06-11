import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Incident } from "@/lib/mock-data";

interface HotspotMapProps {
  incidents: Incident[];
  height?: number | string;
  onSelect?: (incident: Incident) => void;
}

function parseGps(value: string): [number, number] | null {
  const parts = value.split(",").map((p) => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1]];
}

const severityWeight: Record<string, number> = {
  Major: 3,
  Minor: 2,
  "Near Miss": 1,
  Observation: 1,
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length > 0) {
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds.pad(0.3), { animate: false });
  }
  return null;
}

export function HotspotMap({ incidents, height = 360, onSelect }: HotspotMapProps) {
  const points = useMemo(() => {
    return incidents
      .map((inc) => {
        const coords = parseGps(inc.gps_coordinates);
        if (!coords) return null;
        const weight = severityWeight[inc.incident_type] || 1;
        return { incident: inc, coords, weight };
      })
      .filter((p): p is { incident: Incident; coords: [number, number]; weight: number } => p !== null);
  }, [incidents]);

  const center: [number, number] = points.length > 0 ? points[0].coords : [7.95, -1.03]; // Ghana

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-border"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "hsl(220, 20%, 95%)" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points.map((p) => p.coords)} />

        {points.map(({ incident, coords, weight }) => {
          const color =
            incident.incident_type === "Major"
              ? "hsl(0, 72%, 51%)"
              : incident.incident_type === "Minor"
              ? "hsl(25, 90%, 50%)"
              : "hsl(40, 82%, 52%)";
          const radius = 8 + weight * 4;
          return (
            <CircleMarker
              key={incident.id}
              center={coords}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.45,
                weight: 2,
                className: "hotspot-pulse",
              }}
              eventHandlers={{
                click: () => onSelect?.(incident),
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]}>
                <div className="text-xs">
                  <p className="font-semibold">{incident.id} · {incident.category}</p>
                  <p className="text-muted-foreground">{incident.location_name}</p>
                  <p className="text-muted-foreground">{incident.region} · {incident.incident_type}</p>
                  {incident.casualties > 0 && (
                    <p className="text-destructive">Casualties: {incident.casualties}</p>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
