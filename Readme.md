# Call Intelligence

Call Intelligence turns customer-service recordings into searchable, evidence-backed call analysis. A user uploads one audio recording together with its metadata JSON file. The system prepares the audio, transcribes it, identifies speakers, analyses emotion and call outcomes, stores the results in PostgreSQL, and displays prioritised calls in a React dashboard.

## Table of contents

- [What the system produces](#what-the-system-produces)
- [Architecture](#architecture)
- [Why this technology stack?](#why-this-technology-stack)
- [Audio processing](#audio-processing)
- [Open-source AI models](#open-source-ai-models)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
  - [1. Start PostgreSQL and restore the database](#1-start-postgresql-and-restore-the-database)
  - [2. Build the Rust audio processor](#2-build-the-rust-audio-processor)
  - [3. Start the Kaggle model service](#3-start-the-kaggle-model-service)
  - [4. Configure and start the Node.js API](#4-configure-and-start-the-nodejs-api)
  - [5. Start the React dashboard](#5-start-the-react-dashboard)
- [Uploading a call](#uploading-a-call)
- [Main API endpoints](#main-api-endpoints)
- [Data storage](#data-storage)
- [Processing and deduplication flow](#processing-and-deduplication-flow)
- [Notes for production](#notes-for-production)

## What the system produces

For each call, the application provides:

- A speaker-labelled transcript with timings
- Customer intent
- Segment-level sentiment and emotion
- Initial and final mood, including the point where the mood changed
- Resolution status
- A summary of no more than 40 words
- A manager-attention decision and score from 0–100
- Transcript evidence supporting each judgment
- A playable, processed recording

The SHA-256 signature of each uploaded file is checked before expensive processing. Previously processed audio and analysis are reused instead of transcribing the same input on every request.

## Architecture

```text
Audio + metadata JSON
        │
        ▼
Node.js API ─────── PostgreSQL
        │          audio, metadata, transcript and analysis records
        ├── Rust executable ── FFmpeg ── mono 16 kHz PCM WAV
        │
        └── Kaggle FastAPI service
              ├── faster-whisper
              ├── pyannote diarization
              └── Qwen call analysis

React + Vite dashboard ── Node.js dashboard API
```

The repository contains three applications:

| Directory | Responsibility |
| --- | --- |
| `audio-processor-rust` | Invokes FFmpeg and produces a consistent Whisper-ready WAV file |
| `node-audio-service` | Upload API, orchestration, SHA-256 deduplication, PostgreSQL access and dashboard API |
| `dashboard-react` | Call dashboard, upload experience, filtering, KPIs, recording and evidence views |

## Why this technology stack?

### Rust

Rust is used for the audio-processing executable because it provides predictable performance, memory safety, and a strong foundation for future native audio work. It is also a deliberate learning choice: I have been learning Rust and wanted to apply it to a real processing pipeline.

The current implementation keeps audio conversion focused and reliable by invoking the installed FFmpeg executable from Rust. Rust validates the input and output paths, runs the conversion, and reports failures back to Node.js.

### Node.js

Node.js is the orchestration and API layer. It was a natural choice because my primary background is JavaScript. It handles multipart uploads, file signatures, calls to the Rust and Kaggle services, response normalization, analysis, and PostgreSQL persistence.

### React and Vite

React provides the dashboard UI and Vite supplies the development and build tooling. The dashboard uses Axios to communicate with the Node.js API.

## Audio processing

FFmpeg converts supported input audio into a standard format suitable for transcription:

```text
MP3/WAV/other supported audio
        ↓
Remove video streams
        ↓
Mix down to one channel (mono)
        ↓
Resample to 16,000 Hz
        ↓
Encode as signed 16-bit PCM
        ↓
Apply EBU R128 loudness normalization
        ↓
WAV output
```

The effective FFmpeg settings are:

```text
-ac 1
-ar 16000
-c:a pcm_s16le
-af loudnorm=I=-16:TP=-1.5:LRA=11
```

If the uploaded audio is already WAV, the Node.js service can copy it into the managed output location. Otherwise, it calls the Rust converter.

## Open-source AI models

The project uses open-source models only:

| Model | Purpose | Runtime |
| --- | --- | --- |
| `small.en` through `faster-whisper` | English transcription with segment and word timings | Kaggle |
| `pyannote/speaker-diarization-community-1` | Speaker diarization | Kaggle |
| `onnx-community/emotion-english-distilroberta-base-ONNX` | Segment-level emotion classification | Node.js through Transformers.js |
| `Qwen/Qwen2.5-1.5B-Instruct` | Intent, resolution, summary and manager-attention JSON | Kaggle |

The Kaggle service runs with two NVIDIA T4 GPUs and exposes a FastAPI server through a temporary Cloudflare Tunnel URL. The tunnel URL changes when the Kaggle session restarts.

Pyannote Community-1 requires accepting its Hugging Face model conditions and supplying a Hugging Face access token to Kaggle. The models are open source, but Hugging Face authentication is still required to download gated Pyannote model files.

## Prerequisites

Install or prepare:

- Node.js 20 or newer
- Rust and Cargo
- FFmpeg available on `PATH`
- Docker Desktop or Docker Engine with Compose
- A Kaggle account with GPU access
- A Hugging Face account and token for Pyannote Community-1

Verify the local tools:

```bash
node --version
npm --version
cargo --version
ffmpeg -version
docker compose version
```

## Local setup

### 1. Start PostgreSQL and restore the database

```bash
cd node-audio-service
docker compose up -d postgres
docker compose ps
```

Restore the included PostgreSQL backup. It contains the database schema and the call data prepared for this project:

```bash
docker exec -i postgres \
  pg_restore \
  -U appuser \
  -d appdb \
  --clean \
  --if-exists \
  --no-owner \
  < call_radar_db.dump
```

The restore command replaces existing project tables when they are present. To create an empty database without the included call data, initialise only the schema instead:

```bash
docker exec -i postgres \
  psql -U appuser -d appdb < db/processed_audio.sql
```

The local connection string defined by the included Compose configuration is:

```text
postgresql://appuser:nodeAudioServicePass@localhost:5432/appdb
```

### 2. Build the Rust audio processor

FFmpeg must already be installed and available from the terminal.

```bash
cd ../audio-processor-rust
cargo build
```

The Node service uses this debug binary by default:

```text
audio-processor-rust/target/debug/audio-processor-rust
```

For a production-style binary, run `cargo build --release` and set `RUST_BINARY_PATH` to the resulting executable.

You can test conversion directly:

```bash
cargo run -- ../test.mp3 ./test-processed.wav
```

### 3. Start the Kaggle model service

1. Open the Kaggle notebook containing the FastAPI model service.
2. Enable internet access for the notebook.
3. Select the **GPU T4 x2** accelerator.
4. Add the Hugging Face token to Kaggle Secrets using the name expected by the notebook, for example `HF_TOKEN`.
5. Run the notebook cells that install dependencies, load the models, start Uvicorn, and create the Cloudflare Tunnel.
6. Copy the generated `https://<random-name>.trycloudflare.com` base URL.

Do not append `/transcribe` or `/callAnalysis` when saving the environment variable. The Node.js service adds the endpoint paths itself.

Kaggle sessions and free Cloudflare tunnels are temporary. If either session stops, restart the notebook and update the Node.js environment with the new URL.

### 4. Configure and start the Node.js API

Create `node-audio-service/.env`:

```dotenv
PORT=8894
DATABASE_URL=postgresql://appuser:nodeAudioServicePass@localhost:5432/appdb
WHISPER_SERVER_URL=https://your-current-tunnel.trycloudflare.com
RUST_PROCESS_TIMEOUT_MS=600000

# Optional: only needed when the binary is not in the default debug location
# RUST_BINARY_PATH=/absolute/path/to/audio-processor-rust/target/release/audio-processor-rust
```

Install dependencies and start the API:

```bash
cd ../node-audio-service
npm install
npm run dev
```

The API runs at `http://localhost:8894`. Check it with:

```bash
curl http://localhost:8894/health
```

### 5. Start the React dashboard

In another terminal:

```bash
cd ../dashboard-react
npm install
npm run dev
```

The Vite development server proxies `/audio` and `/dashboard` requests to `http://127.0.0.1:8894` by default. To use a different Node.js address, set `VITE_API_PROXY_TARGET` before starting Vite.

## Uploading a call

The dashboard accepts exactly two files per request:

1. One audio recording
2. One metadata `.json` file

The metadata should describe the same call and contain the agent and caller information used to map diarization labels to participant roles.

Processing can take more than three minutes. The upload modal can be minimized while processing continues. The status indicator beside the upload button reopens the progress view and changes to a check mark when processing completes.

The upload endpoint can also be called directly:

```bash
curl -X POST http://localhost:8894/audio/transcribe \
  -F "audio=@/absolute/path/to/recording.mp3" \
  -F "metadata=@/absolute/path/to/metadata.json"
```

## Main API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Node.js service health check |
| `POST` | `/audio/transcribe` | Upload and process one audio/metadata pair |
| `GET` | `/dashboard/calls` | List prioritised dashboard calls |
| `GET` | `/dashboard/calls/:id` | Get a call with transcript and metadata |
| `GET` | `/dashboard/calls/:id/recording` | Stream the processed WAV recording |

## Data storage

PostgreSQL is the source of truth. The schema includes:

- `processed_audio` — signatures, formats, paths and conversion state
- `audio_transcriptions` — transcript JSON and final AI analysis
- `users` — agent and caller identities and roles
- `call_metadata` — the original metadata and participant speaker IDs

Transcript and analysis objects are stored as PostgreSQL `JSONB`; they do not need to be manually serialized before insertion through the Node.js PostgreSQL client.

## Processing and deduplication flow

1. Accept one audio file and one paired metadata JSON file.
2. Calculate the input audio SHA-256 signature.
3. Look for an existing `processed_audio` record.
4. Detect whether the uploaded audio is WAV.
5. Copy an existing WAV or convert other formats through Rust and FFmpeg.
6. Calculate and store the output WAV SHA-256 signature.
7. Store call metadata and participants.
8. Reuse an existing transcription when available.
9. Otherwise call Whisper and, when requested, Pyannote diarization.
10. Run segment emotion classification and Qwen call analysis.
11. Save the transcript and analysis and return the completed result.

Changing a filename does not change its SHA-256 signature. However, an original MP3 and its converted WAV contain different bytes, so the input and output signatures are stored separately.

## Notes for production

The current Kaggle and free Cloudflare setup is suitable for development and demonstrations, not a permanent production endpoint. A production deployment should use a stable model-serving platform, authentication, HTTPS, durable recording storage, background jobs, retries, and a job-status API. PostgreSQL is sufficient at the current scale; add a cache such as Redis only after measurements show repeated dashboard queries are a bottleneck.
