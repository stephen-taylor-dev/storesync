"use client";

import { useMemo, useEffect } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LocationMapPoint } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Fix Leaflet default icon paths (webpack bundling issue)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

/** Auto-fit map bounds to all markers */
function FitBounds({ points }: { points: LocationMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map((p) => [Number(p.latitude), Number(p.longitude)])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);

  return null;
}

interface LocationMapProps {
  points: LocationMapPoint[];
}

export default function LocationMap({ points }: LocationMapProps) {
  // Default center: US geographic center
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [39.8283, -98.5795];
    const lat = points.reduce((sum, p) => sum + Number(p.latitude), 0) / points.length;
    const lng = points.reduce((sum, p) => sum + Number(p.longitude), 0) / points.length;
    return [lat, lng];
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed p-12 text-muted-foreground">
        No locations with coordinates to display on the map.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-420px)] w-full rounded-md border overflow-hidden">
      <MapContainer
        center={center}
        zoom={4}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {points.map((point) => (
            <Marker
              key={point.id}
              position={[Number(point.latitude), Number(point.longitude)]}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1.5">
                  <p className="font-semibold text-sm">{point.name}</p>
                  <p className="text-xs text-muted-foreground">{point.brand_name}</p>
                  <p className="text-xs">Store #{point.store_number}</p>
                  <div>
                    <Badge variant={point.is_active ? "success" : "secondary"} className="text-xs">
                      {point.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                    <Link href={`/dashboard/brands/${point.brand}`}>
                      View details
                    </Link>
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
