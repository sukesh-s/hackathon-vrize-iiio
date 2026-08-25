import { useEffect, useRef, useState } from "react";
import type { CallRecord, Mood, MoodTimelinePoint, Resolution } from "../types";

interface Props {
  call: CallRecord;
  onViewTranscript: () => void;
}

const MOOD_LABELS: Record<Mood, string> = {
  positive: "Positive",
  neutral: "Neutral",
  frustrated: "Frustrated",
  angry: "Angry",
};
const MOOD_COLORS: Record<Mood, string> = {
  positive: "#2E7D32",
  neutral: "#6B7280",
  frustrated: "#ED6C02",
  angry: "#D32F2F",
};
const RESOLUTION_COLORS: Record<Resolution, string> = {
  resolved: "#2E7D32",
  partially_resolved: "#ED6C02",
  unresolved: "#D32F2F",
  unclear: "#6B7280",
};

function formatTime(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--";
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function speakerLabel(role: string) {
  const value = role.toLowerCase();
  if (value === "customer" || value === "caller") return "Customer";
  if (value === "agent") return "Agent";
  return "Unknown";
}

function AudioPlayer({
  src,
  totalSeconds,
}: {
  src?: string;
  totalSeconds: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(totalSeconds);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(totalSeconds);
  }, [src, totalSeconds]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  }

  return (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 7,
        padding: "10px 12px",
        marginBottom: 14,
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const value = audioRef.current?.duration;
          if (value && Number.isFinite(value)) setDuration(value);
        }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#3B5CCC",
            border: 0,
            opacity: src ? 1 : 0.5,
            cursor: src ? "pointer" : "not-allowed",
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "#fff", fontSize: 18 }}
          >
            {playing ? "pause" : "play_arrow"}
          </span>
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = value;
            setCurrent(value);
          }}
          aria-label="Seek audio"
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, color: "#9CA3AF" }}
        >
          volume_up
        </span>
        <select
          value={speed}
          onChange={(event) => {
            const value = Number(event.target.value);
            setSpeed(value);
            if (audioRef.current) audioRef.current.playbackRate = value;
          }}
          aria-label="Playback speed"
          style={{
            height: 24,
            border: "1px solid #E5E7EB",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>
      </div>
    </div>
  );
}

