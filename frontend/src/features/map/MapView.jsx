import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { PIN_STATE_LABELS, pinIcon, pinState, userLocationIcon } from "./mapPins.js";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";

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

// A facility chosen from the list or the AI panel is brought into view.
function ShowSelected({ toilet }) {
  const map = useMap();
  useEffect(() => {
    if (!toilet || toilet.latitude == null || toilet.longitude == null) return;
    const point = [toilet.latitude, toilet.longitude];
    if (!map.getBounds().contains(point)) map.panTo(point);
  }, [toilet, map]);
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
  selectedToilet = null,
}) {
  const { t } = useI18n();
  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {!citywide && pendingCenter && (
        <button
          type="button"
          className="sl-search-area"
          onClick={onSearchThisArea}
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            padding: "8px 16px",
            borderRadius: "999px",
            border: "1px solid var(--sl-accent-solid)",
            background: "var(--sl-accent-solid)",
            color: "var(--sl-on-accent)",
            fontWeight: "600",
            fontSize: "13px",
            boxShadow: "var(--sl-shadow-md)",
            cursor: "pointer",
          }}
        >
          {t("Bu bölgede ara")}
        </button>
      )}

      <MapContainer
        center={[searchCenter.lat, searchCenter.lon]}
        zoom={15}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomleft" />
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
          pathOptions={{ className: "sl-radius" }}
        />}

        {hasLocationPermission && userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={userLocationIcon} title={t("Mevcut Konumunuz")} keyboard={false}>
            <Popup>{t("Mevcut Konumunuz")}</Popup>
          </Marker>
        )}

        <ShowSelected toilet={selectedToilet} />

        {toilets.map((toilet) => {
          const state = pinState(toilet);
          const selected = selectedToilet?.id === toilet.id;
          return (
            <Marker
              key={toilet.id}
              icon={pinIcon(state, selected)}
              alt={toilet.name}
              title={`${toilet.name} · ${t(PIN_STATE_LABELS[state])}`}
              position={[toilet.latitude, toilet.longitude]}
              zIndexOffset={selected ? 1000 : state === "open" ? 100 : 0}
              eventHandlers={{
                click: () => onSelectToilet(toilet),
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
