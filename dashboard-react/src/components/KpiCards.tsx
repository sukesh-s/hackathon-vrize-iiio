const metrics = [
  {
    label: 'Calls analysed',
    value: '1,441',
    icon: 'call',
    color: '#3B5CCC',
    bg: '#EEF2FF',
    change: '+47 vs last week',
  },
  {
    label: 'Need attention',
    value: '38',
    icon: 'priority_high',
    color: '#ED6C02',
    bg: '#FFF3E0',
    change: '2.6% of total',
  },
  {
    label: 'Unresolved',
    value: '24',
    icon: 'report_problem',
    color: '#D32F2F',
    bg: '#FDECEA',
    change: '63% of attention',
  },
  {
    label: 'Resolution rate',
    value: '83%',
    icon: 'check_circle',
    color: '#2E7D32',
    bg: '#E8F5E9',
    change: '+2pp vs last week',
  },
];

export default function KpiCards() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 14,
      }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          style={{
            padding: '16px 20px',
            borderRight: i < 3 ? '1px solid #E5E7EB' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: m.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 21, color: m.color }}>
              {m.icon}
            </span>
          </div>
          <div>
            <div
              style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', lineHeight: 1.2, letterSpacing: '-0.02em' }}
            >
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{m.change}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