function MoodTimeline({
  initial,
  final,
  shift,
  timeline,
  duration,
}: {
  initial: Mood;
  final: Mood;
  shift: number | null;
  timeline: MoodTimelinePoint[];
  duration: number;
}) {
  const points: MoodTimelinePoint[] = timeline.length
    ? timeline
    : [
        { mood: initial, segmentId: -1, atSeconds: 0 },
        ...(initial !== final
          ? [{ mood: final, segmentId: -2, atSeconds: shift }]
          : []),
      ];
  const total = Math.max(duration, 1);
  return (
    <div>
      <Heading>Mood timeline</Heading>
      <div style={{ position: "relative", marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            height: 6,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {points.map((point, index) => {
            const start = point.atSeconds ?? 0;
            const end = points[index + 1]?.atSeconds ?? total;
            return (
              <div
                key={`${point.segmentId}-${index}`}
                style={{
                  flex: Math.max(end - start, 1),
                  background: MOOD_COLORS[point.mood],
                }}
              />
            );
          })}
        </div>
        {shift != null && (
          <div
            style={{
              position: "absolute",
              top: -18,
              left: `${Math.min(100, Math.max(0, (shift / total) * 100))}%`,
              transform: "translateX(-50%)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#D32F2F",
                background: "#FDECEA",
                border: "1px solid #FECACA",
                borderRadius: 3,
                padding: "1px 5px",
                whiteSpace: "nowrap",
              }}
            >
              Shift {formatTime(shift)}
            </span>
            <div
              style={{
                width: 1,
                height: 10,
                background: "#D32F2F",
                margin: "2px auto 0",
              }}
            />
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          {points.map((point, index) => (
            <div
              key={`${point.segmentId}-label-${index}`}
              style={{ textAlign: "center" }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: MOOD_COLORS[point.mood],
                }}
              >
                {MOOD_LABELS[point.mood]}
              </div>
              <div style={{ fontSize: 9, color: "#9CA3AF" }}>
                {formatTime(point.atSeconds)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "8px 10px",
        }}
      >
        <Heading>Mood detail</Heading>
        {[
          {
            label: "Initial mood",
            value: MOOD_LABELS[initial],
            color: MOOD_COLORS[initial],
          },
          {
            label: "Final mood",
            value: MOOD_LABELS[final],
            color: MOOD_COLORS[final],
          },
          {
            label: "Shift at",
            value: shift == null ? "No shift" : formatTime(shift),
            color: "#374151",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 3,
            }}
          >
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{item.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#6B7280",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 9,
      }}
    >
      {children}
    </div>
  );
}

const actionButton = {
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 5,
  padding: "5px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 4,
} as const;

export default function ExpandedRow({ call, onViewTranscript }: Props) {
  const details = [
    { label: "Intent", value: call.intent },
    {
      label: "Initial mood",
      value: MOOD_LABELS[call.initialMood],
      color: MOOD_COLORS[call.initialMood],
    },
    {
      label: "Final mood",
      value: MOOD_LABELS[call.mood],
      color: MOOD_COLORS[call.mood],
    },
    {
      label: "Mood shift",
      value:
        call.moodShiftAtSeconds == null
          ? "No shift"
          : formatTime(call.moodShiftAtSeconds),
    },
    {
      label: "Resolution",
      value: call.resolution.replace("_", " "),
      color: RESOLUTION_COLORS[call.resolution],
    },
    { label: "Duration", value: call.duration },
  ];

  return (
    <div
      style={{
        background: "#F5F7FF",
        borderTop: "2px solid #C7D2FE",
        padding: "20px 20px 20px 52px",
        display: "grid",
        gridTemplateColumns: "268px 1fr 196px",
        gap: 24,
      }}
    >
      <div>
        <Heading>AI call summary</Heading>
        <p
          style={{
            fontSize: 13,
            color: "#374151",
            lineHeight: 1.65,
            margin: "0 0 14px",
          }}
        >
          {call.summary ?? "No summary available."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {details.map((item) => (
            <div key={item.label} style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", minWidth: 78 }}>
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: item.color ?? "#1F2937",
                  textTransform:
                    item.label === "Resolution" ? "capitalize" : undefined,
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          <button
            onClick={onViewTranscript}
            style={{
              ...actionButton,
              color: "#3B5CCC",
              background: "#EEF2FF",
              border: "1px solid #C7D2FE",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14 }}
            >
              description
            </span>
            View full transcript
          </button>
          {/* <button style={{ ...actionButton, color: '#2E7D32', background: '#E8F5E9', border: '1px solid #A5D6A7' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>Mark as reviewed</button> */}
          {/* <button style={{ ...actionButton, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>Assign to manager</button> */}
        </div>
      </div>
      <div>
        <Heading>Audio recording</Heading>
        <AudioPlayer
          src={call.recordingUrl}
          totalSeconds={call.durationSeconds}
        />
        <Heading>Evidence behind this priority</Heading>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!call.evidence.length && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                color: "#6B7280",
              }}
            >
              No manager-attention evidence was identified for this call.
            </div>
          )}
          {call.evidence.map((item) => {
            const speaker = speakerLabel(item.speakerRole);
            return (
              <div
                key={`${item.supports}-${item.segmentId}`}
                style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderLeft: "3px solid #3B5CCC",
                  borderRadius: "0 6px 6px 0",
                  padding: "9px 12px",
                }}
              >
                <div style={{ display: "flex", gap: 7, marginBottom: 5 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#3B5CCC",
                      background: "#EEF2FF",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontFamily: "monospace",
                    }}
                  >
                    {formatTime(item.start)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: speaker === "Customer" ? "#7C3AED" : "#3B5CCC",
                      fontWeight: 600,
                    }}
                  >
                    {speaker}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#374151",
                    fontStyle: "italic",
                    lineHeight: 1.55,
                    margin: "0 0 5px",
                  }}
                >
                  “{item.text}”
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 12, color: "#9CA3AF" }}
                  >
                    lightbulb
                  </span>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>
                    Supports: {item.supports}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MoodTimeline
        initial={call.initialMood}
        final={call.mood}
        shift={call.moodShiftAtSeconds}
        timeline={call.moodTimeline}
        duration={call.durationSeconds}
      />
    </div>
  );
}
