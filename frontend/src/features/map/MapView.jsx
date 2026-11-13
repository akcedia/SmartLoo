import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon]);
  }, [center.lat, center.lon, map]);
  return null;
}

function MapClickReset({ onClearSelection }) {
  useMapEvents({
    click: () => onClearSelection(),
  });
  return null;
}

export default function MapView({
  center,
  radius,
  toilets,
  hasLocationPermission,
  onSelectToilet,
  onClearSelection,
}) {
  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={center} />
      <MapClickReset onClearSelection={onClearSelection} />

      <Circle
        center={[center.lat, center.lon]}
        radius={radius}
        pathOptions={{ color: "#2563eb", fillOpacity: 0.08 }}
      />

      {hasLocationPermission && (
        <Marker position={[center.lat, center.lon]}>
          <Popup>Konumunuz</Popup>
        </Marker>
      )}

      {toilets.map((toilet) => (
        <Marker
          key={toilet.id}
          position={[toilet.latitude, toilet.longitude]}
          eventHandlers={{
            click: () => onSelectToilet(toilet),
          }}
        />
      ))}
    </MapContainer>
  );
} 