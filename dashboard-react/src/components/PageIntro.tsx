import type { UploadTask } from '../types';

interface Props {
  onUpload: () => void;
  uploadTask: UploadTask;
}

export default function PageIntro({ onUpload, uploadTask }: Props) {
  const active = uploadTask.status === 'uploading' || uploadTask.status === 'processing';
  const showStatus = uploadTask.status !== 'idle';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 20,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#1F2937',
            lineHeight: 1.3,
            margin: '0 0 5px',
          }}
        >
          Calls requiring your attention
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, maxWidth: 500 }}>
          Review prioritised customer calls, supporting evidence and resolution outcomes.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onUpload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 16px',
            height: 38,
            background: '#3B5CCC',
            color: '#fff',
            borderRadius: 6,
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
            upload
          </span>
          Upload calls
        </button>
        {showStatus && (
          <button
            onClick={onUpload}
            aria-label="Show upload status"
            title={active ? `Processing ${uploadTask.progress}%` : uploadTask.status === 'completed' ? 'Processing completed' : 'Processing failed'}
            style={{ width: 38, height: 38, border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative' }}
          >
            {active ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#3B5CCC', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                <span style={{ position: 'absolute', right: -5, top: -6, minWidth: 20, height: 16, padding: '0 3px', borderRadius: 8, background: '#3B5CCC', color: '#fff', fontSize: 8, display: 'grid', placeItems: 'center' }}>{uploadTask.progress}%</span>
              </>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: uploadTask.status === 'completed' ? '#2E7D32' : '#D32F2F' }}>{uploadTask.status === 'completed' ? 'check_circle' : 'error'}</span>
            )}
          </button>
        )}
        <button
          aria-label="Refresh calls list"
          style={{
            width: 38,
            height: 38,
            border: '1px solid #E5E7EB',
            borderRadius: 6,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6B7280' }}>
            refresh
          </span>
        </button>
      </div>
    </div>
  );
}
