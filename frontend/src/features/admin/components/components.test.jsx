// Static render tests (react-dom/server) — no extra test dependencies needed.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AccountMenu from "./AccountMenu.jsx";
import KpiCards from "./KpiCards.jsx";
import FacilityTable from "./FacilityTable.jsx";
import TrendChart, { chartGeometry } from "./TrendChart.jsx";
import { ErrorPanel, NoDataPanel } from "./StatusPanel.jsx";
import AdminDashboard, { formatDateTr } from "../AdminDashboard.jsx";
import { sampleSessionFor } from "../api/sampleAdapter.js";
import { CRITICAL_ALERT_TEXT } from "../api/contract.js";

const render = (el) => renderToStaticMarkup(el);
const kpi = (over) => ({
  average_cleanliness: 3.0,
  review_count: 2,
  critical_alert: true,
  critical_threshold: 3.5,
  active_facility_ratio: { active: 1, total: 2 },
  ...over,
});

describe("KpiCards", () => {
  it("shows the critical alert text below the threshold", () => {
    const html = render(<KpiCards data={kpi()} />);
    expect(html).toContain(CRITICAL_ALERT_TEXT);
    expect(html).toContain("3.00");
    expect(html).toContain('role="alert"');
  });

  it("shows 'Veri yok' and never a 0 score when the average is null", () => {
    const html = render(<KpiCards data={kpi({ average_cleanliness: null, review_count: 0, critical_alert: false })} />);
    expect(html).toContain("Veri yok");
    expect(html).not.toContain("0.00");
    expect(html).not.toContain(CRITICAL_ALERT_TEXT);
  });

  it("shows 'Bilinmiyor' when the active ratio is unavailable", () => {
    expect(render(<KpiCards data={kpi({ active_facility_ratio: null })} />)).toContain("Bilinmiyor");
  });
});

describe("FacilityTable and TrendChart", () => {
  it("marks critical rows and shows 'Veri yok' for null scores", () => {
    const html = render(
      <FacilityTable
        rows={[
          { facility_id: "a", name: "A", district: "Kadıköy", status: "ACTIVE", hygiene_score: 2.5, review_count: 2 },
          { facility_id: "b", name: "B", district: "Kadıköy", status: null, hygiene_score: null, review_count: 0 },
        ]}
      />,
    );
    expect(html).toContain("admin-cell--critical");
    expect(html).toContain("Veri yok");
    expect(html).toContain("Bilinmiyor");
  });

  it("leaves days without reviews as gaps, not zero points", () => {
    const trend = [
      { date: "2026-10-01", average_cleanliness: 4, review_count: 1 },
      { date: "2026-10-02", average_cleanliness: null, review_count: 0 },
      { date: "2026-10-03", average_cleanliness: 2, review_count: 1 },
    ];
    const html = render(<TrendChart trend={trend} />);
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html.match(/<polyline/g)).toHaveLength(2);
  });

  it("table cells carry labels for the narrow-screen card layout", () => {
    const html = render(
      <FacilityTable rows={[{ facility_id: "a", name: "A", district: "Kadıköy", status: "ACTIVE", hygiene_score: 4, review_count: 1 }]} />,
    );
    for (const label of ["İlçe", "Durum", "Hijyen puanı", "Değerlendirme"]) {
      expect(html).toContain(`data-label="${label}"`);
    }
  });

  it("adapts chart size and label density to the measured width", () => {
    const phone = chartGeometry(300, 30);
    const desktop = chartGeometry(1000, 30);
    expect(phone.W).toBe(300);
    expect(chartGeometry(120, 30).W).toBe(260); // never narrower than the minimum
    expect(phone.labelEvery).toBeGreaterThan(desktop.labelEvery);
    expect(Math.ceil(30 / phone.labelEvery)).toBeLessThanOrEqual(Math.floor((300 - 44) / 56));
    expect(phone.H).toBeGreaterThanOrEqual(170);
    expect(desktop.H).toBeLessThanOrEqual(240);
  });

  it("shows an empty message when the trend has no values", () => {
    expect(render(<TrendChart trend={[]} />)).toContain("trend verisi yok");
  });
});

describe("Status panels", () => {
  it.each([
    [401, "Oturum gerekli"],
    [403, "Yetkiniz yok"],
    [422, "Filtre geçersiz"],
    [500, "Tekrar dene"],
  ])("renders the %s state", (status, text) => {
    expect(render(<ErrorPanel error={{ status }} onRetry={() => {}} />)).toContain(text);
  });

  it("403 state contains no analytics numbers", () => {
    expect(render(<ErrorPanel error={{ status: 403 }} />)).not.toMatch(/\d\.\d\d/);
  });

  it("no-data panel explains that the average is not 0", () => {
    expect(render(<NoDataPanel />)).toContain("0 değildir");
  });
});

describe("AccountMenu", () => {
  it("offers sign-in when nobody is signed in", () => {
    const html = render(<AccountMenu session={null} />);
    expect(html).toContain("Giriş yap");
    expect(html).toContain('href="#/sign-in"');
  });

  it("shows the name and role of the sample session", () => {
    const html = render(<AccountMenu session={sampleSessionFor("normal")} />);
    expect(html).toContain("Örnek Yönetici");
    expect(html).toContain("Yönetici");
    expect(html).toContain('aria-expanded="false"');
  });

  it("maps demo scenarios to sessions", () => {
    expect(sampleSessionFor("unauthorized")).toBeNull();
    expect(sampleSessionFor("forbidden").role).toBe("USER");
    expect(sampleSessionFor("error").role).toBe("ADMIN");
  });
});

describe("AdminDashboard shell", () => {
  it("renders the sample banner, filters, account menu and only Analytics as active tab", () => {
    const html = render(<AdminDashboard />);
    expect(html).toContain("ÖRNEK VERİ");
    expect(html).toContain("Tüm ilçeler");
    expect(html).toContain("Örnek Yönetici");
    expect(html.match(/admin-tab--active/g)).toHaveLength(1);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
  });

  it("formats dates in Turkish order", () => {
    expect(formatDateTr("2026-10-07")).toBe("07.10.2026");
  });
});
