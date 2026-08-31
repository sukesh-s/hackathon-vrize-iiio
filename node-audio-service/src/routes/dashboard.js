const express = require("express");
const fs = require("node:fs");
const {
  findDashboardCallById,
  getDashboardSummary,
  listDashboardCalls,
} = require("../services/dbService");
const {
  normalizeManagerAttention,
} = require("../services/analyseWithLLM");

const router = express.Router();

function clampScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
}

function getPriority(score) {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function findParticipant(participants, role) {
  return participants.find((participant) => participant.role === role) ?? null;
}

function getTranscriptSegments(transcriptJson) {
  return transcriptJson?.diarizationInfo?.segments ?? [];
}

function getEmotionSegments(transcriptJson) {
  return transcriptJson?.analysisResult?.segmentAnalysis ?? [];
}

function buildMood(emotionSegments) {
  const callerSegments = emotionSegments.filter(({ speakerRole }) =>
    ["caller", "customer"].includes(speakerRole),
  );
  const relevantSegments =
    callerSegments.length > 0 ? callerSegments : emotionSegments;

  if (relevantSegments.length === 0) {
    return {
      initial: "unknown",
      final: "unknown",
      shiftAtSeconds: null,
      timeline: [],
    };
  }

  const timeline = [];

  for (const segment of relevantSegments) {
    const mood = segment.emotion ?? "neutral";
    const previous = timeline[timeline.length - 1];

    if (!previous || previous.mood !== mood) {
      timeline.push({
        mood,
        segmentId: segment.segmentId,
        atSeconds: segment.start ?? null,
      });
    }
  }

  return {
    initial: timeline[0].mood,
    final: timeline[timeline.length - 1].mood,
    shiftAtSeconds: timeline.length > 1 ? timeline[1].atSeconds : null,
    timeline,
  };
}

function getDurationSeconds(row) {
  const startTimeMs = Number(row.rawMetadata?.start_time_ms);
  const endTimeMs = Number(row.rawMetadata?.end_time_ms);

  if (Number.isFinite(startTimeMs) && Number.isFinite(endTimeMs)) {
    return Math.max(0, (endTimeMs - startTimeMs) / 1000);
  }

  return Number(row.transcriptJson?.kaggleTranscript?.whisper?.duration) || 0;
}

function formatDashboardCall(row, { includeDetail = false } = {}) {
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const customer = findParticipant(participants, "caller");
  const agent = findParticipant(participants, "agent");
  const analysis = row.aiSummary ?? {};
  const attention = analysis.needsManagerAttention ?? {};
  const normalizedAttention = normalizeManagerAttention(
    attention,
    analysis.resolution,
  );
  const score = clampScore(normalizedAttention.score);
  const startTimeMs = Number(row.rawMetadata?.start_time_ms);
  const mood = buildMood(getEmotionSegments(row.transcriptJson));

  const result = {
    id: row.id,
    callReference: row.rawMetadata?.sid ?? null,
    customer,
    agent,
    startedAt: Number.isFinite(startTimeMs)
      ? new Date(startTimeMs).toISOString()
      : row.createdAt,
    durationSeconds: getDurationSeconds(row),
    intent: analysis.intent ?? null,
    mood,
    resolution: analysis.resolution ?? null,
    summary: analysis.summary ?? null,
    attention: {
      needed: normalizedAttention.needed,
      score,
      priority: getPriority(score),
      reasons: Array.isArray(attention.reasons) ? attention.reasons : [],
    },
    recordingUrl: `/dashboard/calls/${row.id}/recording`,
  };

  if (includeDetail) {
    result.transcript = getTranscriptSegments(row.transcriptJson);
    result.metadata = row.rawMetadata ?? null;
    result.originalFilename = row.originalFilename;
  }

  return result;
}

router.get("/summary", async (_req, res) => {
  try {
    return res.json(await getDashboardSummary());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/calls", async (req, res) => {
  try {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    const attention = req.query.attention;
    const needsAttention =
      attention === undefined
        ? null
        : attention === "needed"
          ? true
          : attention === "not_needed"
            ? false
            : "invalid";
    if (needsAttention === "invalid") {
      throw new TypeError("attention must be needed or not_needed");
    }

    const resolution = req.query.resolution ?? null;
    const search = req.query.search ?? null;
    const { total, rows } = await listDashboardCalls({
      limit,
      offset,
      needsAttention,
      resolution,
      search,
    });

    return res.json({
      total,
      limit,
      offset,
      calls: rows.map((row) => formatDashboardCall(row)),
    });
  } catch (error) {
    const statusCode = error instanceof TypeError ? 400 : 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

router.get("/calls/:id", async (req, res) => {
  try {
    const row = await findDashboardCallById(req.params.id);

    if (!row) {
      return res.status(404).json({ error: "Call not found" });
    }

    return res.json(formatDashboardCall(row, { includeDetail: true }));
  } catch (error) {
    const statusCode = error instanceof TypeError ? 400 : 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

router.get("/calls/:id/recording", async (req, res) => {
  try {
    const row = await findDashboardCallById(req.params.id);

    if (!row) {
      return res.status(404).json({ error: "Call not found" });
    }

    if (!row.outputPath) {
      return res.status(404).json({ error: "Recording path not found" });
    }

    await fs.promises.access(row.outputPath, fs.constants.R_OK);
    res.type("audio/wav");
    return res.sendFile(row.outputPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ error: "Recording file not found" });
    }

    const statusCode = error instanceof TypeError ? 400 : 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

module.exports = router;
