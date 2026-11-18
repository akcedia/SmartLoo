export async function fetchNearbyToilets({ lat, lon, radius, filters, signal }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
  });

  if (filters.open_now) params.set("open_now", "true");
  if (filters.has_disabled_access) params.set("has_disabled_access", "true");
  if (filters.has_baby_changing) params.set("has_baby_changing", "true");

  // FR-02: "free" -> is_free=true, "paid" -> is_free=false, "all" -> parametre gönderilmez
  if (filters.pricing === "free") {
    params.set("is_free", "true");
  } else if (filters.pricing === "paid") {
    params.set("is_free", "false");
  }

  const response = await fetch(`/api/v1/toilets/nearby?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`API isteği başarısız oldu (HTTP ${response.status})`);
  }

  return await response.json();
}