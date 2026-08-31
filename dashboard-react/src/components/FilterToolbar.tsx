import { CSSProperties, useRef } from 'react';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  attention: string;
  onAttention: (v: string) => void;
  priority: string;
  onPriority: (v: string) => void;
  resolution: string;
  onResolution: (v: string) => void;
  mood: string;
  onMood: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  onClear: () => void;
}

const selectStyle: CSSProperties = {
  height: 38,
  padding: '0 30px 0 10px',
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
  appearance: 'none',
  fontFamily: 'inherit',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath fill='%239CA3AF' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 6px center',
  outline: 'none',
};

export default function FilterToolbar({
  search,
  onSearch,
  attention,
  onAttention,
  priority,
  onPriority,
  resolution,
  onResolution,
  mood,
  onMood,
  date,
  onDate,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFilters =
    search.trim() !== '' || attention !== 'all' || priority !== 'all' || resolution !== 'all' || mood !== 'all' || date !== '';

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 10,
        flexWrap: 'wrap',
      }}
    >
      {/* Search — most prominent */}
      <div style={{ flex: '1 1 320px', position: 'relative', minWidth: 240 }}>
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 18,
            color: '#9CA3AF',
            pointerEvents: 'none',
          }}
        >
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search customer, agent, call ID, summary or evidence…"
          aria-label="Search calls"
          style={{
            width: '100%',
            height: 38,
            padding: '0 36px 0 38px',
            border: '1.5px solid #E5E7EB',
            borderRadius: 6,
            background: '#fff',
            fontSize: 13,
            color: '#1F2937',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = '#3B5CCC';
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = '#E5E7EB';
          }}
        />
        {search && (
          <button
            onClick={() => { onSearch(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9CA3AF' }}>
              close
            </span>
          </button>
        )}
      </div>

      {/* Manager attention */}
      <select
        value={attention}
        onChange={(e) => onAttention(e.target.value)}
        aria-label="Filter by manager attention"
        style={selectStyle}
      >
        <option value="all">All attention</option>
        <option value="needed">Needs attention</option>
        <option value="not_needed">No attention needed</option>
      </select>

      {/* Priority */}
      <select
        value={priority}
        onChange={(e) => onPriority(e.target.value)}
        aria-label="Filter by priority"
        style={selectStyle}
      >
        <option value="all">All priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Resolution */}
      <select
        value={resolution}
        onChange={(e) => onResolution(e.target.value)}
        aria-label="Filter by resolution"
        style={selectStyle}
      >
        <option value="all">All outcomes</option>
        <option value="resolved">Resolved</option>
        <option value="partially_resolved">Partially resolved</option>
        <option value="unresolved">Unresolved</option>
        <option value="unclear">Unclear</option>
      </select>

      {/* Mood */}
      <select
        value={mood}
        onChange={(e) => onMood(e.target.value)}
        aria-label="Filter by mood"
        style={selectStyle}
      >
        <option value="all">All moods</option>
        <option value="positive">Positive</option>
        <option value="neutral">Neutral</option>
        <option value="frustrated">Frustrated</option>
        <option value="angry">Angry</option>
      </select>

      <label
        aria-label="Filter by date"
        style={{
          height: 38,
          padding: '0 12px',
          border: '1px solid #E5E7EB',
          borderRadius: 6,
          background: '#fff',
          fontSize: 13,
          color: '#374151',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'inherit',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6B7280' }}>
          date_range
        </span>
        <input
          type="date"
          value={date}
          onChange={(event) => onDate(event.target.value)}
          aria-label="Call date"
          style={{ border: 0, outline: 0, background: 'transparent', color: '#374151', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}
        />
      </label>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onClear}
          style={{
            height: 38,
            padding: '0 10px',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: '#3B5CCC',
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            filter_alt_off
          </span>
          Clear filters
        </button>
      )}
    </div>
  );
}
