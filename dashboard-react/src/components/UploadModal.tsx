import { useRef, useState } from 'react';
import type { UploadTask } from '../types';

interface Props {
  task: UploadTask;
  onClose: () => void;
  onProcess: (audioFile: File, metadataFile: File) => Promise<void>;
  onReset: () => void;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];

function fileSize(file: File) {
  if (file.size < 1024 * 1024) return `${Math.ceil(file.size / 1024)} KB`;
  return `${(file.size / 1024 / 1024).toFixed(1)} MB`;
}

function FilePicker({ kind, file, disabled, onSelect, onInvalid }: { kind: 'audio' | 'metadata'; file: File | null; disabled: boolean; onSelect: (file: File) => void; onInvalid: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = kind === 'audio' ? AUDIO_EXTENSIONS.join(',') : '.json,application/json';

  function choose(files: FileList | null) {
    if (files && files.length > 1) {
      onInvalid(`Only one ${kind} file can be selected.`);
      return;
    }
    const selected = files?.[0];
    if (selected) onSelect(selected);
  }

  return <div>
    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7 }}>{kind === 'audio' ? 'Audio recording' : 'Call metadata (.json)'}</div>
    <input ref={inputRef} type="file" accept={accept} disabled={disabled} hidden onChange={(event) => choose(event.target.files)} />
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) choose(event.dataTransfer.files); }}
      style={{ border: `2px dashed ${dragging ? '#3B5CCC' : '#E5E7EB'}`, borderRadius: 7, padding: '16px', textAlign: 'center', background: dragging ? '#EEF2FF' : '#FAFAFA', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1 }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: file ? '#2E7D32' : '#9CA3AF' }}>{file ? 'check_circle' : kind === 'audio' ? 'audio_file' : 'data_object'}</span>
      {file ? <><div style={{ fontSize: 12, fontWeight: 600, color: '#1F2937' }}>{file.name}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{fileSize(file)}</div></> : <><div style={{ fontSize: 13, color: '#374151' }}>Drop one {kind} file here or <span style={{ color: '#3B5CCC', fontWeight: 600 }}>browse</span></div><div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{kind === 'audio' ? 'MP3, WAV, M4A, AAC, FLAC or OGG; one file only' : 'One JSON file containing the call metadata'}</div></>}
    </div>
  </div>;
}

export default function UploadModal({ task, onClose, onProcess, onReset }: Props) {
  const processing = task.status === 'uploading' || task.status === 'processing';
  const [audioFile, setAudioFile] = useState<File | null>(task.audioFile);
  const [metadataFile, setMetadataFile] = useState<File | null>(task.metadataFile);
  const [error, setError] = useState<string | null>(null);

  function selectAudio(file: File) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!file.type.startsWith('audio/') && !AUDIO_EXTENSIONS.includes(extension)) { setError('Select a supported audio file.'); return; }
    setError(null); setAudioFile(file);
  }

  function selectMetadata(file: File) {
    if (!file.name.toLowerCase().endsWith('.json')) { setError('Metadata must be a JSON file.'); return; }
    setError(null); setMetadataFile(file);
  }

  async function process() {
    if (!audioFile || !metadataFile) { setError('Select exactly one audio file and one metadata JSON file.'); return; }
    setError(null);
    await onProcess(audioFile, metadataFile);
  }

  const statusLabel = task.status === 'uploading' ? 'Uploading files…' : task.status === 'processing' ? 'Transcribing and analysing the call…' : task.status === 'completed' ? 'Call processing completed' : 'Call processing failed';

  return <div role="dialog" aria-modal="true" aria-label="Upload call" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', zIndex: 200, display: 'grid', placeItems: 'center' }}>
    <div onClick={(event) => event.stopPropagation()} style={{ background: '#fff', borderRadius: 10, width: 560, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
        <div><div style={{ fontSize: 16, fontWeight: 600 }}>Upload a call</div><div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{processing ? 'You can close this window. Processing will continue.' : 'Choose exactly one audio file and its metadata JSON file.'}</div></div>
        <button onClick={onClose} aria-label={processing ? 'Minimize processing dialog' : 'Close dialog'} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 17, color: '#6B7280' }}>{processing ? 'minimize' : 'close'}</span></button>
      </div>

      <div style={{ padding: 20 }}>
        {task.status === 'idle' ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><FilePicker kind="audio" file={audioFile} disabled={false} onSelect={selectAudio} onInvalid={setError} /><FilePicker kind="metadata" file={metadataFile} disabled={false} onSelect={selectMetadata} onInvalid={setError} /></div> : <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 44, color: task.status === 'completed' ? '#2E7D32' : task.status === 'failed' ? '#D32F2F' : '#3B5CCC', animation: processing ? 'spin 1s linear infinite' : undefined }}>{task.status === 'completed' ? 'check_circle' : task.status === 'failed' ? 'error' : 'progress_activity'}</span>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{statusLabel}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>{task.audioFile?.name}<br />{task.metadataFile?.name}</div>
          {processing && <><div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 20 }}><div style={{ width: `${task.progress}%`, height: '100%', background: '#3B5CCC', transition: 'width .5s ease' }} /></div><div style={{ fontSize: 11, color: '#6B7280', marginTop: 7 }}>{task.progress}% · Processing may take more than 3 minutes</div></>}
          {task.error && <div role="alert" style={{ fontSize: 12, color: '#B91C1C', marginTop: 12 }}>{task.error}</div>}
        </div>}
        {error && <div role="alert" style={{ marginTop: 12, padding: 9, borderRadius: 5, background: '#FEF2F2', color: '#B91C1C', fontSize: 12 }}>{error}</div>}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ height: 36, padding: '0 16px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>{processing ? 'Minimize' : 'Close'}</button>
        {task.status === 'idle' && <button onClick={() => void process()} disabled={!audioFile || !metadataFile} style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 6, background: '#3B5CCC', color: '#fff', opacity: audioFile && metadataFile ? 1 : 0.5, cursor: audioFile && metadataFile ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Process call</button>}
        {(task.status === 'completed' || task.status === 'failed') && <button onClick={() => { onReset(); setAudioFile(null); setMetadataFile(null); setError(null); }} style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 6, background: '#3B5CCC', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Upload another call</button>}
      </div>
    </div>
  </div>;
}
