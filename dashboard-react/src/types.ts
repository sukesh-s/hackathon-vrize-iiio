export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Resolution = 'resolved' | 'partially_resolved' | 'unresolved' | 'unclear';
export type Mood = 'positive' | 'neutral' | 'frustrated' | 'angry';

export interface MoodTimelinePoint {
  mood: Mood;
  segmentId: number;
  atSeconds: number | null;
}

export interface CallEvidence {
  segmentId: number;
  start: number | null;
  end: number | null;
  text: string;
  speakerRole: string;
  supports: string;
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface UploadTask {
  audioFile: File | null;
  metadataFile: File | null;
  status: UploadStatus;
  progress: number;
  error: string | null;
}

export interface CallRecord {
  id: string;
  reference: string;
  priority: Priority;
  customer: string;
  agent: string;
  date: string;
  time: string;
  duration: string;
  durationSeconds: number;
  intent: string;
  mood: Mood;
  resolution: Resolution;
  score: number;
  summary?: string;
  recordingUrl?: string;
  initialMood: Mood;
  moodShiftAtSeconds: number | null;
  moodTimeline: MoodTimelinePoint[];
  evidence: CallEvidence[];
}
