// Compact "1 km ▾" next to "Yakınımda". Choosing a distance switches to nearby
// search and closes the list again (shared Dropdown).
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { formatRadius, RADII } from "../../shared/settings/preferences.js";
import Dropdown from "../../shared/ui/Dropdown.jsx";

const OPTIONS = RADII.map((value) => ({ value, label: formatRadius(value) }));

export default function RadiusPicker({ radius, onChange }) {
  const { t } = useI18n();
  return (
    <Dropdown
      className="sl-radius"
      buttonClassName="sl-radius-button"
      label={t("Arama yarıçapı")}
      value={radius}
      options={OPTIONS}
      onChange={onChange}
    />
  );
}
