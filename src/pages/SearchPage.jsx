import React, { useState, useEffect } from 'react';
import { MapView } from '../components/MapView'; // Relative import to components
import { fetchNearbyToilets } from '../api/toiletApi';

export const SearchPage = () => {
  const [toilets, setToilets] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedToilet, setSelectedToilet] = useState(null);

  // Search filter states
  const [filters, setFilters] = useState({
    hasDisabledAccess: false,
    isFree: false,
  });

  // Handle browser geolocation permission (TC-22 rule)
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocationDenied(false);
        },
        (err) => {
          console.warn('Geolocation denied:', err.message);
          setLocationDenied(true);
        }
      );
    }
  }, []);

  // Fetch toilet data when filters change
  useEffect(() => {
    const loadToilets = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchNearbyToilets();
        let results = response.results || [];

        // Simple client-side filtering simulation
        if (filters.hasDisabledAccess) {
          results = results.filter((t) => t.has_disabled_access === true);
        }
        if (filters.isFree) {
          results = results.filter((t) => t.is_free === true);
        }

        setToilets(results);
      } catch (err) {
        setError('Failed to load toilet data.');
      } finally {
        setLoading(false);
      }
    };

    loadToilets();
  }, [filters]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>SmartLoo - Nearby Toilets Search</h2>

      {/* Location warning banner when permission is denied */}
      {locationDenied && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          ⚠️ Location permission denied. Distances cannot be calculated, but you can browse the map manually.
        </div>
      )}

      {/* Filter panel */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <label>
          <input
            type="checkbox"
            checked={filters.hasDisabledAccess}
            onChange={(e) => setFilters({ ...filters, hasDisabledAccess: e.target.checked })}
          />
          Disabled Access
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.isFree}
            onChange={(e) => setFilters({ ...filters, isFree: e.target.checked })}
          />
          Free Only
        </label>
        <button
          onClick={() => setFilters({ hasDisabledAccess: false, isFree: false })}
          style={{ padding: '5px 10px', cursor: 'pointer' }}
        >
          Reset Filters
        </button>
      </div>

      {loading && <p>Loading map components...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <MapView
          userLocation={userLocation}
          toilets={toilets}
          onSelectToilet={(toilet) => setSelectedToilet(toilet)}
        />
      )}

      {/* Facility detail drawer panel (TC-21 rule) */}
      {selectedToilet && (
        <div style={{ marginTop: '20px', border: '1px solid #ccc', borderRadius: '6px', padding: '15px', background: '#f9f9f9' }}>
          <h3>{selectedToilet.name}</h3>
          <p>
            <strong>Disabled Access:</strong>{' '}
            {selectedToilet.has_disabled_access === null ? 'Unknown' : selectedToilet.has_disabled_access ? 'Yes' : 'No'}
          </p>
          <p>
            <strong>Cleanliness Score:</strong>{' '}
            {selectedToilet.average_cleanliness !== null ? `${selectedToilet.average_cleanliness} / 5` : 'Unknown'}
          </p>
          <button onClick={() => setSelectedToilet(null)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
            Close Details
          </button>
        </div>
      )}
    </div>
  );
};