export async function fetchNearbyToilets({ lat, lon, radius, filters, signal }) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius: String(radius),
    });
  
    if (filters.open_now) params.set("open_now", "true");
    if (filters.has_disabled_access) params.set("has_disabled_access", "true");
    if (filters.has_baby_changing) params.set("has_baby_changing", "true");
    if (filters.is_free) params.set("is_free", "true");
  
    const response = await fetch(`/api/v1/toilets/nearby?${params.toString()}`, {
      signal,
    });
  
    if (!response.ok) {
      throw new Error(`API isteği başarısız oldu (HTTP ${response.status})`);
    }
  
    // Backend { count, results } döndürür
    return await response.json();
  } 