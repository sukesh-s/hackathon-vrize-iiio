export default function Header() {
  return (
    <header
      style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: '0 auto',
          padding: '0 32px',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#3B5CCC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 19 }}>
              radar
            </span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2937', lineHeight: 1.25 }}>
              Call-Centre Radar
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.25 }}>
              AI-powered call analysis
            </div>
          </div>
        </div>

        {/* Date range selector */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: 6,
            background: '#fff',
            fontSize: 13,
            color: '#374151',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6B7280' }}>
            calendar_month
          </span>
          21 Aug – 25 Aug 2026
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9CA3AF' }}>
            keyboard_arrow_down
          </span>
        </button>

        {/* Notification bell */}
        <button
          aria-label="Notifications (3 unread)"
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            border: '1px solid #E5E7EB',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6B7280' }}>
            notifications
          </span>
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#D32F2F',
              border: '1.5px solid #fff',
            }}
          />
        </button>

        {/* Manager avatar */}
        <div
          aria-label="Manager: Sarah Mitchell"
          title="Sarah Mitchell — Support Manager"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#3B5CCC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          SM
        </div>
      </div>
    </header>
  );
}
