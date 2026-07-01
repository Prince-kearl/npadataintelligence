import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.heat";
import type { IncidentRow } from "@/lib/incidents";
import { escapeHtml } from "@/lib/exporters";

interface HotspotMapProps {
  incidents: IncidentRow[];
  height?: number | string;
  onSelect?: (incident: IncidentRow) => void;
}

function parseGps(value: string | null): [number, number] | null {
  if (!value) return null;
  const parts = value.split(",").map((p) => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1]];
}

const severityWeight: Record<string, number> = {
  Major: 1.0,
  Minor: 0.6,
  "Near Miss": 0.35,
  Observation: 0.25,
};

function severityColor(type: string) {
  return type === "Major"
    ? "hsl(0, 72%, 51%)"
    : type === "Minor"
    ? "hsl(25, 90%, 50%)"
    : "hsl(40, 82%, 52%)";
}

interface PointData {
  incident: IncidentRow;
  coords: [number, number];
  weight: number;
}

function ClusterAndHeatLayer({
  points,
  mode,
  onSelect,
}: {
  points: PointData[];
  mode: "cluster" | "heat";
  onSelect?: (i: IncidentRow) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);

  // Fit bounds when points change
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p.coords[0], p.coords[1])));
    map.fitBounds(bounds.pad(0.3), { animate: false });
  }, [points, map]);

  // Manage layers
  useEffect(() => {
    // clean previous
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (mode === "cluster") {
      const cluster = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50,
        iconCreateFunction: (c) => {
          const count = c.getChildCount();
          const size = count < 10 ? 32 : count < 50 ? 40 : 52;
          return L.divIcon({
            html: `<div style="
              background: hsl(228, 62%, 26%);
              color: white;
              width:${size}px;height:${size}px;
              border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:12px;
              border:3px solid hsl(40, 82%, 52%);
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${count}</div>`,
            className: "npa-cluster-icon",
            iconSize: L.point(size, size),
          });
        },
      });

      points.forEach(({ incident, coords, weight }) => {
        const color = severityColor(incident.incident_type ?? "Observation");
        const radius = 6 + weight * 8;
        const marker = L.circleMarker(coords, {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.55,
          weight: 2,
          className: "hotspot-pulse",
        });
        marker.bindTooltip(
          `<div style="font-size:11px">
            <div style="font-weight:600">${escapeHtml(incident.reference_code)} · ${escapeHtml(incident.category)}</div>
            <div style="color:#666">${escapeHtml(incident.location_name)}</div>
            <div style="color:#666">${escapeHtml(incident.region)} · ${escapeHtml(incident.incident_type)}</div>
            ${incident.casualties > 0 ? `<div style="color:#c0392b">Casualties: ${incident.casualties}</div>` : ""}
          </div>`,
          { direction: "top", offset: [0, -radius] }
        );
        marker.on("click", () => onSelect?.(incident));
        cluster.addLayer(marker);
      });

      map.addLayer(cluster);
      clusterRef.current = cluster;
    } else {
      const heatPoints = points.map((p) => [p.coords[0], p.coords[1], p.weight] as [number, number, number]);
      // @ts-expect-error leaflet.heat lacks types
      const heat = L.heatLayer(heatPoints, {
        radius: 32,
        blur: 22,
        maxZoom: 12,
        minOpacity: 0.35,
        gradient: {
          0.2: "hsl(210, 75%, 48%)",
          0.4: "hsl(152, 60%, 38%)",
          0.6: "hsl(40, 82%, 52%)",
          0.8: "hsl(25, 90%, 50%)",
          1.0: "hsl(0, 72%, 51%)",
        },
      });
      heat.addTo(map);
      heatRef.current = heat;
    }

    return () => {
      if (clusterRef.current) map.removeLayer(clusterRef.current);
      if (heatRef.current) map.removeLayer(heatRef.current);
    };
  }, [points, mode, map, onSelect]);

  return null;
}

export function HotspotMap({ incidents, height = 360, onSelect }: HotspotMapProps) {
  const [mode, setMode] = useState<"cluster" | "heat">("cluster");

  const points = useMemo<PointData[]>(() => {
    return incidents
      .map((inc) => {
        const coords = parseGps(inc.gps_coordinates);
        if (!coords) return null;
        const weight = inc.incident_type ? severityWeight[inc.incident_type] ?? 0.3 : 0.3;
        return { incident: inc, coords, weight };
      })
      .filter((p): p is PointData => p !== null);
  }, [incidents]);

  const center: [number, number] = points.length > 0 ? points[0].coords : [7.95, -1.03];

  return (
    <div className="relative isolate z-0 rounded-lg overflow-hidden border border-border" style={{ height }}>
      <div className="absolute top-2 right-2 z-[400] flex gap-1 bg-card/95 backdrop-blur p-1 rounded-md shadow-md border border-border">
        <button
          onClick={() => setMode("cluster")}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            mode === "cluster" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Clusters
        </button>
        <button
          onClick={() => setMode("heat")}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            mode === "heat" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Heatmap
        </button>
      </div>
      <div className="absolute bottom-2 left-2 z-[400] text-[10px] text-muted-foreground bg-card/90 px-2 py-1 rounded shadow-sm border border-border">
        {points.length} incidents
      </div>

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
        <ClusterAndHeatLayer points={points} mode={mode} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
