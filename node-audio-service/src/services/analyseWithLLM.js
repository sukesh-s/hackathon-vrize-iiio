const MODEL_NAME = "onnx-community/emotion-english-distilroberta-base-ONNX";
const MINIMUM_CONFIDENCE = 0.6;
const CALL_ANALYSIS_SYSTEM_PROMPT = `
You analyze customer-service calls.

Return exactly one valid JSON object. Do not return Markdown or code fences.

Use only the supplied transcript segments and their sentiment analysis.
Never invent segment IDs, transcript text, timestamps, or evidence.
Use the smallest set of segments that directly supports each judgment.
Intent evidence should normally come from customer statements.
Resolution evidence must demonstrate the outcome, not merely the request.
If the evidence is insufficient, use "unknown" and an empty evidence list.

The manager-attention score MUST be an integer from 0 to 100, not a boolean
or a 0-to-1 probability. Calculate it using only evidenced conditions:
- Start at 0.
- Add 30 for an unresolved outcome, or 15 for a partially resolved outcome.
- Add 25 for evidenced fraud, security, legal, regulatory, or financial-loss risk.
- Add 20 for evidenced anger, escalation, abuse, threats, or severe distress.
- Add 15 when the customer explicitly says this is a repeated contact or recurring issue.
- Add 10 for an evidenced negative mood shift.
- Add 10 for evidenced agent error, misinformation, refusal, or failure to act.
- Cap the total at 100.

Score meaning:
- 0-19: no attention required
- 20-39: low concern; monitor
- 40-59: manager review recommended
- 60-79: high priority
- 80-100: critical

Set needsManagerAttention.needed to true if and only if score is 40 or more.
Every reason contributing points must cite one or more evidenceSegmentIds.

Return this structure:
{
  "intent": {
    "label": "string",
    "description": "string",
    "evidenceSegmentIds": []
  },
  "resolution": {
    "status": "resolved, partially_resolved, unresolved, or unknown",
    "description": "string",
    "evidenceSegmentIds": []
  },
  "summary": "string containing no more than 40 words",
  "needsManagerAttention": {
    "needed": false,
    "score": 0,
    "reasons": [
      {
        "reason": "string",
        "evidenceSegmentIds": []
      }
    ]
  }
}
`.trim();

let classifierPromise;

function getEmotionClassifier() {
  if (!classifierPromise) {
    classifierPromise = import("@huggingface/transformers").then(
      ({ pipeline }) =>
        pipeline("text-classification", MODEL_NAME, {
          dtype: "q8",
        }),
    );
  }

  return classifierPromise;
}

function normalizeLabel(label) {
  return String(label || "neutral").toLowerCase();
}

function mapEmotion(emotion) {
  const emotionMapping = {
    anger: "angry",
    disgust: "frustrated",
    fear: "anxious",
    joy: "satisfied",
    neutral: "neutral",
    sadness: "disappointed",
    surprise: "confused",
  };

  return emotionMapping[emotion] ?? "neutral";
}

function mapSentiment(emotion) {
  if (["anger", "disgust", "fear", "sadness"].includes(emotion)) {
    return "negative";
  }

  if (emotion === "joy") {
    return "positive";
  }

  return "neutral";
}

function getSegmentId(segment, index) {
  return segment.segmentId ?? segment.id ?? index;
}

function isIncompleteFragment(text) {
  const normalizedText = String(text || "").trim();
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const containsExplicitEmotion =
    /\b(angry|annoyed|anxious|appreciate|confused|disappointed|frustrated|glad|happy|hate|love|sad|satisfied|scared|thank|unhappy|upset|worried)\b/i.test(
      normalizedText,
    );

  return words.length < 4 && !containsExplicitEmotion;
}

async function analyzeTheTranscriptSegments(segments) {
  if (!Array.isArray(segments)) {
    throw new Error("segments must be an array");
  }

  if (segments.length === 0) {
    throw new Error("segments must not be empty");
  }

  const classifier = await getEmotionClassifier();
  const predictions = await classifier(
    segments.map((segment) => String(segment.text || "").trim() || " "),
    { top_k: 1 },
  );

  const segmentAnalysis = segments.map((segment, index) => {
    const text = String(segment.text || "").trim();
    const prediction = Array.isArray(predictions[index])
      ? predictions[index][0]
      : predictions[index];
    const modelEmotion = normalizeLabel(prediction?.label);
    const confidence = prediction?.score ?? 0;
    const insufficientEvidence =
      isIncompleteFragment(text) || confidence < MINIMUM_CONFIDENCE;

    return {
      segmentId: getSegmentId(segment, index),
      speakerRole: segment.speaker?.role ?? "unknown",
      sentiment: insufficientEvidence
        ? "neutral"
        : mapSentiment(modelEmotion),
      emotion: insufficientEvidence ? "neutral" : mapEmotion(modelEmotion),
      confidence,
      text,
      start: segment.start ?? null,
      end: segment.end ?? null,
    };
  });

  return {
    provider: "transformers.js",
    model: MODEL_NAME,
    segmentAnalysis,
  };
}

