import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Marker, useMapEvents } from "react-leaflet";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { PIN_STATE_LABELS, pinIcon, pinState } from "./mapPins.js";
import { selectVisibleMarkers } from "./markerDensity.js";

function snapshot(map) {
  const bounds = map.getBounds();
  return { zoom: map.getZoom(), south: bounds.getSouth(), north: bounds.getNorth(),
    west: bounds.getWest(), east: bounds.getEast() };
}

const FacilityPin = memo(function FacilityPin({ row, selected, onSelect }) {
  const { t } = useI18n();
  const state = pinState(row);
  const handlers = useMemo(() => ({ click: () => onSelect(row) }), [row, onSelect]);
  return <Marker icon={pinIcon(state, selected)} alt={row.name}
    title={`${row.name} · ${t(PIN_STATE_LABELS[state])}`}
    position={[row.latitude, row.longitude]}
    zIndexOffset={selected ? 1000 : state === "open" ? 100 : 0} eventHandlers={handlers} />;
});

export default function FacilityMarkers({ toilets, selectedToilet, onSelectToilet }) {
  const { t } = useI18n();
  const [view, setView] = useState(null);
  const map = useMapEvents({ moveend: refresh, zoomend: refresh, resize: refresh });
  function refresh() {
    const next = snapshot(map);
    setView((previous) => previous && Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next);
  }
  const current = view ?? snapshot(map);
  const selection = useMemo(() => selectVisibleMarkers(toilets, current,
    (row) => map.project([row.latitude, row.longitude], current.zoom), selectedToilet?.id),
    [toilets, current, selectedToilet?.id, map]);
  const selectRef = useRef(onSelectToilet);
  selectRef.current = onSelectToilet;
  const select = useCallback((row) => selectRef.current(row), []);
  return <>
    {selection.rows.map((row) => <FacilityPin key={row.id} row={row} selected={row.id === selectedToilet?.id} onSelect={select} />)}
    {selection.limited && <div className="sl-map-density" role="status">
      {t("Bu görünümde {shown}/{total} tesis gösteriliyor. Daha fazlası için yakınlaştırın.",
        { shown: selection.rows.length, total: selection.totalInView })}
    </div>}
  </>;
}
