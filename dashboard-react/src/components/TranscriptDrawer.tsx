import { useState } from 'react';
import type { CallRecord } from '../types';
import { TRANSCRIPT_TURNS } from '../data';

interface Props {
  call: CallRecord;
  onClose: () => void;
}

export default function TranscriptDrawer({ call, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(37);
  const totalSeconds = 462;
  const currentSeconds = Math.round((progress / 100) * totalSeconds);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const filtered = search
    ? TRANSCRIPT_TURNS.filter((t) =>
        t.text.toLowerCase().includes(search.toLowerCase()) ||
        t.speaker.toLowerCase().includes(search.toLowerCase())
      )
    : TRANSCRIPT_TURNS;

  return (
    <div
      role="complementary"
      aria-label="Full transcript"
      style={{ position: 'fixed', inset: 0, zIndex: 300 }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(17, 24, 39, 0.3)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 480,
          background: '#fff',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '15px 18px 13px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2937' }}>
                {call.customer}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace' }}>{call.reference}</span>
                <span>·</span>
                <span>{call.agent}</span>
                <span>·</span>
                <span>{call.date} {call.time}</span>
                <span>·</span>
                <span>{call.duration}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close transcript"
              style={{
                width: 28,
                height: 28,
                border: '1px solid #E5E7EB',
                borderRadius: 5,
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6B7280' }}>
                close
              </span>
            </button>
          </div>
        </div>

        {/* Audio player */}
        <div
          style={{
            padding: '11px 18px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#3B5CCC',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#fff' }}>
                {playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label="Seek"
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
              {fmt(currentSeconds)} / 7:42
            </span>
          </div>
        </div>

        {/* Search transcript */}
        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 16,
                color: '#9CA3AF',
                pointerEvents: 'none',
              }}
            >
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transcript…"
              aria-label="Search transcript"
              style={{
                width: '100%',
                height: 34,
                padding: '0 10px 0 30px',
                border: '1px solid #E5E7EB',
                borderRadius: 5,
                fontSize: 13,
                color: '#1F2937',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = '#3B5CCC'; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = '#E5E7EB'; }}
            />
          </div>
        </div>

        {/* Speaker legend */}
        <div
          style={{
            padding: '7px 18px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {[
            { label: 'Agent', color: '#3B5CCC' },
            { label: 'Customer', color: '#7C3AED' },
            { label: 'Highlighted evidence', color: '#B45309', bg: '#FFFBEB' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: '#6B7280' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Transcript turns */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingTop: 32 }}>
              No matching turns found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {filtered.map((turn, i) => {
                const isCustomer = turn.speaker === 'Customer';
                return (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    {/* Timestamp — clickable to seek */}
                    <button
                      aria-label={`Seek to ${turn.time}`}
                      title="Click to seek audio to this point"
                      style={{
                        flexShrink: 0,
                        paddingTop: 3,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        color: '#9CA3AF',
                        fontFamily: 'monospace',
                        lineHeight: 1.4,
                        minWidth: 32,
                        textAlign: 'right',
                      }}
                      onClick={() => {
                        const [mm, ss] = turn.time.split(':').map(Number);
                        const totalSec = mm * 60 + ss;
                        setProgress(Math.round((totalSec / totalSeconds) * 100));
                      }}
                    >
                      {turn.time}
                    </button>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isCustomer ? '#7C3AED' : '#3B5CCC',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 3,
                        }}
                      >
                        {turn.speaker}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#374151',
                          lineHeight: 1.58,
                          background: turn.highlight ? '#FFFBEB' : 'transparent',
                          border: turn.highlight ? '1px solid #FDE68A' : '1px solid transparent',
                          borderRadius: turn.highlight ? 5 : 0,
                          padding: turn.highlight ? '5px 7px' : 0,
                        }}
                      >
                        {search ? (
                          <HighlightMatch text={turn.text} query={search} />
                        ) : (
                          turn.text
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#FEF08A', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
