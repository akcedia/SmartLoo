// Administration > Moderasyon (FR-05, TC-07/TC-18). Lists user suggestions by status
// and lets an ADMIN approve or reject a pending one after an explicit confirmation.
// Approval publishes the facility on the map right away (server, same transaction).
// The list is refreshed after any failed decision so a stale card never stays.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider.jsx";
import {
  decideSuggestion,
  decisionErrorMessage,
  listErrorMessage,
  listSuggestions,
  PAGE_SIZE,
} from "./moderationApi.js";

const TABS = [
  ["pending", "Bekleyen"],
  ["approved", "Onaylanan"],
  ["rejected", "Reddedilen"],
];

function amenity(value, t) {
  if (value === true) return t("Var");
  if (value === false) return t("Yok");
  return t("Bilinmiyor");
}

function price(value, t) {
  if (value === true) return t("Ücretsiz");
  if (value === false) return t("Ücretli");
  return t("Bilinmiyor");
}

function formatTime(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
}

function Suggestion({ api, item, onDecided, busy, setBusy }) {
  const { t, locale } = useI18n();
  const [confirm, setConfirm] = useState(null); // "approved" | "rejected" | null
  const confirmRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (confirm) confirmRef.current?.focus();
  }, [confirm]);

  async function decide() {
    const status = confirm;
    setBusy(item.id);
    try {
      const saved = await decideSuggestion(api, item.id, status);
      onDecided({ ok: true, item: saved });
    } catch (err) {
      onDecided({ ok: false, item, error: err });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const pending = item.status === "pending";
  const mapUrl = `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=18/${item.latitude}/${item.longitude}`;
  const working = busy === item.id;

  return (
    <li className="admin-mod-item" aria-labelledby={titleId}>
      <div className="admin-mod-head">
        <h3 id={titleId}>{item.name}</h3>
        <span className={`admin-status-pill admin-mod-pill--${item.status}`}>{t(TABS.find(([key]) => key === item.status)?.[1] ?? item.status)}</span>
      </div>
      <dl className="admin-mod-facts">
        <dt>{t("İlçe")}</dt>
        <dd>{item.district}</dd>
        <dt>{t("Konum")}</dt>
        <dd>
          <span className="sl-num">{Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}</span>{" "}
          <a href={mapUrl} target="_blank" rel="noopener noreferrer">{t("Haritada kontrol et")}</a>
        </dd>
        <dt>{t("Engelli Erişimi")}</dt>
        <dd>{amenity(item.has_disabled_access, t)}</dd>
        <dt>{t("Bebek Bakım")}</dt>
        <dd>{amenity(item.has_baby_changing, t)}</dd>
        <dt>{t("Ücret")}</dt>
        <dd>{price(item.is_free, t)}</dd>
        <dt>{t("Gönderildi")}</dt>
        <dd>{formatTime(item.created_at, locale)}</dd>
        {!pending && (
          <>
            <dt>{t("Karar")}</dt>
            <dd>{formatTime(item.decided_at, locale)}</dd>
          </>
        )}
      </dl>

      {pending && !confirm && (
        <div className="admin-mod-actions">
          <button type="button" onClick={() => setConfirm("approved")} disabled={busy !== null}>{t("Onayla")}</button>
          <button type="button" className="admin-button-secondary" onClick={() => setConfirm("rejected")} disabled={busy !== null}>{t("Reddet")}</button>
        </div>
      )}

      {pending && confirm && (
        <div
          ref={confirmRef}
          className={`admin-mod-confirm admin-mod-confirm--${confirm}`}
          role="group"
          aria-label={t("Kararı onaylayın")}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape" && !working) setConfirm(null); }}
        >
          <p>
            {confirm === "approved"
              ? t("“{name}” onaylanınca tesis haritada hemen yayınlanır. Açılış saati ve bilinmeyen olanaklar bilinmiyor olarak kalır.", { name: item.name })
              : t("“{name}” reddedilir ve haritada görünmez. Karar geri alınamaz.", { name: item.name })}
          </p>
          <div className="admin-mod-actions">
            <button type="button" onClick={decide} disabled={working} aria-busy={working}>
              {working ? t("Kaydediliyor…") : confirm === "approved" ? t("Evet, onayla") : t("Evet, reddet")}
            </button>
            <button type="button" className="admin-button-secondary" onClick={() => setConfirm(null)} disabled={working}>{t("Vazgeç")}</button>
          </div>
        </div>
      )}

      {item.status === "approved" && item.toilet_id && (
        <p className="admin-hint">{t("Yayındaki tesis kimliği:")} <code>{item.toilet_id}</code></p>
      )}
    </li>
  );
}

export default function ModerationPanel({ api }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("pending");
  const [state, setState] = useState({ phase: "loading", items: [], count: 0, error: null });
  const [busy, setBusy] = useState(null);
  const requestGeneration = useRef(0);
  const [notice, setNotice] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (offset, signal) => listSuggestions(api, { status, offset, signal }),
    [api, status],
  );

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, phase: "loading", error: null }));
    load(0, controller.signal)
      .then((data) => {
        if (generation !== requestGeneration.current || controller.signal.aborted) return;
        setState({ phase: "ready", items: data.results, count: data.count, error: null });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || generation !== requestGeneration.current || controller.signal.aborted) return;
        setState({ phase: "error", items: [], count: 0, error });
      });
    return () => { ++requestGeneration.current; controller.abort(); };
  }, [load, reloadKey]);

  async function loadMore() {
    const generation = requestGeneration.current;
    setState((s) => ({ ...s, phase: "more" }));
    try {
      const data = await load(state.items.length);
      if (generation !== requestGeneration.current) return;
      setState((s) => ({ phase: "ready", items: [...s.items, ...data.results], count: data.count, error: null }));
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setState((s) => ({ ...s, phase: "ready", error }));
    }
  }

  // The outcome lives here, not in the card: after a failure the list reloads and the
  // card may disappear (e.g. 409, decided by someone else), but the reason must stay visible.
  function onDecided({ ok, item, error }) {
    if (ok) {
      setNotice({ kind: "ok", text: item.status === "approved"
        ? t("“{name}” onaylandı; tesis haritada yayında.", { name: item.name })
        : t("“{name}” reddedildi.", { name: item.name }) });
      setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id), count: Math.max(0, s.count - 1) }));
    } else {
      setNotice({ kind: "error", text: `“${item.name}”: ${t(decisionErrorMessage(error))}` });
      if (error?.status !== 401 && error?.status !== 403) setReloadKey((k) => k + 1);
    }
  }

  const items = state.items;

  return (
    <section className="admin-mod" aria-labelledby="mod-title">
      <h2 id="mod-title">{t("Tesis önerileri")}</h2>
      <p className="admin-hint admin-mod-intro">
        {t("Kullanıcıların önerdiği tesisler burada bekler. Onaylanan öneri hemen haritada yayınlanır; aynı yerde zaten bir tesis varsa reddedin (çift kayıt otomatik algılanmaz).")}
      </p>

      <div className="admin-mod-tabs" role="radiogroup" aria-label={t("Öneri durumu")}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={status === key}
            disabled={busy !== null}
            onClick={() => { setStatus(key); setNotice(null); }}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <p className="admin-status admin-mod-notice" role="status" hidden={notice?.kind !== "ok"}>{notice?.kind === "ok" ? notice.text : ""}</p>
      {notice?.kind === "error" && <p className="admin-status admin-status--error" role="alert">{notice.text}</p>}

      {state.phase === "loading" && (
        <p className="admin-status" role="status"><span className="admin-spinner" aria-hidden="true" /> {t("Öneriler yükleniyor…")}</p>
      )}

      {state.phase === "error" && (
        <div className="admin-status admin-status--error" role="alert">
          <p>{t(listErrorMessage(state.error))}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>{t("Tekrar dene")}</button>
        </div>
      )}

      {(state.phase === "ready" || state.phase === "more") && (
        <>
          <p className="admin-selection">{t("{n} öneri", { n: state.count })}</p>
          {items.length === 0 ? (
            <p className="admin-empty">
              {status === "pending" ? t("Bekleyen öneri yok.") : t("Bu durumda öneri yok.")}
            </p>
          ) : (
            <ul className="admin-mod-list">
              {items.map((item) => (
                <Suggestion key={item.id} api={api} item={item} busy={busy} setBusy={setBusy} onDecided={onDecided} />
              ))}
            </ul>
          )}
          {state.error && <p className="admin-field-error" role="alert">{t(listErrorMessage(state.error))}</p>}
          {state.items.length < state.count && (
            <button type="button" className="admin-button-secondary" onClick={loadMore} disabled={state.phase === "more"}>
              {state.phase === "more" ? t("Yükleniyor…") : t("Daha fazla göster ({n} kaldı)", { n: state.count - state.items.length })}
            </button>
          )}
        </>
      )}
      <p className="admin-hint">{t("En fazla {n} öneri bir kerede yüklenir.", { n: PAGE_SIZE })}</p>
    </section>
  );
}
