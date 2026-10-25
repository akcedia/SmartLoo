import { CRITICAL_THRESHOLD } from "../api/contract.js";
import { useElementWidth } from "../useElementWidth.js";

const MIN_W = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };
const LABEL_SPACING = 56; // px between date labels

// The chart is drawn at its real pixel width so labels and dots keep their
// size on every screen; height and label density follow the width.
export function chartGeometry(width, days) {
  const W = Math.max(MIN_W, width);
  const H = Math.round(Math.min(240, Math.max(170, W * 0.32)));
  const innerW = W - PAD.left - PAD.right;
  const maxLabels = Math.max(2, Math.floor(innerW / LABEL_SPACING));
  return { W, H, innerW, labelEvery: Math.max(1, Math.ceil(days / maxLabels)) };
}

// Daily mean trend. Days without reviews are gaps, never drawn as 0.
export default function TrendChart({ trend, threshold = CRITICAL_THRESHOLD }) {
  const [ref, width] = useElementWidth(640);
  const points = trend.filter((d) => d.average_cleanliness !== null);
  if (points.length === 0) {
    return <p className="admin-empty">Bu seçim için trend verisi yok.</p>;
  }

  const { W, H, innerW, labelEvery } = chartGeometry(width, trend.length);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - ((v - 1) / 4) * innerH;

  const segments = [];
  let current = [];
  trend.forEach((d, i) => {
    if (d.average_cleanliness === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(`${x(i)},${y(d.average_cleanliness)}`);
    }
  });
  if (current.length) segments.push(current);

  return (
    <figure className="admin-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Günlük ortalama hijyen puanı trendi">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="admin-chart-grid" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="admin-chart-label">{v}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(threshold)} y2={y(threshold)} className="admin-chart-threshold" />
        {segments.map((seg, i) => (
          <polyline key={i} points={seg.join(" ")} className="admin-chart-line" />
        ))}
        {trend.map((d, i) =>
          d.average_cleanliness === null ? null : (
            <circle
              key={d.date}
              cx={x(i)}
              cy={y(d.average_cleanliness)}
              r="4"
              className={d.average_cleanliness < threshold ? "admin-chart-dot admin-chart-dot--critical" : "admin-chart-dot"}
            >
              <title>{`${d.date}: ${d.average_cleanliness.toFixed(2)} (${d.review_count} değerlendirme)`}</title>
            </circle>
          ),
        )}
        {trend.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" className="admin-chart-label">{d.date.slice(5)}</text>
          ) : null,
        )}
      </svg>
      <figcaption>Günlük ortalama (1–5). Kesikli çizgi: {threshold} kritik eşik. Değerlendirme olmayan günler boş bırakılır.</figcaption>
    </figure>
  );
}
