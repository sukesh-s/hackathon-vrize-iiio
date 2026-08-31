#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const DEFAULT_API_URL = "http://127.0.0.1:8894/audio/transcribe";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_CHECKPOINT = path.resolve(
  __dirname,
  "../batch-transcribe-progress.json",
);
const DEFAULT_LOG_FILE = path.resolve(__dirname, "../batch-transcribe.log");

function parseCallNumber(value, optionName) {
  if (value === undefined) {
    throw new Error(`${optionName} requires a value`);
  }

  const match = String(value).match(/^(?:call_)?(\d+)$/i);
  const number = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${optionName} must be a positive number or call_<number>`);
  }
  return number;
}

function getCallNumber(callId) {
  const match = callId.match(/^call_(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function createLogger(logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  return (level, message) => {
    const line = `[${new Date().toISOString()}] [${level}] ${message}`;
    fs.appendFileSync(logPath, `${line}\n`, "utf8");
    const output = level === "ERROR" ? console.error : console.log;
    output(message);
  };
}

function printUsage() {
  console.log(`Usage:
  node scripts/batch-transcribe.js [combined-folder] [options]

Source folder:
  Pass <combined-folder>, or set SOURCE_FOLDER_PATH in .env.
  A positional path takes precedence over SOURCE_FOLDER_PATH.

Options:
  --api-url <url>       Transcription endpoint (default: ${DEFAULT_API_URL})
  --checkpoint <path>   Progress file (default: ${DEFAULT_CHECKPOINT})
  --log-file <path>     Persistent log file (default: ${DEFAULT_LOG_FILE})
  --start <number>      First folder, inclusive (example: 50 or call_50)
  --end <number>        Last folder, inclusive (example: 80 or call_80)
  --timeout-ms <number> Request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --limit <number>      Process at most this many pending calls
  --validate-only       Validate folders without calling the API
  --help                Show this help

Expected folder structure:
  combined/call_<number>/<original-call-id>.mp3
  combined/call_<number>/<original-call-id>.json`);
}

function parseArgs(argv) {
  const options = {
    rootDir: process.env.SOURCE_FOLDER_PATH
      ? path.resolve(process.env.SOURCE_FOLDER_PATH)
      : null,
    apiUrl: DEFAULT_API_URL,
    checkpointPath: DEFAULT_CHECKPOINT,
    logPath: DEFAULT_LOG_FILE,
    start: null,
    end: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    limit: Infinity,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (arg === "--validate-only") {
      options.validateOnly = true;
    } else if (arg === "--api-url") {
      options.apiUrl = argv[++index];
    } else if (arg === "--checkpoint") {
      options.checkpointPath = path.resolve(argv[++index]);
    } else if (arg === "--log-file") {
      options.logPath = path.resolve(argv[++index]);
    } else if (arg === "--start") {
      options.start = parseCallNumber(argv[++index], "--start");
    } else if (arg === "--end") {
      options.end = parseCallNumber(argv[++index], "--end");
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[++index]);
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index]);
    } else if (!arg.startsWith("-") && !options.positionalRootDir) {
      options.rootDir = path.resolve(arg);
      options.positionalRootDir = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!options.rootDir) {
    throw new Error(
      "Missing combined-folder path. Pass it as an argument or set SOURCE_FOLDER_PATH in .env",
    );
  }
  if (!options.apiUrl) {
    throw new Error("--api-url must not be empty");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive integer");
  }
  if (
    options.limit !== Infinity &&
    (!Number.isInteger(options.limit) || options.limit <= 0)
  ) {
    throw new Error("--limit must be a positive integer");
  }
  if (options.start !== null && options.end !== null && options.start > options.end) {
    throw new Error("--start must be less than or equal to --end");
  }

  return options;
}

async function discoverAndValidate(rootDir, start, end) {
  const rootStat = await fsp.stat(rootDir).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Combined folder does not exist or is not a directory: ${rootDir}`);
  }

  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  const invalidFolderNames = entries
    .filter((entry) => entry.isDirectory() && getCallNumber(entry.name) === null)
    .map((entry) => entry.name);
  if (invalidFolderNames.length > 0) {
    throw new Error(
      `Invalid call folder name(s): ${invalidFolderNames.join(", ")}. Expected call_<number>.`,
    );
  }

  const allDirectories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => getCallNumber(left.name) - getCallNumber(right.name));

  const directories = allDirectories.filter((entry) => {
    const callNumber = getCallNumber(entry.name);
    return (start === null || callNumber >= start) && (end === null || callNumber <= end);
  });

  if (directories.length === 0) {
    const range = `${start ?? "first"}–${end ?? "last"}`;
    throw new Error(`No call folders found for range ${range} in: ${rootDir}`);
  }

  if (start !== null && getCallNumber(directories[0].name) !== start) {
    throw new Error(`Start folder call_${start} was not found`);
  }
  if (end !== null && getCallNumber(directories[directories.length - 1].name) !== end) {
    throw new Error(`End folder call_${end} was not found`);
  }

  for (let index = 1; index < directories.length; index += 1) {
    const previous = getCallNumber(directories[index - 1].name);
    const current = getCallNumber(directories[index].name);
    if (current !== previous + 1) {
      throw new Error(`Missing call folder(s) between call_${previous} and call_${current}`);
    }
  }

  const calls = [];
  const errors = [];

  for (const directory of directories) {
    const callId = directory.name;
    const callDir = path.join(rootDir, callId);
    const files = (await fsp.readdir(callDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    const audioFiles = files.filter(
      (fileName) => path.extname(fileName).toLowerCase() === ".mp3",
    );
    const metadataFiles = files.filter(
      (fileName) => path.extname(fileName).toLowerCase() === ".json",
    );

    if (audioFiles.length !== 1) {
      errors.push(`${callId}: expected exactly one .mp3 file, found ${audioFiles.length}`);
    }
    if (metadataFiles.length !== 1) {
      errors.push(`${callId}: expected exactly one .json file, found ${metadataFiles.length}`);
    }

    if (audioFiles.length !== 1 || metadataFiles.length !== 1) {
      continue;
    }

    const audioBaseName = path.parse(audioFiles[0]).name;
    const metadataBaseName = path.parse(metadataFiles[0]).name;
    if (audioBaseName !== metadataBaseName) {
      errors.push(
        `${callId}: MP3 and JSON basenames do not match (${audioFiles[0]} vs ${metadataFiles[0]})`,
      );
      continue;
    }

    const audioPath = path.join(callDir, audioFiles[0]);
    const metadataPath = path.join(callDir, metadataFiles[0]);

    try {
      await fsp.access(audioPath, fs.constants.R_OK);
    } catch (error) {
      errors.push(`${callId}: audio file is not readable (${error.message})`);
    }

    try {
      await fsp.access(metadataPath, fs.constants.R_OK);
    } catch (error) {
      errors.push(`${callId}: metadata file is not readable (${error.message})`);
    }

    try {
      JSON.parse(await fsp.readFile(metadataPath, "utf8"));
    } catch (error) {
      errors.push(`${callId}: invalid JSON (${error.message})`);
    }

    if (!errors.some((error) => error.startsWith(`${callId}:`))) {
      try {
        calls.push({
          callId,
          sourceCallId: audioBaseName,
          audioPath,
          metadataPath,
        });
      } catch (error) {
        errors.push(`${callId}: unable to prepare call (${error.message})`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n- ${errors.join("\n- ")}`);
  }

  return calls;
}

async function loadCheckpoint(checkpointPath) {
  try {
    const checkpoint = JSON.parse(await fsp.readFile(checkpointPath, "utf8"));
    return {
      version: 1,
      completed: checkpoint.completed || {},
      lastFailure: checkpoint.lastFailure || null,
      updatedAt: checkpoint.updatedAt || null,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { version: 1, completed: {}, lastFailure: null, updatedAt: null };
    }
    throw new Error(`Cannot read checkpoint ${checkpointPath}: ${error.message}`);
  }
}

async function saveCheckpoint(checkpointPath, checkpoint) {
  const directory = path.dirname(checkpointPath);
  const temporaryPath = `${checkpointPath}.${process.pid}.tmp`;
  await fsp.mkdir(directory, { recursive: true });
  await fsp.writeFile(
    temporaryPath,
    `${JSON.stringify({ ...checkpoint, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  await fsp.rename(temporaryPath, checkpointPath);
}

function buildMultipartParts(boundary, call) {
  const audioHeader = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="audio"; filename="${call.sourceCallId}.mp3"\r\n` +
      "Content-Type: audio/mpeg\r\n\r\n",
  );
  const metadataHeader = Buffer.from(
    `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="metadata"; filename="${call.sourceCallId}.json"\r\n` +
      "Content-Type: application/json\r\n\r\n",
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { audioHeader, metadataHeader, footer };
}

function pipeFile(filePath, request) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(request, { end: false });
  });
}

async function transcribeCall(call, apiUrl, timeoutMs) {
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported API protocol: ${url.protocol}`);
  }

  const boundary = `call-radar-${randomBytes(16).toString("hex")}`;
  const { audioHeader, metadataHeader, footer } = buildMultipartParts(
    boundary,
    call,
  );
  const [audioStat, metadataStat] = await Promise.all([
    fsp.stat(call.audioPath),
    fsp.stat(call.metadataPath),
  ]);
  const contentLength =
    audioHeader.length +
    audioStat.size +
    metadataHeader.length +
    metadataStat.size +
    footer.length;
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": contentLength,
          Accept: "application/json",
        },
      },
      (response) => {
        const chunks = [];
        let responseSize = 0;
        const maxResponseSize = 50 * 1024 * 1024;

        response.on("data", (chunk) => {
          responseSize += chunk.length;
          if (responseSize > maxResponseSize) {
            request.destroy(new Error("API response exceeded 50 MB"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body = null;
          try {
            body = text ? JSON.parse(text) : null;
          } catch (_error) {
            body = text;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const detail =
              body && typeof body === "object" && body.error
                ? body.error
                : text.slice(0, 500) || "Empty response";
            reject(new Error(`HTTP ${response.statusCode}: ${detail}`));
            return;
          }

          if (body && typeof body === "object" && body.error) {
            reject(new Error(`API error: ${body.error}`));
            return;
          }

          resolve(body);
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs} ms`));
    });
    request.on("error", reject);

    (async () => {
      request.write(audioHeader);
      await pipeFile(call.audioPath, request);
      request.write(metadataHeader);
      await pipeFile(call.metadataPath, request);
      request.end(footer);
    })().catch((error) => request.destroy(error));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const log = createLogger(options.logPath);
  log("INFO", "========== Batch run started ==========");
  log("INFO", `Validating: ${options.rootDir}`);
  const calls = await discoverAndValidate(options.rootDir, options.start, options.end);
  log(
    "INFO",
    `Validation passed: ${calls.length} call folder(s), call_${getCallNumber(calls[0].callId)} through call_${getCallNumber(calls[calls.length - 1].callId)}`,
  );

  if (options.validateOnly) {
    log("INFO", "Validation-only run completed; no API requests were sent.");
    return;
  }

  const checkpoint = await loadCheckpoint(options.checkpointPath);
  const pendingCalls = calls
    .filter((call) => !checkpoint.completed[call.callId])
    .slice(0, options.limit);

  const alreadyCompleted = calls.filter(
    (call) => checkpoint.completed[call.callId],
  ).length;
  log("INFO", `Already completed in selected range: ${alreadyCompleted}`);
  log("INFO", `Pending in selected range: ${calls.length - alreadyCompleted}`);
  log("INFO", `Processing in this run: ${pendingCalls.length}`);
  log("INFO", `API: ${options.apiUrl}`);

  for (let index = 0; index < pendingCalls.length; index += 1) {
    const call = pendingCalls[index];
    const overallIndex = calls.findIndex((item) => item.callId === call.callId) + 1;
    const startedAt = Date.now();
    log(
      "INFO",
      `[${overallIndex}/${calls.length}] ${call.callId} (${call.sourceCallId}) — API request started`,
    );

    try {
      const response = await transcribeCall(
        call,
        options.apiUrl,
        options.timeoutMs,
      );
      checkpoint.completed[call.callId] = {
        completedAt: new Date().toISOString(),
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        processedAudioId:
          response?.callMetadata?.processedAudioId || response?.record?.id || null,
      };
      checkpoint.lastFailure = null;
      await saveCheckpoint(options.checkpointPath, checkpoint);
      log(
        "INFO",
        `[${overallIndex}/${calls.length}] ${call.callId} — completed in ${checkpoint.completed[call.callId].durationSeconds}s`,
      );
    } catch (error) {
      checkpoint.lastFailure = {
        callId: call.callId,
        failedAt: new Date().toISOString(),
        error: error.message,
      };
      await saveCheckpoint(options.checkpointPath, checkpoint);
      const completedInRange = calls.filter(
        (item) => checkpoint.completed[item.callId],
      ).length;
      log("ERROR", `[${overallIndex}/${calls.length}] ${call.callId} — API FAILED: ${error.message}`);
      log(
        "ERROR",
        `Batch stopped on ${call.callId}. Completed in selected range: ${completedInRange}/${calls.length}. No later calls were submitted.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const completedInRange = calls.filter(
    (call) => checkpoint.completed[call.callId],
  ).length;
  log(
    "INFO",
    `Batch finished successfully. Completed in selected range: ${completedInRange}/${calls.length}.`,
  );
}

main().catch((error) => {
  console.error(`Batch could not start: ${error.message}`);
  process.exitCode = 1;
});
