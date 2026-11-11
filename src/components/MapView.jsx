import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon rendering issue in React bundlers
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export const MapView = ({ userLocation, toilets, onSelectToilet }) => {
  // Default map center (Taksim) if user location is denied or missing
  const defaultCenter = [41.0369, 28.9850];
  const center = userLocation || defaultCenter;

  return (
    <div style={{ height: '450px', width: '100%' }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        {/* OpenStreetMap attribution requirement */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location pin */}
        {userLocation && (
          <Marker position={userLocation}>
            <Popup>Your Location</Popup>
          </Marker>
        )}

        {/* Render nearby toilet pins */}
        {toilets.map((toilet) => (
          <Marker
            key={toilet.id}
            position={[toilet.latitude, toilet.longitude]}
            eventHandlers={{
              click: () => onSelectToilet(toilet),
            }}
          >
            <Popup>
              <strong>{toilet.name}</strong> <br />
              {toilet.is_free ? 'Free' : 'Paid'} <br />
              {toilet.distance_m ? `Distance: ${toilet.distance_m}m` : 'Location denied'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};