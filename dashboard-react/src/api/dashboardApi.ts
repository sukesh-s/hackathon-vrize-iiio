import axios from 'axios';
import type { CallDetail, CallRecord, Mood, Priority, Resolution } from '../types';

interface DashboardParticipant {
  id: string;
  externalSpeakerId: number;
  name: string | null;
  role: 'agent' | 'caller';
}

interface DashboardCall {
  id: string;
  callReference: string | null;
  customer: DashboardParticipant | null;
  agent: DashboardParticipant | null;
  startedAt: string;
  durationSeconds: number;
  intent: { label?: string } | null;
  mood: {
    initial?: string;
    final?: string;
    shiftAtSeconds?: number | null;
    timeline?: Array<{
      mood?: string;
      segmentId: number;
      atSeconds: number | null;
    }>;
  } | null;
  resolution: { status?: string } | null;
  summary: string | null;
  attention: {
    needed?: boolean;
    score: number;
    priority: string;
    reasons?: Array<{
      reason?: string;
      evidence?: Array<{
        segmentId: number;
        start: number | null;
        end: number | null;
        text: string;
        speakerRole: string;
      }>;
    }>;
  };
  recordingUrl: string;
  transcript?: Array<{
    id?: number;
    start?: number;
    end?: number;
    text?: string;
    speaker?: {
      role?: string;
      name?: string | null;
    };
  }>;
}

interface DashboardCallsResponse {
  total: number;
  limit: number;
  offset: number;
  calls: DashboardCall[];
}

const dashboardApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15_000,
});

function formatDuration(durationSeconds: number) {
  const seconds = Math.max(0, Math.round(Number(durationSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function mapMood(value?: string): Mood {
  const mood = value?.toLowerCase();

  if (['positive', 'satisfied', 'appreciative', 'joy'].includes(mood || '')) {
    return 'positive';
  }

  if (['angry', 'anger'].includes(mood || '')) {
    return 'angry';
  }

  if (
    ['frustrated', 'disappointed', 'anxious', 'confused', 'sadness'].includes(
      mood || '',
    )
  ) {
    return 'frustrated';
  }

  return 'neutral';
}

function mapResolution(value?: string): Resolution {
  if (value === 'resolved') return 'resolved';
  if (value === 'partially_resolved') return 'partially_resolved';
  if (value === 'unresolved') return 'unresolved';
  return 'unclear';
}

function mapPriority(value?: string): Priority {
  if (value === 'critical') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  return 'low';
}

function mapDashboardCall(call: DashboardCall): CallRecord {
  const startedAt = new Date(call.startedAt);
  const hasValidDate = !Number.isNaN(startedAt.getTime());

  return {
    id: call.id,
    reference: call.callReference || call.id,
    priority: mapPriority(call.attention?.priority),
    customer: call.customer?.name || 'Unknown customer',
    agent: call.agent?.name || 'Unknown agent',
    date: hasValidDate
      ? new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(startedAt)
      : 'Unknown date',
    time: hasValidDate
      ? new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(startedAt)
      : '--:--',
    startedAt: call.startedAt,
    duration: formatDuration(call.durationSeconds),
    durationSeconds: call.durationSeconds,
    intent: call.intent?.label || 'Unknown intent',
    mood: mapMood(call.mood?.final),
    resolution: mapResolution(call.resolution?.status),
    score: Math.min(100, Math.max(0, Number(call.attention?.score) || 0)),
    needsAttention: call.attention?.needed === true,
    summary: call.summary || undefined,
    recordingUrl: call.recordingUrl,
    initialMood: mapMood(call.mood?.initial),
    moodShiftAtSeconds: call.mood?.shiftAtSeconds ?? null,
    moodTimeline: (call.mood?.timeline ?? []).map((point) => ({
      mood: mapMood(point.mood),
      segmentId: point.segmentId,
      atSeconds: point.atSeconds,
    })),
    evidence: (call.attention?.reasons ?? []).flatMap((reason) =>
      (reason.evidence ?? []).map((evidence) => ({
        ...evidence,
        supports: reason.reason || 'Manager attention',
      })),
    ),
  };
}

export async function getDashboardCalls({
  limit = 100,
  offset = 0,
  signal,
}: {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
} = {}) {
  const response = await dashboardApi.get<DashboardCallsResponse>(
    '/dashboard/calls',
    {
      params: { limit, offset },
      signal,
    },
  );

  return {
    ...response.data,
    calls: response.data.calls.map(mapDashboardCall),
  };
}

export async function getDashboardCall(id: string, signal?: AbortSignal): Promise<CallDetail> {
  const response = await dashboardApi.get<DashboardCall>(`/dashboard/calls/${id}`, { signal });
  const call = mapDashboardCall(response.data);

  return {
    ...call,
    transcript: (response.data.transcript ?? []).map((segment, index) => ({
      id: Number.isFinite(segment.id) ? Number(segment.id) : index,
      start: Number(segment.start) || 0,
      end: Number(segment.end) || Number(segment.start) || 0,
      text: segment.text?.trim() || '',
      speakerRole: segment.speaker?.role || 'unknown',
      speakerName: segment.speaker?.name || null,
    })),
  };
}
