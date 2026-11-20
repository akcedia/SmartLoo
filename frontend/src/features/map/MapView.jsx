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

function RecenterMap({ center, citywide, toilets }) {
  const map = useMap();
  useEffect(() => {
    if (citywide) {
      if (toilets.length) map.fitBounds(toilets.map(t => [t.latitude, t.longitude]), {padding:[30,30], maxZoom:14});
      else map.setView([41.05, 29.0], 10);
    } else map.setView([center.lat, center.lon], 15);
  }, [center.lat, center.lon, citywide, toilets, map]);
  return null;
}

function MapInteractionHandler({ searchCenter, onClearSelection, onMapMoved }) {
  const map = useMapEvents({
    click: () => onClearSelection(),
    moveend: () => {
      const current = map.getCenter();
      const movedEnough =
        Math.abs(current.lat - searchCenter.lat) > 0.0005 ||
        Math.abs(current.lng - searchCenter.lon) > 0.0005;
      onMapMoved(
        movedEnough
          ? { lat: Number(current.lat.toFixed(5)), lon: Number(current.lng.toFixed(5)) }
          : null
      );
    },
  });
  return null;
}

export default function MapView({
  citywide = false,
  searchCenter,
  userLocation,
  radius,
  toilets,
  hasLocationPermission,
  pendingCenter,
  onMapMoved,
  onSearchThisArea,
  onSelectToilet,
  onClearSelection,
}) {
  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {!citywide && pendingCenter && (
        <button
          type="button"
          onClick={onSearchThisArea}
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            padding: "8px 16px",
            borderRadius: "999px",
            border: "1px solid #1d4ed8",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: "600",
            fontSize: "13px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
        >
          Bu bölgede ara
        </button>
      )}

      <MapContainer
        center={[searchCenter.lat, searchCenter.lon]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={searchCenter} citywide={citywide} toilets={toilets} />
        {!citywide && <MapInteractionHandler
          searchCenter={searchCenter}
          onClearSelection={onClearSelection}
          onMapMoved={onMapMoved}
        />}

        {!citywide && <Circle
          center={[searchCenter.lat, searchCenter.lon]}
          radius={radius}
          pathOptions={{ color: "#2563eb", fillOpacity: 0.08 }}
        />}

        {hasLocationPermission && userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]}>
            <Popup>Mevcut Konumunuz</Popup>
          </Marker>
        )}

        {toilets.map((toilet) => (
          <Marker
            key={toilet.id}
            alt={toilet.name}
            title={toilet.name}
            position={[toilet.latitude, toilet.longitude]}
            eventHandlers={{
              click: () => onSelectToilet(toilet),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
