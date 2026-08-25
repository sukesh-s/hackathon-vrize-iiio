const fs = require("node:fs");
const path = require("node:path");

function normalizeWhisperUrl(url) {
  let normalized = url.trim();

  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.replace(/\/transcribe\/transcribe$/i, "/transcribe");
}

async function transcribeWithKaggle({
  wavPath,
  whisperServerUrl,
  needDiarization = true,
}) {
  if (!whisperServerUrl || whisperServerUrl.trim().length === 0) {
    throw new Error("Missing whisperServerUrl for Kaggle transcription");
  }

  const normalizedWhisperServerUrl = normalizeWhisperUrl(whisperServerUrl);

  const form = new FormData();

  const fileBuffer = await fs.promises.readFile(wavPath);
  const fileName = path.basename(wavPath) || "audio.wav";

  form.append(
    "file",
    new Blob([fileBuffer], {
      type: "audio/wav",
    }),
    fileName,
  );

  form.append("needDiarization", needDiarization ? "true" : "false");

  const response = await fetch(normalizedWhisperServerUrl, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `Kaggle transcription API failed: ${response.status} ${body}`.trim(),
    );
  }

  const result = await response.json();

  return {
    whisper: result.whisper,
    pyannote: result.pyannote,
  };
}

module.exports = transcribeWithKaggle;
