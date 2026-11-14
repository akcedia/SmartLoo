import { ISTANBUL_DISTRICTS } from "../api/contract.js";
import { PRESETS } from "../api/dateRange.js";

export default function FilterBar({ district, preset, from, to, errors, onChange }) {
  const custom = preset === "custom";
  return (
    <form className="admin-filters" aria-label="Analiz filtreleri" onSubmit={(e) => e.preventDefault()}>
      <label>
        İlçe
        <select value={district} onChange={(e) => onChange({ district: e.target.value })}>
          <option value="">Tüm ilçeler</option>
          {ISTANBUL_DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      <fieldset className="admin-presets">
        <legend>Dönem</legend>
        {Object.entries(PRESETS).map(([key, { label }]) => (
          <label key={key} className="admin-radio">
            <input
              type="radio"
              name="preset"
              value={key}
              checked={preset === key}
              onChange={() => onChange({ preset: key })}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label>
        Başlangıç
        <input
          type="date"
          value={from}
          disabled={!custom}
          aria-invalid={Boolean(errors.from)}
          aria-describedby={errors.from ? "from-error" : undefined}
          onChange={(e) => onChange({ from: e.target.value })}
        />
        {errors.from && <span id="from-error" className="admin-field-error">{errors.from}</span>}
      </label>
      <label>
        Bitiş
        <input
          type="date"
          value={to}
          disabled={!custom}
          aria-invalid={Boolean(errors.to)}
          aria-describedby={errors.to ? "to-error" : undefined}
          onChange={(e) => onChange({ to: e.target.value })}
        />
        {errors.to && <span id="to-error" className="admin-field-error">{errors.to}</span>}
      </label>
      <p className="admin-hint">Tarihler Europe/Istanbul saatine göre, iki uç dahil. Filtre değerlendirme tarihine (created_at) uygulanır.</p>
    </form>
  );
}
