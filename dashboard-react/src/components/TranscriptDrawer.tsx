import { useEffect, useRef, useState } from 'react';
import { getDashboardCall } from '../api/dashboardApi';
import type { CallDetail, CallRecord, TranscriptSegment } from '../types';

interface Props { call: CallRecord; onClose: () => void }

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function speakerLabel(segment: TranscriptSegment) {
  if (segment.speakerName) return segment.speakerName;
  const role = segment.speakerRole.toLowerCase();
  if (role === 'caller' || role === 'customer') return 'Customer';
  if (role === 'agent') return 'Agent';
  return 'Unknown speaker';
}

export default function TranscriptDrawer({ call, onClose }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(call.durationSeconds);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getDashboardCall(call.id, controller.signal)
      .then(setDetail)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Unable to load transcript');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [call.id]);

  const transcript = detail?.transcript ?? [];
  const evidenceIds = new Set(call.evidence.map((item) => item.segmentId));
  const activeSegmentId = transcript.find((segment) => currentTime >= segment.start && currentTime < Math.max(segment.end, segment.start + 0.1))?.id;
  const query = search.trim().toLowerCase();
  const filtered = query ? transcript.filter((segment) => `${speakerLabel(segment)} ${segment.speakerRole} ${segment.text}`.toLowerCase().includes(query)) : transcript;

  useEffect(() => {
    if (playing && !query) activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSegmentId, playing, query]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  }

  async function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
    await audio.play();
  }

  return <div role="complementary" aria-label="Full transcript" style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
    <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,.3)' }} />
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 520, maxWidth: '100vw', background: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px 18px 13px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <div><div style={{ fontSize: 15, fontWeight: 600 }}>{call.customer}</div><div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{call.reference} · {call.agent} · {call.date} {call.time} · {call.duration}</div></div>
        <button onClick={onClose} aria-label="Close transcript" style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 5, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6B7280' }}>close</span></button>
      </div>

      <div style={{ padding: '11px 18px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <audio ref={audioRef} src={call.recordingUrl} preload="metadata" onLoadedMetadata={() => { const value = audioRef.current?.duration; if (value != null && Number.isFinite(value)) setDuration(value); }} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <button onClick={() => void togglePlayback()} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 30, height: 30, borderRadius: '50%', background: '#3B5CCC', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 17, color: '#fff' }}>{playing ? 'pause' : 'play_arrow'}</span></button>
          <input type="range" min={0} max={Math.max(duration, 1)} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} aria-label="Seek audio" style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>

      <div style={{ padding: '10px 18px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}><div style={{ position: 'relative' }}><span className="material-symbols-outlined" style={{ position: 'absolute', left: 9, top: 9, fontSize: 16, color: '#9CA3AF' }}>search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transcript…" aria-label="Search transcript" style={{ width: '100%', height: 34, padding: '0 10px 0 30px', border: '1px solid #E5E7EB', borderRadius: 5, boxSizing: 'border-box', fontFamily: 'inherit' }} /></div></div>

      <div style={{ padding: '7px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 16, fontSize: 11, color: '#6B7280' }}><span>● <span style={{ color: '#3B5CCC' }}>Agent</span></span><span>● <span style={{ color: '#7C3AED' }}>Customer</span></span><span>● <span style={{ color: '#B45309' }}>Evidence</span></span></div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {loading && <StateMessage>Loading transcript…</StateMessage>}
        {error && <StateMessage color="#B91C1C">Failed to load transcript: {error}</StateMessage>}
        {!loading && !error && filtered.length === 0 && <StateMessage>{query ? 'No matching transcript segments.' : 'No transcript is available for this call.'}</StateMessage>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {filtered.map((segment) => {
            const role = segment.speakerRole.toLowerCase();
            const customer = role === 'caller' || role === 'customer';
            const active = segment.id === activeSegmentId;
            const evidence = evidenceIds.has(segment.id);
            return <div ref={active ? activeRef : undefined} key={segment.id} style={{ display: 'flex', gap: 10, background: active ? '#EEF2FF' : evidence ? '#FFFBEB' : 'transparent', border: `1px solid ${active ? '#C7D2FE' : evidence ? '#FDE68A' : 'transparent'}`, borderRadius: 5, padding: '6px 7px', transition: 'background .15s ease' }}>
              <button onClick={() => void seekTo(segment.start)} aria-label={`Play from ${formatTime(segment.start)}`} title="Play from this point" style={{ flexShrink: 0, background: 'none', border: 0, cursor: 'pointer', fontSize: 10, color: active ? '#3B5CCC' : '#9CA3AF', fontFamily: 'monospace', minWidth: 38, textAlign: 'right', padding: 0 }}>{formatTime(segment.start)}</button>
              <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: customer ? '#7C3AED' : '#3B5CCC', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{speakerLabel(segment)}{active ? ' · Playing' : ''}</div><div style={{ fontSize: 13, color: '#374151', lineHeight: 1.58 }}>{query ? <HighlightMatch text={segment.text} query={search.trim()} /> : segment.text}</div></div>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}

function StateMessage({ children, color = '#9CA3AF' }: { children: React.ReactNode; color?: string }) {
  return <div style={{ textAlign: 'center', color, fontSize: 13, paddingTop: 32 }}>{children}</div>;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark style={{ background: '#FEF08A', borderRadius: 2 }}>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}
