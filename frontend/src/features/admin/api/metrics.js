// Reference aggregation used by the sample adapter. It follows the same rules the
// backend must implement (REQUIREMENTS.MD §3.6) so the sample screens are honest:
// - the KPI is the mean of individual eligible reviews, not a mean of facility means;
// - no eligible reviews means null, never 0.

import { EXPORT_COLUMNS, isCritical, CRITICAL_THRESHOLD, TIMEZONE } from "./contract.js";
import { eachDay, istanbulDateOf } from "./dateRange.js";

function mean(scores) {
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

export function selectEligibleReviews({ facilities, reviews }, { district, from, to }) {
  const inDistrict = new Map(
    facilities.filter((f) => !district || f.district === district).map((f) => [f.facility_id, f]),
  );
  return reviews.filter((r) => {
    if (!inDistrict.has(r.facility_id)) return false;
    const day = istanbulDateOf(r.created_at);
    return day >= from && day <= to;
  });
}

export function buildSummary(dataset, filters) {
  const { district = null, from, to } = filters;
  const facilities = dataset.facilities.filter((f) => !district || f.district === district);
  const eligible = selectEligibleReviews(dataset, { district, from, to });
  const average = mean(eligible.map((r) => r.cleanliness_score));

  const trend = eachDay(from, to).map((date) => {
    const scores = eligible
      .filter((r) => istanbulDateOf(r.created_at) === date)
      .map((r) => r.cleanliness_score);
    return { date, average_cleanliness: mean(scores), review_count: scores.length };
  });

  const rows = facilities.map((f) => {
    const scores = eligible.filter((r) => r.facility_id === f.facility_id).map((r) => r.cleanliness_score);
    return {
      facility_id: f.facility_id,
      name: f.name,
      district: f.district,
      status: f.status ?? null,
      hygiene_score: mean(scores),
      review_count: scores.length,
    };
  });

  const withStatus = facilities.filter((f) => f.status);
  const active_facility_ratio =
    withStatus.length === 0 || withStatus.length !== facilities.length
      ? null
      : { active: withStatus.filter((f) => f.status === "ACTIVE").length, total: facilities.length };

  return {
    filters: { district, from, to, timezone: TIMEZONE },
    average_cleanliness: average,
    review_count: eligible.length,
    critical_alert: isCritical(average),
    critical_threshold: CRITICAL_THRESHOLD,
    active_facility_ratio,
    trend: eligible.length === 0 ? [] : trend,
    facilities: eligible.length === 0 ? [] : rows,
  };
}

export function buildExportRows(dataset, filters) {
  const summary = buildSummary(dataset, filters);
  const byId = new Map(dataset.facilities.map((f) => [f.facility_id, f]));
  return summary.facilities.map((row) => {
    const f = byId.get(row.facility_id);
    return {
      facility_id: row.facility_id,
      district: row.district,
      hygiene_score: row.hygiene_score,
      // Operational fields only come from imported/administrative records.
      open_issues_count: f.open_issues_count ?? null,
      last_cleaned_at: f.last_cleaned_at ?? null,
    };
  });
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// RFC 4180 with CRLF and a UTF-8 BOM, as required for the CSV export.
export function toCsv(rows) {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const row of rows) lines.push(EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function exportFilename({ district, from, to }, format) {
  const place = district ? district : "all";
  return `smartloo-hygiene-${place}-${from}_${to}.${format}`;
}
