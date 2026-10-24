// Calendar-date helpers for the district/date filter.
// Dates are plain "YYYY-MM-DD" strings in Europe/Istanbul; the backend turns
// [from, to] into the half-open interval [from 00:00, to+1 00:00) Istanbul time.

import { TIMEZONE } from "./contract.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PRESETS = {
  last30: { label: "Son 30 gün", days: 30 },
  last7: { label: "Son 7 gün", days: 7 },
  custom: { label: "Özel aralık", days: null },
};

export function todayInIstanbul(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
}

export function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Last N calendar days inclusive of today (open question Q1).
export function presetRange(preset, today = todayInIstanbul()) {
  const { days } = PRESETS[preset];
  return { from: addDays(today, -(days - 1)), to: today };
}

export function validateRange({ from, to }) {
  const errors = {};
  if (!isValidDate(from)) errors.from = "Geçerli bir başlangıç tarihi girin (YYYY-AA-GG).";
  if (!isValidDate(to)) errors.to = "Geçerli bir bitiş tarihi girin (YYYY-AA-GG).";
  if (!errors.from && !errors.to && from > to) {
    errors.to = "Bitiş tarihi başlangıçtan önce olamaz.";
  }
  return errors;
}

export function eachDay(from, to) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

// Istanbul calendar date of an ISO timestamp (used by the sample adapter only).
export function istanbulDateOf(isoTimestamp) {
  return todayInIstanbul(new Date(isoTimestamp));
}
