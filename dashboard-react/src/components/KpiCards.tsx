import type { CallRecord } from '../types';

interface Props {
  calls: CallRecord[];
  loading?: boolean;
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

export default function KpiCards({ calls, loading = false }: Props) {
  const total = calls.length;
  const attention = calls.filter((call) => call.needsAttention).length;
  const unresolved = calls.filter((call) => call.resolution === 'unresolved').length;
  const resolved = calls.filter((call) => call.resolution === 'resolved').length;

  const metrics = [
    {
      label: 'Calls analysed',
      value: total.toLocaleString(),
      icon: 'call',
      color: '#3B5CCC',
      bg: '#EEF2FF',
      detail: 'Available on this dashboard',
    },
    {
      label: 'Need attention',
      value: attention.toLocaleString(),
      icon: 'priority_high',
      color: '#ED6C02',
      bg: '#FFF3E0',
      detail: `${percentage(attention, total)}% of analysed calls`,
    },
    {
      label: 'Unresolved',
      value: unresolved.toLocaleString(),
      icon: 'report_problem',
      color: '#D32F2F',
      bg: '#FDECEA',
      detail: `${percentage(unresolved, total)}% of analysed calls`,
    },
    {
      label: 'Resolution rate',
      value: `${percentage(resolved, total)}%`,
      icon: 'check_circle',
      color: '#2E7D32',
      bg: '#E8F5E9',
      detail: `${resolved.toLocaleString()} resolved call${resolved === 1 ? '' : 's'}`,
    },
  ];

  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
    {metrics.map((metric, index) => <div key={metric.label} style={{ padding: '16px 20px', borderRight: index < metrics.length - 1 ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: metric.bg, display: 'grid', placeItems: 'center', flexShrink: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 21, color: metric.color }}>{metric.icon}</span></div>
      <div>
        <div aria-busy={loading} style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{loading ? '—' : metric.value}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{metric.label}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{loading ? 'Loading…' : metric.detail}</div>
      </div>
    </div>)}
  </div>;
}
