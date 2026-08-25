function calculateOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return Math.max(
    0,
    Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart),
  );
}

function findSpeaker({ start, end, diarization, speakerMap }) {
  let bestMatch = null;
  let greatestOverlap = 0;

  for (const speakerTurn of diarization) {
    const overlap = calculateOverlap(
      start,
      end,
      speakerTurn.start,
      speakerTurn.end,
    );

    if (overlap > greatestOverlap) {
      greatestOverlap = overlap;
      bestMatch = speakerTurn;
    }
  }

  if (!bestMatch) {
    return {
      label: "UNKNOWN",
      role: "unknown",
      name: null,
      speakerId: null,
      confidence: 0,
    };
  }

  const participant = speakerMap[bestMatch.speaker] ?? {};

  const duration = Math.max(end - start, 0.001);

  return {
    label: bestMatch.speaker,
    role: participant.role ?? "unknown",
    name: participant.name ?? null,
    speakerId: participant.speakerId ?? null,
    confidence: Math.min(1, greatestOverlap / duration),
  };
}

async function combineWhisperAndDiarization(response, speakerMap = {}) {
  const kaggleTranscript = response?.kaggleTranscript ?? response;

  const whisper = kaggleTranscript?.whisper;
  const pyannote = kaggleTranscript?.pyannote;

  if (!whisper || !Array.isArray(whisper.segments)) {
    throw new Error("Missing whisper segments in Kaggle response");
  }

  const diarization =
    pyannote?.exclusive_diarization ?? pyannote?.diarization ?? [];

  const labeledWords = [];

  for (const whisperSegment of whisper.segments) {
    const words = Array.isArray(whisperSegment.words)
      ? whisperSegment.words
      : [];

    if (words.length === 0) {
      labeledWords.push({
        word: whisperSegment.text,
        start: whisperSegment.start,
        end: whisperSegment.end,
        probability: null,
        whisperSegmentId: whisperSegment.id,
        speaker: findSpeaker({
          start: whisperSegment.start,
          end: whisperSegment.end,
          diarization,
          speakerMap,
        }),
      });

      continue;
    }

    for (const word of words) {
      labeledWords.push({
        word: word.word,
        start: word.start,
        end: word.end,
        probability: word.probability,
        whisperSegmentId: whisperSegment.id,
        speaker: findSpeaker({
          start: word.start,
          end: word.end,
          diarization,
          speakerMap,
        }),
      });
    }
  }

  labeledWords.sort((first, second) => first.start - second.start);

  const combinedSegments = [];

  for (const labeledWord of labeledWords) {
    const previousSegment = combinedSegments[combinedSegments.length - 1];

    const sameSpeaker =
      previousSegment &&
      previousSegment.speaker.label === labeledWord.speaker.label;

    const gap = previousSegment ? labeledWord.start - previousSegment.end : 0;

    const canMerge = sameSpeaker && gap <= 1.5;

    if (canMerge) {
      previousSegment.end = Math.max(previousSegment.end, labeledWord.end);

      previousSegment.text += labeledWord.word;

      previousSegment.words.push({
        word: labeledWord.word,
        start: labeledWord.start,
        end: labeledWord.end,
        probability: labeledWord.probability,
      });

      if (
        !previousSegment.whisperSegmentIds.includes(
          labeledWord.whisperSegmentId,
        )
      ) {
        previousSegment.whisperSegmentIds.push(labeledWord.whisperSegmentId);
      }

      continue;
    }

    combinedSegments.push({
      id: combinedSegments.length,
      start: labeledWord.start,
      end: labeledWord.end,
      text: labeledWord.word,
      speaker: labeledWord.speaker,
      whisperSegmentIds: [labeledWord.whisperSegmentId],
      words: [
        {
          word: labeledWord.word,
          start: labeledWord.start,
          end: labeledWord.end,
          probability: labeledWord.probability,
        },
      ],
    });
  }

  for (const segment of combinedSegments) {
    segment.text = segment.text.trim();

    const confidenceValues = segment.words
      .map((word) => word.probability)
      .filter(Number.isFinite);

    segment.transcriptionConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
        : null;
  }

  return {
    provider: {
      transcription: whisper.provider,
      diarization: pyannote?.provider ?? null,
    },
    models: {
      transcription: whisper.model,
      diarization: pyannote?.model ?? null,
    },
    language: whisper.language,
    languageProbability: whisper.language_probability,
    duration: whisper.duration,
    durationAfterVad: whisper.duration_after_vad,
    diarizationPerformed: pyannote?.performed === true,
    segments: combinedSegments,
  };
}

module.exports = {
  calculateOverlap,
  findSpeaker,
  combineWhisperAndDiarization,
};
