import { Fragment, CSSProperties } from "react";
import type { CallRecord, Priority, Mood, Resolution } from "../types";
import ExpandedRow from "./ExpandedRow";

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; icon: string; color: string; bg: string }
> = {
  critical: {
    label: "Critical",
    icon: "warning",
    color: "#D32F2F",
    bg: "#FDECEA",
  },
  high: { label: "High", icon: "trending_up", color: "#ED6C02", bg: "#FFF3E0" },
  medium: {
    label: "Medium",
    icon: "radio_button_checked",
    color: "#B45309",
    bg: "#FFFBEB",
  },
  low: { label: "Low", icon: "trending_down", color: "#6B7280", bg: "#F9FAFB" },
};

const MOOD_CONFIG: Record<
  Mood,
  { label: string; icon: string; color: string }
> = {
  positive: {
    label: "Positive",
    icon: "sentiment_satisfied",
    color: "#2E7D32",
  },
  neutral: { label: "Neutral", icon: "sentiment_neutral", color: "#6B7280" },
  frustrated: {
    label: "Frustrated",
    icon: "sentiment_dissatisfied",
    color: "#ED6C02",
  },
  angry: {
    label: "Angry",
    icon: "sentiment_very_dissatisfied",
    color: "#D32F2F",
  },
};

const RESOLUTION_CONFIG: Record<
  Resolution,
  { label: string; color: string; bg: string }
> = {
  resolved: { label: "Resolved", color: "#2E7D32", bg: "#E8F5E9" },
  partially_resolved: {
    label: "Partially resolved",
    color: "#ED6C02",
    bg: "#FFF3E0",
  },
  unresolved: { label: "Unresolved", color: "#D32F2F", bg: "#FDECEA" },
  unclear: { label: "Unclear", color: "#6B7280", bg: "#F3F4F6" },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "#D32F2F"
      : score >= 60
        ? "#ED6C02"
        : score >= 40
          ? "#B45309"
          : "#2E7D32";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          minWidth: 22,
          textAlign: "right",
        }}
      >
        {score}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "#F3F4F6",
          borderRadius: 2,
          minWidth: 50,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "#9CA3AF" }}>/ 100</span>
    </div>
  );
}

interface Props {
  calls: CallRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageItemCount: number;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onViewTranscript: (call: CallRecord) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const TH: CSSProperties = {
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "#6B7280",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.055em",
  borderBottom: "1px solid #E5E7EB",
  background: "#FAFAFA",
  whiteSpace: "nowrap",
};

const TD: CSSProperties = {
  padding: "11px 12px",
  fontSize: 13,
  color: "#1F2937",
  borderBottom: "1px solid #E5E7EB",
  verticalAlign: "middle",
};

export default function CallsTable({
  calls,
  total,
  page,
  pageSize,
  pageItemCount,
  expandedId,
  onToggle,
  onViewTranscript,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize + pageItemCount, total);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Table title row */}
      <div
        style={{
          padding: "13px 16px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1F2937" }}>
            Prioritised calls
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              background: "#F3F4F6",
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            {total.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#9CA3AF",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            sort
          </span>
          Sorted by priority score
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            minWidth: 960,
          }}
        >
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 148 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={TH} aria-label="Expand" />
              <th style={TH}>Priority</th>
              <th style={TH}>Customer</th>
              <th style={TH}>Agent</th>
              <th style={TH}>Date &amp; Time</th>
              <th style={TH}>Duration</th>
              <th style={TH}>Intent</th>
              <th style={TH}>Mood</th>
              <th style={TH}>Resolution</th>
              <th style={TH}>Attention score</th>
              <th style={TH} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const isExpanded = expandedId === call.id;
              const p = PRIORITY_CONFIG[call.priority];
              const m = MOOD_CONFIG[call.mood];
              const r = RESOLUTION_CONFIG[call.resolution];

              return (
                <Fragment key={call.id}>
                  <tr
                    onClick={() => onToggle(call.id)}
                    aria-expanded={isExpanded}
                    style={{
                      cursor: "pointer",
                      background: isExpanded ? "#EEF2FF" : "transparent",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isExpanded)
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded)
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.background = "transparent";
                    }}
                  >
                    {/* Expand chevron */}
                    <td
                      style={{
                        ...TD,
                        textAlign: "center",
                        padding: "0 0 0 12px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 18,
                          color: isExpanded ? "#3B5CCC" : "#9CA3AF",
                          display: "block",
                          transform: isExpanded
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    </td>

                    {/* Priority */}
                    <td style={TD}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 15, color: p.color }}
                          aria-hidden="true"
                        >
                          {p.icon}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: p.color,
                            background: p.bg,
                            padding: "2px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {p.label}
                        </span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: "#111827" }}>
                        {call.customer}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9CA3AF",
                          marginTop: 1,
                          fontFamily: "monospace",
                        }}
                      >
                        {call.reference}
                      </div>
                    </td>

                    {/* Agent */}
                    <td style={{ ...TD, color: "#374151" }}>{call.agent}</td>

                    {/* Date + Time */}
                    <td style={TD}>
                      <div style={{ fontSize: 13 }}>{call.date}</div>
                      <div
                        style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                      >
                        {call.time}
                      </div>
                    </td>

                    {/* Duration */}
                    <td style={{ ...TD, color: "#6B7280" }}>{call.duration}</td>

                    {/* Intent */}
                    <td style={{ ...TD, fontSize: 12, color: "#374151" }}>
                      {call.intent}
                    </td>

                    {/* Mood */}
                    <td style={TD}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 15, color: m.color }}
                          aria-hidden="true"
                        >
                          {m.icon}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: m.color,
                            fontWeight: 500,
                          }}
                        >
                          {m.label}
                        </span>
                      </div>
                    </td>

                    {/* Resolution */}
                    <td style={TD}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: r.color,
                          background: r.bg,
                          padding: "3px 8px",
                          borderRadius: 10,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.label}
                      </span>
                    </td>

                    {/* Attention score */}
                    <td style={TD}>
                      <ScoreBar score={call.score} />
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr>
                      <td
                        colSpan={11}
                        style={{
                          padding: 0,
                          borderBottom: "1px solid #C7D2FE",
                        }}
                      >
                        <ExpandedRow
                          call={call}
                          onViewTranscript={() => onViewTranscript(call)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {calls.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 14,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 36,
                display: "block",
                marginBottom: 8,
                color: "#D1D5DB",
              }}
            >
              search_off
            </span>
            No calls match your current filters.
          </div>
        )}
      </div>

      <div
        style={{
          minHeight: 56,
          padding: "8px 16px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          color: "#6B7280",
          fontSize: 12,
          boxSizing: "border-box",
        }}
      >
        <div aria-live="polite">
          Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()} calls
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
            Results per page
            <select
              aria-label="Results per page"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              style={{
                height: 34,
                padding: "0 28px 0 9px",
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                background: "#fff",
                color: "#374151",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {[50, 100, 200, 500].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <span>
            Page {(page + 1).toLocaleString()} of {totalPages.toLocaleString()}
          </span>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              style={{
                height: 34,
                padding: "0 11px",
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                background: page === 0 ? "#F9FAFB" : "#fff",
                color: page === 0 ? "#9CA3AF" : "#374151",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: page === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_left
              </span>
              Previous
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => onPageChange(page + 1)}
              style={{
                height: 34,
                padding: "0 11px",
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                background: page + 1 >= totalPages ? "#F9FAFB" : "#fff",
                color: page + 1 >= totalPages ? "#9CA3AF" : "#374151",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: page + 1 >= totalPages ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              Next
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
