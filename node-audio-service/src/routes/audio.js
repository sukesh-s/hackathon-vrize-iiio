const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const multer = require("multer");
const { runRustProcessor } = require("../services/rustProcessor");
const kaggleService = require("../services/kaggleService");
const {
  calculateSha256,
  isWavFile,
  getMimeType,
  getFileType,
} = require("../services/audioService");
const {
  findBySignature,
  findIfTranscriptionExists,
  findTranscriptionByProcessedAudioId,
  saveCallMetadata,
  upsertAudioTranscription,
} = require("../services/dbService");
const { upsertProcessedAudio } = require("../services/dbService");
const {
  combineWhisperAndDiarization,
} = require("../services/diarizationService");
const {
  analyzeTheTranscriptSegments,
  analyzeCall,
} = require("../services/analyseWithLLM");
const {
  createSpeakerMap,
  extractParticipants,
  parseCallMetadata,
} = require("../services/callMetadataService");

const router = express.Router();

const uploadsDir = path.resolve(__dirname, "../../tmp/uploads");
const outputsDir = path.resolve(__dirname, "../../tmp/outputs");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 10 ? ext : ".bin";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const acceptedUpload = upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "file", maxCount: 1 },
  { name: "metadata", maxCount: 1 },
]);

function uploadMiddleware(req, res, next) {
  acceptedUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({
        error:
          "Invalid upload field. Use 'audio' (or 'file') for audio and 'metadata' for JSON.",
      });
      return;
    }

    next(error);
  });
}

function getUploadedFile(req) {
  return req.files?.audio?.[0] || req.files?.file?.[0] || null;
}

function getMetadataFile(req) {
  const metadataFile = req.files?.metadata?.[0] || null;

  if (
    metadataFile &&
    path.extname(metadataFile.originalname).toLowerCase() !== ".json"
  ) {
    throw new TypeError("metadata file must be a .json file");
  }

  return metadataFile;
}

router.post("/transcribe", uploadMiddleware, async (req, res) => {
  const uploadedFile = getUploadedFile(req);
  const metadataFile = req.files?.metadata?.[0] || null;

  if (!uploadedFile) {
    return res.status(400).json({
      error: "Missing uploaded file in field audio or file",
    });
  }

  const inputPath = uploadedFile.path;
  const outputPath = path.join(
    outputsDir,
    `${path.parse(uploadedFile.filename).name}-processed.wav`,
  );

  try {
    getMetadataFile(req);
    const metadataInput = metadataFile
      ? await fs.promises.readFile(metadataFile.path, "utf8")
      : req.body?.metadata;
    const callMetadata = parseCallMetadata(metadataInput);
    const speakerMap = callMetadata ? createSpeakerMap(callMetadata) : {};
    const inputSignature = await calculateSha256(inputPath);
    const inputFileType = await getFileType(inputPath);

    if (!inputFileType) {
      return res.status(400).json({
        error: "Unable to detect the uploaded audio format",
      });
    }

    const isWav = await isWavFile(inputPath);
    const existingInputRecord = await findBySignature(inputSignature);
    let savedRecord = existingInputRecord;
    let transcribeInputFilePath = null;
    let needToTranscribeAgain = false;
    const whisperServerUrl = `${process.env.WHISPER_SERVER_URL}/transcribe`;
    let kaggleTranscript = null;

    if (!existingInputRecord) {
      if (isWav) {
        await fs.promises.copyFile(inputPath, outputPath);
      } else {
        await runRustProcessor({ inputPath, outputPath });
      }

      const outputSignature = await calculateSha256(outputPath);

      savedRecord = await upsertProcessedAudio({
        inputSignature,
        outputSignature,
        originalFilename: uploadedFile.originalname,
        inputMimeType: await getMimeType(inputPath),
        outputMimeType: await getMimeType(outputPath),
        inputFormat: inputFileType.ext,
        inputPath,
        outputPath,
        wasConverted: !isWav,
      });

      transcribeInputFilePath = outputPath;
      needToTranscribeAgain = true;
    } else {
      const transcriptionExists = await findIfTranscriptionExists(
        existingInputRecord.id,
      );

      needToTranscribeAgain = !transcriptionExists;

      if (transcriptionExists) {
        const existingTranscription = await findTranscriptionByProcessedAudioId(
          existingInputRecord.id,
        );
        kaggleTranscript = existingTranscription?.transcriptJson || null;
      }

      if (needToTranscribeAgain) {
        transcribeInputFilePath = existingInputRecord.outputPath;

        try {
          await fs.promises.access(transcribeInputFilePath, fs.constants.R_OK);
        } catch (_error) {
          if (isWav) {
            await fs.promises.copyFile(inputPath, outputPath);
          } else {
            await runRustProcessor({ inputPath, outputPath });
          }

          const outputSignature = await calculateSha256(outputPath);

          savedRecord = await upsertProcessedAudio({
            id: existingInputRecord.id,
            outputSignature,
            outputMimeType: await getMimeType(outputPath),
            outputPath,
            wasConverted: !isWav,
          });

          transcribeInputFilePath = outputPath;
        }
      }
    }

    let savedCallMetadata = null;

    if (callMetadata) {
      savedCallMetadata = await saveCallMetadata({
        processedAudioId: savedRecord.id,
        participants: extractParticipants(callMetadata),
        rawMetadata: callMetadata,
      });
    }

    if (needToTranscribeAgain) {
      if (!transcribeInputFilePath) {
        throw new Error("Missing file path for transcription");
      }

      kaggleTranscript = await kaggleService({
        wavPath: transcribeInputFilePath,
        whisperServerUrl: whisperServerUrl,
      });

      const diarizationInfo = await combineWhisperAndDiarization(
        kaggleTranscript,
        speakerMap,
      );
      const analysisResult = await analyzeTheTranscriptSegments(
        diarizationInfo.segments || [],
      );
      const llmAnalysisResult = await analyzeCall(analysisResult || []);

      await upsertAudioTranscription({
        processedAudioId: savedRecord.id,
        transcriptJson: { kaggleTranscript, diarizationInfo, analysisResult },
        aiSummary: llmAnalysisResult,
      });

      return res.json({
        kaggleTranscript,
        diarizationInfo,
        analysisResult,
        llmAnalysisResult,
        speakerMap,
        callMetadata: savedCallMetadata,
      });
    }
    return res.json({
      kaggleTranscript,
      record: savedRecord,
      transcribeInputFilePath,
      needToTranscribeAgain,
      isExists: existingInputRecord !== null,
      speakerMap,
      callMetadata: savedCallMetadata,
    });
  } catch (error) {
    console.error("Audio transcription failed:", error);
    const statusCode = error instanceof TypeError ? 400 : 500;
    return res.status(statusCode).json({ error: error.message });
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    if (metadataFile) {
      await fs.promises.unlink(metadataFile.path).catch(() => {});
    }
  }
});

module.exports = router;
