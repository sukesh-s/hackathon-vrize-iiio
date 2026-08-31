import type { DashboardSummary } from '../types';

interface Props {
  summary: DashboardSummary | null;
  loading?: boolean;
  attentionActive?: boolean;
  unresolvedActive?: boolean;
  onAttentionClick?: () => void;
  onUnresolvedClick?: () => void;
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

export default function KpiCards({
  summary,
  loading = false,
  attentionActive = false,
  unresolvedActive = false,
  onAttentionClick,
  onUnresolvedClick,
}: Props) {
  const total = summary?.totalCalls ?? 0;
  const attention = summary?.needsAttention ?? 0;
  const unresolved = summary?.unresolved ?? 0;
  const resolved = summary?.resolved ?? 0;
  const resolutionRate = summary?.resolutionRate ?? 0;

  const metrics = [
    {
      label: 'Calls analysed',
      value: total.toLocaleString(),
      icon: 'call',
      color: '#3B5CCC',
      bg: '#EEF2FF',
      detail: 'Available on this dashboard',
      action: undefined,
      active: false,
    },
    {
      label: 'Need attention',
      value: attention.toLocaleString(),
      icon: 'priority_high',
      color: '#ED6C02',
      bg: '#FFF3E0',
      detail: `${percentage(attention, total)}% of analysed calls`,
      action: onAttentionClick,
      active: attentionActive,
    },
    {
      label: 'Unresolved',
      value: unresolved.toLocaleString(),
      icon: 'report_problem',
      color: '#D32F2F',
      bg: '#FDECEA',
      detail: `${percentage(unresolved, total)}% of analysed calls`,
      action: onUnresolvedClick,
      active: unresolvedActive,
    },
    {
      label: 'Resolution rate',
      value: `${resolutionRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
      icon: 'check_circle',
      color: '#2E7D32',
      bg: '#E8F5E9',
      detail: `${resolved.toLocaleString()} resolved call${resolved === 1 ? '' : 's'}`,
      action: undefined,
      active: false,
    },
  ];

  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
    {metrics.map((metric, index) => <button
      key={metric.label}
      type="button"
      disabled={!metric.action || loading}
      onClick={metric.action}
      aria-pressed={metric.action ? metric.active : undefined}
      title={metric.action ? `Filter calls by ${metric.label.toLowerCase()}` : undefined}
      style={{
        padding: '16px 20px',
        border: 'none',
        borderRight: index < metrics.length - 1 ? '1px solid #E5E7EB' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: metric.active ? metric.bg : '#fff',
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: metric.action && !loading ? 'pointer' : 'default',
        opacity: 1,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 8, background: metric.bg, display: 'grid', placeItems: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 21, color: metric.color }}>{metric.icon}</span></div>
      <div>
        <div aria-busy={loading} style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{loading ? '—' : metric.value}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{metric.label}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{loading ? 'Loading…' : metric.detail}</div>
      </div>
    </button>)}
  </div>;
}
