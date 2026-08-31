import { useEffect, useState } from 'react';
import type { CallRecord, DashboardSummary, UploadTask } from './types';
import { getDashboardCalls, getDashboardSummary } from './api/dashboardApi';
import { transcribeCall } from './api/audioApi';
import Header from './components/Header';
import PageIntro from './components/PageIntro';
import KpiCards from './components/KpiCards';
import FilterToolbar from './components/FilterToolbar';
import CallsTable from './components/CallsTable';
import UploadModal from './components/UploadModal';
import TranscriptDrawer from './components/TranscriptDrawer';

export default function App() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [callsTotal, setCallsTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTask, setUploadTask] = useState<UploadTask>({ audioFile: null, metadataFile: null, status: 'idle', progress: 0, error: null });
  const [callsVersion, setCallsVersion] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptCall, setTranscriptCall] = useState<CallRecord | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [attentionFilter, setAttentionFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [resolutionFilter, setResolutionFilter] = useState('all');
  const [moodFilter, setMoodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadCalls() {
      try {
        setCallsLoading(true);
        setCallsError(null);
        const result = await getDashboardCalls({
          limit: pageSize,
          offset: page * pageSize,
          attention: attentionFilter === 'all' ? undefined : attentionFilter as 'needed' | 'not_needed',
          resolution: resolutionFilter === 'all' ? undefined : resolutionFilter as CallRecord['resolution'],
          search: debouncedSearch || undefined,
          signal: controller.signal,
        });
        setCalls(result.calls);
        setCallsTotal(result.total);
        setExpandedId(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCallsError(error instanceof Error ? error.message : 'Unable to load calls');
      } finally {
        if (!controller.signal.aborted) setCallsLoading(false);
      }
    }

    void loadCalls();
    return () => controller.abort();
  }, [attentionFilter, callsVersion, debouncedSearch, page, pageSize, resolutionFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        setSummaryLoading(true);
        setSummaryError(null);
        setSummary(await getDashboardSummary(controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        setSummaryError(error instanceof Error ? error.message : 'Unable to load dashboard summary');
      } finally {
        if (!controller.signal.aborted) setSummaryLoading(false);
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, [callsVersion]);

  useEffect(() => {
    if (uploadTask.status !== 'processing') return;
    const timer = window.setInterval(() => {
      setUploadTask((current) => ({
        ...current,
        progress: current.status === 'processing' ? Math.min(92, current.progress + 1) : current.progress,
      }));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [uploadTask.status]);

  const handleProcessCall = async (audioFile: File, metadataFile: File) => {
    setUploadTask({ audioFile, metadataFile, status: 'uploading', progress: 0, error: null });
    try {
      await transcribeCall(audioFile, metadataFile, (progress) => {
        setUploadTask((current) => ({ ...current, status: progress >= 100 ? 'processing' : 'uploading', progress: progress >= 100 ? 15 : Math.round(progress * 0.15) }));
      });
      setUploadTask((current) => ({ ...current, status: 'completed', progress: 100 }));
      setCallsVersion((version) => version + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process call';
      setUploadTask((current) => ({ ...current, status: 'failed', error: message }));
    }
  };

  const handleToggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleViewTranscript = (call: CallRecord) => {
    setTranscriptCall(call);
    setTranscriptOpen(true);
  };

  const handleClearFilters = () => {
    setSearch('');
    setAttentionFilter('all');
    setPriorityFilter('all');
    setResolutionFilter('all');
    setMoodFilter('all');
    setDateFilter('');
    setPage(0);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(0);
    setExpandedId(null);
  };

  const filteredCalls = calls.filter((c) => {
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
    if (moodFilter !== 'all' && c.mood !== moodFilter) return false;
    if (dateFilter) {
      const startedAt = new Date(c.startedAt);
      if (Number.isNaN(startedAt.getTime())) return false;
      const localDate = [startedAt.getFullYear(), String(startedAt.getMonth() + 1).padStart(2, '0'), String(startedAt.getDate()).padStart(2, '0')].join('-');
      if (localDate !== dateFilter) return false;
    }
    return true;
  });

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: '#F7F7F8',
        minHeight: '100vh',
        color: '#1F2937',
      }}
    >
      <Header />

      <main style={{ maxWidth: 1380, margin: '0 auto', padding: '24px 32px 48px' }}>
        <PageIntro onUpload={() => setUploadOpen(true)} uploadTask={uploadTask} />
        <KpiCards
          summary={summary}
          loading={summaryLoading}
          attentionActive={attentionFilter === 'needed'}
          unresolvedActive={resolutionFilter === 'unresolved'}
          onAttentionClick={() => {
            setAttentionFilter((current) => current === 'needed' ? 'all' : 'needed');
            setPage(0);
          }}
          onUnresolvedClick={() => {
            setResolutionFilter((current) => current === 'unresolved' ? 'all' : 'unresolved');
            setPage(0);
          }}
        />
        {summaryError && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              marginBottom: 14,
              color: '#B91C1C',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 7,
            }}
          >
            Failed to load dashboard summary: {summaryError}
          </div>
        )}
        <FilterToolbar
          search={search}
          onSearch={setSearch}
          attention={attentionFilter}
          onAttention={(value) => {
            setAttentionFilter(value);
            setPage(0);
          }}
          priority={priorityFilter}
          onPriority={setPriorityFilter}
          resolution={resolutionFilter}
          onResolution={(value) => {
            setResolutionFilter(value);
            setPage(0);
          }}
          mood={moodFilter}
          onMood={setMoodFilter}
          date={dateFilter}
          onDate={setDateFilter}
          onClear={handleClearFilters}
        />
        {callsLoading && (
          <div style={{ padding: '18px', color: '#6B7280', textAlign: 'center' }}>
            Loading calls…
          </div>
        )}
        {callsError && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              marginBottom: 14,
              color: '#B91C1C',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 7,
            }}
          >
            Failed to load dashboard calls: {callsError}
          </div>
        )}
        <CallsTable
          calls={filteredCalls}
          total={callsTotal}
          page={page}
          pageSize={pageSize}
          pageItemCount={calls.length}
          expandedId={expandedId}
          onToggle={handleToggleRow}
          onViewTranscript={handleViewTranscript}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </main>

      {uploadOpen && (
        <UploadModal
          task={uploadTask}
          onClose={() => setUploadOpen(false)}
          onProcess={handleProcessCall}
          onReset={() => setUploadTask({ audioFile: null, metadataFile: null, status: 'idle', progress: 0, error: null })}
        />
      )}

      {transcriptOpen && transcriptCall && (
        <TranscriptDrawer call={transcriptCall} onClose={() => setTranscriptOpen(false)} />
      )}
    </div>
  );
}