function parseCallAnalysisResponse(responseBody) {
  if (responseBody?.json && typeof responseBody.json === "object") {
    return responseBody.json;
  }

  if (typeof responseBody?.response === "string") {
    const cleanedResponse = responseBody.response
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    return JSON.parse(cleanedResponse);
  }

  throw new Error("Call analysis API did not return valid JSON");
}

function createEvidenceResolver(segments) {
  const segmentById = new Map(
    segments.map((segment, index) => [getSegmentId(segment, index), segment]),
  );

  return (evidenceSegmentIds) => {
    if (!Array.isArray(evidenceSegmentIds)) {
      return [];
    }

    return [...new Set(evidenceSegmentIds)]
      .filter((segmentId) => segmentById.has(segmentId))
      .map((segmentId) => {
        const segment = segmentById.get(segmentId);

        return {
          segmentId,
          start: segment.start ?? null,
          end: segment.end ?? null,
          text: String(segment.text || "").trim(),
          speakerRole:
            segment.speakerRole ?? segment.speaker?.role ?? "unknown",
        };
      });
  };
}

function normalizeManagerAttention(managerAttention, resolution = {}) {
  const modelNeeded = managerAttention?.needed === true;
  const numericScore = Number(managerAttention?.score);
  const roundedScore = Number.isFinite(numericScore)
    ? Math.round(numericScore)
    : null;
  const scoreIsBinary = roundedScore === 0 || roundedScore === 1;
  let score;

  if (roundedScore !== null && !scoreIsBinary) {
    score = Math.min(100, Math.max(0, roundedScore));
  } else if (!modelNeeded) {
    score = 0;
  } else {
    const fallbackByResolution = {
      unresolved: 60,
      partially_resolved: 45,
      resolved: 40,
      unknown: 40,
    };
    score = fallbackByResolution[resolution?.status] ?? 40;
  }

  return {
    needed: score >= 40,
    score,
  };
}

function enrichCallAnalysisEvidence(callAnalysis, segments) {
  const resolveEvidence = createEvidenceResolver(segments);
  const intent = callAnalysis?.intent ?? {};
  const resolution = callAnalysis?.resolution ?? {};
  const managerAttention = callAnalysis?.needsManagerAttention ?? {};
  const normalizedManagerAttention = normalizeManagerAttention(
    managerAttention,
    resolution,
  );
  const reasons = Array.isArray(managerAttention.reasons)
    ? managerAttention.reasons
    : [];
  const intentEvidence = resolveEvidence(intent.evidenceSegmentIds);
  const resolutionEvidence = resolveEvidence(resolution.evidenceSegmentIds);

  return {
    intent: {
      ...intent,
      evidenceSegmentIds: intentEvidence.map((item) => item.segmentId),
      evidence: intentEvidence,
    },
    resolution: {
      ...resolution,
      evidenceSegmentIds: resolutionEvidence.map((item) => item.segmentId),
      evidence: resolutionEvidence,
    },
    summary: String(callAnalysis?.summary || "").trim(),
    needsManagerAttention: {
      ...managerAttention,
      ...normalizedManagerAttention,
      reasons: reasons.map((reason) => {
        const evidence = resolveEvidence(reason.evidenceSegmentIds);

        return {
          ...reason,
          evidenceSegmentIds: evidence.map((item) => item.segmentId),
          evidence,
        };
      }),
    },
  };
}

async function analyzeCall(analysisResult) {
  if (!Array.isArray(analysisResult?.segmentAnalysis)) {
    throw new Error("analysisResult.segmentAnalysis must be an array");
  }

  if (analysisResult.segmentAnalysis.length === 0) {
    throw new Error("analysisResult.segmentAnalysis must not be empty");
  }

  const input = analysisResult.segmentAnalysis.map((segment, index) => {
    const segmentId = getSegmentId(segment, index);

    return {
      segmentId,
      speakerRole: segment.speakerRole ?? "unknown",
      text: String(segment.text || "").trim(),
      sentiment: segment.sentiment ?? "neutral",
      emotion: segment.emotion ?? "neutral",
    };
  });

  const serverUrl = process.env.WHISPER_SERVER_URL;

  if (!serverUrl) {
    throw new Error("WHISPER_SERVER_URL is missing");
  }

  const response = await fetch(new URL("/callAnalysis", serverUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemPrompt: CALL_ANALYSIS_SYSTEM_PROMPT,
      input,
      maxNewTokens: 600,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Call analysis API failed: ${response.status} ${responseText}`.trim(),
    );
  }

  let responseBody;

  try {
    responseBody = JSON.parse(responseText);
  } catch (_error) {
    throw new Error("Call analysis API returned an invalid response body");
  }

  const callAnalysis = parseCallAnalysisResponse(responseBody);

  return {
    provider: responseBody.provider ?? "qwen",
    model: responseBody.model ?? null,
    ...enrichCallAnalysisEvidence(
      callAnalysis,
      analysisResult.segmentAnalysis,
    ),
  };
}

module.exports = {
  analyzeTheTranscriptSegments,
  analyzeCall,
  normalizeManagerAttention,
};
